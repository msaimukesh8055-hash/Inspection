# DriveX Rental Return Inspector — Build Spec

Oct 24, 2026 · @saimukesh

## Overview and how to use this spec

Build a working prototype that inspects a returned rental scooter from photos, bills minor damage at the counter, and sends major damage to a human parts inspector. It is a demo for DriveX's two-wheeler rental business, built to run live in about two minutes.

**How to use with Claude Code:** export this doc as Markdown, save it as `docs/SPEC.md` in an empty repo, then paste the first prompt from the last section. Build one milestone at a time and review each before moving on.

**Demo goal:** run two scooters end to end. One with a light scratch goes through Path A (instant bill). One with a dented panel goes through Path B (diagnostic order, inspector confirms the final amount).

**Assumptions (change if needed):**

- One Expo app that runs on a phone (counter staff) and in a web browser (parts inspector).
- All models are called through OpenRouter, so swapping between Claude, GPT and open-source models is one config change.
- Prices are in INR from a small parts and labour table you create. They are demo figures, not DriveX's real rates.
- No payment gateway. "Paid" is a status the staff member sets. The deposit is fixed at ₹2,000, hard-coded as DEPOSIT\_INR = 2000 in one shared constants file.

## User flow

&#91;embedded content: return flow · two paths, one decision\]

Text version for Claude Code (diagrams don't export):

1. Staff opens the rental and takes four return photos. Pickup photos already exist.
2. The damage and estimate agents assess the return; the router checks the rules.
3. **Path A** (no rule fires): staff reviews the bill, taps "Confirm and bill", and the rider pays or it is deducted from the ₹2,000 deposit.
4. **Path B** (any rule fires, or staff escalates): a diagnostic order is raised and auto-filled, the estimate is held from the deposit as provisional, and the scooter goes to refurbishment. The parts inspector approves or adjusts each line, can add damage the AI missed, and confirms the final amount. The counter person is notified with the final amount and the difference from the estimate, and settles with the customer.
5. The rider sees each status change: returned, assessing, billed or order raised, at refurb, inspected, counter notified, settled.

**Settlement rule (both paths):** the deposit is always ₹2,000. If the final amount is ₹2,000 or less, deduct it and refund the balance. If it is more, deduct the full deposit and show "Collect ₹X more" on the counter screen, where X = final amount − 2,000. A final amount of ₹0 means a full refund.

## Tech stack and architecture

&#91;embedded content: architecture · app, Supabase, OpenRouter, CI\]

Text version for Claude Code:

- **Frontend:** Expo (React Native, Expo Router, TypeScript). One codebase runs on a phone for counter staff and as a web build for the inspector.
- **Backend:** Supabase. Postgres for data, Storage for photos, Edge Functions (Deno, TypeScript) for the agent pipeline.
- **Pipeline:** `assess-return` runs Damage → Estimate → Router → Order in sequence and writes results. `confirm-order` saves the inspector's final amount and notifies the counter person. settle-return records the counter settlement with the customer, for both paths.
- **Models:** all calls through OpenRouter from one shared client. A vision model for damage; a cheap open-source model for estimate and order.
- **CI:** GitHub Actions runs lint, typecheck, unit tests and the eval set on every push.

## The three agents

Each agent is one Supabase Edge Function with a strict JSON output schema, validated with Zod before anything is saved. Agents never write to the database directly; the function does, after validation.

| Agent | Input | Output (JSON) | Model (via OpenRouter) |
| --- | --- | --- | --- |
| Damage agent | 4 pickup photos + 4 return photos (front, rear, left, right) | List of new damage items: `panel`, `type` (scratch, dent, crack, broken part), `severity` (1–3), `photo_ref`, `confidence` (0–1), plus `photo_quality_ok` | Strong vision model (Claude Sonnet class) |
| Estimate agent | Damage items + `parts_catalog` table | Line items: `damage_id`, `part_code`, `parts_inr`, `labour_inr`, `total_inr`, `reasoning` (one line) | Cheap open-source model (Llama or Qwen class); prices come from the table, the model only maps damage to part codes |
| Order agent | Final line items + route (A or B) | Path A: rider-facing bill text. Path B: diagnostic order (summary, line items, priority) and a rider message saying the amount is provisional | Cheap open-source model |

Rules for every agent:

- Never invent prices. Any rupee figure must come from `parts_catalog`.
- On invalid JSON, retry once, then mark the return `needs_human` and route to Path B.
- Log model name, tokens, latency and cost per call to `agent_runs`.

## Routing logic

Routing is plain code in `supabase/functions/_shared/router.ts`, not an LLM call, so it is testable and predictable. A return goes to Path B if any one rule fires; otherwise Path A.

```ts
const THRESHOLD_INR = 1500;   // config table, editable
const MIN_CONFIDENCE = 0.75;  // config table, editable

function route(r: ReturnAssessment): { path: 'A' | 'B'; reasons: string[] } {
  const reasons: string[] = [];
  if (r.total_inr > THRESHOLD_INR) reasons.push('amount_over_threshold');
  if (r.items.some(i => i.confidence < MIN_CONFIDENCE)) reasons.push('low_confidence');
  if (!r.photo_quality_ok) reasons.push('poor_photos');
  if (r.items.some(i => i.type === 'crack' || i.type === 'broken part')) reasons.push('structural');
  if (r.staff_escalated) reasons.push('staff_escalation');
  return { path: reasons.length ? 'B' : 'A', reasons };
}
```

Override rules:

- Staff can escalate A → B at any time with a one-line reason.
- Staff can downgrade B → A only for AI-raised reasons, and only with a reason. Staff escalations cannot be downgraded.
- Every override is saved to `overrides` with who, when, from, to and reason. This is your eval signal.

## Database and storage

Supabase Postgres with row-level security on every table, migrations in `supabase/migrations/`, and seed data in `supabase/seed.sql`. Photos go in a private storage bucket `vehicle-photos`, at `{rental_id}/{pickup|return}/{angle}.jpg`.

| Table | Key columns | Purpose |
| --- | --- | --- |
| `vehicles` | id, model, reg\_no, colour | Demo fleet (e.g. TVS Jupiter, TVS Radeon) |
| `riders` | id, name, phone | Demo riders (fake data only) |
| `rentals` | id, vehicle\_id, rider\_id, deposit\_inr (always 2000, from DEPOSIT\_INR), status, picked\_up\_at, returned\_at | One rental per pickup |
| `photos` | id, rental\_id, stage (pickup / return), angle, storage\_path | Eight photos per rental |
| `assessments` | id, rental\_id, path (A / B), route\_reasons\[\], total\_inr, status, deducted\_inr, refund\_inr, collect\_extra\_inr | One per return |
| `damage_items` | id, assessment\_id, panel, type, severity, confidence, photo\_ref | Damage agent output |
| `line_items` | id, assessment\_id, damage\_item\_id (null if inspector-added), source (ai / inspector\_added), part\_code, parts\_inr, labour\_inr, total\_inr, final\_inr | Estimate, then inspector-confirmed amount |
| `parts_catalog` | part\_code, vehicle\_model, description, parts\_inr, labour\_inr | The only source of prices |
| `diagnostic_orders` | id, assessment\_id, status, summary, priority, route\_reasons\[\], staff\_note, provisional\_total\_inr, held\_inr, inspector\_id, inspector\_notes, final\_total\_inr | Path B only; auto-filled when raised |
| `status_events` | id, assessment\_id, status, at | Timeline shown to the rider |
| `overrides` | id, assessment\_id, actor, from\_path, to\_path, reason, at | Staff and inspector disagreements with the AI |
| `agent_runs` | id, assessment\_id, agent, model, tokens\_in, tokens\_out, latency\_ms, cost\_usd | Cost and latency tracking |
| `config` | key, value | Threshold and confidence values |

Status values for an assessment: `returned → assessing → billed → paid` (Path A) or `returned → assessing → order_raised → at_refurb → inspected → counter_notified → settled` (Path B).

Add a `notifications` table (id, recipient\_role, assessment\_id, message, read\_at). When the inspector confirms, insert a row for the counter role; the counter app listens with Supabase Realtime and shows it at once.

## Screens

Six screens in one Expo Router app. Counter screens are built for a phone; inspector screens for a laptop browser.

**Counter staff (phone)**

1. **Rental list:** active rentals, tap one to start a return. Include a "Sample gallery" toggle that loads preset photos for the demo.
2. **Return capture:** a guided four-angle camera (front, rear, left, right) with the matching pickup photo shown as a ghost overlay. An "Assess" button sends all eight photos.
3. **Assessment result:** side-by-side pickup and return photos with damage boxes, line items with amounts, and a route badge (A or B, with reasons). Path A buttons: "Confirm and bill", "Escalate to inspection". Path B shows the provisional hold message and the status timeline.

**Parts inspector (web)**

4. **Order queue:** open diagnostic orders, newest first, with AI total and route reasons.
5. **Order review:** the auto-filled order, photos, each AI line item with an editable final amount and an approve or adjust control, an "Add missing damage" button (part from the catalog), a notes field, and "Confirm final amount". This saves overrides and notifies the counter person. It does not settle the deposit.

**Counter settlement (phone)**

6. **Notification and settlement:** a badge for inspector-confirmed orders. Opening one shows the provisional estimate, the final amount, the difference, and what the inspector added or changed. It then shows the settlement: amount deducted, refund due, or "Collect ₹X more" if the final amount is above ₹2,000. A "Mark settled" button closes the return. Path A bills use the same settlement view.

Keep UI simple: one font, neutral colours, large touch targets. No login screens for the demo; use two hard-coded demo roles switched from a menu.

## Repo structure, AGENTS.md and CLAUDE.md

One monorepo. `AGENTS.md` holds the real rules; `CLAUDE.md` contains one line, `@AGENTS.md`, so Claude Code imports it and other coding agents read the same file.

```
drivex-return-inspector/
├── AGENTS.md
├── CLAUDE.md                 # @AGENTS.md
├── docs/SPEC.md              # this doc, exported
├── docs/BUILD_LOG.md         # what you delegated, rejected, fixed
├── app/                      # Expo Router screens
│   ├── (counter)/
│   └── (inspector)/
├── components/
├── lib/                      # supabase client, types
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── functions/
│       ├── _shared/          # router.ts, schemas.ts, openrouter.ts
│       ├── assess-return/    # damage → estimate → route → order
│       ├── confirm-order/    # inspector final amount, notify counter
│       └── settle-return/    # counter settlement with customer
├── evals/
│   ├── cases/                # 15 cases: photos + expected.json
│   └── run.ts
└── .github/workflows/ci.yml
```

Paste this into `AGENTS.md`:

```markdown
# AGENTS.md — DriveX Return Inspector

## Product
Demo app: inspect returned rental scooters from photos, bill minor damage
at the counter (Path A), send major or uncertain damage to a human
inspector (Path B). Full spec: docs/SPEC.md. Read it before any task.

## Stack
Expo (Router, TypeScript) · Supabase (Postgres, Storage, Edge Functions)
· OpenRouter for all model calls · Zod for every schema.

## Rules
- TypeScript strict. No `any`.
- Every model call goes through supabase/functions/_shared/openrouter.ts
  and logs a row to agent_runs.
- Every agent output is validated with Zod before saving.
- Prices only from parts_catalog. Never let a model invent a rupee amount.
- Routing lives in _shared/router.ts as plain code with unit tests.
- Secrets only in env vars. Never commit keys.
- Use only fake rider data.

## Workflow
- Work one milestone at a time (docs/SPEC.md, Build order).
- Before coding, state a short plan. After coding, run: npm run lint,
  npm test, npm run evals.
- Do not mark a milestone done until tests and evals pass.
- Append a 2–3 line entry to docs/BUILD_LOG.md after each milestone.

## Don't
- Don't add payments, auth providers or GPS tracking.
- Don't change the database schema without a new migration.
```

## Evals, tests, CI/CD and cost

The eval set is 15 cases in `evals/cases/`, each with eight photos and an `expected.json` you write by hand.

| Case group | Count | Expected result |
| --- | --- | --- |
| No new damage | 3 | Empty damage list, ₹0, Path A, full ₹2,000 refund. Any flagged damage is a false positive and fails. |
| Minor scratch only | 4 | Correct panel flagged, amount within the expected range, Path A. |
| Dent or broken part | 4 | Damage flagged, Path B by amount or the structural rule. |
| Blurry or missing angle | 2 | Path B by low confidence or poor photos. Never a confident bill. |
| Pre-existing damage at pickup | 2 | Damage visible in both pickup and return photos is ignored; only new damage counts. |

`expected.json` holds `expected_path`, the panels that should be flagged, and an acceptable amount range. `evals/run.ts` reports routing accuracy, panel recall, amount-in-range rate, average cost and latency.

CI in `.github/workflows/ci.yml` runs on every push: lint, typecheck, unit tests for `router.ts`, then evals. The build fails if routing accuracy drops below 90% or any case that should go to Path B goes to Path A. That second rule is the safety gate.

Evals check the whole workflow against `expected.json`; they do not assume the agent is wrong. Rerun them after every prompt or model change to catch regressions. A failed case shows where the agent is weak; record it in the build log.

Also unit-test the settlement math with no model involved: ₹0 (full refund), ₹650 (refund ₹1,350), exactly ₹2,000 (no refund), and ₹2,600 (collect ₹600 more).

Cost: `agent_runs` gives cost per assessment. Run the eval set twice (estimate and order agents on an open-source model, then on a frontier model) and put both numbers in the README.

Deploy: Edge Functions with `supabase functions deploy`, web build on Vercel or Netlify, phone build via Expo Go or an EAS preview APK.

## Build order and first prompt

Seven milestones; each ends with something you can run. Stop after each one, test it yourself, and add a line to the build log.

1. **Scaffold:** Expo Router app, Supabase project, folder structure, `AGENTS.md`, `CLAUDE.md`, lint and test setup.
2. **Data:** migrations for every table, RLS, storage bucket, seed with 3 vehicles, 3 riders, a parts catalog of about 20 rows.
3. **Capture:** rental list and four-angle return capture with upload; sample gallery loads preset photos.
4. **Damage agent:** `assess-return` function, damage step only, shown on the result screen.
5. **Estimate, routing, order:** add the other two agents and `router.ts` with unit tests; Path A bill end to end.
6. **Inspector flow:** order queue, review screen, `confirm-order`, overrides, status timeline, counter notification, settlement screen with "Collect ₹X more".
7. **Evals, CI and deploy:** 15 cases, `evals/run.ts`, GitHub Actions, deployed web and phone builds, cost numbers in README.

Paste this into Claude Code after saving this doc as `docs/SPEC.md`:

```
Read docs/SPEC.md fully. Then create AGENTS.md and CLAUDE.md exactly as
the spec describes. Do Milestone 1 only: scaffold the Expo Router app
(TypeScript, strict), initialise Supabase locally, create the folder
structure from the spec, and set up lint, typecheck and a test runner.
Before writing code, give me a short plan and list anything in the spec
that is unclear. After finishing, run lint and tests, then stop and
summarise what you did. Do not start Milestone 2.
```

For later milestones, use the same pattern: "Do Milestone N only, plan first, run checks, stop and summarise."
