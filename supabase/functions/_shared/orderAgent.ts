// supabase/functions/_shared/orderAgent.ts
// Order step: Path A gets the rider's bill note, Path B a diagnostic order and a rider message.
// The model sees no prices, and its text is rejected if it contains any rupee amount.
import type { SupabaseClient } from '@supabase/supabase-js';

import { runAgent } from './agent.ts';
import type { AgentResult } from './agent.ts';
import type { Database } from './database.types.ts';
import type { ChatMessage } from './openrouter.ts';
import { BILL_SYSTEM_PROMPT, ORDER_SYSTEM_PROMPT } from './prompts.ts';
import type { RouteReason } from './router.ts';
import { BillOutputSchema, OrderOutputSchema, parseReply } from './schemas.ts';
import type { BillOutput, DamageItem, OrderOutput } from './schemas.ts';

export type OrderContext = {
  vehicleModel: string;
  damage: DamageItem[];
  /** Part descriptions chosen by the estimate step (no prices). */
  parts: string[];
  reasons: RouteReason[];
};

const REASON_TEXT: Record<RouteReason, string> = {
  amount_over_threshold: 'estimate is above the counter limit',
  low_confidence: 'the AI is not confident about some damage',
  poor_photos: 'some photos are unclear',
  structural: 'structural damage (crack or broken part)',
  staff_escalation: 'staff asked for an inspection',
  needs_human: 'the AI could not produce a usable answer',
};

function describe(context: OrderContext): string {
  const damage = context.damage.length
    ? context.damage.map((d) => `- ${d.type} on ${d.panel} (severity ${d.severity})`).join('\n')
    : '- no new damage found';
  const parts = context.parts.length ? context.parts.map((p) => `- ${p}`).join('\n') : '- none';
  const reasons = context.reasons.map((r) => `- ${REASON_TEXT[r]}`).join('\n');
  return `Vehicle: ${context.vehicleModel}\n\nNew damage:\n${damage}\n\nRepairs:\n${parts}${reasons ? `\n\nWhy it needs a human:\n${reasons}` : ''}`;
}

export function buildBillMessages(context: OrderContext): ChatMessage[] {
  return [
    { role: 'system', content: BILL_SYSTEM_PROMPT },
    { role: 'user', content: describe(context) },
  ];
}

export function buildOrderMessages(context: OrderContext): ChatMessage[] {
  return [
    { role: 'system', content: ORDER_SYSTEM_PROMPT },
    { role: 'user', content: describe(context) },
  ];
}

export function runBillAgent(db: SupabaseClient<Database>, assessmentId: string, context: OrderContext): Promise<AgentResult<BillOutput>> {
  return runAgent({
    db,
    agent: 'order',
    assessmentId,
    messages: buildBillMessages(context),
    parse: (text) => parseReply(BillOutputSchema, text),
    outageIsFailure: true,
  });
}

export function runOrderAgent(db: SupabaseClient<Database>, assessmentId: string, context: OrderContext): Promise<AgentResult<OrderOutput>> {
  return runAgent({
    db,
    agent: 'order',
    assessmentId,
    messages: buildOrderMessages(context),
    parse: (text) => parseReply(OrderOutputSchema, text),
    outageIsFailure: true,
  });
}
