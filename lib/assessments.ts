// lib/assessments.ts
// Running the AI assessment, reading its result, and recording the counter settlement.
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

export type LineItem = {
  id: string;
  partCode: string;
  description: string;
  reasoning: string | null;
  partsInr: number;
  labourInr: number;
  totalInr: number;
  finalInr: number | null;
};

export type DiagnosticOrder = {
  status: string;
  summary: string;
  priority: 'low' | 'normal' | 'high';
  provisionalTotalInr: number;
  heldInr: number;
};

export type StatusEvent = { status: string; at: string };

export type Assessment = {
  id: string;
  status: string;
  path: 'A' | 'B' | null;
  routeReasons: string[];
  totalInr: number;
  photoQualityOk: boolean | null;
  needsHuman: boolean;
  riderMessage: string | null;
  deductedInr: number | null;
  refundInr: number | null;
  collectExtraInr: number | null;
  items: DamageFinding[];
  lines: LineItem[];
  order: DiagnosticOrder | null;
  events: StatusEvent[];
};

/** Plain-words labels for the router's reasons. */
export const ROUTE_REASON_LABELS: Record<string, string> = {
  amount_over_threshold: 'Estimate above the ₹1,500 counter limit',
  low_confidence: 'AI not confident about some damage',
  poor_photos: 'Some photos are unclear',
  structural: 'Structural damage (crack or broken part)',
  staff_escalation: 'Staff asked for an inspection',
  needs_human: 'AI answer was not usable',
};

const DAMAGE_TYPES: readonly DamageType[] = ['scratch', 'dent', 'crack', 'broken part'];
const ANGLE_VALUES: readonly Angle[] = ['front', 'rear', 'left', 'right'];
const PRIORITIES = ['low', 'normal', 'high'] as const;

function toSeverity(value: number): 1 | 2 | 3 {
  return value <= 1 ? 1 : value >= 3 ? 3 : 2;
}

/** Calls an Edge Function and surfaces its { error } message on failure. */
async function invoke(name: string, body: Record<string, string>): Promise<void> {
  const { error } = await supabase.functions.invoke(name, { body });
  if (!error) return;
  const context: unknown = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const reply = (await context.json().catch(() => null)) as { error?: string } | null;
    if (reply?.error) throw new Error(reply.error);
  }
  throw new Error(error.message);
}

/** Runs damage → estimate → router → order. Takes 20–60 seconds on free models. */
export function runAssessment(rentalId: string): Promise<void> {
  return invoke('assess-return', { rental_id: rentalId });
}

/** Path A at the counter: "confirm_bill" saves the deposit maths, "mark_paid" closes the return. */
export function settleReturn(assessmentId: string, action: 'confirm_bill' | 'mark_paid'): Promise<void> {
  return invoke('settle-return', { assessment_id: assessmentId, action });
}

const SELECT = `
  id, status, path, route_reasons, total_inr, photo_quality_ok, rider_message,
  deducted_inr, refund_inr, collect_extra_inr,
  damage_items(id, panel, type, severity, confidence, photo_ref),
  line_items(id, part_code, reasoning, parts_inr, labour_inr, total_inr, final_inr, parts_catalog(description)),
  diagnostic_orders(status, summary, priority, provisional_total_inr, held_inr),
  status_events(status, at)
`;

export async function fetchAssessment(rentalId: string): Promise<Assessment | null> {
  const { data, error } = await supabase.from('assessments').select(SELECT).eq('rental_id', rentalId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const items = data.damage_items.flatMap(function toFinding(row): DamageFinding[] {
    const type = DAMAGE_TYPES.find((t) => t === row.type);
    const angle = ANGLE_VALUES.find((a) => a === row.photo_ref);
    if (!type || !angle) return [];
    return [{ id: row.id, panel: row.panel, type, severity: toSeverity(row.severity), confidence: Number(row.confidence), angle }];
  });

  const lines = data.line_items.map(function toLine(row): LineItem {
    return {
      id: row.id,
      partCode: row.part_code,
      description: row.parts_catalog?.description ?? row.part_code,
      reasoning: row.reasoning,
      partsInr: row.parts_inr,
      labourInr: row.labour_inr,
      totalInr: row.total_inr,
      finalInr: row.final_inr,
    };
  });

  const orderRow = data.diagnostic_orders;
  const priority = PRIORITIES.find((p) => p === orderRow?.priority) ?? 'normal';
  const order: DiagnosticOrder | null = orderRow
    ? {
        status: orderRow.status,
        summary: orderRow.summary,
        priority,
        provisionalTotalInr: orderRow.provisional_total_inr,
        heldInr: orderRow.held_inr,
      }
    : null;

  const events = [...data.status_events].sort((a, b) => a.at.localeCompare(b.at));
  const path = data.path === 'A' || data.path === 'B' ? data.path : null;

  return {
    id: data.id,
    status: data.status,
    path,
    routeReasons: data.route_reasons,
    totalInr: data.total_inr,
    photoQualityOk: data.photo_quality_ok,
    needsHuman: data.route_reasons.includes('needs_human'),
    riderMessage: data.rider_message,
    deductedInr: data.deducted_inr,
    refundInr: data.refund_inr,
    collectExtraInr: data.collect_extra_inr,
    items,
    lines,
    order,
    events,
  };
}
