// supabase/functions/_shared/agentSchemas.test.ts
// Estimate and order agent outputs: catalog-only part codes, no rupee amounts in text.
import { describe, expect, it } from 'vitest';

import { BillOutputSchema, containsRupeeAmount, OrderOutputSchema, parseEstimateOutput, parseReply } from './schemas.ts';

const CODES = ['RAD-SCRATCH-POLISH', 'RAD-FUEL-TANK'];

function estimate(lines: { damage_id: string; part_code: string; reasoning?: string }[]): string {
  return JSON.stringify({ lines: lines.map((l) => ({ reasoning: 'matches', ...l })) });
}

describe('parseEstimateOutput', () => {
  it('accepts one catalog part per damage item', () => {
    const result = parseEstimateOutput(estimate([{ damage_id: 'd1', part_code: 'RAD-SCRATCH-POLISH' }]), ['d1'], CODES);
    expect(result.ok).toBe(true);
  });

  it('rejects a part code that is not in the catalog', () => {
    const result = parseEstimateOutput(estimate([{ damage_id: 'd1', part_code: 'JUP-MIRROR' }]), ['d1'], CODES);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('JUP-MIRROR');
  });

  it('rejects missing, unknown or repeated damage items', () => {
    expect(parseEstimateOutput(estimate([]), ['d1'], CODES).ok).toBe(false);
    expect(parseEstimateOutput(estimate([{ damage_id: 'd9', part_code: 'RAD-FUEL-TANK' }]), ['d1'], CODES).ok).toBe(false);
    const twice = estimate([
      { damage_id: 'd1', part_code: 'RAD-FUEL-TANK' },
      { damage_id: 'd1', part_code: 'RAD-SCRATCH-POLISH' },
    ]);
    expect(parseEstimateOutput(twice, ['d1'], CODES).ok).toBe(false);
  });

  it('ignores any price the model adds (prices come from the catalog)', () => {
    const withPrice = JSON.stringify({ lines: [{ damage_id: 'd1', part_code: 'RAD-FUEL-TANK', reasoning: 'dent', price: 99 }] });
    const result = parseEstimateOutput(withPrice, ['d1'], CODES);
    expect(result.ok && result.data.lines[0]).toEqual({ damage_id: 'd1', part_code: 'RAD-FUEL-TANK', reasoning: 'dent' });
  });
});

describe('containsRupeeAmount', () => {
  it('spots rupee amounts in any common form', () => {
    for (const text of ['₹500', 'Rs. 500', 'Rs 1,200', 'INR 900', '500 rupees', '1,500 Rs']) {
      expect(containsRupeeAmount(text)).toBe(true);
    }
  });

  it('allows plain words and non-money numbers', () => {
    expect(containsRupeeAmount('One light scratch on the left side panel.')).toBe(false);
    expect(containsRupeeAmount('Front panel needs 1 replacement within 2 days.')).toBe(false);
  });
});

describe('order agent schemas', () => {
  it('accepts words-only text and rejects text with amounts', () => {
    expect(parseReply(BillOutputSchema, '{"bill_text": "A light scratch was polished out."}').ok).toBe(true);
    expect(parseReply(BillOutputSchema, '{"bill_text": "You owe ₹500."}').ok).toBe(false);
    const order = { summary: 'Dented front panel.', priority: 'normal', rider_message: 'The amount is provisional.' };
    expect(parseReply(OrderOutputSchema, JSON.stringify(order)).ok).toBe(true);
    expect(parseReply(OrderOutputSchema, JSON.stringify({ ...order, priority: 'urgent' })).ok).toBe(false);
    expect(parseReply(OrderOutputSchema, JSON.stringify({ ...order, rider_message: 'Held Rs 2000.' })).ok).toBe(false);
  });
});
