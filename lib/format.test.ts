// lib/format.test.ts
import { describe, expect, it } from 'vitest';

import { formatInr } from './format';

describe('formatInr', () => {
  it('uses Indian digit grouping with a rupee sign', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(2000)).toBe('₹2,000');
    expect(formatInr(125000)).toBe('₹1,25,000');
  });
});
