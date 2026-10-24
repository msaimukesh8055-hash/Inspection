// supabase/functions/assess-return/damage.test.ts
import { describe, expect, it } from 'vitest';

import { buildDamageMessages } from './damage.ts';
import type { PhotoSet } from './damage.ts';

const photos: PhotoSet = {
  pickup: { front: 'p-front', rear: 'p-rear', left: 'p-left', right: 'p-right' },
  return: { front: 'r-front', rear: 'r-rear', left: 'r-left', right: 'r-right' },
};

describe('buildDamageMessages', () => {
  it('sends the system prompt, then each angle as a labelled pickup/return pair', () => {
    const [system, user] = buildDamageMessages(photos);
    expect(system?.role).toBe('system');
    expect(user?.role).toBe('user');

    const parts = Array.isArray(user?.content) ? user.content : [];
    const images = parts.flatMap((p) => (p.type === 'image_url' ? [p.image_url.url] : []));
    expect(images).toEqual(['p-front', 'r-front', 'p-rear', 'r-rear', 'p-left', 'r-left', 'p-right', 'r-right']);

    const labels = parts.flatMap((p) => (p.type === 'text' ? [p.text] : []));
    expect(labels).toContain('LEFT — PICKUP photo:');
    expect(labels).toContain('LEFT — RETURN photo:');
  });
});
