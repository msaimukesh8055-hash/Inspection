# Next steps (handoff, 2026-10-25)

Where the build stopped and what to do next. Read this, `AGENTS.md` and the end of `docs/BUILD_LOG.md` first.

## Status
- Milestones 1–6 done, committed and pushed. The app works end to end (Detector + Inspector, live notifications, Path A billing, Path B settlement, overrides).
- Demo uses real photos of a Goa rental Honda Activa fleet (GA07M2211 clean, GA07M2212 scratch, GA07M2213 dent on the left side panel).
- Milestone 7 groundwork is committed and pushed (`6218a3a`): 15 eval cases, resumable runner with safety gate, CI (passing on GitHub), `vercel.json`.
- GitHub secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the user was adding them. Check before using the "Run evals" button.
- New, not yet committed: `.claude/skills/run-evals/SKILL.md`, `.claude/agents/reviewer.md`, and the `.gitignore` entry for `.claude/launch.json`.
- A reviewer pass was run on `b815513..HEAD`. The 3 must-fix findings are fixed (see BUILD_LOG, "Reviewer must-fixes"); the should-fix items and nits below are still open. Verify each against the code before fixing, then plan the fixes with the user first.

## Reviewer findings (2026-10-25), not fixed yet
**Must-fix:** all 3 done on 2026-10-25 (₹0 downgrade, real data and history purge, re-run guard).

**Should-fix**
- `confirm-order`:
  - duplicate `line_id`s pass the check and inflate the final total
  - no guard against two confirms at once (claim the order with `.eq('status','open')` first)
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
2. **Run the 15 evals** with the `run-evals` skill (`npm run evals -- --label=free-nemotron`). It resumes the next day if the limit runs out.
3. **Act on the reviewer findings**, then commit the skill, agent and fixes (ask the user before committing or pushing).
4. **Deploy the website to Vercel.** The user imports the GitHub repo and adds the two `VITE_` env vars. Confirm deep links work.
5. **Finish Milestone 7:** cost and accuracy numbers in the README, optional second eval run on another model, mark the milestone done in the build log, commit and push (ask first).
6. Optional for the job application: showcase write-up, architecture diagram, short demo video.

## Working rules (from the user)
Plan first and wait for "go ahead". Never commit or push without asking. Plain, concise explanations; the user is a product manager. Dark, premium, laptop-only UI.
