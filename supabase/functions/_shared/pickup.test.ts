// supabase/functions/_shared/pickup.test.ts
import { describe, expect, it } from 'vitest';

import { colourOrDefault, normalizeRegNo, openRentalBlocker, StartRentalSchema } from './pickup.ts';

const RENTAL = '00000000-0000-4000-8000-000000000501';
const RIDER = '00000000-0000-4000-8000-000000000201';

describe('normalizeRegNo', () => {
  it('drops spaces and upper-cases', () => {
    expect(normalizeRegNo(' ga 07 m 2214 ')).toBe('GA07M2214');
  });
});

describe('StartRentalSchema', () => {
  const valid = { rental_id: RENTAL, reg_no: 'ga07 m2214', model: 'Honda Activa', rider_id: RIDER, branch: 'Bellandur' };

  it('accepts a pickup and normalizes the plate', () => {
    const parsed = StartRentalSchema.safeParse(valid);
    expect(parsed.success && parsed.data.reg_no).toBe('GA07M2214');
  });

  it('rejects a plate with symbols or the wrong length', () => {
    expect(StartRentalSchema.safeParse({ ...valid, reg_no: 'GA-07' }).success).toBe(false);
    expect(StartRentalSchema.safeParse({ ...valid, reg_no: 'GA0' }).success).toBe(false);
  });

  it('rejects a missing model or a bad rider id', () => {
    expect(StartRentalSchema.safeParse({ ...valid, model: ' ' }).success).toBe(false);
    expect(StartRentalSchema.safeParse({ ...valid, rider_id: 'asha' }).success).toBe(false);
  });

  it('accepts only the six Bangalore branches', () => {
    expect(StartRentalSchema.safeParse({ ...valid, branch: 'HSR Layout' }).success).toBe(true);
    expect(StartRentalSchema.safeParse({ ...valid, branch: 'Mumbai' }).success).toBe(false);
    expect(StartRentalSchema.safeParse({ ...valid, branch: undefined }).success).toBe(false);
  });
});

describe('colourOrDefault', () => {
  it('fills in a colour when none was given', () => {
    expect(colourOrDefault(undefined)).toBe('Not recorded');
    expect(colourOrDefault('')).toBe('Not recorded');
    expect(colourOrDefault('Pearl White')).toBe('Pearl White');
  });
});

describe('openRentalBlocker', () => {
  it('allows a vehicle whose earlier rentals are all closed', () => {
    expect(openRentalBlocker('GA07M2211', [])).toBeNull();
    expect(openRentalBlocker('GA07M2211', ['closed', 'closed'])).toBeNull();
  });

  it('refuses a vehicle that is out or back but not settled', () => {
    expect(openRentalBlocker('GA07M2211', ['closed', 'active'])).toMatch(/already out/);
    expect(openRentalBlocker('GA07M2211', ['returned'])).toMatch(/already out/);
  });
});
