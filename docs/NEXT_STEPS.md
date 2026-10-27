# Next steps (handoff, 2026-10-26)

Where the build stopped and what to do next. Read this, `AGENTS.md` and the end of `docs/BUILD_LOG.md` first.

## Status
- Live: app https://inspection-psi-eight.vercel.app and architecture page `/architecture.html` (Vercel deploys every push to `main`).
- Built and working: Detector + Inspector, Path A billing, Path B settlement, overrides, New pickup, send back for reassessment, dashboard (`/dashboard`).
- AI runs on Google's Gemini free tier first (per-model daily limits, ~20 for 2.5 Flash), OpenRouter Nemotron as fallback. Free limits reset 12:30 pm IST.
- Evals: latest full picture is `gemini-3.5-flash` (routing 15/15 after the scratch rule) plus `scratch-prompt-v2` (E04, E05 now found; E06 mudguard still missed, kept as a known hard case). A full 15-case run with the latest prompt is still to do; ask the user before running it.
- Sample dashboard history: `npm run history:seed`. `npm run demo:reset` before demos; it keeps the sample history.

## Reviewer findings (2026-10-25), not fixed yet
**Must-fix:** all 3 done on 2026-10-25 (₹0 downgrade, real data and history purge, re-run guard).

**Should-fix**
- `confirm-order`: duplicate `line_id`s pass the check and inflate the final total. (Double confirm is fixed: the order is claimed first.)
- Eval Path B cases raise real orders that show in the live inspector queue and bell. Filter eval rentals out, or clean up after scoring.
- `override-route` copies the route reasons by hand. Export `ROUTE_REASONS` from `router.ts` instead.
- Green (Path A colour) is used for "Approved", "Confirmed" and "Settled" on Path B screens. Use neutral grey.

**Nits:**
- inline `saveOutcome`
- dead `order_raised` check in `confirm-order`
- the "no order" error message wording
- the downgrade timeline step going backwards
- leftover `const Icon = Moped`
- explain the channel-name suffix in `lib/notifications.ts`
- catch `markRead` failures
- tighten eval panel keywords (`panel`, `front` match too much)
- README evals table says "right panel" for all scratches
- ignore `evals/results/` for local and CI runs, or decide which results to keep
- note in the README that evals run manually, not on every push (a spec deviation)
- confirm with the user that inspector line edits don't need `overrides` rows

## Blocked on the free AI limit
OpenRouter free models allow about 50 calls a day (resets 00:00 UTC, 5:30 am IST). They ran out on 2026-10-24, so the AI has **not** been retested on the real photos yet.

## To do, in order
1. **Retest on the real photos: mostly done (2026-10-25).** The first retest missed both damaged scooters (₹0 on Path A). Fixes: damage prompt rewritten (per-angle pickup/return `checks` the model fills before `items`, which Zod drops; what scratches and dents look like on matte grey; what is not damage; confidence scale), and the drawn scratch and dent made bolder (samples and eval cases rebuilt). Final run: 2211 clean → A ₹0 ✓, 2213 dent → B ₹1,850 ✓, 2212 scratch → A ₹500 ✓ but reported on the **right** side panel (drawn on the left). Runs vary between prompt versions; one version billed the clean scooter ₹500, so watch false positives. Still to do: retest once more in the website, and fix the left/right mix-up if the evals show it again.
2. **Evals on Gemini (in progress, 2026-10-25).** First full run `gemini-3.5-flash`: 13/15 (gate needs 90%). The scratch-must-be-polish rule is deployed but not yet tested: Gemini's free daily limit ran out. After 12:30 pm IST run `npm run evals -- --label=gemini-3.5-flash --only=E05,E07,E11 --pause=20` (expected: E05/E07 Path A ₹500, E11 ₹2,350, gate passes). Then look at the missed scratches E04 (left panel) and E06 (mudguard). Gemini free limits are per model (2.5 Flash: 20/day); see the comment in `_shared/openrouter.ts`.
3. **Act on the reviewer findings**, then commit the skill, agent and fixes (ask the user before committing or pushing).
4. **Deploy the website to Vercel.** The user imports the GitHub repo and adds the two `VITE_` env vars. Confirm deep links work.
5. **Finish Milestone 7:** cost and accuracy numbers in the README, optional second eval run on another model, mark the milestone done in the build log, commit and push (ask first).
6. Optional for the job application: showcase write-up, architecture diagram, short demo video.

## Working rules (from the user)
Plan first and wait for "go ahead". Never commit or push without asking. Plain, concise explanations; the user is a product manager. Dark, premium, laptop-only UI.
