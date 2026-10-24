// supabase/functions/assess-return/index.ts
// POST { rental_id }. Runs Damage → Estimate → Router → Order and writes every result.
// Runs with the service role; agents never write to the database, this function does after validation.
import { z } from 'zod';

import { check, need, RequestError, serve, setStatus } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import type { OrderContext } from '../_shared/orderAgent.ts';
import { raiseOrder, writeBill } from '../_shared/outcome.ts';
import { route, routeConfigFrom } from '../_shared/router.ts';
import type { Path, RouteReason } from '../_shared/router.ts';
import { PHOTO_ANGLES } from '../_shared/schemas.ts';
import type { DamageItem } from '../_shared/schemas.ts';
import { runDamageAgent } from './damage.ts';
import type { Angle, PhotoSet } from './damage.ts';
import { numberDamage, priceLines, runEstimateAgent } from './estimate.ts';
import type { CatalogPart, PricedLine } from './estimate.ts';

const RequestSchema = z.object({ rental_id: z.string().uuid() });

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Downloads all 8 photos and returns them as data URLs (no signed-URL fetching needed by the provider). */
async function loadPhotos(db: Db, rentalId: string): Promise<PhotoSet> {
  const rows = need(await db.from('photos').select('stage, angle, storage_path').eq('rental_id', rentalId));
  const photos: PhotoSet = { pickup: {} as Record<Angle, string>, return: {} as Record<Angle, string> };
  for (const stage of ['pickup', 'return'] as const) {
    for (const angle of PHOTO_ANGLES) {
      const row = rows.find((r) => r.stage === stage && r.angle === angle);
      if (!row) throw new RequestError(`Missing ${stage} photo: ${angle}. Upload all four return photos first.`);
      const file = await db.storage.from('vehicle-photos').download(row.storage_path);
      if (file.error) throw new Error(`${row.storage_path}: ${file.error.message}`);
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      photos[stage][angle] = `data:image/jpeg;base64,${toBase64(bytes)}`;
    }
  }
  return photos;
}

/** Starts a fresh assessment. A re-run replaces the previous one (its items, lines, events, order and notices go with it). */
async function startAssessment(db: Db, rentalId: string): Promise<string> {
  check(await db.from('assessments').delete().eq('rental_id', rentalId));
  const created = need(await db.from('assessments').insert({ rental_id: rentalId, status: 'returned' }).select('id').single());
  check(await db.from('status_events').insert({ assessment_id: created.id, status: 'returned' }));
  check(await db.from('rentals').update({ status: 'returned', returned_at: new Date().toISOString() }).eq('id', rentalId));
  return created.id;
}

async function assessReturn(db: Db, rentalId: string) {
  const rental = check(await db.from('rentals').select('id, vehicles(model, reg_no)').eq('id', rentalId).maybeSingle());
  if (!rental) throw new RequestError('Rental not found');
  const vehicle = { model: rental.vehicles?.model ?? 'Unknown', regNo: rental.vehicles?.reg_no ?? '' };

  const photos = await loadPhotos(db, rentalId);
  const assessmentId = await startAssessment(db, rentalId);
  await setStatus(db, assessmentId, 'assessing');
  const skipped: string[] = [];
  let needsHuman = false;

  // 1. Damage
  const damage = await runDamageAgent(db, assessmentId, photos);
  skipped.push(...damage.skipped);
  const items: DamageItem[] = damage.ok ? damage.data.items : [];
  const photoQualityOk = damage.ok ? damage.data.photo_quality_ok : true;
  if (!damage.ok) needsHuman = true;

  let damageIds: string[] = [];
  if (items.length > 0) {
    const inserted = need(
      await db
        .from('damage_items')
        .insert(
          items.map((item) => ({
            assessment_id: assessmentId,
            panel: item.panel,
            type: item.type,
            severity: item.severity,
            confidence: Math.round(item.confidence * 100) / 100,
            photo_ref: item.photo_ref,
          })),
        )
        .select('id'),
    );
    damageIds = inserted.map((row) => row.id);
  }

  // 2. Estimate: the model picks part codes, prices come from parts_catalog
  let lines: PricedLine[] = [];
  if (items.length > 0) {
    const catalog: CatalogPart[] = need(
      await db.from('parts_catalog').select('part_code, description, parts_inr, labour_inr').eq('vehicle_model', vehicle.model),
    );
    const estimate = await runEstimateAgent(db, assessmentId, vehicle.model, numberDamage(items), catalog);
    skipped.push(...estimate.skipped);
    if (estimate.ok) lines = priceLines(estimate.data, catalog);
    else needsHuman = true;
  }
  const totalInr = lines.reduce((sum, line) => sum + line.total_inr, 0);

  if (lines.length > 0) {
    check(
      await db.from('line_items').insert(
        lines.map((line) => ({
          assessment_id: assessmentId,
          damage_item_id: damageIds[Number(line.damage_id.slice(1)) - 1] ?? null,
          source: 'ai' as const,
          part_code: line.part_code,
          parts_inr: line.parts_inr,
          labour_inr: line.labour_inr,
          total_inr: line.total_inr,
          reasoning: line.reasoning,
        })),
      ),
    );
  }

  // 3. Router: plain code over the config table
  const config = routeConfigFrom(need(await db.from('config').select('key, value')));
  const routed = route(
    { total_inr: totalInr, items, photo_quality_ok: photoQualityOk, staff_escalated: false, needs_human: needsHuman },
    config,
  );
  let path: Path = routed.path;
  let reasons: RouteReason[] = [...routed.reasons];

  // 4. Order: bill note for Path A; diagnostic order for Path B
  const context: OrderContext = { vehicleModel: vehicle.model, damage: items, parts: lines.map((l) => l.description), reasons };
  let riderMessage = '';
  if (path === 'A') {
    const bill = await writeBill(db, assessmentId, context);
    skipped.push(...bill.skipped);
    if (bill.text !== null) {
      riderMessage = bill.text;
    } else {
      // Spec: invalid output twice → needs_human → Path B.
      path = 'B';
      reasons = [...reasons, 'needs_human'];
    }
  }

  const saveOutcome = async () =>
    check(
      await db
        .from('assessments')
        .update({
          path,
          route_reasons: reasons,
          total_inr: totalInr,
          photo_quality_ok: damage.ok ? photoQualityOk : null,
          rider_message: riderMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId),
    );

  let order: { summary: string; priority: 'low' | 'normal' | 'high' } | null = null;
  if (path === 'B') {
    const raised = await raiseOrder(db, assessmentId, vehicle, { ...context, reasons }, totalInr, false);
    skipped.push(...raised.skipped);
    reasons = raised.reasons;
    riderMessage = raised.riderMessage;
    order = { summary: raised.summary, priority: raised.priority };
  }
  // Path A stays "assessing" until the Detector's "Confirm and bill" (settle-return).
  await saveOutcome();

  return { assessment_id: assessmentId, path, reasons, total_inr: totalInr, items, lines, order, rider_message: riderMessage, skipped_models: skipped };
}

serve('assess-return', RequestSchema, '{ "rental_id": "<uuid>" }', function handle(db, body) {
  return assessReturn(db, body.rental_id);
});
