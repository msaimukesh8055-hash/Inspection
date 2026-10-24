// supabase/functions/settle-return/index.ts
// POST { assessment_id, action }. Records the counter settlement with the rider.
// Milestone 5 handles Path A: "confirm_bill" (billed, deposit maths saved) then "mark_paid" (paid, rental closed).
// Path B settlement after the inspector confirms arrives in Milestone 6.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Database } from '../_shared/database.types.ts';
import { json, preflight } from '../_shared/http.ts';
import { settle } from '../_shared/settlement.ts';

type Db = SupabaseClient<Database>;

const RequestSchema = z.object({
  assessment_id: z.string().uuid(),
  action: z.enum(['confirm_bill', 'mark_paid']),
});

class RequestError extends Error {}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** Like check, for queries that always return data (select, insert…select). */
function need<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(result);
  if (data === null || data === undefined) throw new Error('Query returned no data');
  return data;
}

async function confirmBill(db: Db, assessmentId: string) {
  const assessment = check(
    await db.from('assessments').select('id, path, status, total_inr').eq('id', assessmentId).maybeSingle(),
  );
  if (!assessment) throw new RequestError('Assessment not found');
  if (assessment.path !== 'A') throw new RequestError('Only Path A returns are billed at the counter');
  if (assessment.status !== 'assessing') throw new RequestError(`Already ${assessment.status}`);

  // Path A: the AI estimate is the final amount for every line.
  const lines = need(await db.from('line_items').select('id, total_inr').eq('assessment_id', assessmentId));
  for (const line of lines) {
    check(await db.from('line_items').update({ final_inr: line.total_inr }).eq('id', line.id));
  }

  const settlement = settle(assessment.total_inr);
  check(
    await db
      .from('assessments')
      .update({ ...settlement, status: 'billed', updated_at: new Date().toISOString() })
      .eq('id', assessmentId),
  );
  check(await db.from('status_events').insert({ assessment_id: assessmentId, status: 'billed' }));
  return { status: 'billed', total_inr: assessment.total_inr, ...settlement };
}

async function markPaid(db: Db, assessmentId: string) {
  const assessment = check(await db.from('assessments').select('id, rental_id, status').eq('id', assessmentId).maybeSingle());
  if (!assessment) throw new RequestError('Assessment not found');
  if (assessment.status !== 'billed') throw new RequestError(`Cannot mark paid while ${assessment.status}`);

  check(await db.from('assessments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', assessmentId));
  check(await db.from('status_events').insert({ assessment_id: assessmentId, status: 'paid' }));
  check(await db.from('rentals').update({ status: 'closed' }).eq('id', assessment.rental_id));
  return { status: 'paid' };
}

Deno.serve(async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return json(405, { error: 'Use POST' });

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Body must be { "assessment_id": "<uuid>", "action": "confirm_bill" | "mark_paid" }' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Function is missing Supabase env vars' });
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { assessment_id, action } = parsed.data;
    return json(200, action === 'confirm_bill' ? await confirmBill(db, assessment_id) : await markPaid(db, assessment_id));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`settle-return failed: ${message}`);
    return json(e instanceof RequestError ? 400 : 500, { error: message });
  }
});
