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
    branch: 'Panaji',
    path: 'A',
    status: 'paid',
    deductedInr: 0,
    collectExtraInr: 0,
    entries: [],
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
  });
  const crackedLamp = record({
    regNo: 'GA07M2203',
    branch: 'Calangute',
    path: 'B',
    status: 'settled',
    deductedInr: 1150,
    entries: [{ side: 'rear', what: 'Crack · tail lamp', amountInr: 1150, addedByInspector: false }],
  });

  it('splits paths and counts money only from finished returns', () => {
    const open = record({ regNo: 'GA07M2204', status: 'assessing', deductedInr: 0 });
    const summary = summarize([scratch, dentWithMirror, crackedLamp, open]);
    expect(summary.paths).toEqual({ A: 2, B: 2 });
    expect(summary.moneyRecoveredInr).toBe(500 + 2210 + 1150);
  });

  it('counts returns per branch, in a fixed order, including empty branches', () => {
    const unknown = record({ regNo: 'GA07M2204', branch: null });
    const summary = summarize([scratch, dentWithMirror, crackedLamp, unknown]);
    expect(summary.byBranch).toEqual([
      { branch: 'Ponda', returns: 0 },
      { branch: 'Mapusa', returns: 0 },
      { branch: 'Panaji', returns: 2 },
      { branch: 'Calangute', returns: 1 },
      { branch: 'Margao', returns: 0 },
      { branch: 'Vasco da Gama', returns: 0 },
    ]);
  });

  it('groups returns by scooter, newest first, with each scooter total', () => {
    const later = record({ date: '2026-10-08T12:00:00Z', entries: [] });
    const summary = summarize([scratch, later, dentWithMirror]);
    const first = summary.scooters[0];
    expect(summary.scooters.map((s) => s.regNo)).toEqual(['GA07M2201', 'GA07M2202']);
    expect(first?.returns.map((r) => r.date)).toEqual(['2026-10-08T12:00:00Z', '2026-09-04T12:00:00Z']);
    expect(first?.totalInr).toBe(500);
  });
});
