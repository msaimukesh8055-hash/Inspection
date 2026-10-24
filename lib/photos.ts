// lib/photos.ts
// Pure photo helpers shared by the app and the Node scripts. No React Native imports here.

export const ANGLES = ['front', 'rear', 'left', 'right'] as const;
export type Angle = (typeof ANGLES)[number];

export const STAGES = ['pickup', 'return'] as const;
export type Stage = (typeof STAGES)[number];

export const PHOTO_BUCKET = 'vehicle-photos';

/** Storage path from the spec: {rental_id}/{pickup|return}/{angle}.jpg */
export function photoPath(rentalId: string, stage: Stage, angle: Angle): string {
  return `${rentalId}/${stage}/${angle}.jpg`;
}

/** True once every angle has a photo chosen. */
export function allAnglesFilled<T>(photos: Partial<Record<Angle, T>>): boolean {
  return ANGLES.every((angle) => photos[angle] !== undefined);
}

/** The full set when every angle is filled, otherwise null. */
export function completeSet<T>(photos: Partial<Record<Angle, T>>): Record<Angle, T> | null {
  const { front, rear, left, right } = photos;
  if (front === undefined || rear === undefined || left === undefined || right === undefined) return null;
  return { front, rear, left, right };
}

export function angleLabel(angle: Angle): string {
  return angle.charAt(0).toUpperCase() + angle.slice(1);
}

// Sample gallery: real rental-scooter photos (edited for damage) in assets/samples/{vehicle}/{set}/{angle}.jpg

/** Demo fleet: three Honda Activas, told apart by registration number (supabase/seed.sql). */
export const SAMPLE_VEHICLES = {
  GA07M2211: 'fleet1',
  GA06T5141: 'fleet2',
  GA06T5142: 'fleet3',
} as const;
export type SampleVehicleKey = (typeof SAMPLE_VEHICLES)[keyof typeof SAMPLE_VEHICLES];

export const SAMPLE_SCENARIOS = [
  { key: 'no-damage', label: 'No damage' },
  { key: 'light-scratch', label: 'Light scratch' },
  { key: 'dented-panel', label: 'Dented panel' },
] as const;
export type SampleScenarioKey = (typeof SAMPLE_SCENARIOS)[number]['key'];

/** Pickup is the clean "before" set; the scenarios are return sets. */
export type SampleSet = 'pickup' | SampleScenarioKey;

/**
 * The one demo photo set each scooter uses for "Use sample photos". The UI never names it:
 * spotting the damage is the AI's job.
 */
export const DEMO_RETURN_SET: Record<SampleVehicleKey, SampleScenarioKey> = {
  fleet1: 'no-damage',
  fleet2: 'light-scratch',
  fleet3: 'dented-panel',
};

/** Sample set for a registration number (spaces ignored), or null for vehicles without samples. */
export function sampleKeyForRegNo(regNo: string): SampleVehicleKey | null {
  const key = regNo.replace(/\s+/g, '').toUpperCase();
  return key in SAMPLE_VEHICLES ? SAMPLE_VEHICLES[key as keyof typeof SAMPLE_VEHICLES] : null;
}
