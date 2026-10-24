# I Inspect

Demo website that inspects returned rental scooters from photos. Minor damage is billed at the counter (Path A); major or uncertain damage goes to a human parts inspector (Path B). Full spec: [docs/SPEC.md](docs/SPEC.md).

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
npm run db:types    # regenerate lib/database.types.ts after a schema change
npm run db:verify   # check seed data, RLS and the photo bucket with the anon key
```

## AI assessment

`supabase/functions/assess-return` runs Damage → Estimate → Router → Order on free OpenRouter models:

- **Damage** (vision) lists new damage from the 4 pickup and 4 return photos.
- **Estimate** picks a part code per damage item; prices come only from `parts_catalog`.
- **Router** (`_shared/router.ts`, plain code) picks Path A or B from the `config` table.
- **Order** writes the rider's bill note (Path A) or a diagnostic order (Path B), with no rupee amounts.

Other functions:

- `confirm-order`: the inspector's final amounts and added parts (catalog only); notifies the counter.
- `settle-return`: counter settlement. Path A `confirm_bill` then `mark_paid`; Path B `settle_order` after inspection.
- `override-route`: staff `escalate` (A → B) or `downgrade` (AI-raised B → A, before inspection), each saved to `overrides` with a reason.

Every model call is logged to `agent_runs`. Notifications reach the open app live through Supabase Realtime.

```bash
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...             # once
npx supabase functions deploy assess-return --use-api              # after changing function code
npx supabase functions deploy settle-return --use-api
npx supabase functions deploy confirm-order --use-api
npx supabase functions deploy override-route --use-api
npx supabase secrets set DAMAGE_MODELS=model-a:free,model-b:free   # optional: change the model order
```

Default models: `nvidia/nemotron-3.5-super-vl:free` for every step, with `google/gemma-4-31b-it:free` (damage) or `google/gemma-4-26b-a4b-it:free` and `nvidia/nemotron-3-super-120b-a12b:free` (estimate, order) as fallbacks. Set `ESTIMATE_MODELS` / `ORDER_MODELS` the same way.

```bash
npm run demo:reset   # set the 3 demo rentals back to active and clear their returns and assessments
```

## Sample photos

Demo photos live in `assets/samples/{fleet1|fleet2|fleet3}/{set}/{angle}.jpg`: a clean `pickup` set plus `no-damage`, `light-scratch` and `dented-panel` return sets for each of the three demo Honda Activas (GA 07 M 2211 / 5141 / 5142).

They are built by `scripts/make-photo-samples.ts` from four real photos in `assets/photo-src/`. The script swaps the rental shop's sticker for a generic one, repaints the plate per scooter, and draws the scratch or dent in code.

```bash
npm run samples:make   # rebuild the photo sets
npm run seed:photos    # upload the pickup sets for the 3 seeded rentals
```

**Photo credit:** "Honda Activa Rental- Goa" 1, 4, 6 and 9 by Bssasidhar, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Honda_Activa_Rental-_Goa_1.jpg), CC0 (public domain). Edited as described above.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run evals
```
