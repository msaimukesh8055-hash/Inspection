// lib/dashboard.test.ts
import { describe, expect, it } from 'vitest';

import { isEvalRental, summarize } from './dashboard';
import type { ReturnRecord } from './dashboard';

function record(overrides: Partial<ReturnRecord>): ReturnRecord {
  return {
    rentalId: '00000000-0000-4000-8000-000000000601',
    regNo: 'GA07M2201',
    model: 'Honda Activa',
    colour: 'Pearl White',
    date: '2026-09-04T12:00:00Z',
    path: 'A',
    status: 'paid',
    deductedInr: 0,
    collectExtraInr: 0,
    entries: [],
    order: null,
    ...overrides,
  };
}

describe('isEvalRental', () => {
  it('spots the 15 eval rentals and nothing else', () => {
    expect(isEvalRental('00000000-0000-4000-8000-000000000401')).toBe(true);
    expect(isEvalRental('00000000-0000-4000-8000-000000000415')).toBe(true);
    expect(isEvalRental('00000000-0000-4000-8000-000000000416')).toBe(false);
    expect(isEvalRental('00000000-0000-4000-8000-000000000301')).toBe(false);
    expect(isEvalRental('a7ad8209-c226-435e-b14b-ae597157b92e')).toBe(false);
  });
});

describe('summarize', () => {
  const scratch = record({
    deductedInr: 500,
    entries: [{ side: 'left', what: 'Scratch · left side panel', amountInr: 500, addedByInspector: false }],
  });
  const dentWithMirror = record({
    rentalId: '00000000-0000-4000-8000-000000000603',
    regNo: 'GA07M2202',
    date: '2026-09-13T12:00:00Z',
    path: 'B',
    status: 'settled',
    deductedInr: 2000,
    collectExtraInr: 210,
    entries: [
      { side: 'right', what: 'Dent · right side panel', amountInr: 1850, addedByInspector: false },
      { side: 'right', what: 'Rear-view mirror (added by inspector)', amountInr: 360, addedByInspector: true },
    ],
    order: { provisionalInr: 1850, finalInr: 2210 },
  });
  const agreedLamp = record({
    regNo: 'GA07M2203',
    path: 'B',
    status: 'settled',
    deductedInr: 1150,
    entries: [{ side: 'rear', what: 'Crack · tail lamp', amountInr: 1150, addedByInspector: false }],
    order: { provisionalInr: 1150, finalInr: 1150 },
  });

  it('adds up damage by side, including parts the inspector added', () => {
    const summary = summarize([scratch, dentWithMirror, agreedLamp], []);
    expect(summary.bySide.left).toEqual({ count: 1, amountInr: 500 });
    expect(summary.bySide.right).toEqual({ count: 2, amountInr: 2210 });
    expect(summary.bySide.rear).toEqual({ count: 1, amountInr: 1150 });
    expect(summary.bySide.front).toEqual({ count: 0, amountInr: 0 });
  });

  it('splits paths and counts money only from finished returns', () => {
    const open = record({ regNo: 'GA07M2204', status: 'assessing', deductedInr: 0 });
    const summary = summarize([scratch, dentWithMirror, agreedLamp, open], []);
    expect(summary.paths).toEqual({ A: 2, B: 2 });
    expect(summary.moneyRecoveredInr).toBe(500 + 2210 + 1150);
  });

  it('counts agreement over confirmed orders and send-backs', () => {
    const summary = summarize([scratch, dentWithMirror, agreedLamp], ['missed_damage', 'missed_damage', 'wrong_part']);
    expect(summary.agreement).toEqual({ agreed: 1, decisions: 5 });
    expect(summary.sendBackReasons).toEqual([
      { reason: 'missed_damage', label: 'Missed damage', count: 2 },
      { reason: 'wrong_part', label: 'Wrong part', count: 1 },
    ]);
  });

  it('groups returns by scooter, newest first, with each scooter total', () => {
    const later = record({ date: '2026-10-08T12:00:00Z', entries: [] });
    const summary = summarize([scratch, later, dentWithMirror], []);
    const first = summary.scooters[0];
    expect(summary.scooters.map((s) => s.regNo)).toEqual(['GA07M2201', 'GA07M2202']);
    expect(first?.returns.map((r) => r.date)).toEqual(['2026-10-08T12:00:00Z', '2026-09-04T12:00:00Z']);
    expect(first?.totalInr).toBe(500);
  });
});
