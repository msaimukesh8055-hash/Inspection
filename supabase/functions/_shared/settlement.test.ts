// supabase/functions/_shared/settlement.test.ts
import { describe, expect, it } from 'vitest';

import { heldFromDeposit, settle } from './settlement.ts';

describe('settle (₹2,000 deposit)', () => {
  it('₹0 is a full refund', () => {
    expect(settle(0)).toEqual({ deducted_inr: 0, refund_inr: 2000, collect_extra_inr: 0 });
  });

  it('₹650 refunds ₹1,350', () => {
    expect(settle(650)).toEqual({ deducted_inr: 650, refund_inr: 1350, collect_extra_inr: 0 });
  });

  it('exactly ₹2,000 has no refund', () => {
    expect(settle(2000)).toEqual({ deducted_inr: 2000, refund_inr: 0, collect_extra_inr: 0 });
  });

  it('₹2,600 collects ₹600 more', () => {
    expect(settle(2600)).toEqual({ deducted_inr: 2000, refund_inr: 0, collect_extra_inr: 600 });
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => settle(-1)).toThrow();
    expect(() => settle(10.5)).toThrow();
  });
});

describe('heldFromDeposit', () => {
  it('holds the estimate, capped at the deposit', () => {
    expect(heldFromDeposit(900)).toBe(900);
    expect(heldFromDeposit(2100)).toBe(2000);
  });
});
