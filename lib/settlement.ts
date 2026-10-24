// lib/settlement.ts
// App-side entry point for the settlement maths. The source of truth lives with the Edge Functions.
export { heldFromDeposit, settle } from '../supabase/functions/_shared/settlement';
export type { Settlement } from '../supabase/functions/_shared/settlement';
