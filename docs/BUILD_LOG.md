# Build log

What was built, what went wrong and how it was fixed, in the order it happened. Each entry: **Built**, **Problems and fixes**, **Decisions**, **Result**.

---

# Part 1: Core build (Milestones 1–7)

## Milestone 1: Scaffold
**Built**
- Expo SDK 58 + Expo Router (strict TypeScript), `supabase init`, the spec's folder structure, AGENTS.md and CLAUDE.md.
- Lint (ESLint), typecheck (`tsc --noEmit`), tests (Vitest) and an evals placeholder, all passing.

**Decisions**
- Vitest over Jest, so the backend's plain logic can be tested.
- `DEPOSIT_INR` lives in one shared constants file, used by both backend and website.
- CI left for Milestone 7.

## Milestone 2: Data
**Built**
- Hosted Supabase (free tier, Singapore) instead of local Docker.
- 3 migrations: 14 tables with check constraints, row-level security on every table, private `vehicle-photos` bucket, Realtime on notifications and status events.
- Seed: 3 vehicles, 3 fake riders, 3 active rentals, 21 catalog parts, config.

**Decisions**
- Security: the website reads screen data, adds photos and can only mark a notification read; every other write goes through backend functions.
- One unique part code per part; rental status is active / returned / closed.
- Roles stored as counter / inspector (the screen calls the counter "Detector").
- `needs_human` is a route reason, not a column.

**Result**
- `npm run db:verify` 10/10; lint, typecheck, tests and evals pass.

## Milestone 3: Capture
**Built**
- Detector flow, one step per page: role picker → active rentals → 4 upload tiles (+ "Use sample photos") → review (pickup and return side by side) → upload → saved view.
- Sample photos never name the scenario on screen, so the AI has to find the damage itself.

**Problems and fixes**
- **Expo phone build rejected:** Expo Go said the project was incompatible, and the demo is on a laptop anyway. Frontend moved to Vite + React + Tailwind with a black, Uber-style design (Inter, Phosphor duotone icons). Camera and ghost overlay dropped.
- Picking several files at once kept only the last one. Fixed.

**Result**
- Tested end to end in a browser at 1440×900, including real file uploads; every page fits one laptop screen.

## Milestone 4: Damage agent
**Built**
- `assess-return` backend function: sends the 8 photos to a free vision model through `_shared/openrouter.ts` (every call logged to `agent_runs`), checks the answer with Zod, retries once with the error, else marks `needs_human` (Path B).
- Website: Assess damage button and an Assessment page (findings, confidence, angle tabs, Run again).
- `npm run demo:reset` restores the 3 demo rentals.

**Problems and fixes**
- Gemma 4 (free) was rate-limited on every call → Nemotron 3.5 VL made primary, Gemma as fallback.
- A dent was first called a scratch → the prompt now defines what a dent looks like.

**Decisions**
- New migration adds `assessments.photo_quality_ok`.
- No damage boxes on photos (the damage schema has no coordinates).

**Result**
- 3/3 scooters right on two full runs (no damage, scratch, dent), 15–40 s each, ₹0.

## Milestone 5: Estimate, routing, bill/order
**Built**
- Full chain: Damage → Estimate (AI picks part codes, prices only from `parts_catalog`) → Router (plain code, thresholds from the config table, 7 unit tests) → Bill or Order (text with rupee amounts is rejected).
- `settle-return` for Path A: Confirm and bill (settlement maths, 4 spec cases tested) → Mark paid.
- Website: route badge, Bill page, Order page with provisional hold and rider timeline.

**Problems and fixes**
- One free model returned 404 and Gemma stayed rate-limited → the vision model runs all three steps, with fallbacks; 404 now counts as "try the next model".
- If pricing or order writing fails, the return goes to a person instead of erroring.

**Decisions**
- Migrations add `assessments.rider_message` and `line_items.reasoning`.
- Path A stays "assessing" until Confirm and bill.

**Result**
- Clean scooter Path A ₹0 (full refund); scratch Path A ₹500 (refund ₹1,500); dent Path B ₹2,100 (₹2,000 held). Same through the API and the website.

## Milestone 6: Inspector flow
**Built**
- Inspector: live order queue and review page (approve or adjust each line, add missed parts from the catalog, notes, confirm).
- New functions: `confirm-order` (final amounts, timeline, counter notification), `settle-return` for Path B (deposit maths on the final amount), `override-route` (escalate A → B, downgrade AI-raised B → A, saved to `overrides`).
- Detector: live notification bell (Realtime), Notifications and Settlement pages, escalate / downgrade with a reason.
- Shared inspection rules with 9 unit tests.

**Decisions**
- "At refurb" is set automatically after an order is raised.
- Inspector line edits are kept on the line items (AI vs final); `overrides` records path changes only.
- Overrides get their own function, separate from billing. No schema change.

**Result**
- Dent ₹2,100 → inspector added a mirror → final ₹2,500 → counter bell updated live → settled with "Collect ₹500 more", full 7-step timeline.
- Escalate A → B worked and refused a downgrade back; downgrade B → A worked.

## Real photos
**Built**
- Replaced the drawn scooters with four public-domain (CC0) photos of a Goa rental Honda Activa.
- Code replaces the shop's sticker (real phone numbers) with a generic one, repaints the plates, and draws the scratches and dents.
- Data migration renames the demo fleet to Honda Activas with an Activa parts catalog.

**Problems and fixes**
- A dent on the shadowed front panel looked like a smudge → moved to the side panel.
- The AI retest had to wait: the free models' daily limit (~50 calls) ran out.

## Milestone 7: Evals, CI, deploy (mostly done)
**Built**
- 15 eval cases from the real photos, in the spec's groups (3 clean / 4 scratch / 4 dent or broken / 2 bad photos / 2 pre-existing damage), each with an answer sheet.
- Hidden eval rentals, separate from the demo.
- `evals/run.ts`: scorecard, safety gate, resumes after the daily limit; scoring unit-tested.
- `evals:check`, GitHub Actions (checks on every push, AI evals on demand), Vercel deploy.

**Still to do**
- A full 15-case run on the latest prompt, and cost numbers in the README.

---

# Part 2: Review and AI quality

## Reviewer must-fixes
**Problems and fixes** (found by the reviewer agent)
- **₹0 loophole:** staff could downgrade a `needs_human` return to Path A, billing ₹0 for real damage → blocked.
- **Re-runs could wipe the Inspector's work** → `assess-return` now refuses a re-run once a return is billed, escalated or with the Inspector. Only an unbilled Path A, or a Path B raised only because the AI failed, can be re-assessed. Shared with the website and unit-tested.
- **Real data:** source photos redacted (generic sticker, blanked plate, blurred background plates and bystander); all demo plates made up (GA07M2211/12/13); samples and eval cases rebuilt; unredacted photos purged from git history.

## Gemini free tier and the scratch rule
**Built**
- AI calls can now go to Google's Gemini API as well as OpenRouter, still all through `_shared/openrouter.ts` and logged.
- Gemini's free limits are per model and small (2.5 Flash: 20 a day), so Damage runs on Gemini 3.5 Flash and the text agents on Flash-Lite and Gemma.

**Problems and fixes**
- Gemini 3.8 Flash hung past the timeout → removed from the model list.
- **First full eval: routing 13/15 (87%, gate failed).** Scratches E05 and E07 were priced as a new panel; E04 and E06 scratches missed. No damaged scooter billed at the counter; no false alarms.
- **Fix: the scratch rule.** The estimate check now rejects a scratch not priced as polish, and polish used for anything else (retry once, else Path B; 3 tests).
- Eval re-runs were blocked by the new re-run guard → `reset_eval_rental` (new migration, touches only the 15 eval rentals) clears a case before re-running.
- The runner stopped on any rate-limit message → now it stops only when every model is out for the day.

**Result**
- Demo retest 3/3, about 18 s per return.

## Eval re-run after the scratch rule
**Result**
- E07 now Path A ₹500 (was ₹1,850); E11 ₹2,350 (was ₹3,700).
- **Routing 15/15, safety gate passed**, no damaged scooter billed at the counter, no false alarms.
- **But damage found only 67%:** E04, E05 and E06 scratches missed, so three ₹500 scratches wouldn't be charged.

## Missed small scratches
**Problems and fixes**
- Damage prompt: a checklist of spots per side (mudguard, lamps, mirrors, side panels); "report a doubtful mark with low confidence so a person checks it"; removed "most returns have no new damage" (it nudged the AI to call doubtful returns clean).
- Mudguard scratch drawn longer.

**Result** (label `scratch-prompt-v2`, 8 cases)
- E04 and E05 now found (Path A ₹500).
- Clean and pre-existing cases still ₹0: no false alarms.
- **E06 (mudguard) still missed. Kept as a known hard case:** the scooter fills only a third of that photo, so the real fix is closer, guided photos.
- Free-tier per-minute limits hit on some cases → use a 45 s pause between cases.
- A full 15-case run is still needed (the prompt change affects every case).

---

# Part 3: Features added after the plan

## New pickup
**Built**
- Detector → New pickup → scooter details and a demo rider → 4 pickup photos → the rental appears in Active rentals. (The spec assumed pickup photos already existed.)
- New `start-rental` function: refuses a plate still out on rent, a model with no parts prices, or missing photos; saves vehicle, rental and photos together and undoes it if anything fails. The website still can't write rentals directly. No schema change.
- "Use sample photos" works for new plates too; `demo:reset` removes added pickups.

**Result**
- GA07M2214 pickup → return → AI compared against the new pickup photos → Path A ₹0 (correct for the clean set). The three refusal cases checked against the live function.

## Send back for reassessment
**Built**
- Inspector can send an open order back with a reason: missed damage, wrong part, wrong severity, photos unclear, or other (note required).
- New migration: `sent_back` status and `reassessments` table (keeps a copy of the AI's answer; one open send-back per rental).
- New `send-back` function. Both send-back and confirm "claim" the order first, so it can't be processed twice (also fixes the reviewer's double-confirm item).
- Detector: bell notification, "Sent back by the inspector" section, return photos pre-loaded (not uploaded again). Re-assessing resolves the send-back.

**Result**
- GA07M2216 dent → sent back ("Missed damage — left mirror is cracked too") → order closed, Detector notified → photos pre-loaded → assessed again → Path B, send-back resolved. "Other" without a note is refused.

## Dashboard
**Built**
- `/dashboard`: each scooter's damage history (side, type, date, final amount); totals by side, Path A/B split, money recovered, inspector agreement (send-backs count as disagreements). Eval rentals left out.
- New migration adds `line_items.angle`: AI lines take the side from the damage photo; inspector-added parts get a side picker.
- `npm run history:seed` loads 4 sample scooters with 8 past returns; `demo:reset` leaves them alone.
- Sums in `lib/dashboard.ts`, 5 unit tests (90 in total).

**Later changes**
- "iInspect" name across the website.
- Dashboard in two boxes (Insights, Scooters); send-back reasons section removed; sent-back returns counted once reassessed.
- `demo:reset` now always leaves GA07M2212 (Vikram) sent back by the inspector (wrong part: scratch priced as a panel), photos uploaded and an unread notice, so the Detector page shows 2 active rentals and 1 sent-back return. Reassessing gives ₹500, Path A.

---

# Part 4: Documentation

## Docs brought up to date
- `docs/SPEC.md` rewritten to describe the product as built: laptop website, Detector and Inspector, 4 agents plus the Router and rule checks, Gemini first with OpenRouter fallback, the three added features, current eval results, and a table of every change from the original plan.
- `docs/NEXT_STEPS.md` rewritten as the current to-do list.
- Evals skill: Gemini limits, per-case reset, "ask before a full run", and the three kinds of evals.
- Small fixes in README, AGENTS.md and the reviewer agent.
- `evals/RESULTS.md`: a plain-English scorecard of the eval runs.
- Architecture page: all 6 router rules, 4 rule checks, unit tests, three evals in boxes, "4 + 1 AI agents".
- No code changes.
