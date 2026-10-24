// lib/constants.test.ts
import { describe, expect, it } from 'vitest';

import { DEPOSIT_INR } from './constants';

describe('shared constants', () => {
  it('fixes the deposit at ₹2,000', () => {
    expect(DEPOSIT_INR).toBe(2000);
  });
});
