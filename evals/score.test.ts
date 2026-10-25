// evals/score.test.ts
import { describe, expect, it } from 'vitest';

import type { Expected } from './expected.ts';
import { isDailyLimit, markCase, scorecard } from './score.ts';
import type { CaseResult, FoundItem } from './score.ts';

const RENTAL = '00000000-0000-4000-8000-000000000401';

const scratchCase: Expected = {
  id: 'E04-scratch-left-panel',
  group: 'minor_scratch',
  description: 'scratch',
  rental_id: RENTAL,
  expected_path: 'A',
  no_new_damage: false,
  expected_damage: [{ photo_ref: 'left', panel_keywords: ['side', 'panel'] }],
  amount_inr: { min: 400, max: 600 },
};

const dentCase: Expected = { ...scratchCase, id: 'E08-dent-left-panel', group: 'dent_or_broken', expected_path: 'B', amount_inr: { min: 1600, max: 2400 } };
const cleanCase: Expected = { ...scratchCase, id: 'E01-clean', group: 'no_damage', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 } };

function scored(id: string, path: 'A' | 'B', total: number, items: FoundItem[]): CaseResult {
  return { id, status: 'scored', assessment_id: 'x', path, reasons: [], total_inr: total, items, latency_ms: 20000 };
}

const leftScratch = { panel: 'Left side panel', type: 'scratch', photo_ref: 'left', confidence: 0.9 };

describe('markCase', () => {
  it('passes a correct scratch case: path, panel and amount', () => {
    expect(markCase(scratchCase, scored(scratchCase.id, 'A', 500, [leftScratch]))).toMatchObject({
      path_ok: true,
      b_to_a: false,
      damage_found: 1,
      amount_ok: true,
      false_positive: false,
    });
  });

  it('needs the right angle as well as a matching panel word', () => {
    const wrongAngle = { ...leftScratch, photo_ref: 'right' };
    expect(markCase(scratchCase, scored(scratchCase.id, 'A', 500, [wrongAngle])).damage_found).toBe(0);
  });

  it('flags a Path B case billed at the counter', () => {
    expect(markCase(dentCase, scored(dentCase.id, 'A', 500, [leftScratch]))).toMatchObject({ path_ok: false, b_to_a: true, amount_ok: false });
  });

  it('counts anything flagged on a clean return as a false positive', () => {
    expect(markCase(cleanCase, scored(cleanCase.id, 'A', 0, [leftScratch])).false_positive).toBe(true);
    expect(markCase(cleanCase, scored(cleanCase.id, 'A', 0, [])).false_positive).toBe(false);
  });

  it('treats an error as a wrong answer', () => {
    const error: CaseResult = { id: scratchCase.id, status: 'error', error: 'boom', latency_ms: 0 };
    expect(markCase(scratchCase, error)).toMatchObject({ path_ok: false, amount_ok: false });
  });
});

describe('scorecard', () => {
  it('passes the gate at 90% routing with no B → A', () => {
    const results = Array.from({ length: 10 }, (_, i) => scored(`E${i}`, i === 0 ? 'B' : 'A', 500, [leftScratch]));
    const marks = results.map((r) => markCase({ ...scratchCase, id: r.id }, r));
    const card = scorecard(marks, results);
    expect(card.routing_accuracy).toBe(0.9);
    expect(card.passed).toBe(true);
  });

  it('fails the gate on any B → A, even with high accuracy', () => {
    const results = [scored(dentCase.id, 'A', 500, [leftScratch]), ...Array.from({ length: 19 }, (_, i) => scored(`E${i}`, 'A', 500, [leftScratch]))];
    const marks = [markCase(dentCase, results[0] as CaseResult), ...results.slice(1).map((r) => markCase({ ...scratchCase, id: r.id }, r))];
    const card = scorecard(marks, results);
    expect(card.routing_accuracy).toBe(0.95);
    expect(card.b_to_a).toEqual([dentCase.id]);
    expect(card.passed).toBe(false);
  });
});

describe('isDailyLimit', () => {
  const geminiDay = 'gemini/gemini-3.5-flash: HTTP 429 Quota exceeded ... Generate content requests per day limit exceeded on Free Tier';
  const openRouterDay = 'nvidia/nemotron-3.5-super-vl:free: HTTP 429 Rate limit exceeded: free-models-per-day';
  const geminiMinute = 'gemini/gemini-3.5-flash: HTTP 429 Quota exceeded ... requests per minute';

  it('stops when every model is out for the day', () => {
    expect(isDailyLimit(`All models failed: ${geminiDay} | ${openRouterDay}`)).toBe(true);
  });

  it('keeps going when any model was only busy or over a per-minute limit', () => {
    expect(isDailyLimit(`All models failed: ${geminiMinute} | ${openRouterDay}`)).toBe(false);
    expect(isDailyLimit('HTTP 504')).toBe(false);
  });
});
