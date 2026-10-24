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

Local Supabase (`npm run supabase:start`) needs Docker Desktop running.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run evals
```
