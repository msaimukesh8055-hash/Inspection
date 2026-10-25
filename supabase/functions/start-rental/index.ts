// supabase/functions/start-rental/index.ts
// POST { rental_id, reg_no, model, colour?, rider_id }. Records a pickup: the vehicle (created if the
// plate is new), the rental and its four pickup photos, all or nothing. The app has already uploaded
// the photos to {rental_id}/pickup/{angle}.jpg; this checks they are all there before saving anything.
import { check, need, RequestError, serve } from '../_shared/db.ts';
import type { Db } from '../_shared/db.ts';
import { colourOrDefault, openRentalBlocker, StartRentalSchema } from '../_shared/pickup.ts';
import type { StartRentalRequest } from '../_shared/pickup.ts';
import { PHOTO_ANGLES } from '../_shared/schemas.ts';

const BUCKET = 'vehicle-photos';

async function assertPhotosUploaded(db: Db, rentalId: string): Promise<void> {
  const listed = await db.storage.from(BUCKET).list(`${rentalId}/pickup`);
  if (listed.error) throw new Error(listed.error.message);
  const names = listed.data.map((file) => file.name);
  const missing = PHOTO_ANGLES.filter((angle) => !names.includes(`${angle}.jpg`));
  if (missing.length) throw new RequestError(`Missing pickup photo: ${missing.join(', ')}. Upload all four first.`);
}

/** The existing vehicle for this plate (refused if it is still out on a rental), or null for a new plate. */
async function existingVehicle(db: Db, regNo: string): Promise<string | null> {
  const existing = check(await db.from('vehicles').select('id, rentals(status)').eq('reg_no', regNo).maybeSingle());
  if (!existing) return null;
  const blocker = openRentalBlocker(regNo, existing.rentals.map((r) => r.status));
  if (blocker) throw new RequestError(blocker);
  return existing.id;
}

async function createVehicle(db: Db, request: StartRentalRequest): Promise<string> {
  const created = need(
    await db
      .from('vehicles')
      .insert({ reg_no: request.reg_no, model: request.model, colour: colourOrDefault(request.colour) })
      .select('id')
      .single(),
  );
  return created.id;
}

async function startRental(db: Db, request: StartRentalRequest) {
  const priced = need(await db.from('parts_catalog').select('part_code').eq('vehicle_model', request.model).limit(1));
  if (priced.length === 0) throw new RequestError(`No parts prices for ${request.model}, so its returns could not be estimated`);
  const rider = check(await db.from('riders').select('id').eq('id', request.rider_id).maybeSingle());
  if (!rider) throw new RequestError('Rider not found');
  const known = await existingVehicle(db, request.reg_no);
  await assertPhotosUploaded(db, request.rental_id);

  const vehicleId = known ?? (await createVehicle(db, request));
  check(await db.from('rentals').insert({ id: request.rental_id, vehicle_id: vehicleId, rider_id: request.rider_id }));

  const photos = PHOTO_ANGLES.map((angle) => ({
    rental_id: request.rental_id,
    stage: 'pickup',
    angle,
    storage_path: `${request.rental_id}/pickup/${angle}.jpg`,
  }));
  const saved = await db.from('photos').insert(photos);
  if (saved.error) {
    // Never leave a rental without its pickup photos: the damage agent needs them at return.
    await db.from('rentals').delete().eq('id', request.rental_id);
    throw new Error(saved.error.message);
  }
  return { rental_id: request.rental_id, reg_no: request.reg_no };
}

serve('start-rental', StartRentalSchema, '{ rental_id, reg_no, model, colour?, rider_id }', startRental);
