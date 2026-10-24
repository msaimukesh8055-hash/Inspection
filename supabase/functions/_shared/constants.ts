// supabase/functions/_shared/constants.ts
// The one shared constants file. Pure TypeScript with no imports, so both the
// Expo app (via lib/constants.ts) and the Deno Edge Functions can use it.

/** Fixed rental deposit in rupees. Every rental uses this value. */
export const DEPOSIT_INR = 2000;
