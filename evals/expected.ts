// evals/expected.ts
// The answer sheet format for one eval case (evals/cases/<id>/expected.json), shared by the
// case generator, the file check and the runner.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

export const CASES_DIR = fileURLToPath(new URL('./cases/', import.meta.url));

export const GROUPS = ['no_damage', 'minor_scratch', 'dent_or_broken', 'poor_photos', 'pre_existing'] as const;

export const ExpectedSchema = z.object({
  id: z.string().regex(/^E\d{2}-[a-z0-9-]+$/),
  group: z.enum(GROUPS),
  description: z.string().min(1),
  /** Hidden eval rental the runner uploads photos to (status closed, never in the Active list). */
  rental_id: z.string().uuid(),
  expected_path: z.enum(['A', 'B']),
  /** True when nothing new should be flagged: any flagged item is a false positive. */
  no_new_damage: z.boolean(),
  /** Each must be matched by a flagged item seen in that angle whose panel mentions any keyword. */
  expected_damage: z.array(
    z.object({
      photo_ref: z.enum(['front', 'rear', 'left', 'right']),
      panel_keywords: z.array(z.string().min(1)).min(1),
    }),
  ),
  /** Acceptable total; null when the amount does not matter (the case is about routing). */
  amount_inr: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).nullable(),
});

export type Expected = z.infer<typeof ExpectedSchema>;

export const PHOTO_STAGES = ['pickup', 'return'] as const;
export const PHOTO_ANGLES = ['front', 'rear', 'left', 'right'] as const;

/** Reads every case's expected.json, validated. Throws on the first bad file. */
export function loadCases(): Expected[] {
  return readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const raw: unknown = JSON.parse(readFileSync(`${CASES_DIR}${name}/expected.json`, 'utf8'));
      const parsed = ExpectedSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`${name}/expected.json: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
      if (parsed.data.id !== name) throw new Error(`${name}/expected.json: id is ${parsed.data.id}`);
      return parsed.data;
    });
}
