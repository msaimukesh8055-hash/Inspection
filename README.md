# iInspect

Demo website that inspects returned rental scooters from photos. Minor damage is billed at the counter (Path A); major or uncertain damage goes to a human parts inspector (Path B). Full spec: [docs/SPEC.md](docs/SPEC.md).

Live: https://inspection-psi-eight.vercel.app · architecture: https://inspection-psi-eight.vercel.app/architecture.html

Laptop-only web app: Vite + React + Tailwind, Inter, Phosphor icons. Two demo roles, no login: **Detector** (counter staff) and **Inspector**.

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Database (hosted Supabase)

The app uses a hosted Supabase project on the free tier, not local Docker. One-time setup:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

Then fill `.env` with the project URL and anon key (Dashboard → Project Settings → API).

```bash
npm run db:push     # apply new migrations and seed to the linked project
npm run db:types    # regenerate the database types after a schema change
npm run db:verify   # check seed data, RLS and the photo bucket with the anon key
```

## AI assessment

`supabase/functions/assess-return` runs Damage → Estimate → Router → Bill or Order on free models (Google's Gemini API first, OpenRouter as fallback):

- **Damage** (vision) lists new damage from the 4 pickup and 4 return photos.
- **Estimate** picks a part code per damage item; prices come only from `parts_catalog`.
- **Router** (`_shared/router.ts`, plain code) picks Path A or B from the `config` table. Why the limits are ₹1,500 and 75% confidence: [docs/THRESHOLDS.md](docs/THRESHOLDS.md).
- **Bill** (Path A) writes the rider's bill note; **Order** (Path B) writes the diagnostic order and the rider's message. Neither may contain a rupee amount.

Every answer is checked with Zod and the rule checks (catalog part codes only, a scratch must be priced as polish, no rupee amounts in text); a failed answer gets one retry, then the return goes to Path B as `needs_human`. Prompts live in `_shared/prompts.ts`.

Other functions:

- `start-rental`: records a pickup from the Detector's **New pickup** screens (branch, scooter details, demo rider, 4 pickup photos). The app uploads the photos to `{rental_id}/pickup/`, then this checks all four are there and saves the vehicle (new plates are created), the rental and the photos rows together. It refuses a plate that is still out on a rental and a model with no parts prices. Renting out itself is outside this app; the spec assumed pickup photos already exist.
- `confirm-order`: the inspector's final amounts and added parts (catalog only); notifies the counter.
- `settle-return`: counter settlement. Path A `confirm_bill` then `mark_paid`; Path B `settle_order` after inspection.
- `override-route`: staff `escalate` (A → B) or `downgrade` (AI-raised B → A, before inspection), each saved to `overrides` with a reason.
- `send-back`: the inspector sends an open order back for reassessment with a reason (missed damage, wrong part, wrong severity, photos unclear, other + note). Closes the order, copies the AI's answer into `reassessments` (a re-run deletes the assessment), and notifies the counter. The return then appears under **Sent back by the inspector** on the Detector's rentals page, opens with its saved return photos pre-loaded, and is assessed again; the router decides the path as usual.

Every model call is logged to `agent_runs`. Notifications reach the open app live through Supabase Realtime.

```bash
npx supabase secrets set GEMINI_API_KEY=...                       # once (Google AI Studio)
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...             # once
npx supabase functions deploy assess-return --use-api              # after changing function code
npx supabase functions deploy start-rental --use-api
npx supabase functions deploy settle-return --use-api
npx supabase functions deploy confirm-order --use-api
npx supabase functions deploy override-route --use-api
npx supabase functions deploy send-back --use-api
npx supabase secrets set DAMAGE_MODELS=model-a:free,model-b:free   # optional: change the model order
```

Default models (`_shared/openrouter.ts`): damage on `gemini/gemini-3.5-flash`, then `gemini/gemini-2.5-flash`; estimate and order on `gemini/gemini-3.1-flash-lite`, `gemini/gemini-flash-lite-latest`, `gemini/gemma-4-26b-a4b-it`; `nvidia/nemotron-3.5-super-vl:free` (OpenRouter) last for every step. A `gemini/` prefix sends a model to Google; anything else goes to OpenRouter. Gemini's free limits are per model and small (e.g. 20 calls a day for 2.5 Flash). Set `ESTIMATE_MODELS` / `ORDER_MODELS` the same way.

```bash
npm run demo:reset   # demo start state: no scooters out (start with New pickup), GA07M2212 sent back by the inspector (photos pre-loaded); removes pickups added through New pickup
npm run history:seed # (re)load the sample damage history the dashboard shows: 4 extra scooters with 24 past returns across the 6 branches; demo:reset leaves it alone
```

## Dashboard

`/dashboard` (link in the top bar) shows every assessed return, eval test rentals left out: each scooter's damage by side (`line_items.angle`, from the damage photo or the inspector's side picker), type, date and final amount, plus the Path A/B split, money recovered on finished returns, and a bar chart of returns per Goa branch (`rentals.branch`, chosen on the New pickup form). The sums live in `lib/dashboard.ts` with unit tests.

## Sample photos

Demo photos live in `assets/samples/{fleet1|fleet2|fleet3}/{set}/{angle}.jpg`: a clean `pickup` set plus `no-damage`, `light-scratch` and `dented-panel` return sets for each of the three demo Honda Activas (GA 07 M 2211 / 2212 / 2213).

They are built by `scripts/make-photo-samples.ts` from four real photos in `assets/photo-src/`. The sources are redacted (generic shop sticker, blanked plate, blurred background plates and bystander); the script paints a made-up plate per scooter and draws the scratch or dent in code.

```bash
npm run samples:make   # rebuild the photo sets
npm run seed:photos    # upload the pickup sets for the 3 seeded rentals
```

**Photo credit:** "Honda Activa Rental- Goa" 1, 4, 6 and 9 by Bssasidhar, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Honda_Activa_Rental-_Goa_1.jpg), CC0 (public domain). Edited as described above.

## Checks

```bash
npm run lint
npm run typecheck
npm test              # router, settlement, schemas, eval scoring
npm run evals:check   # the eval set is complete (no AI calls)
npm run evals         # 15 cases through the real AI pipeline
```

## Evals

`evals/cases/E01…E15` holds 15 cases built from the real Activa photos (`npm run evals:make`). Each case has 4 pickup photos, 4 return photos and an answer sheet, `expected.json` (expected path, panels to flag, acceptable amount):

| Group | Cases | Expected |
|---|---|---|
| No new damage | E01–E03 | ₹0, Path A, nothing flagged |
| Minor scratch | E04–E07 | the scratched panel (left, right or mudguard), ₹400–600, Path A |
| Dent or broken part | E08–E11 | flagged, Path B |
| Blurry or missing angle | E12–E13 | Path B (poor photos) |
| Damage already at pickup | E14–E15 | ignored: ₹0, Path A |

`npm run evals` uploads each case to its own hidden eval rental (`npm run evals:setup` creates them once, status closed), runs the deployed `assess-return`, and prints a scorecard:
- routing accuracy
- Path B cases billed as A
- panel recall
- false positives
- amount in range
- latency and cost

A readable scorecard of the latest runs is in [evals/RESULTS.md](evals/RESULTS.md). Results are saved per case in `evals/results/<label>.json`, so a run cut short by the free models' daily limit resumes where it stopped. **Safety gate:** routing accuracy ≥ 90% and no Path B case billed as Path A. Exit codes: 0 pass, 1 fail, 2 incomplete.

## CI

`.github/workflows/ci.yml` runs on every push: lint, typecheck, unit tests, the eval-set check and a build. These need no secrets and make no AI calls.

**Actions → CI → Run workflow** runs the 15 AI evals with the safety gate. Add repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` first; the Gemini and OpenRouter keys stay in Supabase.

## Deploy

- **Edge Functions:** `npx supabase functions deploy <name> --use-api` (already live).
- **Website:** Vercel. Import the GitHub repo, keep the detected Vite settings (`vercel.json` adds the rewrite for page links), and add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Every push to `main` redeploys.
