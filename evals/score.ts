// evals/score.ts
// Marks the AI's answers against the answer sheets. Plain code, no model calls.
import type { Expected } from './expected.ts';

export type FoundItem = { panel: string; type: string; photo_ref: string; confidence: number };

export type CaseResult =
  | {
      id: string;
      status: 'scored';
      assessment_id: string;
      path: 'A' | 'B';
      reasons: string[];
      total_inr: number;
      items: FoundItem[];
      latency_ms: number;
    }
  | { id: string; status: 'error'; error: string; latency_ms: number };

export type CaseMark = {
  id: string;
  group: Expected['group'];
  path_ok: boolean;
  /** Expected B but the AI pipeline billed it at the counter: the costly mistake. */
  b_to_a: boolean;
  damage_expected: number;
  damage_found: number;
  false_positive: boolean;
  /** null when the case does not check the amount. */
  amount_ok: boolean | null;
};

function matches(item: FoundItem, want: Expected['expected_damage'][number]): boolean {
  const panel = item.panel.toLowerCase();
  return item.photo_ref === want.photo_ref && want.panel_keywords.some((k) => panel.includes(k.toLowerCase()));
}

export function markCase(expected: Expected, result: CaseResult): CaseMark {
  const base = { id: expected.id, group: expected.group, damage_expected: expected.expected_damage.length };
  if (result.status === 'error') {
    return { ...base, path_ok: false, b_to_a: false, damage_found: 0, false_positive: false, amount_ok: expected.amount_inr ? false : null };
  }
  const found = expected.expected_damage.filter((want) => result.items.some((item) => matches(item, want))).length;
  const amount = expected.amount_inr;
  return {
    ...base,
    path_ok: result.path === expected.expected_path,
    b_to_a: expected.expected_path === 'B' && result.path === 'A',
    damage_found: found,
    false_positive: expected.no_new_damage && result.items.length > 0,
    amount_ok: amount ? result.total_inr >= amount.min && result.total_inr <= amount.max : null,
  };
}

export type Scorecard = {
  cases: number;
  routing_accuracy: number;
  b_to_a: string[];
  panel_recall: number | null;
  false_positives: string[];
  amount_in_range: number | null;
  errors: string[];
  avg_latency_ms: number | null;
  /** The CI safety gate: routing ≥ 90% and no Path B case billed as Path A. */
  passed: boolean;
};

export const MIN_ROUTING_ACCURACY = 0.9;

export function scorecard(marks: CaseMark[], results: CaseResult[]): Scorecard {
  const ratio = (num: number, den: number) => (den === 0 ? null : num / den);
  const expectedDamage = marks.reduce((sum, m) => sum + m.damage_expected, 0);
  const foundDamage = marks.reduce((sum, m) => sum + m.damage_found, 0);
  const amountChecks = marks.filter((m) => m.amount_ok !== null);
  const latencies = results.filter((r) => r.status === 'scored').map((r) => r.latency_ms);
  const routing = ratio(marks.filter((m) => m.path_ok).length, marks.length) ?? 0;
  const bToA = marks.filter((m) => m.b_to_a).map((m) => m.id);
  return {
    cases: marks.length,
    routing_accuracy: routing,
    b_to_a: bToA,
    panel_recall: ratio(foundDamage, expectedDamage),
    false_positives: marks.filter((m) => m.false_positive).map((m) => m.id),
    amount_in_range: ratio(amountChecks.filter((m) => m.amount_ok).length, amountChecks.length),
    errors: results.filter((r) => r.status === 'error').map((r) => r.id),
    avg_latency_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    passed: routing >= MIN_ROUTING_ACCURACY && bToA.length === 0,
  };
}
