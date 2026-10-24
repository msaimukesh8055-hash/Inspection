// evals/run.ts
// Eval runner. Placeholder until Milestone 7 adds the 15 cases in evals/cases/.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const casesDir = fileURLToPath(new URL('./cases/', import.meta.url));

function listCases(): string[] {
  return readdirSync(casesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const cases = listCases();

if (cases.length === 0) {
  console.log('evals: no cases yet (added in Milestone 7). Nothing to run.');
} else {
  console.log(`evals: found ${cases.length} case(s), but the runner is not built yet (Milestone 7).`);
}
