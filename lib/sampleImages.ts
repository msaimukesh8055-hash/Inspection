// lib/sampleImages.ts
// URLs of the drawn demo images in assets/samples/{vehicle}/{set}/{angle}.jpg (made by npm run samples:make).
import type { Angle, SampleSet, SampleVehicleKey } from './photos';

const files = import.meta.glob<string>('../assets/samples/*/*/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function sampleImageUrl(vehicle: SampleVehicleKey, set: SampleSet, angle: Angle): string {
  const url = files[`../assets/samples/${vehicle}/${set}/${angle}.jpg`];
  if (!url) throw new Error(`Missing sample image ${vehicle}/${set}/${angle}`);
  return url;
}
