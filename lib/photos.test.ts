// lib/photos.test.ts
import { describe, expect, it } from 'vitest';

import { allAnglesFilled, angleLabel, completeSet, DEMO_RETURN_SET, photoPath, sampleKeyForModel } from './photos';

describe('photoPath', () => {
  it('follows {rental_id}/{stage}/{angle}.jpg', () => {
    expect(photoPath('abc', 'return', 'left')).toBe('abc/return/left.jpg');
    expect(photoPath('abc', 'pickup', 'front')).toBe('abc/pickup/front.jpg');
  });
});

describe('allAnglesFilled', () => {
  it('is false until all four angles have a photo', () => {
    expect(allAnglesFilled({})).toBe(false);
    expect(allAnglesFilled({ front: 'a', rear: 'b', left: 'c' })).toBe(false);
    expect(allAnglesFilled({ front: 'a', rear: 'b', left: 'c', right: 'd' })).toBe(true);
  });
});

describe('completeSet', () => {
  it('returns the four photos only when none is missing', () => {
    expect(completeSet({ front: 1, rear: 2, left: 3 })).toBeNull();
    expect(completeSet({ front: 1, rear: 2, left: 3, right: 4 })).toEqual({ front: 1, rear: 2, left: 3, right: 4 });
  });
});

describe('angleLabel', () => {
  it('capitalises the angle', () => {
    expect(angleLabel('rear')).toBe('Rear');
  });
});

describe('DEMO_RETURN_SET', () => {
  it('gives the three demo scooters three different return scenarios', () => {
    expect(DEMO_RETURN_SET).toEqual({ jupiter: 'no-damage', radeon: 'light-scratch', ntorq: 'dented-panel' });
  });
});

describe('sampleKeyForModel', () => {
  it('maps the demo fleet and rejects unknown models', () => {
    expect(sampleKeyForModel('TVS Jupiter')).toBe('jupiter');
    expect(sampleKeyForModel('TVS Radeon')).toBe('radeon');
    expect(sampleKeyForModel('Unknown')).toBeNull();
  });
});
