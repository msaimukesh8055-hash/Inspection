---
name: run-evals
description: Run the 15-case eval set against the deployed AI pipeline and read the scorecard. Use after any change that can alter what the app decides for a returned scooter (agent prompts, models, agent code, router rules or config, parts catalog, prices), or when asked to "run evals" or "check the AI still works". Not needed for UI-only changes.
---

# Run the evals

The eval runner (`evals/run.ts`, `npm run evals`) sends 15 known returns through the real deployed pipeline (damage → estimate → router → order) and marks the answers against each case's `expected.json`. This skill is the routine around it: prepare, run within the free-model budget, read the result, record it.

## 1. Decide whether to run

Run when the change touches any of:
- `supabase/functions/_shared/prompts.ts`, `schemas.ts`, `openrouter.ts` (model order), `agent.ts`, `orderAgent.ts`, `outcome.ts`
- `supabase/functions/assess-return/*`
- `supabase/functions/_shared/router.ts` or the `config` table (threshold_inr, min_confidence)
- `parts_catalog` (new parts or prices)

Skip for UI-only changes (`app/`, `components/`, styles, copy).

If function code changed, deploy it first, or the evals test the old code:
`npx supabase functions deploy assess-return --use-api`

## 2. Check the budget

Models are tried in order: Google's Gemini free tier first, OpenRouter's free Nemotron last (the `defaults` list in `_shared/openrouter.ts`).
- Gemini's free limits are per model and small: Gemini 2.5 Flash allows 20 calls a day; each model also has a per-minute limit. They reset at midnight Pacific (12:30 pm IST).
- OpenRouter free models allow about 50 calls a day (resets 00:00 UTC, 5:30 am IST).
- One case uses 3–5 calls, so a full 15-case run needs about 45.
- **Ask the user before a full 15-case run.** Retrying a few cases with `--only` after a fix is fine.
- If a demo or interview is today, do not run evals. Keep the calls for the demo.
- If only part of the budget is left, run anyway: the runner saves each case and stops cleanly once every model is out for the day (exit code 2). Run `npm run evals` again after the reset and it resumes.

## 3. Prepare

```bash
npm run evals:check     # 15 cases, spec group counts, 120 photos (no AI calls)
npm run evals:setup     # only the first time: creates the hidden eval rentals (closed, never in Active rentals)
```

The eval rentals (`…-000000000401` to `…-000000000415`) are separate from the demo rentals, so a demo reset is not needed for evals. Do not run `npm run demo:reset` in the middle of a live demo.

Before each case the runner clears that eval rental (the `reset_eval_rental` database function, which only touches the 15 eval rentals), because `assess-return` refuses to overwrite a return that is already with the inspector. Eval Path B cases still raise real orders that show in the live Inspector queue (the dashboard leaves them out); tell the user after a run, and clear them if they will demo soon.

## 4. Run

Label every run after what changed, so results stay comparable:

```bash
npm run evals -- --label=<what-changed>      # e.g. --label=dent-prompt-v2, --label=gemma
npm run evals -- --label=<label> --fresh     # rerun everything under an existing label
npm run evals -- --only=E06,E08              # retry specific cases after a fix
npm run evals -- --label=<label> --pause=45  # seconds between cases (default 15); use 45 on Gemini's free tier
```

Results are saved to `evals/results/<label>.json` after every case.

## 5. Read the scorecard

The gate fails if routing accuracy is below 90% or any case that should go to Path B was billed as Path A (`⚠ B→A`). A B→A miss is the costliest mistake: always fix it first, even if the gate passes overall.

For each failed case, find which step went wrong by reading its row (expected path, got, total, what was found):

| Symptom | Likely cause | Where to fix |
|---|---|---|
| Damage not found, or found at the wrong angle | Damage agent missed it | damage prompt in `prompts.ts`, or the model order |
| Damage flagged on a clean or pre-existing case (false positive) | Damage agent invented or misjudged it | damage prompt: "only new damage", pickup comparison |
| Damage right, amount out of range | Estimate agent picked the wrong part (e.g. a new panel for a scratch) | estimate prompt rules |
| Damage and amount right, path wrong | Router rules or config | `router.ts`, `config` table (has unit tests: run `npm test`) |
| Bad-photo case billed at the counter | Damage agent said photos were fine | photo_quality_ok guidance in the damage prompt |
| `error` rows | Model outage or rate limit, not a wrong answer | rerun those cases with `--only` |

Fix one cause at a time, deploy, and rerun just the affected cases with `--only` before a full run.

## 6. Compare and record

- Compare with the previous label's `scorecard` in `evals/results/`: routing accuracy, panel recall, false positives, amount in range, avg latency, cost.
- Append 2–3 lines to `docs/BUILD_LOG.md`: what changed, the before/after numbers, which cases still fail and why.
- Keep the results JSON in the repo. The README's numbers come from it.

## Don'ts

- Don't edit a case's `expected.json` to make a failing case pass. Expected answers change only when the scenario itself changes (use `npm run evals:make`).
- Don't run evals on the morning of a demo with free models.
- Don't count `error` rows as model mistakes when explaining results. Retry them first.
