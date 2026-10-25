// lib/returnPhotos.ts
// Preparing and uploading the four pickup or return photos in the browser.
import { ANGLES, PHOTO_BUCKET, photoPath } from './photos';
import type { Angle, SampleSet, SampleVehicleKey, Stage } from './photos';
import { sampleImageUrl } from './sampleImages';
import { supabase } from './supabase';

/** Longest side sent to storage; keeps uploads fast and model calls cheap later. */
const MAX_SIDE_PX = 1280;

/** A chosen photo: url is a sample asset or a local object URL of the prepared JPEG. */
export type ChosenPhoto = { url: string; source: 'sample' | 'file' };

/** Shrinks a picked file to MAX_SIDE_PX and re-encodes it as JPEG. */
export async function prepareFile(file: File): Promise<ChosenPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare images.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(function encode(resolve) {
    canvas.toBlob(resolve, 'image/jpeg', 0.82);
  });
  if (!blob) throw new Error('Could not convert the photo to JPEG.');
  return { url: URL.createObjectURL(blob), source: 'file' };
}

export function samplePhotos(vehicle: SampleVehicleKey, set: SampleSet): Record<Angle, ChosenPhoto> {
  const photo = (angle: Angle): ChosenPhoto => ({ url: sampleImageUrl(vehicle, set, angle), source: 'sample' });
  return { front: photo('front'), rear: photo('rear'), left: photo('left'), right: photo('right') };
}

/** Uploads one photo file to storage, overwriting any earlier one. Returns its storage path. */
async function uploadPhotoFile(rentalId: string, stage: Stage, angle: Angle, photo: ChosenPhoto): Promise<string> {
  const blob = await (await fetch(photo.url)).blob();
  const path = photoPath(rentalId, stage, angle);
  const upload = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upload.error) throw new Error(`${angle}: ${upload.error.message}`);
  return path;
}

/** Uploads one return photo and records its photos row. */
async function uploadReturnPhoto(rentalId: string, angle: Angle, photo: ChosenPhoto): Promise<void> {
  const path = await uploadPhotoFile(rentalId, 'return', angle, photo);

  const row = await supabase
    .from('photos')
    .upsert({ rental_id: rentalId, stage: 'return', angle, storage_path: path }, { onConflict: 'rental_id,stage,angle' });
  if (row.error) throw new Error(`${angle}: ${row.error.message}`);
}

/** Uploads all four angles in order, reporting how many are done. */
export async function uploadReturnPhotos(
  rentalId: string,
  photos: Record<Angle, ChosenPhoto>,
  onProgress: (done: number) => void,
): Promise<void> {
  let done = 0;
  for (const angle of ANGLES) {
    await uploadReturnPhoto(rentalId, angle, photos[angle]);
    done += 1;
    onProgress(done);
  }
}

/**
 * Uploads the four pickup photos for a rental that does not exist yet. Only the files: the start-rental
 * function checks they are all there, then saves the rental and the photos rows together.
 */
export async function uploadPickupPhotos(
  rentalId: string,
  photos: Record<Angle, ChosenPhoto>,
  onProgress: (done: number) => void,
): Promise<void> {
  let done = 0;
  for (const angle of ANGLES) {
    await uploadPhotoFile(rentalId, 'pickup', angle, photos[angle]);
    done += 1;
    onProgress(done);
  }
}
