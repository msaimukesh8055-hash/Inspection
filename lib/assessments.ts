// lib/assessments.ts
// Running the AI assessment, reading its result, and recording the counter settlement.
import type { Angle } from './photos';
import { invokeFunction } from './functions';
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
  source: 'ai' | 'inspector_added';
  partCode: string;
  description: string;
  reasoning: string | null;
  partsInr: number;
  labourInr: number;
  totalInr: number;
  finalInr: number | null;
};

export type DiagnosticOrder = {
  id: string;
  status: string;
  summary: string;
  priority: 'low' | 'normal' | 'high';
  provisionalTotalInr: number;
  heldInr: number;
  finalTotalInr: number | null;
  inspectorNotes: string | null;
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

/** Runs damage → estimate → router → order. Takes 20–60 seconds on free models. */
export function runAssessment(rentalId: string): Promise<void> {
  return invokeFunction('assess-return', { rental_id: rentalId });
}

/** Counter settlement: Path A "confirm_bill" then "mark_paid"; Path B "settle_order" after inspection. */
export function settleReturn(assessmentId: string, action: 'confirm_bill' | 'mark_paid' | 'settle_order'): Promise<void> {
  return invokeFunction('settle-return', { assessment_id: assessmentId, action });
}

/** Staff overrule the router with a reason: escalate A → B, or downgrade AI-raised B → A. */
export function overrideRoute(assessmentId: string, action: 'escalate' | 'downgrade', reason: string): Promise<void> {
  return invokeFunction('override-route', { assessment_id: assessmentId, action, reason });
}

const SELECT = `
  id, status, path, route_reasons, total_inr, photo_quality_ok, rider_message,
  deducted_inr, refund_inr, collect_extra_inr,
  damage_items(id, panel, type, severity, confidence, photo_ref),
  line_items(id, source, part_code, reasoning, parts_inr, labour_inr, total_inr, final_inr, parts_catalog(description)),
  diagnostic_orders(id, status, summary, priority, provisional_total_inr, held_inr, final_total_inr, inspector_notes),
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
      source: row.source === 'inspector_added' ? 'inspector_added' : 'ai',
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
        id: orderRow.id,
        status: orderRow.status,
        summary: orderRow.summary,
        priority,
        provisionalTotalInr: orderRow.provisional_total_inr,
        heldInr: orderRow.held_inr,
        finalTotalInr: orderRow.final_total_inr,
        inspectorNotes: orderRow.inspector_notes,
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
