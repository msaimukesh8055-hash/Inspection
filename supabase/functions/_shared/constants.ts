// supabase/functions/_shared/constants.ts
// The one shared constants file. Pure TypeScript with no imports, so both the
// web app (via lib/constants.ts) and the Deno Edge Functions can use it.

/** Fixed rental deposit in rupees. Every rental uses this value. */
export const DEPOSIT_INR = 2000;

/** Router defaults. The live values come from the config table (threshold_inr, min_confidence). */
export const DEFAULT_THRESHOLD_INR = 1500;
export const DEFAULT_MIN_CONFIDENCE = 0.75;
