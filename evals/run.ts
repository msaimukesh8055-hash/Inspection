// evals/run.ts
// Runs the 15 eval cases through the real deployed pipeline (assess-return) and marks the answers.
//   npm run evals                      run every case not yet in the results file, then score
//   npm run evals -- --fresh           start over
//   npm run evals -- --only=E04,E08    run some cases (still scored only when all 15 are in)
//   npm run evals -- --label=gemma     keep results for another model setup apart
// Results are saved after every case, so a run cut short by the free model's daily limit resumes
// where it stopped. Exit code: 0 gate passed, 1 gate failed, 2 incomplete.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CASES_DIR, loadCases, PHOTO_ANGLES, PHOTO_STAGES } from './expected.ts';
import type { Expected } from './expected.ts';
import { markCase, scorecard } from './score.ts';
import type { CaseResult, FoundItem, Scorecard } from './score.ts';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));

/** Free endpoints allow about 20 requests a minute; one case makes 3–5 model calls. */
const DEFAULT_PAUSE_S = 15;

type ResultsFile = {
  label: string;
  updated_at: string;
  cases: Record<string, CaseResult>;
  scorecard?: Scorecard;
  cost?: { calls: number; cost_usd: number; models: string[] } | null;
};

class DailyLimitError extends Error {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : 'true';
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('evals: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env, or as CI secrets)');
  process.exit(1);
}
const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

async function uploadPhotos(expected: Expected): Promise<void> {
  for (const stage of PHOTO_STAGES) {
    for (const angle of PHOTO_ANGLES) {
      const path = `${expected.rental_id}/${stage}/${angle}.jpg`;
      const body = readFileSync(`${CASES_DIR}${expected.id}/${stage}/${angle}.jpg`);
      const upload = await fetch(`${url}/storage/v1/object/vehicle-photos/${path}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body,
      });
      if (!upload.ok) throw new Error(`upload ${path}: ${upload.status} ${await upload.text()}`);
      const row = await fetch(`${url}/rest/v1/photos?on_conflict=rental_id,stage,angle`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ rental_id: expected.rental_id, stage, angle, storage_path: path }),
      });
      if (!row.ok) throw new Error(`photo row ${path}: ${row.status} ${await row.text()}`);
    }
  }
}

type AssessReply = { assessment_id?: string; path?: 'A' | 'B'; reasons?: string[]; total_inr?: number; items?: FoundItem[]; error?: string };

async function runCase(expected: Expected): Promise<CaseResult> {
  await uploadPhotos(expected);
  const started = Date.now();
  const response = await fetch(`${url}/functions/v1/assess-return`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rental_id: expected.rental_id }),
  });
  const latency = Date.now() - started;
  const reply = (await response.json().catch(() => ({}))) as AssessReply;

  if (!response.ok || !reply.path) {
    const error = reply.error ?? `HTTP ${response.status}`;
    if (/free-models-per-day|Rate limit exceeded/i.test(error)) throw new DailyLimitError(error);
    return { id: expected.id, status: 'error', error, latency_ms: latency };
  }
  return {
    id: expected.id,
    status: 'scored',
    assessment_id: reply.assessment_id ?? '',
    path: reply.path,
    reasons: reply.reasons ?? [],
    total_inr: reply.total_inr ?? 0,
    items: (reply.items ?? []).map((i) => ({ panel: i.panel, type: i.type, photo_ref: i.photo_ref, confidence: i.confidence })),
    latency_ms: latency,
  };
}

/** Cost and models from agent_runs (readable only with the Supabase CLI login, so optional). */
function readCost(assessmentIds: string[]): ResultsFile['cost'] {
  if (assessmentIds.length === 0) return null;
  try {
    const list = assessmentIds.map((id) => `'${id}'`).join(',');
    const sql = `select count(*)::int as calls, coalesce(sum(cost_usd),0)::float as cost, array_agg(distinct model) as models from agent_runs where assessment_id in (${list})`;
    const out = execSync(`npx supabase db query --linked "${sql}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const row = (JSON.parse(out) as { rows?: { calls: number; cost: number; models: string[] }[] }).rows?.[0];
    return row ? { calls: row.calls, cost_usd: row.cost, models: row.models } : null;
  } catch {
    return null;
  }
}

function pct(value: number | null): string {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`;
}

function printScorecard(cases: Expected[], file: ResultsFile, card: Scorecard): void {
  console.log('\n  Case                          Expected  Got  Total     Found');
  for (const expected of cases) {
    const result = file.cases[expected.id];
    const mark = result ? markCase(expected, result) : null;
    const got = result?.status === 'scored' ? result.path : 'ERR';
    const total = result?.status === 'scored' ? `₹${result.total_inr}` : '-';
    const found = result?.status === 'scored' ? result.items.map((i) => `${i.type}@${i.photo_ref}`).join(', ') || 'nothing' : result?.error ?? '';
    const flag = mark?.b_to_a ? '  ⚠ B→A' : mark?.path_ok ? '' : '  ✗';
    console.log(`  ${expected.id.padEnd(30)}${expected.expected_path.padEnd(10)}${got.padEnd(5)}${total.padEnd(10)}${found.slice(0, 60)}${flag}`);
  }
  console.log(`\n  Routing accuracy   ${pct(card.routing_accuracy)}  (gate: ≥ 90%)`);
  console.log(`  B sent to A        ${card.b_to_a.length ? card.b_to_a.join(', ') : 'none'}  (gate: none)`);
  console.log(`  Panel recall       ${pct(card.panel_recall)}`);
  console.log(`  False positives    ${card.false_positives.length ? card.false_positives.join(', ') : 'none'}`);
  console.log(`  Amount in range    ${pct(card.amount_in_range)}`);
  console.log(`  Avg latency        ${card.avg_latency_ms === null ? 'n/a' : `${(card.avg_latency_ms / 1000).toFixed(1)} s`}`);
  if (file.cost) console.log(`  Cost               $${file.cost.cost_usd.toFixed(4)} over ${file.cost.calls} model calls (${file.cost.models.join(', ')})`);
  console.log(`\n  ${card.passed ? 'PASS' : 'FAIL'}: safety gate ${card.passed ? 'met' : 'not met'}`);
}

async function main(): Promise<number> {
  const cases = loadCases();
  const label = arg('label') ?? 'default';
  const only = arg('only')?.split(',').map((s) => s.trim().toUpperCase());
  const pauseMs = Number(arg('pause') ?? DEFAULT_PAUSE_S) * 1000;
  const resultsPath = `${RESULTS_DIR}${label}.json`;

  mkdirSync(RESULTS_DIR, { recursive: true });
  const file: ResultsFile =
    existsSync(resultsPath) && !arg('fresh')
      ? (JSON.parse(readFileSync(resultsPath, 'utf8')) as ResultsFile)
      : { label, updated_at: new Date().toISOString(), cases: {} };
  const save = () => {
    file.updated_at = new Date().toISOString();
    writeFileSync(resultsPath, `${JSON.stringify(file, null, 2)}\n`);
  };

  const todo = cases.filter((c) => (only ? only.some((o) => c.id.startsWith(o)) : !file.cases[c.id]));
  console.log(`evals [${label}]: ${Object.keys(file.cases).length} of ${cases.length} done, ${todo.length} to run now`);

  for (const [i, expected] of todo.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    process.stdout.write(`  ${expected.id} … `);
    try {
      const result = await runCase(expected);
      file.cases[expected.id] = result;
      save();
      console.log(result.status === 'scored' ? `Path ${result.path}, ₹${result.total_inr}, ${(result.latency_ms / 1000).toFixed(0)} s` : `error: ${result.error.slice(0, 120)}`);
    } catch (e) {
      if (e instanceof DailyLimitError) {
        save();
        console.log('stopped: daily free model limit reached');
        console.log(`\nevals [${label}]: ${Object.keys(file.cases).length} of ${cases.length} cases done. Run "npm run evals" again after the limit resets to finish.`);
        return 2;
      }
      throw e;
    }
  }

  const missing = cases.filter((c) => !file.cases[c.id]);
  if (missing.length) {
    console.log(`\nevals [${label}]: ${missing.length} case(s) not run yet (${missing.map((c) => c.id).join(', ')}).`);
    return 2;
  }

  const results = cases.map((c) => file.cases[c.id]).filter((r): r is CaseResult => r !== undefined);
  const card = scorecard(
    cases.map((c, i) => markCase(c, results[i] as CaseResult)),
    results,
  );
  file.scorecard = card;
  file.cost = readCost(results.flatMap((r) => (r.status === 'scored' && r.assessment_id ? [r.assessment_id] : [])));
  save();
  printScorecard(cases, file, card);
  return card.passed ? 0 : 1;
}

process.exit(await main());
