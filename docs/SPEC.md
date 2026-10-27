# iInspect — Build Spec

Oct 24, 2026 · @saimukesh · updated Oct 27, 2026 to match what was built

## Overview and how to use this spec

iInspect is a working prototype that inspects a returned rental scooter from photos, bills minor damage at the counter, and sends major or uncertain damage to a human inspector. It is a demo for a two-wheeler rental business, built to run live in about two minutes.

This spec describes the product **as built**. The plan it started from (Oct 24) is in git history; the section "What changed from the original plan" lists every difference.

**How to use with Claude Code:** `AGENTS.md` tells every coding agent to read this file before any task. Build one milestone at a time and review each before moving on.

**Demo goal:** run scooters end to end. A light scratch goes through Path A (instant bill). A dented panel goes through Path B (diagnostic order, inspector confirms the final amount). A return the inspector disagrees with is sent back and assessed again.

**Assumptions:**

- A laptop website (1280–1920px wide) used by two people at the rental shop: the **Detector** (counter staff) and the **Inspector** (parts inspector). No phone app.
- All model calls go through one shared client. Google's Gemini API (free tier) is tried first, OpenRouter's free models are the fallback, so swapping models is one config change.
- Prices are in INR from a small parts and labour table. They are demo figures, not any real company's rates.
- No payment gateway and no login. "Paid" is a status the Detector sets; the two roles are switched from a menu. The deposit is fixed at ₹2,000 (`DEPOSIT_INR = 2000` in one shared constants file).
- Fake rider data only; scooter plates are made up.

## User flow

1. **Pickup (optional in the demo):** the Detector records a new pickup: the branch, scooter details (plate, model, colour), a demo rider, and 4 pickup photos (front, rear, left, right). The rental then shows as active. The 3 demo rentals already have pickup photos.
2. **Return:** the Detector opens the active rental and adds 4 return photos (sample set or files), reviews them and uploads them.
3. **Assess:** the Damage, Estimate and Bill/Order agents assess the return; the Router (plain code) checks the rules and picks the path.
4. **Path A** (no rule fires): the Detector reviews the bill and the rider's note, taps "Confirm and bill", and the rider pays or it is deducted from the ₹2,000 deposit. The Detector can escalate to Path B at any time with a reason.
5. **Path B** (any rule fires, or the Detector escalates): a diagnostic order is raised and auto-filled, the estimate is held from the deposit as provisional, and the scooter goes to refurbishment. The Inspector then either:
   - **confirms:** approves or adjusts each line, can add parts the AI missed (from the catalog, with the side of the scooter), and confirms the final amount. The Detector is notified with the final amount and the difference from the estimate, and settles with the rider; or
   - **sends it back for reassessment** with a reason (missed damage, wrong part, wrong severity, photos unclear, or other with a note). The order closes, the Detector is notified, and the return appears under "Sent back by the inspector" with its saved return photos already loaded. The Detector assesses it again and the Router decides the path as usual.
6. The rider-facing status timeline records each change: returned, assessing, billed or order raised, at refurb, inspected, counter notified, settled (and sent back, when it happens).
7. **Dashboard:** anyone can open the fleet dashboard to see every assessed return by scooter (with the side of each damage), the Path A/B split, money recovered and returns per Goa branch.

**Settlement rule (both paths):** the deposit is always ₹2,000. If the final amount is ₹2,000 or less, deduct it and refund the balance. If it is more, deduct the full deposit and show "Collect ₹X more", where X = final amount − 2,000. A final amount of ₹0 means a full refund.

## Tech stack and architecture

- **Frontend:** Vite + React + React Router + Tailwind (TypeScript strict), Inter font, Phosphor icons (duotone). Black background, white type, greys; colour only for status (green Path A, amber Path B, red errors). Hosted on Vercel; every push to `main` redeploys the same link.
- **Backend:** Supabase. Postgres for data (row-level security on every table), Storage for photos, Realtime for live notifications, Edge Functions (Deno, TypeScript) for everything that writes.
- **Edge Functions:**
  - `start-rental`: records a pickup (scooter, rider, 4 pickup photos).
  - `assess-return`: runs Damage → Estimate → Router → Bill or Order and saves the result.
  - `override-route`: the Detector escalates A → B, or downgrades an AI-raised B → A, with a reason.
  - `confirm-order`: saves the Inspector's final amounts and added parts, notifies the Detector.
  - `send-back`: the Inspector sends an order back for reassessment, notifies the Detector.
  - `settle-return`: the counter settlement with the rider, for both paths.
- **Models:** all calls through `supabase/functions/_shared/openrouter.ts`. Model ids starting `gemini/` go to Google's Gemini API, anything else to OpenRouter. Each call is logged to `agent_runs`.
- **CI:** GitHub Actions runs lint, typecheck, unit tests, the eval-set check and a build on every push. The 15 AI evals run on demand (they use model calls).
- **Built with Claude Code:** `AGENTS.md` (rules), a reviewer agent (`.claude/agents/reviewer.md`) and an evals skill (`.claude/skills/run-evals/SKILL.md`).

## The agents

There are four AI agents plus the Router, which is plain code. Each agent's instructions (prompt) live in `supabase/functions/_shared/prompts.ts`. Every output is validated with Zod and the rule checks below before anything is saved. Agents never write to the database; the function does, after validation.

| Agent | Input | Output (JSON) | Default models |
| --- | --- | --- | --- |
| Damage agent (vision) | 4 pickup + 4 return photos (front, rear, left, right) | New damage items: `panel`, `type` (scratch, dent, crack, broken part), `severity` (1–3), `photo_ref` (the side), `confidence` (0–1), plus `photo_quality_ok`. It first fills a per-angle `checks` list (what it sees at pickup and return, and whether anything changed) | Gemini 3.5 Flash, then Gemini 2.5 Flash, then Nemotron (OpenRouter) |
| Estimate agent | Damage items + the parts catalog for that model | One `part_code` and a one-line `reasoning` per damage item. No prices: the code looks up parts and labour in `parts_catalog` | Gemini Flash-Lite models, then Gemma, then Nemotron |
| Bill agent (Path A) | Damage found and parts chosen | `bill_text`: 1–3 friendly sentences for the rider, no amounts | Same as Estimate |
| Order agent (Path B) | Damage, parts and the routing reasons | Diagnostic order: `summary`, `priority` (high, normal, low), `rider_message` saying the amount is provisional, no amounts | Same as Estimate |

The Damage agent's prompt has a checklist of spots per side (front panel, mudguard, lamps, indicators, side panels, floor board edge, mirrors) and asks it to report a doubtful mark with confidence below 0.75 so a person checks it: missing real damage is worse than a doubtful report.

**Rule checks on every agent answer:**

- The answer must match its Zod schema.
- Only part codes from the catalog. Any rupee figure comes from `parts_catalog`, never from a model.
- A scratch must be priced with the `SCRATCH-POLISH` code, and polish is never used for a dent, crack or broken part.
- Bill and order text must not contain any rupee amount.

If an answer fails, the agent gets one retry with the error. If it fails again, the return is marked `needs_human` and goes to Path B.

## Routing logic

Routing is plain code in `supabase/functions/_shared/router.ts`, not a model call, so it is testable and predictable. A return goes to Path B if any one rule fires; otherwise Path A. The threshold and minimum confidence are read from the `config` table (₹1,500 and 0.75).

| Reason | Fires when |
| --- | --- |
| `amount_over_threshold` | Total is above ₹1,500 |
| `low_confidence` | Any damage item has confidence below 0.75 |
| `poor_photos` | The Damage agent says a photo is too blurry, dark, cropped or the wrong angle |
| `structural` | Any crack or broken part |
| `staff_escalation` | The Detector escalated |
| `needs_human` | An agent failed its checks twice |

Override rules:

- The Detector can escalate A → B at any time with a one-line reason.
- The Detector can downgrade B → A only for AI-raised reasons, only before inspection, and only with a reason. Staff escalations and `needs_human` cannot be downgraded (a `needs_human` downgrade would bill ₹0 for real damage).
- Every override is saved to `overrides` with who, when, from, to and reason.
- A return can be assessed again only while nothing is final: an unbilled Path A, a Path B raised only because the AI failed (not yet inspected), or a return the Inspector sent back. A billed, escalated or inspected return cannot be re-run.

## Database and storage

Supabase Postgres with row-level security on every table, migrations in `supabase/migrations/` (never change the schema without a new migration), and seed data in `supabase/seed.sql`. Photos go in a private storage bucket `vehicle-photos`, at `{rental_id}/{pickup|return}/{angle}.jpg`.

| Table | Key columns | Purpose |
| --- | --- | --- |
| `vehicles` | id, model, reg\_no, colour | The fleet: 3 demo Honda Activas (GA07M2211/12/13), 4 sample-history scooters, plus any added at pickup |
| `riders` | id, name, phone | Demo riders (fake data only) |
| `rentals` | id, vehicle\_id, rider\_id, deposit\_inr (always 2000), status (active, returned, closed), branch (one of 6 Goa branches), picked\_up\_at, returned\_at | One rental per pickup |
| `photos` | id, rental\_id, stage (pickup / return), angle, storage\_path | Eight photos per rental |
| `assessments` | id, rental\_id, path (A / B), route\_reasons\[\], total\_inr, status, photo\_quality\_ok, rider\_message, deducted\_inr, refund\_inr, collect\_extra\_inr | One per return |
| `damage_items` | id, assessment\_id, panel, type, severity, confidence, photo\_ref | Damage agent output |
| `line_items` | id, assessment\_id, damage\_item\_id (null if inspector-added), source (ai / inspector\_added), part\_code, parts\_inr, labour\_inr, total\_inr, final\_inr, reasoning, angle | Estimate, then the inspector-confirmed amount; `angle` is the side, for the dashboard |
| `parts_catalog` | part\_code, vehicle\_model, description, parts\_inr, labour\_inr | The only source of prices |
| `diagnostic_orders` | id, assessment\_id, status, summary, priority, route\_reasons\[\], staff\_note, provisional\_total\_inr, held\_inr, inspector\_notes, final\_total\_inr | Path B only; auto-filled when raised |
| `reassessments` | id, rental\_id, reason, note, ai\_result (copy of the AI's answer), requested\_at, resolved\_at | Each send-back; at most one open per rental |
| `status_events` | id, assessment\_id, status, at | Timeline |
| `overrides` | id, assessment\_id, actor, from\_path, to\_path, reason, at | Staff and inspector disagreements with the AI |
| `agent_runs` | id, assessment\_id, agent, model, tokens\_in, tokens\_out, latency\_ms, cost\_usd | Every model call: cost, speed, failures |
| `config` | key, value | `threshold_inr` (1500), `min_confidence` (0.75) |
| `notifications` | id, recipient\_role, assessment\_id, message, read\_at | Bell notices; the app listens with Realtime |

Status values for an assessment: `returned → assessing → billed → paid` (Path A) or `returned → assessing → order_raised → at_refurb → inspected → counter_notified → settled` (Path B). `sent_back` marks a return the Inspector sent back; it leaves that status when it is assessed again.

Parts catalog for the Honda Activa (demo prices, parts + labour): scratch polish ₹500, front panel / left or right side panel ₹1,850, mudguard ₹850, headlamp ₹1,600, tail lamp ₹1,150, mirror ₹360, indicator ₹320. So a light scratch stays under the ₹1,500 limit and any panel replacement goes over it.

## Screens

One website, one job per page. A role menu switches between Detector and Inspector; the Dashboard link is in the top bar.

**Detector (counter staff)**

1. **Rentals:** active rentals, "Sent back by the inspector" (with the reason), and a **New pickup** button.
2. **New pickup, details:** branch, plate, model, colour and demo rider.
3. **New pickup, photos:** the 4 pickup photos (sample set or files).
4. **Return photos:** the 4 return photos (sample set or files); for a sent-back return, the saved photos are pre-loaded with the reason shown.
5. **Review:** pickup and return photos side by side before upload.
6. **Uploaded:** confirmation, then "Assess damage".
7. **Assessment:** damage found, line items, the route badge (A or B with reasons).
8. **Bill (Path A):** the rider's note and charges; "Confirm and bill" or "Escalate to inspection".
9. **Order (Path B):** the provisional hold and the status timeline.
10. **Notifications:** inspector confirmations and send-backs.
11. **Settlement:** estimate vs final, what the Inspector changed, deducted / refund / "Collect ₹X more", "Mark settled".

**Inspector**

12. **Order queue:** open diagnostic orders, newest first, with AI total and route reasons.
13. **Order review:** photos, each AI line with approve or adjust, "Add missing damage" (catalog part + side), notes, "Confirm final amount", and "Send back for reassessment".

**Shared**

14. **Dashboard:** an Insights box (returns assessed, Path A/B split, money recovered, and a bar chart of returns by branch: Ponda, Mapusa, Panaji, Calangute, Margao, Vasco da Gama) and a Scooters box (each scooter's returns: date, side, damage, path, final amount). Eval test returns are left out.

## Repo structure, AGENTS.md and CLAUDE.md

`AGENTS.md` holds the real rules for any coding agent; `CLAUDE.md` contains one line, `@AGENTS.md`, so Claude Code imports it and other coding agents (Cursor, Codex, Copilot) read the same file.

```
i-inspect/
├── AGENTS.md                  # rules for coding agents
├── CLAUDE.md                  # @AGENTS.md
├── README.md                  # setup, run, deploy, commands
├── docs/SPEC.md               # this doc
├── docs/BUILD_LOG.md          # what was built, fixed and learned, per milestone
├── docs/NEXT_STEPS.md         # current status and to-do list
├── .claude/agents/reviewer.md # reviewer agent: checks code against AGENTS.md before commits
├── .claude/skills/run-evals/  # skill: when and how to run the evals
├── app/pages/                 # one file per page (detector/, inspector/, Dashboard)
├── components/                # shared UI pieces
├── lib/                       # Supabase client and data helpers
├── public/architecture.html   # one-page architecture diagram (/architecture.html)
├── assets/samples/            # demo photos (3 scooters × pickup + 3 return sets)
├── scripts/                   # photo builder, demo reset, sample history, eval setup
├── supabase/
│   ├── migrations/            # every schema change
│   ├── seed.sql               # demo fleet, riders, parts catalog, config
│   └── functions/
│       ├── _shared/           # prompts, schemas, router, model client, rules
│       ├── start-rental/  assess-return/  override-route/
│       └── confirm-order/  send-back/  settle-return/
├── evals/
│   ├── cases/                 # 15 cases: photos + expected.json
│   ├── results/               # one scorecard file per labelled run
│   └── run.ts                 # the eval runner
└── .github/workflows/ci.yml
```

## Evals, tests, CI/CD and cost

The eval set is 15 cases in `evals/cases/E01…E15`, built from the real Activa photos. Each has 4 pickup photos, 4 return photos and an `expected.json` answer sheet (expected path, panels to flag, acceptable amount range).

| Case group | Cases | Expected result |
| --- | --- | --- |
| No new damage | E01–E03 | ₹0, Path A, nothing flagged. Any flagged damage is a false positive. |
| Minor scratch | E04–E07 | The scratched panel flagged (left, right or mudguard), ₹400–600, Path A |
| Dent or broken part | E08–E11 | Damage flagged, Path B by amount or the structural rule |
| Blurry or wrong angle | E12–E13 | Path B (poor photos). Never a confident bill. |
| Damage already at pickup | E14–E15 | Ignored: ₹0, Path A |

`evals/run.ts` (`npm run evals`) sends each case through the real deployed pipeline on its own hidden eval rental, clears that rental before each case, and prints a scorecard: routing accuracy, Path B cases billed as A, panel recall, false positives, amount in range, latency and cost. Results are saved per labelled run in `evals/results/<label>.json`, so a run cut short by the free daily limit resumes where it stopped. The `run-evals` skill tells Claude when to run them and how to read the result.

**Safety gate:** routing accuracy at least 90% and no case that should go to Path B billed as Path A.

**Latest results:** `gemini-3.5-flash` (15 cases): routing 15/15, gate passes, no B→A, no false positives, but panel recall 67% (small scratches missed). After the damage prompt fix, `scratch-prompt-v2` (8 cases): E04 and E05 found, clean and pre-existing cases still ₹0, E06 (mudguard scratch) still missed: a known hard case, because the scooter fills only a third of that photo. A full 15-case run on the latest prompt is still to do.

**Unit tests** (no model involved, 90 tests): router rules, settlement maths (₹0 full refund, ₹650 refund ₹1,350, exactly ₹2,000 no refund, ₹2,600 collect ₹600 more), schemas and rule checks, inspection rules (overrides, re-runs, send-back), pickup checks, model routing, eval scoring and dashboard sums.

**CI** (`.github/workflows/ci.yml`): every push runs lint, typecheck, unit tests, the eval-set check and a build. The AI evals run from **Actions → CI → Run workflow**, not on every push, because each run uses about 45 free model calls.

**Cost:** the free tiers cost ₹0 but have small daily limits (Gemini 2.5 Flash: 20 calls a day per model; limits reset 12:30 pm IST). `agent_runs` records the cost and latency of every call.

**Deploy:** Edge Functions with `npx supabase functions deploy <name> --use-api`; website on Vercel (https://inspection-psi-eight.vercel.app), redeployed on every push to `main`.

## Build order

Each milestone ends with something you can run, a check run and a line in the build log.

1. **Scaffold:** done. Vite + React app, Supabase project, folder structure, `AGENTS.md`, `CLAUDE.md`, lint and tests.
2. **Data:** done. Migrations, RLS, storage bucket, seed (3 scooters, 3 riders, parts catalog).
3. **Capture:** done. Rentals page and four-angle return photos with upload; sample photos.
4. **Damage agent:** done.
5. **Estimate, routing, bill/order:** done. Path A end to end; router unit-tested.
6. **Inspector flow:** done. Order queue and review, `confirm-order`, overrides, timeline, notifications, settlement.
7. **Evals, CI and deploy:** mostly done. 15 cases, runner, GitHub Actions, Vercel. Still to do: a full eval run on the latest prompt and cost numbers in the README.

**Added after the original plan:**

8. **New pickup:** done. Record the branch, scooter details, a demo rider and 4 pickup photos.
9. **Send back for reassessment:** done. The Inspector returns a wrong AI answer to the Detector with a reason.
10. **Dashboard:** done. Fleet damage history and returns by branch.

Prompt pattern for each milestone: "Do Milestone N only, plan first, run checks, stop and summarise."

## What changed from the original plan

| Original plan (Oct 24) | As built | Why |
| --- | --- | --- |
| One Expo app: phone for counter staff, web for the inspector | Laptop website only (Vite + React) | Simpler to build and demo; both roles work at a desk |
| "Counter staff" and "parts inspector" | **Detector** and **Inspector** | Clearer role names in the UI |
| Three agents: Damage, Estimate, Order (Order also wrote the bill) | Four: Damage, Estimate, **Bill** (Path A), Order (Path B) | Separate, smaller prompts are easier to check |
| All models via OpenRouter, Claude-class vision model | Google Gemini free tier first, OpenRouter free models as fallback | OpenRouter's free limit (about 50 calls a day) ran out during testing |
| Zod checks only | Zod plus rule checks: scratch must be polish, no rupee amounts in text | Evals showed scratches priced as a new panel |
| Router reasons: five | Six: added `needs_human` | An agent that fails twice must go to a person |
| TVS Jupiter / Radeon demo fleet | Honda Activas with made-up plates (GA07M2211/12/13) | Matches the real, redacted photos used |
| Pickup photos assumed to exist | **New pickup** screens and `start-rental` | Closes the loop for new scooters |
| Inspector could only confirm | Inspector can also **send back for reassessment** (`send-back`, `reassessments` table, `sent_back` status) | A wrong AI answer should be redone, not hand-fixed |
| No reporting | **Dashboard** (`line_items.angle` for the side of each damage, `rentals.branch` for returns by branch) | Fleet view across branches |
| Evals in CI on every push | Every push runs the free checks; AI evals run on demand | Each run uses about 45 free model calls |
| Phone build via Expo / EAS | Website on Vercel | No phone app |
| Name "I Inspect" | **iInspect** | Branding |
