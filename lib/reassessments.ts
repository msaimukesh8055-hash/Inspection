// lib/reassessments.ts
// Returns the inspector sent back to the counter, still waiting to be assessed again.
import { SEND_BACK_REASONS } from './inspection';
import type { SendBackReason } from './inspection';
import { supabase } from './supabase';

export type SentBackReturn = {
  rentalId: string;
  reason: SendBackReason;
  reasonLabel: string;
  note: string | null;
  requestedAt: string;
  model: string;
  regNo: string;
  riderName: string;
};

type Row = {
  rental_id: string;
  reason: string;
  note: string | null;
  requested_at: string;
  rentals: { vehicles: { model: string; reg_no: string } | null; riders: { name: string } | null } | null;
};

function toSentBack(row: Row): SentBackReturn {
  const reason = (Object.keys(SEND_BACK_REASONS) as SendBackReason[]).find((key) => key === row.reason) ?? 'other';
  return {
    rentalId: row.rental_id,
    reason,
    reasonLabel: SEND_BACK_REASONS[reason],
    note: row.note,
    requestedAt: row.requested_at,
    model: row.rentals?.vehicles?.model ?? 'Unknown vehicle',
    regNo: row.rentals?.vehicles?.reg_no ?? '',
    riderName: row.rentals?.riders?.name ?? '',
  };
}

const COLUMNS = 'rental_id, reason, note, requested_at, rentals(vehicles(model, reg_no), riders(name))';

/** Open send-backs, oldest first: the order the counter should work through them. */
export async function fetchSentBackReturns(): Promise<SentBackReturn[]> {
  const { data, error } = await supabase.from('reassessments').select(COLUMNS).is('resolved_at', null).order('requested_at');
  if (error) throw new Error(error.message);
  return data.map(toSentBack);
}

/** The open send-back for one rental, or null if the inspector has not sent it back. */
export async function fetchOpenReassessment(rentalId: string): Promise<SentBackReturn | null> {
  const { data, error } = await supabase.from('reassessments').select(COLUMNS).eq('rental_id', rentalId).is('resolved_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSentBack(data) : null;
}
