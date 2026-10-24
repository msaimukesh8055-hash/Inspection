// lib/assessments.ts
// Running the AI assessment and reading its result.
import type { Angle } from './photos';
import { supabase } from './supabase';

export type DamageType = 'scratch' | 'dent' | 'crack' | 'broken part';

export type DamageFinding = {
  id: string;
  panel: string;
  type: DamageType;
  severity: 1 | 2 | 3;
  confidence: number;
  angle: Angle;
};

export type Assessment = {
  id: string;
  status: string;
  photoQualityOk: boolean | null;
  needsHuman: boolean;
  items: DamageFinding[];
};

const DAMAGE_TYPES: readonly DamageType[] = ['scratch', 'dent', 'crack', 'broken part'];
const ANGLE_VALUES: readonly Angle[] = ['front', 'rear', 'left', 'right'];

function toSeverity(value: number): 1 | 2 | 3 {
  return value <= 1 ? 1 : value >= 3 ? 3 : 2;
}

/** Calls the assess-return Edge Function. It takes 15–60 seconds on free models. */
export async function runAssessment(rentalId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('assess-return', { body: { rental_id: rentalId } });
  if (!error) return;

  // Non-2xx replies carry { error } in the body; show that rather than the generic message.
  const context: unknown = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const body = (await context.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) throw new Error(body.error);
  }
  throw new Error(error.message);
}

export async function fetchAssessment(rentalId: string): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, status, photo_quality_ok, route_reasons, damage_items(id, panel, type, severity, confidence, photo_ref)')
    .eq('rental_id', rentalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const items = data.damage_items.flatMap(function toFinding(row): DamageFinding[] {
    const type = DAMAGE_TYPES.find((t) => t === row.type);
    const angle = ANGLE_VALUES.find((a) => a === row.photo_ref);
    if (!type || !angle) return [];
    return [
      {
        id: row.id,
        panel: row.panel,
        type,
        severity: toSeverity(row.severity),
        confidence: Number(row.confidence),
        angle,
      },
    ];
  });

  return {
    id: data.id,
    status: data.status,
    photoQualityOk: data.photo_quality_ok,
    needsHuman: data.route_reasons.includes('needs_human'),
    items,
  };
}
