# Next steps (handoff, 2026-10-27)

Where the build stands and what to do next. Read this, `AGENTS.md`, `docs/SPEC.md` and the end of `docs/BUILD_LOG.md` first.

## Status
- Live: app https://inspection-psi-eight.vercel.app and architecture page `/architecture.html`. Vercel redeploys the same link on every push to `main`.
- Built and working: Detector + Inspector, New pickup, Path A billing, Path B settlement, overrides, send back for reassessment, dashboard (`/dashboard`, returns by branch), "iInspect" name.
- AI: Google's Gemini free tier first (per-model daily limits, 20 a day for 2.5 Flash, reset 12:30 pm IST), OpenRouter Nemotron as fallback.
- Docs (SPEC, README, AGENTS, skill, reviewer) brought up to date with the build on 2026-10-27.
- Demo: run `npm run demo:reset` before a demo. It leaves GA07M2211 (Asha) and GA07M2213 (Meera) active and GA07M2212 (Vikram) sent back by the inspector, and keeps the dashboard's sample history (`npm run history:seed` reloads it).

## Evals
- Latest full run `gemini-3.5-flash`: routing 15/15, gate passes, no B→A, no false positives, panel recall 67%.
- After the damage prompt fix, `scratch-prompt-v2` (8 cases): E04 and E05 found; E06 (mudguard) still missed, kept as a known hard case.
- **To do:** a full 15-case run with the latest prompt (about 45 free calls). Ask the user before running it, and never on a demo day.

## Reviewer findings (2026-10-25) still open
**Should-fix**
- `confirm-order`: duplicate `line_id`s pass the check and inflate the final total.
- Eval Path B cases raise real orders that show in the live Inspector queue and bell. Filter eval rentals out, or clean up after scoring.
- `override-route` copies the route reasons by hand. Export `ROUTE_REASONS` from `router.ts` instead.
- Green (Path A colour) is used for "Approved", "Confirmed" and "Settled" on Path B screens. Use neutral grey.

**Nits**
- inline `saveOutcome`
- dead `order_raised` check in `confirm-order`
- the "no order" error message wording
- the downgrade timeline step going backwards
- leftover `const Icon = Moped`
- explain the channel-name suffix in `lib/notifications.ts`
- catch `markRead` failures
- tighten eval panel keywords (`panel`, `front` match too much)
- decide which `evals/results/` files to keep
- confirm with the user that inspector line edits don't need `overrides` rows

## To do, in order
1. **Full eval run** on the latest prompt (ask first).
2. **Reviewer should-fixes** above.
3. **Finish Milestone 7:** cost and accuracy numbers in the README, mark the milestone done in the build log.
4. Optional, offered to the user and not yet decided:
   - redo the photo sticker that reads "I INSPECT"
   - hide the old TVS models in the New pickup dropdown
   - Estimate reasoning wording tweak

## Working rules (from the user)
Plan first and wait for "go ahead". Never commit or push without asking. Don't run the full eval set without asking. Plain, concise explanations; the user is a product manager. Dark, premium, laptop-only UI.
