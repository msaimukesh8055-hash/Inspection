// supabase/functions/confirm-order/index.ts
// POST { order_id, lines, added, notes }. The inspector's final word on a Path B order:
// saves each line's final amount, adds missed parts (priced from parts_catalog), and notifies the counter.
// It does not settle the deposit; the counter does that with settle-return.
import { check, need, RequestError, serve, setStatus } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import { ConfirmOrderSchema, counterMessage, finalTotals } from '../_shared/inspection.ts';
import type { ConfirmOrderRequest } from '../_shared/inspection.ts';

const OPEN_STATUSES = new Set(['order_raised', 'at_refurb']);

async function confirmOrder(db: Db, request: ConfirmOrderRequest) {
  const order = check(
    await db.from('diagnostic_orders').select('id, status, assessment_id, provisional_total_inr').eq('id', request.order_id).maybeSingle(),
  );
  if (!order) throw new RequestError('Order not found');
  if (order.status !== 'open') throw new RequestError(`Order is already ${order.status}`);

  const assessment = need(
    await db
      .from('assessments')
      .select('id, status, rentals(vehicles(model, reg_no))')
      .eq('id', order.assessment_id)
      .single(),
  );
  if (!OPEN_STATUSES.has(assessment.status)) throw new RequestError(`Return is ${assessment.status}, not waiting for inspection`);
  const vehicle = { model: assessment.rentals?.vehicles?.model ?? 'Unknown', regNo: assessment.rentals?.vehicles?.reg_no ?? '' };

  // Every existing line needs a final amount (approving keeps the AI amount).
  const existing = need(await db.from('line_items').select('id').eq('assessment_id', assessment.id));
  const sent = request.lines.map((l) => l.line_id);
  const missing = existing.filter((l) => !sent.includes(l.id));
  const unknown = sent.filter((id) => !existing.some((l) => l.id === id));
  if (missing.length || unknown.length) throw new RequestError('Send a final amount for every line of this order, and only those');

  // Missed damage: parts only from this vehicle's catalog.
  const catalog = need(
    await db.from('parts_catalog').select('part_code, parts_inr, labour_inr').eq('vehicle_model', vehicle.model),
  );
  const added = request.added.map((a) => {
    const part = catalog.find((p) => p.part_code === a.part_code);
    if (!part) throw new RequestError(`${a.part_code} is not in the ${vehicle.model} catalog`);
    const total = part.parts_inr + part.labour_inr;
    return { ...part, total_inr: total, final_inr: a.final_inr ?? total, angle: a.angle ?? null };
  });

  // Claim the order before writing, so a confirm and a send-back at the same moment cannot both win.
  const claimed = need(await db.from('diagnostic_orders').update({ status: 'inspected' }).eq('id', order.id).eq('status', 'open').select('id'));
  if (claimed.length === 0) throw new RequestError('This order was just handled by someone else');

  for (const line of request.lines) {
    check(await db.from('line_items').update({ final_inr: line.final_inr }).eq('id', line.line_id));
  }
  if (added.length > 0) {
    check(
      await db.from('line_items').insert(
        added.map((part) => ({
          assessment_id: assessment.id,
          damage_item_id: null,
          source: 'inspector_added' as const,
          part_code: part.part_code,
          parts_inr: part.parts_inr,
          labour_inr: part.labour_inr,
          total_inr: part.total_inr,
          final_inr: part.final_inr,
          angle: part.angle,
          reasoning: 'Added by the inspector',
        })),
      ),
    );
  }

  const totals = finalTotals([...request.lines, ...added], order.provisional_total_inr);
  check(
    await db
      .from('diagnostic_orders')
      .update({
        inspector_id: 'inspector',
        inspector_notes: request.notes || null,
        final_total_inr: totals.final_total_inr,
      })
      .eq('id', order.id),
  );
  check(
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('assessment_id', assessment.id)
      .eq('recipient_role', 'inspector')
      .is('read_at', null),
  );

  if (assessment.status === 'order_raised') await setStatus(db, assessment.id, 'at_refurb');
  await setStatus(db, assessment.id, 'inspected');
  check(
    await db.from('notifications').insert({
      recipient_role: 'counter',
      assessment_id: assessment.id,
      message: counterMessage(vehicle.model, vehicle.regNo, totals.final_total_inr, order.provisional_total_inr),
    }),
  );
  await setStatus(db, assessment.id, 'counter_notified');

  return { status: 'counter_notified', provisional_total_inr: order.provisional_total_inr, ...totals, added: added.length };
}

serve(
  'confirm-order',
  ConfirmOrderSchema,
  '{ "order_id": "<uuid>", "lines": [{ "line_id", "final_inr" }], "added": [{ "part_code", "final_inr"? }], "notes"? }',
  confirmOrder,
);
