// supabase/functions/_shared/inspection.ts
// Pure rules for the inspector review, route overrides and the counter notification. No database, no model.
import { z } from 'zod';

import { formatInr } from './format.ts';
import type { RouteReason } from './router.ts';

/** Amounts a human types are whole rupees, capped well above any catalog part. */
const Rupees = z.number().int().min(0).max(200_000);

export const ConfirmOrderSchema = z.object({
  order_id: z.string().uuid(),
  lines: z.array(z.object({ line_id: z.string().uuid(), final_inr: Rupees })).max(20),
  added: z.array(z.object({ part_code: z.string().trim().min(1), final_inr: Rupees.optional() })).max(10),
  notes: z.string().trim().max(500).optional(),
});
export type ConfirmOrderRequest = z.infer<typeof ConfirmOrderSchema>;

export const OverrideSchema = z.object({
  assessment_id: z.string().uuid(),
  action: z.enum(['escalate', 'downgrade']),
  reason: z.string().trim().min(3).max(200),
});
export type OverrideRequest = z.infer<typeof OverrideSchema>;

/** Spec: staff can downgrade B → A only for AI-raised reasons. Staff escalations cannot be downgraded. */
export function downgradeBlocker(reasons: readonly string[]): string | null {
  if (reasons.includes('staff_escalation')) return 'Staff escalations cannot be downgraded';
  if (reasons.length === 0) return 'Nothing to downgrade';
  return null;
}

/** Reasons after a staff escalation: the AI's reasons stay, staff_escalation is added once. */
export function escalatedReasons(reasons: readonly RouteReason[]): RouteReason[] {
  return reasons.includes('staff_escalation') ? [...reasons] : [...reasons, 'staff_escalation'];
}

export type FinalLine = { final_inr: number };

/** Final total of the inspector's lines and how far it moved from the AI estimate. */
export function finalTotals(lines: readonly FinalLine[], provisionalInr: number): { final_total_inr: number; difference_inr: number } {
  const finalTotal = lines.reduce((sum, line) => sum + line.final_inr, 0);
  return { final_total_inr: finalTotal, difference_inr: finalTotal - provisionalInr };
}

/** Message the counter sees when the inspector confirms. */
export function counterMessage(vehicle: string, regNo: string, finalInr: number, provisionalInr: number): string {
  const difference = finalInr - provisionalInr;
  const change =
    difference === 0
      ? 'same as the estimate'
      : `${difference > 0 ? '+' : '−'}${formatInr(Math.abs(difference))} vs the ${formatInr(provisionalInr)} estimate`;
  return `${vehicle} ${regNo} inspected: final ${formatInr(finalInr)} (${change}). Settle with the rider.`;
}

/** Message the inspector sees when an order is raised. */
export function inspectorMessage(vehicle: string, regNo: string, provisionalInr: number, escalated: boolean): string {
  return `${vehicle} ${regNo}: ${escalated ? 'escalated by the counter' : 'new diagnostic order'}, AI estimate ${formatInr(provisionalInr)}.`;
}
