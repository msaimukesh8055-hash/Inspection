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

// Sample gallery: drawn demo images in assets/samples/{vehicle}/{set}/{angle}.jpg

export const SAMPLE_VEHICLES = {
  'TVS Jupiter': 'jupiter',
  'TVS Radeon': 'radeon',
  'TVS Ntorq': 'ntorq',
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
  jupiter: 'no-damage',
  radeon: 'light-scratch',
  ntorq: 'dented-panel',
};

export function sampleKeyForModel(model: string): SampleVehicleKey | null {
  return model in SAMPLE_VEHICLES ? SAMPLE_VEHICLES[model as keyof typeof SAMPLE_VEHICLES] : null;
}
