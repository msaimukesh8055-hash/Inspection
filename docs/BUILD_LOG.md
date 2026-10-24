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

## Milestone 3 — Capture (2026-10-24)
Detector flow on its own pages: role picker → active rentals (Upload photos button per row) → four upload tiles, plus "Use sample photos (demo)" that fills this scooter's fixed set (Jupiter clean, Radeon light scratch, Ntorq dent; never named on screen so the AI has to find it) → review (angle list, pickup vs return side by side) → upload → saved view read back from Supabase. Tested end to end in headless Chrome at 1440×900, including real file uploads; every page fits one laptop screen.
Rejected: Expo phone build (Expo Go said the project was incompatible, and the demo is shown on a laptop only), so the frontend moved to Vite + React + Tailwind with an Uber-style black design (Inter, Phosphor duotone icons). Camera and ghost overlay dropped.
Fixed: picking several files at once kept only the last one (stale state); drafts now update from the latest value. Decisions: drawn sample images (48, scenario never written on the image), pickup sets via `npm run seed:photos`, "Assess" waits for Milestone 4, rental status unchanged on upload.
