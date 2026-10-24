// evals/check.ts
// No-AI check that the eval set is complete and well formed: 15 valid answer sheets in the spec's
// group counts, and all 8 photos per case. Runs in CI on every push. Run: npm run evals:check
import { existsSync, statSync } from 'node:fs';

import { CASES_DIR, GROUPS, loadCases, PHOTO_ANGLES, PHOTO_STAGES } from './expected.ts';

/** docs/SPEC.md, Evals: 3 no damage, 4 minor scratch, 4 dent or broken, 2 blurry or missing, 2 pre-existing. */
const GROUP_COUNTS: Record<(typeof GROUPS)[number], number> = {
  no_damage: 3,
  minor_scratch: 4,
  dent_or_broken: 4,
  poor_photos: 2,
  pre_existing: 2,
};

function check(): string[] {
  const problems: string[] = [];
  let cases;
  try {
    cases = loadCases();
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }

  if (cases.length !== 15) problems.push(`expected 15 cases, found ${cases.length}`);
  for (const group of GROUPS) {
    const count = cases.filter((c) => c.group === group).length;
    if (count !== GROUP_COUNTS[group]) problems.push(`group ${group}: expected ${GROUP_COUNTS[group]} cases, found ${count}`);
  }
  if (new Set(cases.map((c) => c.rental_id)).size !== cases.length) problems.push('two cases share a rental');

  for (const c of cases) {
    if (c.expected_path === 'B' && c.group !== 'dent_or_broken' && c.group !== 'poor_photos') {
      problems.push(`${c.id}: only dent/broken and poor-photo cases should expect Path B`);
    }
    for (const stage of PHOTO_STAGES) {
      for (const angle of PHOTO_ANGLES) {
        const photo = `${CASES_DIR}${c.id}/${stage}/${angle}.jpg`;
        if (!existsSync(photo) || statSync(photo).size < 10_000) problems.push(`${c.id}: missing or empty ${stage}/${angle}.jpg`);
      }
    }
  }
  return problems;
}

const problems = check();
if (problems.length) {
  console.error(`evals:check: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('evals:check: 15 cases, groups match the spec, all 120 photos present');
