// scripts/make-photo-samples.ts
// Builds the demo photo sets (assets/samples/{fleet}/{set}/{angle}.jpg) from the real Activa photos.
// Run: npm run samples:make. The editing itself lives in scripts/photo-edits.ts.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ANGLES } from '../lib/photos.ts';
import type { Angle, SampleSet, SampleVehicleKey } from '../lib/photos.ts';
import { renderPhoto } from './photo-edits.ts';
import type { SpotName } from './photo-edits.ts';

const OUT = fileURLToPath(new URL('../assets/samples/', import.meta.url));

const FLEET: SampleVehicleKey[] = ['fleet1', 'fleet2', 'fleet3'];

/** Damage per set and angle: the scratch and the dent both sit on the left rear side panel. */
const SETS: { set: SampleSet; isReturn: boolean; damage: Partial<Record<Angle, SpotName[]>> }[] = [
  { set: 'pickup', isReturn: false, damage: {} },
  { set: 'no-damage', isReturn: true, damage: {} },
  { set: 'light-scratch', isReturn: true, damage: { left: ['leftPanelScratch'] } },
  { set: 'dented-panel', isReturn: true, damage: { left: ['leftPanelDent'] } },
];

async function main(): Promise<void> {
  let count = 0;
  for (const fleet of FLEET) {
    for (const { set, isReturn, damage } of SETS) {
      const dir = `${OUT}${fleet}/${set}/`;
      mkdirSync(dir, { recursive: true });
      for (const angle of ANGLES) {
        const image = await renderPhoto({ source: angle, fleet, damage: damage[angle] ?? [], isReturn });
        await image.jpeg({ quality: 84, mozjpeg: true }).toFile(`${dir}${angle}.jpg`);
        count += 1;
      }
    }
  }
  console.log(`samples:make: wrote ${count} photos to assets/samples`);
}

await main();
