// supabase/functions/assess-return/estimate.ts
// Estimate step: the model only picks part codes; every rupee comes from parts_catalog here in code.
import type { SupabaseClient } from '@supabase/supabase-js';

import { runAgent } from '../_shared/agent.ts';
import type { AgentResult } from '../_shared/agent.ts';
import type { Database } from '../_shared/database.types.ts';
import type { ChatMessage } from '../_shared/openrouter.ts';
import { ESTIMATE_SYSTEM_PROMPT } from '../_shared/prompts.ts';
import { parseEstimateOutput } from '../_shared/schemas.ts';
import type { DamageItem, EstimateOutput } from '../_shared/schemas.ts';

export type CatalogPart = { part_code: string; description: string; parts_inr: number; labour_inr: number };

/** A damage item as sent to the model, with a short id ("d1") instead of the database uuid. */
export type NumberedDamage = DamageItem & { damage_id: string };

export type PricedLine = {
  damage_id: string;
  part_code: string;
  description: string;
  reasoning: string;
  parts_inr: number;
  labour_inr: number;
  total_inr: number;
};

export function numberDamage(items: DamageItem[]): NumberedDamage[] {
  return items.map((item, i) => ({ ...item, damage_id: `d${i + 1}` }));
}

export function buildEstimateMessages(vehicleModel: string, damage: NumberedDamage[], catalog: CatalogPart[]): ChatMessage[] {
  const damageLines = damage
    .map((d) => `${d.damage_id}: ${d.type} on ${d.panel} (severity ${d.severity}, seen in ${d.photo_ref})`)
    .join('\n');
  const catalogLines = catalog.map((p) => `${p.part_code}: ${p.description}`).join('\n');
  return [
    { role: 'system', content: ESTIMATE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Vehicle: ${vehicleModel}\n\nDamage items:\n${damageLines}\n\nParts catalog (code: description):\n${catalogLines}`,
    },
  ];
}

/** Adds catalog prices to the model's part choices. Throws if a code is missing (parse already checks this). */
export function priceLines(estimate: EstimateOutput, catalog: CatalogPart[]): PricedLine[] {
  return estimate.lines.map((line) => {
    const part = catalog.find((p) => p.part_code === line.part_code);
    if (!part) throw new Error(`Part ${line.part_code} is not in the catalog`);
    return {
      damage_id: line.damage_id,
      part_code: part.part_code,
      description: part.description,
      reasoning: line.reasoning,
      parts_inr: part.parts_inr,
      labour_inr: part.labour_inr,
      total_inr: part.parts_inr + part.labour_inr,
    };
  });
}

export function runEstimateAgent(
  db: SupabaseClient<Database>,
  assessmentId: string,
  vehicleModel: string,
  damage: NumberedDamage[],
  catalog: CatalogPart[],
): Promise<AgentResult<EstimateOutput>> {
  const damageIds = damage.map((d) => d.damage_id);
  const codes = catalog.map((p) => p.part_code);
  return runAgent({
    db,
    agent: 'estimate',
    assessmentId,
    messages: buildEstimateMessages(vehicleModel, damage, catalog),
    parse: (text) => parseEstimateOutput(text, damageIds, codes),
    outageIsFailure: true,
  });
}
