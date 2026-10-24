// supabase/functions/_shared/router.test.ts
import { describe, expect, it } from 'vitest';

import { route, routeConfigFrom } from './router.ts';
import type { ReturnAssessment } from './router.ts';

const clean: ReturnAssessment = { total_inr: 0, items: [], photo_quality_ok: true, staff_escalated: false };
const scratch = { type: 'scratch', confidence: 0.9 };

describe('route', () => {
  it('sends a clean, cheap, confident return to Path A', () => {
    expect(route(clean)).toEqual({ path: 'A', reasons: [] });
    expect(route({ ...clean, total_inr: 500, items: [scratch] })).toEqual({ path: 'A', reasons: [] });
  });

  it('fires amount_over_threshold only above ₹1,500', () => {
    expect(route({ ...clean, total_inr: 1500 }).path).toBe('A');
    expect(route({ ...clean, total_inr: 1501 })).toEqual({ path: 'B', reasons: ['amount_over_threshold'] });
  });

  it('fires low_confidence only below 0.75', () => {
    expect(route({ ...clean, items: [{ type: 'scratch', confidence: 0.75 }] }).path).toBe('A');
    expect(route({ ...clean, items: [{ type: 'scratch', confidence: 0.74 }] }).reasons).toEqual(['low_confidence']);
  });

  it('fires poor_photos, structural, staff_escalation and needs_human', () => {
    expect(route({ ...clean, photo_quality_ok: false }).reasons).toEqual(['poor_photos']);
    expect(route({ ...clean, items: [{ type: 'crack', confidence: 0.9 }] }).reasons).toEqual(['structural']);
    expect(route({ ...clean, items: [{ type: 'broken part', confidence: 0.9 }] }).reasons).toEqual(['structural']);
    expect(route({ ...clean, staff_escalated: true }).reasons).toEqual(['staff_escalation']);
    expect(route({ ...clean, needs_human: true }).reasons).toEqual(['needs_human']);
  });

  it('lists every rule that fires', () => {
    const result = route({
      total_inr: 3000,
      items: [{ type: 'crack', confidence: 0.5 }],
      photo_quality_ok: false,
      staff_escalated: true,
    });
    expect(result).toEqual({
      path: 'B',
      reasons: ['amount_over_threshold', 'low_confidence', 'poor_photos', 'structural', 'staff_escalation'],
    });
  });

  it('uses the configured threshold and confidence', () => {
    expect(route({ ...clean, total_inr: 1200 }, { thresholdInr: 1000, minConfidence: 0.75 }).path).toBe('B');
    expect(route({ ...clean, items: [scratch] }, { thresholdInr: 1500, minConfidence: 0.95 }).path).toBe('B');
  });
});

describe('routeConfigFrom', () => {
  it('reads config rows and falls back to defaults', () => {
    expect(routeConfigFrom([{ key: 'threshold_inr', value: 1200 }, { key: 'min_confidence', value: 0.8 }])).toEqual({
      thresholdInr: 1200,
      minConfidence: 0.8,
    });
    expect(routeConfigFrom([{ key: 'threshold_inr', value: 'oops' }])).toEqual({ thresholdInr: 1500, minConfidence: 0.75 });
  });
});
