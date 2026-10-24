// supabase/functions/_shared/settlement.ts
// Settlement rule (both paths): deduct up to the ₹2,000 deposit, refund the rest,
// or collect the difference when the final amount is above the deposit.
import { DEPOSIT_INR } from './constants.ts';

export type Settlement = {
  deducted_inr: number;
  refund_inr: number;
  collect_extra_inr: number;
};

export function settle(finalInr: number, depositInr: number = DEPOSIT_INR): Settlement {
  if (!Number.isInteger(finalInr) || finalInr < 0) throw new Error(`Invalid final amount: ${finalInr}`);
  if (finalInr <= depositInr) {
    return { deducted_inr: finalInr, refund_inr: depositInr - finalInr, collect_extra_inr: 0 };
  }
  return { deducted_inr: depositInr, refund_inr: 0, collect_extra_inr: finalInr - depositInr };
}

/** Path B holds the provisional estimate from the deposit, capped at the deposit. */
export function heldFromDeposit(provisionalInr: number, depositInr: number = DEPOSIT_INR): number {
  return Math.min(provisionalInr, depositInr);
}
