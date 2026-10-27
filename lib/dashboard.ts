// lib/dashboard.ts
// Fleet damage history for the dashboard: every assessed return (eval test rentals left out, and returns
// the inspector sent back are counted once they are assessed again), grouped by scooter, with totals by side, the Path A/B split, money recovered and how often the inspector agreed
// with the AI. The sums are plain functions so they can be unit-tested.
import { SEND_BACK_REASONS } from './inspection';
import type { SendBackReason } from './inspection';
import { ANGLES } from './photos';
import type { Angle } from './photos';
import { supabase } from './supabase';

export type DamageEntry = { side: Angle | null; what: string; amountInr: number; addedByInspector: boolean };

export type ReturnRecord = {
  rentalId: string;
  regNo: string;
  model: string;
  colour: string;
  date: string;
  path: 'A' | 'B' | null;
  status: string;
  deductedInr: number;
  collectExtraInr: number;
  entries: DamageEntry[];
  /** Path B only: the AI's estimate and the inspector's confirmed total (null until confirmed). */
  order: { provisionalInr: number; finalInr: number | null } | null;
};

export type ScooterHistory = { regNo: string; model: string; colour: string; totalInr: number; returns: ReturnRecord[] };

export type DashboardSummary = {
  scooters: ScooterHistory[];
  bySide: Record<Angle, { count: number; amountInr: number }>;
  paths: { A: number; B: number };
  moneyRecoveredInr: number;
  agreement: { agreed: number; decisions: number };
  sendBackReasons: { reason: SendBackReason; label: string; count: number }[];
};

/** The 15 hidden eval rentals (…0401 to …0415) are test traffic, not fleet history. */
export function isEvalRental(rentalId: string): boolean {
  const match = /^00000000-0000-4000-8000-000000000(\d{3})$/.exec(rentalId);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 401 && n <= 415;
}

const FINISHED = new Set(['paid', 'settled']);

export function summarize(returns: readonly ReturnRecord[], sendBacks: readonly SendBackReason[]): DashboardSummary {
  const bySide = Object.fromEntries(ANGLES.map((a) => [a, { count: 0, amountInr: 0 }])) as DashboardSummary['bySide'];
  const paths = { A: 0, B: 0 };
  let moneyRecoveredInr = 0;
  let agreed = 0;
  let confirmed = 0;
  const scooters = new Map<string, ScooterHistory>();

  for (const record of returns) {
    if (record.path) paths[record.path] += 1;
    if (FINISHED.has(record.status)) moneyRecoveredInr += record.deductedInr + record.collectExtraInr;
    if (record.order && record.order.finalInr !== null) {
      confirmed += 1;
      if (record.order.finalInr === record.order.provisionalInr) agreed += 1;
    }
    for (const entry of record.entries) {
      if (!entry.side) continue;
      bySide[entry.side].count += 1;
      bySide[entry.side].amountInr += entry.amountInr;
    }
    const scooter = scooters.get(record.regNo) ?? { regNo: record.regNo, model: record.model, colour: record.colour, totalInr: 0, returns: [] };
    scooter.returns.push(record);
    scooter.totalInr += record.entries.reduce((sum, e) => sum + e.amountInr, 0);
    scooters.set(record.regNo, scooter);
  }

  for (const scooter of scooters.values()) scooter.returns.sort((a, b) => b.date.localeCompare(a.date));
  const reasonCounts = (Object.keys(SEND_BACK_REASONS) as SendBackReason[])
    .map((reason) => ({ reason, label: SEND_BACK_REASONS[reason], count: sendBacks.filter((r) => r === reason).length }))
    .filter((r) => r.count > 0);

  return {
    scooters: [...scooters.values()].sort((a, b) => a.regNo.localeCompare(b.regNo)),
    bySide,
    paths,
    moneyRecoveredInr,
    // A send-back counts as a decision where the inspector did not agree with the AI.
    agreement: { agreed, decisions: confirmed + sendBacks.length },
    sendBackReasons: reasonCounts,
  };
}

const RETURN_COLUMNS = `rental_id, path, status, total_inr, deducted_inr, collect_extra_inr, created_at,
  rentals(returned_at, vehicles(model, reg_no, colour)),
  damage_items(id, type, panel, photo_ref),
  line_items(damage_item_id, source, angle, total_inr, final_inr, parts_catalog(description)),
  diagnostic_orders(provisional_total_inr, final_total_inr)`;

function asAngle(value: string | null | undefined): Angle | null {
  return ANGLES.find((a) => a === value) ?? null;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  const [returnsResult, sendBackResult] = await Promise.all([
    // A sent-back return has no answer anyone trusts yet; it is counted once reassessed. The send-back
    // itself still counts below, as a decision where the inspector disagreed with the AI.
    supabase.from('assessments').select(RETURN_COLUMNS).not('path', 'is', null).neq('status', 'sent_back'),
    supabase.from('reassessments').select('rental_id, reason'),
  ]);
  if (returnsResult.error) throw new Error(returnsResult.error.message);
  if (sendBackResult.error) throw new Error(sendBackResult.error.message);

  const returns: ReturnRecord[] = returnsResult.data
    .filter((row) => !isEvalRental(row.rental_id))
    .map(function toRecord(row): ReturnRecord {
      const damageById = new Map(row.damage_items.map((d) => [d.id, d]));
      const priced = new Set(row.line_items.map((l) => l.damage_item_id).filter((id) => id !== null));
      const lineEntries = row.line_items.map(function toEntry(line): DamageEntry {
        const damage = line.damage_item_id ? damageById.get(line.damage_item_id) : undefined;
        return {
          side: asAngle(line.angle ?? damage?.photo_ref),
          what: damage ? `${capitalise(damage.type)} · ${damage.panel}` : `${line.parts_catalog?.description ?? 'Part'} (added by inspector)`,
          amountInr: line.final_inr ?? line.total_inr,
          addedByInspector: line.source === 'inspector_added',
        };
      });
      // Damage the AI found but could not price still belongs in the history.
      const unpriced = row.damage_items
        .filter((d) => !priced.has(d.id))
        .map((d): DamageEntry => ({ side: asAngle(d.photo_ref), what: `${capitalise(d.type)} · ${d.panel}`, amountInr: 0, addedByInspector: false }));
      const vehicle = row.rentals?.vehicles;
      const order = row.diagnostic_orders;
      return {
        rentalId: row.rental_id,
        regNo: vehicle?.reg_no ?? 'Unknown',
        model: vehicle?.model ?? '',
        colour: vehicle?.colour ?? '',
        date: row.rentals?.returned_at ?? row.created_at,
        path: row.path === 'A' || row.path === 'B' ? row.path : null,
        status: row.status,
        deductedInr: row.deducted_inr ?? 0,
        collectExtraInr: row.collect_extra_inr ?? 0,
        entries: [...lineEntries, ...unpriced],
        order: order ? { provisionalInr: order.provisional_total_inr, finalInr: order.final_total_inr } : null,
      };
    });

  const keys = Object.keys(SEND_BACK_REASONS) as SendBackReason[];
  const sendBacks = sendBackResult.data
    .filter((row) => !isEvalRental(row.rental_id))
    .flatMap((row) => keys.filter((key) => key === row.reason));
  return summarize(returns, sendBacks);
}
