// supabase/functions/assess-return/index.ts
// POST { rental_id }. Milestone 4: damage step only. Estimate, routing and order follow in Milestone 5.
// Runs with the service role; the agent never writes to the database, this function does after validation.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Database } from '../_shared/database.types.ts';
import { json, preflight } from '../_shared/http.ts';
import { PHOTO_ANGLES } from '../_shared/schemas.ts';
import { runDamageAgent } from './damage.ts';
import type { Angle, PhotoSet } from './damage.ts';

type Db = SupabaseClient<Database>;
type AssessmentStatus = Database['public']['Tables']['assessments']['Row']['status'];

const RequestSchema = z.object({ rental_id: z.string().uuid() });

class RequestError extends Error {}

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
  const { data: rows, error } = await db.from('photos').select('stage, angle, storage_path').eq('rental_id', rentalId);
  if (error) throw new Error(error.message);

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

async function setStatus(db: Db, assessmentId: string, status: AssessmentStatus): Promise<void> {
  const update = await db
    .from('assessments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (update.error) throw new Error(update.error.message);
  const event = await db.from('status_events').insert({ assessment_id: assessmentId, status });
  if (event.error) throw new Error(event.error.message);
}

/** Starts a fresh assessment. A re-run replaces the previous one (its damage items and events go with it). */
async function startAssessment(db: Db, rentalId: string): Promise<string> {
  const rental = await db.from('rentals').select('id').eq('id', rentalId).maybeSingle();
  if (rental.error) throw new Error(rental.error.message);
  if (!rental.data) throw new RequestError('Rental not found');

  const removed = await db.from('assessments').delete().eq('rental_id', rentalId);
  if (removed.error) throw new Error(removed.error.message);

  const created = await db.from('assessments').insert({ rental_id: rentalId, status: 'returned' }).select('id').single();
  if (created.error) throw new Error(created.error.message);
  const event = await db.from('status_events').insert({ assessment_id: created.data.id, status: 'returned' });
  if (event.error) throw new Error(event.error.message);

  const returned = await db
    .from('rentals')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .eq('id', rentalId);
  if (returned.error) throw new Error(returned.error.message);
  return created.data.id;
}

async function assessReturn(db: Db, rentalId: string) {
  const photos = await loadPhotos(db, rentalId);
  const assessmentId = await startAssessment(db, rentalId);
  await setStatus(db, assessmentId, 'assessing');

  const damage = await runDamageAgent(db, assessmentId, photos);
  if (!damage.ok) {
    // Spec: invalid output twice means a human decides (Path B).
    const flagged = await db
      .from('assessments')
      .update({ path: 'B', route_reasons: ['needs_human'], updated_at: new Date().toISOString() })
      .eq('id', assessmentId);
    if (flagged.error) throw new Error(flagged.error.message);
    return { assessment_id: assessmentId, needs_human: true, error: damage.error, skipped_models: damage.skipped };
  }

  const { photo_quality_ok, items } = damage.output;
  const saved = await db
    .from('assessments')
    .update({ photo_quality_ok, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (saved.error) throw new Error(saved.error.message);

  if (items.length > 0) {
    const inserted = await db.from('damage_items').insert(
      items.map((item) => ({
        assessment_id: assessmentId,
        panel: item.panel,
        type: item.type,
        severity: item.severity,
        confidence: Math.round(item.confidence * 100) / 100,
        photo_ref: item.photo_ref,
      })),
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }

  return {
    assessment_id: assessmentId,
    needs_human: false,
    model: damage.model,
    skipped_models: damage.skipped,
    photo_quality_ok,
    items,
  };
}

Deno.serve(async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return json(405, { error: 'Use POST' });

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Body must be { "rental_id": "<uuid>" }' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Function is missing Supabase env vars' });
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  try {
    return json(200, await assessReturn(db, parsed.data.rental_id));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`assess-return failed: ${message}`);
    return json(e instanceof RequestError ? 400 : 502, { error: message });
  }
});
