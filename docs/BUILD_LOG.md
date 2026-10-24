# Build log

What was delegated, rejected and fixed, one entry per milestone.

## Milestone 1 — Scaffold (2026-10-24)
Expo SDK 58 + Expo Router (strict TS), `supabase init`, spec folder structure, AGENTS.md and CLAUDE.md.
Lint (ESLint, expo config), typecheck (`tsc --noEmit`), tests (Vitest) and an evals placeholder all pass.
Decisions: Vitest over Jest so Deno-side pure logic is testable; `DEPOSIT_INR` lives in `supabase/functions/_shared/constants.ts`, re-exported by `lib/constants.ts`; CI deferred to Milestone 7.

## Milestone 2 — Data (2026-10-24)
Hosted Supabase (free tier, Singapore) instead of local Docker. Three migrations: 14 tables with check constraints, RLS on every table, private `vehicle-photos` bucket, Realtime on notifications and status_events. Seed: 3 vehicles, 3 fake riders, 3 active rentals, 21 catalog parts, config.
RLS: anon reads screen data, inserts photos and sets only `notifications.read_at`; all other writes go through Edge Functions (service role). `npm run db:verify` passes 10/10; lint, typecheck, tests and evals pass.
Decisions: unique part_code per part; rental status active/returned/closed; roles stored as counter/inspector (UI can label counter "Detector"); `needs_human` is a route reason, not a column.
