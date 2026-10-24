// supabase/functions/assess-return/damage.ts
// Damage step: builds the 8-photo request, calls the model, validates, retries once.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../_shared/database.types.ts';
import { callModel, modelsFor } from '../_shared/openrouter.ts';
import type { ChatMessage, ContentPart } from '../_shared/openrouter.ts';
import { DAMAGE_SYSTEM_PROMPT, damageRetryPrompt } from '../_shared/prompts.ts';
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

export type DamageResult =
  | { ok: true; output: DamageOutput; model: string; skipped: string[] }
  | { ok: false; error: string; skipped: string[] };

/** Runs the damage agent. Invalid output gets one retry with the error fed back; then it gives up. */
export async function runDamageAgent(db: SupabaseClient<Database>, assessmentId: string, photos: PhotoSet): Promise<DamageResult> {
  const messages = buildDamageMessages(photos);
  let lastError = '';
  const skipped: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await callModel({ db, agent: 'damage', assessmentId, models: modelsFor('damage'), messages });
    skipped.push(...reply.skipped);
    const parsed = parseDamageOutput(reply.text);
    if (parsed.ok) return { ok: true, output: parsed.data, model: reply.model, skipped };
    lastError = parsed.error;
    messages.push({ role: 'assistant', content: reply.text });
    messages.push({ role: 'user', content: damageRetryPrompt(parsed.error) });
  }
  return { ok: false, error: lastError, skipped };
}
