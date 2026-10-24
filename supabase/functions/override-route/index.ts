// supabase/functions/override-route/index.ts
// POST { assessment_id, action, reason }. Staff overrule the router, and every override is saved to overrides.
// escalate (A → B): any time before billing, with a one-line reason; raises a diagnostic order.
// downgrade (B → A): only for AI-raised reasons, never a staff escalation, and only before the inspector confirms.
import { check, RequestError, serve, setStatus } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import { downgradeBlocker, escalatedReasons, OverrideSchema } from '../_shared/inspection.ts';
import type { OverrideRequest } from '../_shared/inspection.ts';
import type { OrderContext } from '../_shared/orderAgent.ts';
import { raiseOrder, writeBill } from '../_shared/outcome.ts';
import type { RouteReason } from '../_shared/router.ts';
import { DAMAGE_TYPES, PHOTO_ANGLES } from '../_shared/schemas.ts';
import type { DamageItem } from '../_shared/schemas.ts';

const ROUTE_REASONS: readonly RouteReason[] = [
  'amount_over_threshold',
  'low_confidence',
  'poor_photos',
  'structural',
  'staff_escalation',
  'needs_human',
];

async function loadReturn(db: Db, assessmentId: string) {
  const row = check(
    await db
      .from('assessments')
      .select(
        `id, path, status, route_reasons, total_inr,
         rentals(vehicles(model, reg_no)),
         damage_items(panel, type, severity, confidence, photo_ref),
         line_items(parts_catalog(description)),
         diagnostic_orders(id, status)`,
      )
      .eq('id', assessmentId)
      .maybeSingle(),
  );
  if (!row) throw new RequestError('Assessment not found');

  const damage: DamageItem[] = row.damage_items.flatMap((d) => {
    const type = DAMAGE_TYPES.find((t) => t === d.type);
    const angle = PHOTO_ANGLES.find((a) => a === d.photo_ref);
    return type && angle ? [{ panel: d.panel, type, severity: d.severity, confidence: Number(d.confidence), photo_ref: angle }] : [];
  });
  const reasons = row.route_reasons.flatMap((r) => ROUTE_REASONS.filter((known) => known === r));
  return {
    row,
    vehicle: { model: row.rentals?.vehicles?.model ?? 'Unknown', regNo: row.rentals?.vehicles?.reg_no ?? '' },
    damage,
    parts: row.line_items.map((l) => l.parts_catalog?.description ?? 'Part'),
    reasons,
  };
}

async function recordOverride(db: Db, assessmentId: string, from: 'A' | 'B', to: 'A' | 'B', reason: string): Promise<void> {
  check(await db.from('overrides').insert({ assessment_id: assessmentId, actor: 'counter', from_path: from, to_path: to, reason }));
}

async function escalate(db: Db, request: OverrideRequest) {
  const { row, vehicle, damage, parts, reasons } = await loadReturn(db, request.assessment_id);
  if (row.path !== 'A') throw new RequestError('Only Path A returns can be escalated');
  if (row.status !== 'assessing') throw new RequestError(`Cannot escalate once ${row.status}`);

  const newReasons = escalatedReasons(reasons);
  await recordOverride(db, row.id, 'A', 'B', request.reason);
  const context: OrderContext = { vehicleModel: vehicle.model, damage, parts, reasons: newReasons };
  const raised = await raiseOrder(db, row.id, vehicle, context, row.total_inr, true);
  check(
    await db
      .from('assessments')
      .update({ path: 'B', route_reasons: raised.reasons, rider_message: raised.riderMessage, updated_at: new Date().toISOString() })
      .eq('id', row.id),
  );
  return { path: 'B', reasons: raised.reasons, skipped_models: raised.skipped };
}

async function downgrade(db: Db, request: OverrideRequest) {
  const { row, vehicle, damage, parts, reasons } = await loadReturn(db, request.assessment_id);
  if (row.path !== 'B') throw new RequestError('Only Path B returns can be downgraded');
  const blocker = downgradeBlocker(reasons);
  if (blocker) throw new RequestError(blocker);
  if (!row.diagnostic_orders || row.diagnostic_orders.status !== 'open') {
    throw new RequestError('The inspector has already confirmed this order');
  }

  await recordOverride(db, row.id, 'B', 'A', request.reason);
  check(await db.from('diagnostic_orders').delete().eq('id', row.diagnostic_orders.id));
  check(await db.from('notifications').delete().eq('assessment_id', row.id).eq('recipient_role', 'inspector'));

  const context: OrderContext = { vehicleModel: vehicle.model, damage, parts, reasons: [] };
  const bill = await writeBill(db, row.id, context);
  const riderMessage = bill.text ?? 'The counter has reviewed your return. The charges are listed on this bill.';
  check(
    await db
      .from('assessments')
      .update({ path: 'A', route_reasons: [], rider_message: riderMessage, updated_at: new Date().toISOString() })
      .eq('id', row.id),
  );
  // Back to the counter: Path A waits for "Confirm and bill".
  await setStatus(db, row.id, 'assessing');
  return { path: 'A', skipped_models: bill.skipped };
}

serve(
  'override-route',
  OverrideSchema,
  '{ "assessment_id": "<uuid>", "action": "escalate" | "downgrade", "reason": "<3–200 chars>" }',
  function handle(db, request) {
    return request.action === 'escalate' ? escalate(db, request) : downgrade(db, request);
  },
);
