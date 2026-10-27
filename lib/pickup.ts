// lib/pickup.ts
// New pickup: the choices the form needs and the call that records the rental.
import { BRANCHES } from '../supabase/functions/_shared/pickup';
import type { Branch } from '../supabase/functions/_shared/pickup';
import { invokeFunction } from './functions';
import { supabase } from './supabase';

export { BRANCHES };
export type { Branch };

export type RiderOption = { id: string; name: string };

/** Pickup details carried from the details page to the photos page. */
export type PickupDetails = { regNo: string; model: string; colour: string; riderId: string; branch: Branch };

export async function fetchRiders(): Promise<RiderOption[]> {
  const { data, error } = await supabase.from('riders').select('id, name').order('name');
  if (error) throw new Error(error.message);
  return data;
}

/** Models with parts prices; a return can only be estimated for one of these. */
export async function fetchPricedModels(): Promise<string[]> {
  const { data, error } = await supabase.from('parts_catalog').select('vehicle_model');
  if (error) throw new Error(error.message);
  return [...new Set(data.map((row) => row.vehicle_model))].sort();
}

export function pickupSearch(details: PickupDetails): string {
  return new URLSearchParams({ reg: details.regNo, model: details.model, colour: details.colour, rider: details.riderId, branch: details.branch }).toString();
}

export function pickupFromSearch(search: URLSearchParams): PickupDetails | null {
  const regNo = search.get('reg') ?? '';
  const model = search.get('model') ?? '';
  const riderId = search.get('rider') ?? '';
  const branch = BRANCHES.find((b) => b === search.get('branch'));
  if (!regNo || !model || !riderId || !branch) return null;
  return { regNo, model, colour: search.get('colour') ?? '', riderId, branch };
}

/** Saves the rental and its photos rows. The four photos must already be uploaded under rentalId. */
export function startRental(rentalId: string, details: PickupDetails): Promise<void> {
  return invokeFunction('start-rental', {
    rental_id: rentalId,
    reg_no: details.regNo,
    model: details.model,
    ...(details.colour ? { colour: details.colour } : {}),
    rider_id: details.riderId,
    branch: details.branch,
  });
}
