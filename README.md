# I Inspect

Demo app that inspects returned rental scooters from photos. Minor damage is billed at the counter (Path A); major or uncertain damage goes to a human parts inspector (Path B). Full spec: [docs/SPEC.md](docs/SPEC.md).

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run web      # inspector view in the browser
npm start        # scan the QR code with Expo Go for the counter view on a phone
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

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run evals
```
