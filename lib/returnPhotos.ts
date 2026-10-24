// lib/returnPhotos.ts
// Preparing and uploading the four return photos in the browser.
import { ANGLES, PHOTO_BUCKET, photoPath } from './photos';
import type { Angle, SampleScenarioKey, SampleVehicleKey } from './photos';
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

export function samplePhotos(vehicle: SampleVehicleKey, scenario: SampleScenarioKey): Record<Angle, ChosenPhoto> {
  const photo = (angle: Angle): ChosenPhoto => ({ url: sampleImageUrl(vehicle, scenario, angle), source: 'sample' });
  return { front: photo('front'), rear: photo('rear'), left: photo('left'), right: photo('right') };
}

/** Uploads one return photo (overwriting any earlier one) and records its photos row. */
async function uploadReturnPhoto(rentalId: string, angle: Angle, photo: ChosenPhoto): Promise<void> {
  const blob = await (await fetch(photo.url)).blob();
  const path = photoPath(rentalId, 'return', angle);

  const upload = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upload.error) throw new Error(`${angle}: ${upload.error.message}`);

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
