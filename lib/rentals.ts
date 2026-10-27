// lib/rentals.ts
// Read-side queries for the counter (Detector) screens.
import { ANGLES, PHOTO_BUCKET } from './photos';
import type { Angle, Stage } from './photos';
import { supabase } from './supabase';

const RENTAL_COLUMNS = 'id, status, picked_up_at, deposit_inr, branch, vehicles(model, reg_no, colour), riders(name)';

export type RentalSummary = {
  id: string;
  status: string;
  pickedUpAt: string;
  depositInr: number;
  model: string;
  regNo: string;
  colour: string;
  riderName: string;
  branch: string | null;
};

type RentalRow = {
  id: string;
  status: string;
  picked_up_at: string;
  deposit_inr: number;
  branch: string | null;
  vehicles: { model: string; reg_no: string; colour: string } | null;
  riders: { name: string } | null;
};

function toSummary(row: RentalRow): RentalSummary {
  return {
    id: row.id,
    status: row.status,
    pickedUpAt: row.picked_up_at,
    depositInr: row.deposit_inr,
    model: row.vehicles?.model ?? 'Unknown vehicle',
    regNo: row.vehicles?.reg_no ?? '',
    colour: row.vehicles?.colour ?? '',
    riderName: row.riders?.name ?? 'Unknown rider',
    branch: row.branch,
  };
}

export async function fetchActiveRentals(): Promise<RentalSummary[]> {
  const { data, error } = await supabase
    .from('rentals')
    .select(RENTAL_COLUMNS)
    .eq('status', 'active')
    .order('picked_up_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(toSummary);
}

export async function fetchRental(rentalId: string): Promise<RentalSummary> {
  const { data, error } = await supabase.from('rentals').select(RENTAL_COLUMNS).eq('id', rentalId).single();
  if (error) throw new Error(error.message);
  return toSummary(data);
}

/** Signed URLs (valid one hour) for the photos saved at one stage of a rental. */
export async function fetchPhotoUrls(rentalId: string, stage: Stage): Promise<Partial<Record<Angle, string>>> {
  const { data: rows, error } = await supabase
    .from('photos')
    .select('angle, storage_path')
    .eq('rental_id', rentalId)
    .eq('stage', stage);
  if (error) throw new Error(error.message);
  if (rows.length === 0) return {};

  const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
    rows.map((r) => r.storage_path),
    3600,
  );
  if (signed.error) throw new Error(signed.error.message);

  const urls: Partial<Record<Angle, string>> = {};
  for (const row of rows) {
    const match = signed.data.find((s) => s.path === row.storage_path);
    const angle = ANGLES.find((a) => a === row.angle);
    if (angle && match?.signedUrl) urls[angle] = match.signedUrl;
  }
  return urls;
}
