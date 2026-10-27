// supabase/functions/send-back/index.ts
// POST { order_id, reason, note? }. The inspector sends a return back to the counter for reassessment
// instead of confirming it: the order is closed, the AI's answer is copied into reassessments (a re-run
// deletes the assessment), and the counter is notified. The counter then re-runs assess-return.
import { check, need, RequestError, serve, setStatus } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import { SendBackSchema, sendBackMessage } from '../_shared/inspection.ts';
import type { SendBackRequest } from '../_shared/inspection.ts';

const WAITING_STATUSES = new Set(['order_raised', 'at_refurb']);

async function sendBack(db: Db, request: SendBackRequest) {
  const order = check(await db.from('diagnostic_orders').select('id, status, assessment_id').eq('id', request.order_id).maybeSingle());
  if (!order) throw new RequestError('Order not found');
  if (order.status !== 'open') throw new RequestError(`Order is already ${order.status}`);

  const assessment = need(
    await db
      .from('assessments')
      .select(
        `id, rental_id, status, path, total_inr, route_reasons,
         rentals(vehicles(model, reg_no)),
         damage_items(panel, type, severity, confidence, photo_ref),
         line_items(part_code, source, total_inr, final_inr)`,
      )
      .eq('id', order.assessment_id)
      .single(),
  );
  if (!WAITING_STATUSES.has(assessment.status)) throw new RequestError(`Return is ${assessment.status}, not waiting for inspection`);

  // Claim the order first, so two clicks (or a confirm at the same moment) cannot both win.
  const claimed = need(await db.from('diagnostic_orders').update({ status: 'closed' }).eq('id', order.id).eq('status', 'open').select('id'));
  if (claimed.length === 0) throw new RequestError('This order was just handled by someone else');

  const saved = await db.from('reassessments').insert({
    rental_id: assessment.rental_id,
    reason: request.reason,
    note: request.note || null,
    ai_result: {
      path: assessment.path,
      total_inr: assessment.total_inr,
      route_reasons: assessment.route_reasons,
      items: assessment.damage_items,
      lines: assessment.line_items,
    },
  });
  if (saved.error) {
    check(await db.from('diagnostic_orders').update({ status: 'open' }).eq('id', order.id));
    throw new Error(saved.error.message);
  }

  check(
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('assessment_id', assessment.id)
      .eq('recipient_role', 'inspector')
      .is('read_at', null),
  );
  await setStatus(db, assessment.id, 'sent_back');

  const vehicle = assessment.rentals?.vehicles;
  check(
    await db.from('notifications').insert({
      recipient_role: 'counter',
      assessment_id: assessment.id,
      message: sendBackMessage(vehicle?.model ?? 'Scooter', vehicle?.reg_no ?? '', request.reason, request.note || undefined),
    }),
  );

  return { status: 'sent_back', rental_id: assessment.rental_id };
}

serve('send-back', SendBackSchema, '{ "order_id": "<uuid>", "reason": "missed_damage|wrong_part|wrong_severity|photos_unclear|other", "note"? }', sendBack);
