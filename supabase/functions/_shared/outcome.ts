// supabase/functions/_shared/outcome.ts
// The two ways an assessment ends: a Path A bill note, or a Path B diagnostic order sent to the inspector.
// Shared by assess-return (the router decides) and override-route (staff decide).
import { DEPOSIT_INR } from './constants.ts';
import { check, setStatus } from './db.ts';
import type { Db } from './db.ts';
import { inspectorMessage } from './inspection.ts';
import { runBillAgent, runOrderAgent } from './orderAgent.ts';
import type { OrderContext } from './orderAgent.ts';
import type { RouteReason } from './router.ts';
import { heldFromDeposit } from './settlement.ts';

export type Vehicle = { model: string; regNo: string };

/** Plain fallback when the order agent fails twice: no model text, no amounts. */
function fallbackOrder(reasons: RouteReason[]) {
  return {
    summary: `Needs inspection (${reasons.join(', ')}). The AI order text was not usable; review all photos.`,
    priority: 'normal' as const,
    rider_message: 'An inspector will confirm the final amount. The amount held from your deposit is provisional.',
  };
}

export type RaisedOrder = {
  reasons: RouteReason[];
  riderMessage: string;
  summary: string;
  priority: 'low' | 'normal' | 'high';
  skipped: string[];
};

/**
 * Path B: the order agent writes the order, which is saved with the provisional hold; the scooter goes
 * to refurbishment and the inspector is notified. If the agent fails, a plain order is raised and the
 * return is marked needs_human.
 */
export async function raiseOrder(
  db: Db,
  assessmentId: string,
  vehicle: Vehicle,
  context: OrderContext,
  totalInr: number,
  escalated: boolean,
): Promise<RaisedOrder> {
  const reasons = [...context.reasons];
  const result = await runOrderAgent(db, assessmentId, { ...context, reasons });
  const text = result.ok ? result.data : fallbackOrder(reasons);
  if (!result.ok && !reasons.includes('needs_human')) reasons.push('needs_human');

  check(
    await db.from('diagnostic_orders').insert({
      assessment_id: assessmentId,
      summary: text.summary,
      priority: text.priority,
      route_reasons: reasons,
      provisional_total_inr: totalInr,
      held_inr: heldFromDeposit(totalInr, DEPOSIT_INR),
    }),
  );
  await setStatus(db, assessmentId, 'order_raised');
  await setStatus(db, assessmentId, 'at_refurb');
  check(
    await db.from('notifications').insert({
      recipient_role: 'inspector',
      assessment_id: assessmentId,
      message: inspectorMessage(vehicle.model, vehicle.regNo, totalInr, escalated),
    }),
  );

  return { reasons, riderMessage: text.rider_message, summary: text.summary, priority: text.priority, skipped: result.skipped };
}

/** Path A: the order agent writes the rider's bill note. Null means it failed twice (route to a human). */
export async function writeBill(db: Db, assessmentId: string, context: OrderContext): Promise<{ text: string | null; skipped: string[] }> {
  const bill = await runBillAgent(db, assessmentId, context);
  return { text: bill.ok ? bill.data.bill_text : null, skipped: bill.skipped };
}
