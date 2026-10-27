// supabase/functions/_shared/inspection.ts
// Pure rules for the inspector review, route overrides and the counter notification. No database, no model.
import { z } from 'zod';

import { formatInr } from './format.ts';
import type { RouteReason } from './router.ts';
import { PHOTO_ANGLES } from './schemas.ts';

/** Amounts a human types are whole rupees, capped well above any catalog part. */
const Rupees = z.number().int().min(0).max(200_000);

export const ConfirmOrderSchema = z.object({
  order_id: z.string().uuid(),
  lines: z.array(z.object({ line_id: z.string().uuid(), final_inr: Rupees })).max(20),
  // angle: the side the added part is for (the dashboard groups damage by side). Optional for older clients.
  added: z.array(z.object({ part_code: z.string().trim().min(1), final_inr: Rupees.optional(), angle: z.enum(PHOTO_ANGLES).optional() })).max(10),
  notes: z.string().trim().max(500).optional(),
});
export type ConfirmOrderRequest = z.infer<typeof ConfirmOrderSchema>;

export const OverrideSchema = z.object({
  assessment_id: z.string().uuid(),
  action: z.enum(['escalate', 'downgrade']),
  reason: z.string().trim().min(3).max(200),
});
export type OverrideRequest = z.infer<typeof OverrideSchema>;

/** Why the inspector sends a return back to the counter for reassessment. */
export const SEND_BACK_REASONS = {
  missed_damage: 'Missed damage',
  wrong_part: 'Wrong part',
  wrong_severity: 'Wrong severity',
  photos_unclear: 'Photos unclear',
  other: 'Other',
} as const;
export type SendBackReason = keyof typeof SEND_BACK_REASONS;
const REASON_KEYS = Object.keys(SEND_BACK_REASONS) as [SendBackReason, ...SendBackReason[]];

export const SendBackSchema = z
  .object({
    order_id: z.string().uuid(),
    reason: z.enum(REASON_KEYS),
    note: z.string().trim().max(300).optional(),
  })
  .refine((body) => body.reason !== 'other' || (body.note ?? '').length >= 3, {
    message: 'Add a note when the reason is "Other"',
    path: ['note'],
  });
export type SendBackRequest = z.infer<typeof SendBackSchema>;

/** Message the counter sees when the inspector sends a return back. */
export function sendBackMessage(vehicle: string, regNo: string, reason: SendBackReason, note: string | undefined): string {
  const base = `${vehicle} ${regNo} sent back by the inspector: ${SEND_BACK_REASONS[reason]}`;
  return note ? `${base} — ${note}` : base;
}

/**
 * Spec: staff can downgrade B → A only for AI-raised reasons. Staff escalations cannot be downgraded, and
 * neither can a return the AI failed to assess or price: Path A would bill its ₹0 total for real damage.
 */
export function downgradeBlocker(reasons: readonly string[]): string | null {
  if (reasons.includes('staff_escalation')) return 'Staff escalations cannot be downgraded';
  if (reasons.includes('needs_human')) return 'The AI could not assess or price this return, so an inspector must check it';
  if (reasons.length === 0) return 'Nothing to downgrade';
  return null;
}

export type RerunState = { status: string; path: string | null; routeReasons: readonly string[]; orderStatus: string | null };

/**
 * A re-run deletes the assessment and everything hanging off it (lines, order, overrides, notices), so it is
 * only allowed while nothing human has happened yet: a Path A return not yet billed, or a Path B order raised
 * only because the AI failed and not yet inspected. Staff escalations and inspector work are never wiped,
 * except when the inspector sent the return back for reassessment.
 */
export function rerunBlocker(existing: RerunState | null): string | null {
  if (!existing) return null;
  // The inspector asked for it: the order is already closed and the AI's answer is kept in reassessments.
  if (existing.status === 'sent_back') return null;
  if (existing.path !== 'B') {
    return existing.status === 'returned' || existing.status === 'assessing' ? null : 'This return is already billed';
  }
  const aiFailedOnly = existing.routeReasons.length === 1 && existing.routeReasons[0] === 'needs_human';
  if (aiFailedOnly && existing.orderStatus === 'open') return null;
  return 'This return is with the inspector, so it cannot be re-assessed';
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
