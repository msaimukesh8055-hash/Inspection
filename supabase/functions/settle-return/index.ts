// supabase/functions/settle-return/index.ts
// POST { assessment_id, action }. Records the counter settlement with the rider, for both paths.
// Path A: "confirm_bill" (billed, deposit maths saved) then "mark_paid" (paid, rental closed).
// Path B: "settle_order" after the inspector confirms (settled on the final amount, rental closed).
import { z } from 'zod';

import { check, need, RequestError, serve, setStatus } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import { settle } from '../_shared/settlement.ts';

const RequestSchema = z.object({
  assessment_id: z.string().uuid(),
  action: z.enum(['confirm_bill', 'mark_paid', 'settle_order']),
});

async function loadAssessment(db: Db, assessmentId: string) {
  const assessment = check(
    await db.from('assessments').select('id, rental_id, path, status, total_inr').eq('id', assessmentId).maybeSingle(),
  );
  if (!assessment) throw new RequestError('Assessment not found');
  return assessment;
}

async function closeRental(db: Db, rentalId: string): Promise<void> {
  check(await db.from('rentals').update({ status: 'closed' }).eq('id', rentalId));
}

async function confirmBill(db: Db, assessmentId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  if (assessment.path !== 'A') throw new RequestError('Only Path A returns are billed at the counter');
  if (assessment.status !== 'assessing') throw new RequestError(`Already ${assessment.status}`);

  // Path A: the AI estimate is the final amount for every line.
  const lines = need(await db.from('line_items').select('id, total_inr').eq('assessment_id', assessmentId));
  for (const line of lines) {
    check(await db.from('line_items').update({ final_inr: line.total_inr }).eq('id', line.id));
  }

  const settlement = settle(assessment.total_inr);
  check(await db.from('assessments').update(settlement).eq('id', assessmentId));
  await setStatus(db, assessmentId, 'billed');
  return { status: 'billed', total_inr: assessment.total_inr, ...settlement };
}

async function markPaid(db: Db, assessmentId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  if (assessment.status !== 'billed') throw new RequestError(`Cannot mark paid while ${assessment.status}`);
  await setStatus(db, assessmentId, 'paid');
  await closeRental(db, assessment.rental_id);
  return { status: 'paid' };
}

async function settleOrder(db: Db, assessmentId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  if (assessment.path !== 'B') throw new RequestError('Only Path B returns are settled after inspection');
  if (assessment.status !== 'counter_notified') throw new RequestError(`Cannot settle while ${assessment.status}`);

  const order = need(
    await db.from('diagnostic_orders').select('id, final_total_inr').eq('assessment_id', assessmentId).single(),
  );
  if (order.final_total_inr === null) throw new RequestError('The inspector has not confirmed a final amount');

  const settlement = settle(order.final_total_inr);
  check(await db.from('assessments').update(settlement).eq('id', assessmentId));
  check(await db.from('diagnostic_orders').update({ status: 'closed' }).eq('id', order.id));
  check(
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('assessment_id', assessmentId)
      .eq('recipient_role', 'counter')
      .is('read_at', null),
  );
  await setStatus(db, assessmentId, 'settled');
  await closeRental(db, assessment.rental_id);
  return { status: 'settled', final_total_inr: order.final_total_inr, ...settlement };
}

serve(
  'settle-return',
  RequestSchema,
  '{ "assessment_id": "<uuid>", "action": "confirm_bill" | "mark_paid" | "settle_order" }',
  function handle(db, { assessment_id, action }) {
    if (action === 'confirm_bill') return confirmBill(db, assessment_id);
    if (action === 'mark_paid') return markPaid(db, assessment_id);
    return settleOrder(db, assessment_id);
  },
);
