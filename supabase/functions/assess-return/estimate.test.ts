// supabase/functions/assess-return/estimate.test.ts
import { describe, expect, it } from 'vitest';

import { buildBillMessages } from '../_shared/orderAgent.ts';
import { buildEstimateMessages, numberDamage, priceLines } from './estimate.ts';
import type { CatalogPart } from './estimate.ts';

const CATALOG: CatalogPart[] = [
  { part_code: 'NTQ-SCRATCH-POLISH', description: 'Scratch polish', parts_inr: 180, labour_inr: 400 },
  { part_code: 'NTQ-FRONT-PANEL', description: 'Front panel', parts_inr: 1650, labour_inr: 450 },
];

const dent = { panel: 'front panel', type: 'dent' as const, severity: 2, photo_ref: 'front' as const, confidence: 0.9 };

describe('estimate step', () => {
  it('numbers damage items d1, d2, …', () => {
    expect(numberDamage([dent, dent]).map((d) => d.damage_id)).toEqual(['d1', 'd2']);
  });

  it('prices lines from the catalog, never from the model', () => {
    const lines = priceLines({ lines: [{ damage_id: 'd1', part_code: 'NTQ-FRONT-PANEL', reasoning: 'dent' }] }, CATALOG);
    expect(lines).toEqual([
      {
        damage_id: 'd1',
        part_code: 'NTQ-FRONT-PANEL',
        description: 'Front panel',
        reasoning: 'dent',
        parts_inr: 1650,
        labour_inr: 450,
        total_inr: 2100,
      },
    ]);
  });

  it('throws on a part outside the catalog', () => {
    expect(() => priceLines({ lines: [{ damage_id: 'd1', part_code: 'X', reasoning: 'r' }] }, CATALOG)).toThrow();
  });

  it('sends codes and descriptions but no prices to the model', () => {
    const [, user] = buildEstimateMessages('TVS Ntorq', numberDamage([dent]), CATALOG);
    const text = typeof user?.content === 'string' ? user.content : '';
    expect(text).toContain('d1: dent on front panel');
    expect(text).toContain('NTQ-FRONT-PANEL: Front panel');
    expect(text).not.toMatch(/1650|450|2100/);
  });
});

describe('order step', () => {
  it('describes damage and repairs without any amounts', () => {
    const [, user] = buildBillMessages({ vehicleModel: 'TVS Ntorq', damage: [dent], parts: ['Front panel'], reasons: [] });
    const text = typeof user?.content === 'string' ? user.content : '';
    expect(text).toContain('dent on front panel');
    expect(text).toContain('- Front panel');
    expect(text).not.toMatch(/\d{3,}/);
  });
});
