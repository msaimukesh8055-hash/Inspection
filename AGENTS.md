# AGENTS.md — I Inspect

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
