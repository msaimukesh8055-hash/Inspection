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

`supabase/functions/assess-return` compares the 4 pickup and 4 return photos with a free OpenRouter vision model and saves the new damage it finds. Every model call is logged to `agent_runs`.

```bash
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...           # once
npx supabase functions deploy assess-return --use-api            # after changing function code
npx supabase secrets set DAMAGE_MODELS=model-a:free,model-b:free # optional: change the model order
```

Default damage models: `nvidia/nemotron-3.5-super-vl:free`, then `google/gemma-4-31b-it:free` as a fallback.

```bash
npm run demo:reset   # set the 3 demo rentals back to active and clear their returns and assessments
```

## Sample photos

Drawn demo images live in `assets/samples/{vehicle}/{set}/{angle}.jpg`: a clean `pickup` set plus `no-damage`, `light-scratch` and `dented-panel` return sets for each demo scooter.

```bash
npm run samples:make   # redraw the images
npm run seed:photos    # upload the pickup sets for the 3 seeded rentals
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run evals
```
