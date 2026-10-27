// lib/inspection.ts
// App-side entry point for the inspection rules. The source of truth lives with the Edge Functions.
export { rerunBlocker, SEND_BACK_REASONS } from '../supabase/functions/_shared/inspection';
export type { SendBackReason } from '../supabase/functions/_shared/inspection';
