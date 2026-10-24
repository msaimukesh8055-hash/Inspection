// supabase/functions/assess-return/damage.ts
// Damage step: sends the 8 photos (pickup and return per angle) to the vision model.
import type { SupabaseClient } from '@supabase/supabase-js';

import { runAgent } from '../_shared/agent.ts';
import type { AgentResult } from '../_shared/agent.ts';
import type { Database } from '../_shared/database.types.ts';
import type { ChatMessage, ContentPart } from '../_shared/openrouter.ts';
import { DAMAGE_SYSTEM_PROMPT } from '../_shared/prompts.ts';
import { parseDamageOutput, PHOTO_ANGLES } from '../_shared/schemas.ts';
import type { DamageOutput } from '../_shared/schemas.ts';

export type Angle = (typeof PHOTO_ANGLES)[number];

/** Image URLs (or data URLs) for both stages, every angle. */
export type PhotoSet = Record<'pickup' | 'return', Record<Angle, string>>;

/** One user message: per angle, the pickup photo then the return photo, each labelled. */
export function buildDamageMessages(photos: PhotoSet): ChatMessage[] {
  const parts: ContentPart[] = [{ type: 'text', text: 'Compare each pickup photo with its return photo.' }];
  for (const angle of PHOTO_ANGLES) {
    const label = angle.toUpperCase();
    parts.push({ type: 'text', text: `${label} — PICKUP photo:` });
    parts.push({ type: 'image_url', image_url: { url: photos.pickup[angle] } });
    parts.push({ type: 'text', text: `${label} — RETURN photo:` });
    parts.push({ type: 'image_url', image_url: { url: photos.return[angle] } });
  }
  return [
    { role: 'system', content: DAMAGE_SYSTEM_PROMPT },
    { role: 'user', content: parts },
  ];
}

export function runDamageAgent(db: SupabaseClient<Database>, assessmentId: string, photos: PhotoSet): Promise<AgentResult<DamageOutput>> {
  return runAgent({ db, agent: 'damage', assessmentId, messages: buildDamageMessages(photos), parse: parseDamageOutput });
}
