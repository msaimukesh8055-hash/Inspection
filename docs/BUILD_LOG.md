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

## Milestone 4 — Damage agent (2026-10-24)
`assess-return` Edge Function (deployed) sends 8 photos to a free OpenRouter vision model via `_shared/openrouter.ts` (logs every call to `agent_runs`), validates with Zod, retries once with the error fed back, else marks `needs_human` (Path B). Website: Assess damage button and an Assessment page (findings, confidence, angle tabs, Run again). Real runs: Jupiter no damage, Radeon left-panel scratch, Ntorq front-panel dent — 3/3 on two full runs, 15–40 s each, ₹0.
Rejected/fixed: Gemma 4 free was rate-limited (429) on every call, so Nemotron 3.5 VL is primary with Gemma as fallback; the dent was first called a scratch until the prompt defined a dent. One run failed once before starting and did not reproduce. Decisions: new migration adds `assessments.photo_quality_ok`; generated DB types moved to `_shared` so functions share them; `npm run demo:reset` restores the 3 demo rentals; no damage boxes (the spec's damage schema has no coordinates).

## Milestone 5 — Estimate, routing, order (2026-10-24)
`assess-return` now runs Damage → Estimate (model picks part codes; prices only from `parts_catalog`) → Router (`_shared/router.ts`, config-table thresholds, 7 unit tests) → Order (bill note or diagnostic order; text with rupee amounts is rejected). `settle-return` handles Path A: Confirm and bill (settlement maths, 4 spec cases tested) then Mark paid (rental closed). Website: route badge, Bill page and Order page with provisional hold and rider timeline; all fit 1440×900.
Results: Jupiter Path A ₹0 (full refund), Radeon Path A ₹500 scratch polish (refund ₹1,500), Ntorq Path B ₹2,100 front panel (held ₹2,000), via both API and website. Rejected/fixed: Nemotron 3 Super free returned 404 upstream and Gemma was rate-limited, so the VL model runs all three steps with fallbacks; 404 now counts as retryable and the caller goes round once more after a pause; pricing or order outages route to a human instead of failing.
Decisions: migrations add `assessments.rider_message` and `line_items.reasoning`; Path A stays "assessing" until Confirm and bill; escalation and overrides wait for Milestone 6.

## Milestone 6 — Inspector flow (2026-10-24)
Inspector: live order queue and review page (approve or adjust each line, add missed parts from the catalog, notes, confirm). New `confirm-order` (final amounts, timeline inspected → counter_notified, counter notification), `settle-return` `settle_order` (deposit maths on the final amount), and `override-route` (escalate A → B, downgrade AI-raised B → A, each saved to `overrides`). Detector: live notification bell (Supabase Realtime), Notifications and Settlement pages, escalate and downgrade with a reason dialog. Shared `_shared/db.ts`, `outcome.ts`, `inspection.ts` (9 unit tests).
Results: Ntorq ₹2,100 → inspector added a mirror → final ₹2,500, counter bell updated live, settled with "Collect ₹500 more", full 7-step rider timeline; Radeon escalated A → B and refused a downgrade; Ntorq downgrade B → A worked via API. Fixed: Order page and timeline spacing to fit 1440×900.
Decisions: "at refurb" is set automatically after an order is raised; inspector line edits live on line_items (AI vs final), overrides record path changes only; a 4th function (`override-route`) keeps overrides apart from billing; no schema change.

## Real photos (2026-10-25)
Replaced the drawn scooters with four CC0 photos of a Goa rental Honda Activa (black plate, yellow letters). Code swaps the rental shop's sticker (real phone numbers) for a generic one, repaints the plates, and draws scratches (hairline key scrape) and dents (shaded hollow). Rejected: a first dent on the shadowed front apron read as a smudge, so it moved to the side panel. Data migration renames the demo fleet to Honda Activas with an Activa parts catalog. The AI retest on the new photos is pending: the free models' daily limit (~50 calls) ran out.

## Milestone 7 — Evals, CI, deploy (in progress, 2026-10-25)
Built with no AI calls: 15 eval cases from the real photos in the spec's groups (3/4/4/2/2) with answer sheets; hidden eval rentals; `evals/run.ts` (scorecard, safety gate, resumable for the daily limit; scoring unit-tested); `evals:check`; GitHub Actions (checks on push, manual AI-eval job); `vercel.json`. Not done until the evals actually pass: running them waits for the limit to reset.

## Reviewer must-fixes (2026-10-25)
Staff can no longer downgrade a `needs_human` return to Path A (it would bill ₹0 for real damage). `assess-return` refuses a re-run once a return is billed, escalated or with the inspector; only an unbilled Path A, or a Path B raised solely because the AI failed and not yet inspected, can be re-assessed (`rerunBlocker`, shared with the UI, unit-tested, checked live).
Real data: source photos redacted (generic sticker, blanked plate, blurred background plates and bystander), all three demo plates are made up (GA07M2211/12/13, new data migration), samples and eval cases rebuilt, and the unredacted photos purged from git history.

## Gemini free tier and the scratch rule (2026-10-25)
Model calls can now go to Google's Gemini API (`gemini/` model ids, `GEMINI_API_KEY`) as well as OpenRouter, still all through `_shared/openrouter.ts` and logged. The free tier is per model and small (gemini-2.5-flash: 20 a day), so damage runs on gemini-3.5-flash and the text steps on the Flash-Lite models and Gemma; 3.8 Flash hung past the timeout. Demo retest 3/3 (right side too), ~18 s per return. First full eval (`gemini-3.5-flash`): routing 13/15 (87%, gate fail), no B→A, no false positives; E05/E07 scratches priced as a new panel, E04/E06 scratches missed.
Fixes: the estimate check now rejects a scratch not priced as polish and polish for anything else (retry once, else Path B; 3 tests). `reset_eval_rental` (new migration, only the 15 eval rentals) lets the runner clear a case before re-running it, since assess-return now refuses to overwrite Path B work. The runner stops only when every model is out for the day. Rerun of E05/E07/E11 waits for the Gemini daily reset.
