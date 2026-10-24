# Build log

What was delegated, rejected and fixed, one entry per milestone.

## Milestone 1 — Scaffold (2026-10-24)
Expo SDK 58 + Expo Router (strict TS), `supabase init`, spec folder structure, AGENTS.md and CLAUDE.md.
Lint (ESLint, expo config), typecheck (`tsc --noEmit`), tests (Vitest) and an evals placeholder all pass.
Decisions: Vitest over Jest so Deno-side pure logic is testable; `DEPOSIT_INR` lives in `supabase/functions/_shared/constants.ts`, re-exported by `lib/constants.ts`; CI deferred to Milestone 7.
