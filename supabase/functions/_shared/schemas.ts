// supabase/functions/_shared/schemas.ts
// Zod schemas for every agent output. Nothing an agent returns is saved until it passes these.
import { z } from 'zod';

export const PHOTO_ANGLES = ['front', 'rear', 'left', 'right'] as const;
export const DAMAGE_TYPES = ['scratch', 'dent', 'crack', 'broken part'] as const;

export const DamageItemSchema = z.object({
  panel: z.string().trim().min(1).max(60),
  type: z.enum(DAMAGE_TYPES),
  severity: z.number().int().min(1).max(3),
  photo_ref: z.enum(PHOTO_ANGLES),
  confidence: z.number().min(0).max(1),
});

export const DamageOutputSchema = z.object({
  photo_quality_ok: z.boolean(),
  items: z.array(DamageItemSchema).max(20),
});

export type DamageItem = z.infer<typeof DamageItemSchema>;
export type DamageOutput = z.infer<typeof DamageOutputSchema>;

/** Pulls the JSON object out of a model reply that may be wrapped in ```json fences or prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in the reply');
  return JSON.parse(text.slice(start, end + 1));
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Extracts and validates the damage agent's reply. The error text is fed back to the model on retry. */
export function parseDamageOutput(text: string): ParseResult<DamageOutput> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Reply was not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = DamageOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `Reply did not match the schema: ${issues}` };
  }
  return { ok: true, data: parsed.data };
}
