// supabase/functions/_shared/inspection.test.ts
import { describe, expect, it } from 'vitest';

import {
  ConfirmOrderSchema,
  counterMessage,
  downgradeBlocker,
  escalatedReasons,
  finalTotals,
  OverrideSchema,
} from './inspection.ts';

const UUID = '00000000-0000-4000-8000-000000000301';

describe('downgradeBlocker', () => {
  it('allows downgrading AI-raised reasons', () => {
    expect(downgradeBlocker(['amount_over_threshold'])).toBeNull();
    expect(downgradeBlocker(['low_confidence', 'poor_photos'])).toBeNull();
  });

  it('never downgrades a staff escalation, even mixed with AI reasons', () => {
    expect(downgradeBlocker(['staff_escalation'])).toMatch(/cannot/);
    expect(downgradeBlocker(['amount_over_threshold', 'staff_escalation'])).toMatch(/cannot/);
  });

  it('refuses when there is no reason to undo', () => {
    expect(downgradeBlocker([])).not.toBeNull();
  });
});

describe('escalatedReasons', () => {
  it('adds staff_escalation once and keeps AI reasons', () => {
    expect(escalatedReasons([])).toEqual(['staff_escalation']);
    expect(escalatedReasons(['low_confidence'])).toEqual(['low_confidence', 'staff_escalation']);
    expect(escalatedReasons(['staff_escalation'])).toEqual(['staff_escalation']);
  });
});

describe('finalTotals', () => {
  it('sums the final lines and compares with the estimate', () => {
    expect(finalTotals([{ final_inr: 2100 }, { final_inr: 400 }], 2100)).toEqual({ final_total_inr: 2500, difference_inr: 400 });
    expect(finalTotals([{ final_inr: 1800 }], 2100)).toEqual({ final_total_inr: 1800, difference_inr: -300 });
    expect(finalTotals([], 0)).toEqual({ final_total_inr: 0, difference_inr: 0 });
  });
});

describe('counterMessage', () => {
  it('states the final amount and the change from the estimate', () => {
    expect(counterMessage('TVS Ntorq', 'KA01DM0103', 2500, 2100)).toBe(
      'TVS Ntorq KA01DM0103 inspected: final ₹2,500 (+₹400 vs the ₹2,100 estimate). Settle with the rider.',
    );
    expect(counterMessage('TVS Ntorq', 'KA01DM0103', 2100, 2100)).toContain('same as the estimate');
    expect(counterMessage('TVS Ntorq', 'KA01DM0103', 1800, 2100)).toContain('−₹300');
  });
});

describe('request schemas', () => {
  it('accepts a valid inspector confirmation', () => {
    const body = { order_id: UUID, lines: [{ line_id: UUID, final_inr: 2100 }], added: [{ part_code: 'NTQ-MIRROR' }], notes: 'ok' };
    expect(ConfirmOrderSchema.safeParse(body).success).toBe(true);
  });

  it('rejects negative, fractional or huge amounts', () => {
    for (const final_inr of [-1, 10.5, 1_000_000]) {
      const body = { order_id: UUID, lines: [{ line_id: UUID, final_inr }], added: [] };
      expect(ConfirmOrderSchema.safeParse(body).success).toBe(false);
    }
  });

  it('needs a real reason for an override', () => {
    expect(OverrideSchema.safeParse({ assessment_id: UUID, action: 'escalate', reason: 'Rider disputes scratch' }).success).toBe(true);
    expect(OverrideSchema.safeParse({ assessment_id: UUID, action: 'escalate', reason: '  ' }).success).toBe(false);
    expect(OverrideSchema.safeParse({ assessment_id: UUID, action: 'skip', reason: 'because' }).success).toBe(false);
  });
});
