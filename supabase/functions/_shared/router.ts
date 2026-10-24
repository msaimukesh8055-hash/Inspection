// supabase/functions/_shared/router.ts
// Path A (bill at the counter) or Path B (human inspector). Plain code, not a model call,
// so it is testable and predictable. Any one rule firing sends the return to Path B.
import { DEFAULT_MIN_CONFIDENCE, DEFAULT_THRESHOLD_INR } from './constants.ts';

export type Path = 'A' | 'B';

export type RouteReason =
  | 'amount_over_threshold'
  | 'low_confidence'
  | 'poor_photos'
  | 'structural'
  | 'staff_escalation'
  | 'needs_human';

export type ReturnAssessment = {
  total_inr: number;
  items: { type: string; confidence: number }[];
  photo_quality_ok: boolean;
  staff_escalated: boolean;
  /** An agent failed validation twice: a human must decide. */
  needs_human?: boolean;
};

export type RouteConfig = { thresholdInr: number; minConfidence: number };

export const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  thresholdInr: DEFAULT_THRESHOLD_INR,
  minConfidence: DEFAULT_MIN_CONFIDENCE,
};

export function route(r: ReturnAssessment, config: RouteConfig = DEFAULT_ROUTE_CONFIG): { path: Path; reasons: RouteReason[] } {
  const reasons: RouteReason[] = [];
  if (r.total_inr > config.thresholdInr) reasons.push('amount_over_threshold');
  if (r.items.some((i) => i.confidence < config.minConfidence)) reasons.push('low_confidence');
  if (!r.photo_quality_ok) reasons.push('poor_photos');
  if (r.items.some((i) => i.type === 'crack' || i.type === 'broken part')) reasons.push('structural');
  if (r.staff_escalated) reasons.push('staff_escalation');
  if (r.needs_human) reasons.push('needs_human');
  return { path: reasons.length ? 'B' : 'A', reasons };
}

/** Reads threshold_inr and min_confidence from config rows, falling back to the defaults. */
export function routeConfigFrom(rows: { key: string; value: unknown }[]): RouteConfig {
  const number = (key: string, fallback: number): number => {
    const value = rows.find((r) => r.key === key)?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  return {
    thresholdInr: number('threshold_inr', DEFAULT_THRESHOLD_INR),
    minConfidence: number('min_confidence', DEFAULT_MIN_CONFIDENCE),
  };
}
