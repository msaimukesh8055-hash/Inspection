// supabase/functions/_shared/schemas.ts
// Zod schemas for every agent output. Nothing an agent returns is saved until it passes these.
import { z } from 'zod';

export const PHOTO_ANGLES = ['front', 'rear', 'left', 'right'] as const;
export const DAMAGE_TYPES = ['scratch', 'dent', 'crack', 'broken part'] as const;

// Damage agent

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

// Estimate agent: maps each damage item to a part code. It never returns a price.

export const EstimateOutputSchema = z.object({
  lines: z
    .array(
      z.object({
        damage_id: z.string().trim().min(1),
        part_code: z.string().trim().min(1),
        reasoning: z.string().trim().min(1).max(200),
      }),
    )
    .max(20),
});

export type EstimateOutput = z.infer<typeof EstimateOutputSchema>;

// Order agent: words only. Rupee amounts come from code, so any amount in the text is rejected.

const RUPEE_AMOUNT = /₹|\b(?:rs|inr)\.?\s*\d|\d[\d,]*\s*(?:rupees?|rs\b|inr\b)/i;

export function containsRupeeAmount(text: string): boolean {
  return RUPEE_AMOUNT.test(text);
}

const wordsOnly = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((text) => !containsRupeeAmount(text), 'must not contain rupee amounts');

export const BillOutputSchema = z.object({ bill_text: wordsOnly(600) });

export const OrderOutputSchema = z.object({
  summary: wordsOnly(400),
  priority: z.enum(['low', 'normal', 'high']),
  rider_message: wordsOnly(400),
});

export type BillOutput = z.infer<typeof BillOutputSchema>;
export type OrderOutput = z.infer<typeof OrderOutputSchema>;

// Parsing

/** Pulls the JSON object out of a model reply that may be wrapped in ```json fences or prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in the reply');
  return JSON.parse(text.slice(start, end + 1));
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Extracts and validates a reply. The error text is fed back to the model on retry. */
export function parseReply<T>(schema: z.ZodType<T>, text: string): ParseResult<T> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: `Reply was not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `Reply did not match the schema: ${issues}` };
  }
  return { ok: true, data: parsed.data };
}

export function parseDamageOutput(text: string): ParseResult<DamageOutput> {
  return parseReply(DamageOutputSchema, text);
}

/** Validates the estimate and checks it covers each damage item once, using only allowed part codes. */
export function parseEstimateOutput(
  text: string,
  damageIds: readonly string[],
  allowedCodes: readonly string[],
): ParseResult<EstimateOutput> {
  const parsed = parseReply(EstimateOutputSchema, text);
  if (!parsed.ok) return parsed;

  const seen = parsed.data.lines.map((l) => l.damage_id);
  const missing = damageIds.filter((id) => !seen.includes(id));
  const unknown = seen.filter((id) => !damageIds.includes(id));
  const repeated = seen.filter((id, i) => seen.indexOf(id) !== i);
  const badCodes = parsed.data.lines.map((l) => l.part_code).filter((code) => !allowedCodes.includes(code));

  const problems = [
    missing.length && `missing damage_id ${missing.join(', ')}`,
    unknown.length && `unknown damage_id ${unknown.join(', ')}`,
    repeated.length && `damage_id used twice: ${repeated.join(', ')}`,
    badCodes.length && `part_code not in the catalog: ${badCodes.join(', ')}`,
  ].filter(Boolean);
  if (problems.length) return { ok: false, error: `Reply did not match the request: ${problems.join('; ')}` };
  return parsed;
}
