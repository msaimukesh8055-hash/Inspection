// lib/dashboard.ts
// Fleet damage history for the dashboard: every assessed return (eval test rentals left out, and returns
// the inspector sent back are counted once they are assessed again), grouped by scooter, with the Path
// A/B split, money recovered and returns per branch. The sums are plain functions so they can be unit-tested.
import { ANGLES } from './photos';
import type { Angle } from './photos';
import { BRANCHES } from './pickup';
import { supabase } from './supabase';

export type DamageEntry = { side: Angle | null; what: string; amountInr: number; addedByInspector: boolean };

export type ReturnRecord = {
  rentalId: string;
  regNo: string;
  model: string;
  colour: string;
  date: string;
  branch: string | null;
  path: 'A' | 'B' | null;
  status: string;
  deductedInr: number;
  collectExtraInr: number;
  entries: DamageEntry[];
};

export type ScooterHistory = { regNo: string; model: string; colour: string; totalInr: number; returns: ReturnRecord[] };

export type DashboardSummary = {
  scooters: ScooterHistory[];
  paths: { A: number; B: number };
  moneyRecoveredInr: number;
  /** Every branch in a fixed order, including branches with no returns yet. */
  byBranch: { branch: string; returns: number }[];
};

/** The 15 hidden eval rentals (…0401 to …0415) are test traffic, not fleet history. */
export function isEvalRental(rentalId: string): boolean {
  const match = /^00000000-0000-4000-8000-000000000(\d{3})$/.exec(rentalId);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 401 && n <= 415;
}

const FINISHED = new Set(['paid', 'settled']);

export function summarize(returns: readonly ReturnRecord[]): DashboardSummary {
  const paths = { A: 0, B: 0 };
  let moneyRecoveredInr = 0;
  const branchCounts = new Map<string, number>(BRANCHES.map((b) => [b, 0]));
  const scooters = new Map<string, ScooterHistory>();

  for (const record of returns) {
    if (record.path) paths[record.path] += 1;
    if (FINISHED.has(record.status)) moneyRecoveredInr += record.deductedInr + record.collectExtraInr;
    if (record.branch !== null && branchCounts.has(record.branch)) branchCounts.set(record.branch, (branchCounts.get(record.branch) ?? 0) + 1);
    const scooter = scooters.get(record.regNo) ?? { regNo: record.regNo, model: record.model, colour: record.colour, totalInr: 0, returns: [] };
    scooter.returns.push(record);
    scooter.totalInr += record.entries.reduce((sum, e) => sum + e.amountInr, 0);
    scooters.set(record.regNo, scooter);
  }

  for (const scooter of scooters.values()) scooter.returns.sort((a, b) => b.date.localeCompare(a.date));

  return {
    scooters: [...scooters.values()].sort((a, b) => a.regNo.localeCompare(b.regNo)),
    paths,
    moneyRecoveredInr,
    byBranch: [...branchCounts].map(([branch, count]) => ({ branch, returns: count })),
  };
}

const RETURN_COLUMNS = `rental_id, path, status, total_inr, deducted_inr, collect_extra_inr, created_at,
  rentals(returned_at, branch, vehicles(model, reg_no, colour)),
  damage_items(id, type, panel, photo_ref),
  line_items(damage_item_id, source, angle, total_inr, final_inr, parts_catalog(description))`;

function asAngle(value: string | null | undefined): Angle | null {
  return ANGLES.find((a) => a === value) ?? null;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  // A sent-back return has no answer anyone trusts yet; it is counted once reassessed.
  const returnsResult = await supabase.from('assessments').select(RETURN_COLUMNS).not('path', 'is', null).neq('status', 'sent_back');
  if (returnsResult.error) throw new Error(returnsResult.error.message);

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
      return {
        rentalId: row.rental_id,
        regNo: vehicle?.reg_no ?? 'Unknown',
        model: vehicle?.model ?? '',
        colour: vehicle?.colour ?? '',
        date: row.rentals?.returned_at ?? row.created_at,
        branch: row.rentals?.branch ?? null,
        path: row.path === 'A' || row.path === 'B' ? row.path : null,
        status: row.status,
        deductedInr: row.deducted_inr ?? 0,
        collectExtraInr: row.collect_extra_inr ?? 0,
        entries: [...lineEntries, ...unpriced],
      };
    });

  return summarize(returns);
}
