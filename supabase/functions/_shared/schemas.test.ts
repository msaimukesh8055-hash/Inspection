// supabase/functions/_shared/schemas.test.ts
import { describe, expect, it } from 'vitest';

import { extractJson, parseDamageOutput } from './schemas.ts';

const VALID = {
  photo_quality_ok: true,
  items: [{ panel: 'left side panel', type: 'scratch', severity: 1, photo_ref: 'left', confidence: 0.82 }],
};

describe('extractJson', () => {
  it('reads plain JSON, fenced JSON and JSON with prose around it', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here is the result: {"a":{"b":2}} Hope it helps.')).toEqual({ a: { b: 2 } });
  });

  it('throws when there is no object', () => {
    expect(() => extractJson('no damage found')).toThrow();
  });
});

describe('parseDamageOutput', () => {
  it('accepts a valid reply, including an empty damage list', () => {
    expect(parseDamageOutput(JSON.stringify(VALID))).toEqual({ ok: true, data: VALID });
    expect(parseDamageOutput('{"photo_quality_ok": true, "items": []}').ok).toBe(true);
  });

  it('rejects broken JSON', () => {
    const result = parseDamageOutput('{"photo_quality_ok": true, "items": [');
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-range or unknown values', () => {
    const bad = (patch: Record<string, unknown>) =>
      parseDamageOutput(JSON.stringify({ ...VALID, items: [{ ...VALID.items[0], ...patch }] })).ok;
    expect(bad({ severity: 4 })).toBe(false);
    expect(bad({ severity: 1.5 })).toBe(false);
    expect(bad({ confidence: 1.2 })).toBe(false);
    expect(bad({ type: 'smudge' })).toBe(false);
    expect(bad({ photo_ref: 'top' })).toBe(false);
    expect(bad({ panel: '' })).toBe(false);
  });

  it('rejects a reply missing photo_quality_ok', () => {
    const result = parseDamageOutput('{"items": []}');
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('photo_quality_ok');
  });
});
