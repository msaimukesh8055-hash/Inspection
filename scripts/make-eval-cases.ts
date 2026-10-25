// scripts/make-eval-cases.ts
// Builds the 15 eval cases from the real Activa photos: 8 photos each plus the answer sheet
// (expected.json). Run: npm run evals:make. Groups and counts follow docs/SPEC.md (Evals).
// We drew the damage, so we know the right answer; the AI has to find it on its own.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

import { CASES_DIR, ExpectedSchema } from '../evals/expected.ts';
import type { Expected } from '../evals/expected.ts';
import { ANGLES } from '../lib/photos.ts';
import type { Angle, SampleVehicleKey } from '../lib/photos.ts';
import { renderPhoto } from './photo-edits.ts';
import type { SpotName } from './photo-edits.ts';

/** Eval photos are a little smaller than the demo ones to keep the repo light. */
const WIDTH = 1024;
const HEIGHT = 768;

type Shot = { damage?: SpotName[]; blur?: number; brightness?: number; source?: Angle };

type CaseSpec = Omit<Expected, 'id' | 'rental_id'> & {
  slug: string;
  fleet: SampleVehicleKey;
  /** Damage (or bad shots) per angle; pickup only lists damage that was already there. */
  pickup?: Partial<Record<Angle, Shot>>;
  return?: Partial<Record<Angle, Shot>>;
};

const SIDE_PANEL = ['side', 'panel', 'body', 'cowl', 'cover'];

const CASES: CaseSpec[] = [
  // No new damage: ₹0, Path A. Any flagged damage is a false positive.
  { slug: 'clean-2211', fleet: 'fleet1', group: 'no_damage', description: 'Clean return, nothing new', expected_path: 'A', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 } },
  { slug: 'clean-2212', fleet: 'fleet2', group: 'no_damage', description: 'Clean return, nothing new', expected_path: 'A', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 } },
  { slug: 'clean-2213', fleet: 'fleet3', group: 'no_damage', description: 'Clean return, nothing new', expected_path: 'A', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 } },

  // Minor scratch: correct panel, polish-level amount, Path A.
  {
    slug: 'scratch-left-panel', fleet: 'fleet1', group: 'minor_scratch', description: 'Light scratch on the left rear side panel',
    expected_path: 'A', no_new_damage: false, expected_damage: [{ photo_ref: 'left', panel_keywords: SIDE_PANEL }], amount_inr: { min: 400, max: 600 },
    return: { left: { damage: ['leftPanelScratch'] } },
  },
  {
    slug: 'scratch-right-panel', fleet: 'fleet2', group: 'minor_scratch', description: 'Light scratch on the right rear side panel',
    expected_path: 'A', no_new_damage: false, expected_damage: [{ photo_ref: 'right', panel_keywords: SIDE_PANEL }], amount_inr: { min: 400, max: 600 },
    return: { right: { damage: ['rightPanelScratch'] } },
  },
  {
    slug: 'scratch-mudguard', fleet: 'fleet3', group: 'minor_scratch', description: 'Light scratch on the front mudguard',
    expected_path: 'A', no_new_damage: false, expected_damage: [{ photo_ref: 'front', panel_keywords: ['mudguard', 'fender', 'front'] }], amount_inr: { min: 400, max: 600 },
    return: { front: { damage: ['mudguardScratch'] } },
  },
  {
    slug: 'scratch-right-2213', fleet: 'fleet3', group: 'minor_scratch', description: 'Light scratch on the right rear side panel, another scooter',
    expected_path: 'A', no_new_damage: false, expected_damage: [{ photo_ref: 'right', panel_keywords: SIDE_PANEL }], amount_inr: { min: 400, max: 600 },
    return: { right: { damage: ['rightPanelScratch'] } },
  },

  // Dent or broken part: flagged, Path B by amount or the structural rule.
  {
    slug: 'dent-left-panel', fleet: 'fleet1', group: 'dent_or_broken', description: 'Dent on the left rear side panel',
    expected_path: 'B', no_new_damage: false, expected_damage: [{ photo_ref: 'left', panel_keywords: SIDE_PANEL }], amount_inr: { min: 1600, max: 2400 },
    return: { left: { damage: ['leftPanelDent'] } },
  },
  {
    slug: 'dent-right-panel', fleet: 'fleet2', group: 'dent_or_broken', description: 'Dent on the right rear side panel',
    expected_path: 'B', no_new_damage: false, expected_damage: [{ photo_ref: 'right', panel_keywords: SIDE_PANEL }], amount_inr: { min: 1600, max: 2400 },
    return: { right: { damage: ['rightPanelDent'] } },
  },
  {
    slug: 'cracked-tail-lamp', fleet: 'fleet3', group: 'dent_or_broken', description: 'Cracked tail lamp lens',
    expected_path: 'B', no_new_damage: false, expected_damage: [{ photo_ref: 'rear', panel_keywords: ['tail', 'lamp', 'light', 'lens'] }], amount_inr: null,
    return: { rear: { damage: ['tailLampCrack'] } },
  },
  {
    slug: 'dent-and-scratch', fleet: 'fleet3', group: 'dent_or_broken', description: 'Dent on the right panel and a scratch on the left',
    expected_path: 'B', no_new_damage: false,
    expected_damage: [{ photo_ref: 'right', panel_keywords: SIDE_PANEL }, { photo_ref: 'left', panel_keywords: SIDE_PANEL }],
    amount_inr: { min: 2000, max: 3000 },
    return: { right: { damage: ['rightPanelDent'] }, left: { damage: ['leftPanelScratch'] } },
  },

  // Blurry or missing angle: Path B by low confidence or poor photos. Never a confident bill.
  {
    slug: 'blurry-sides', fleet: 'fleet1', group: 'poor_photos', description: 'Both side photos badly blurred',
    expected_path: 'B', no_new_damage: false, expected_damage: [], amount_inr: null,
    return: { left: { blur: 22 }, right: { blur: 22 } },
  },
  {
    slug: 'dark-and-wrong-angle', fleet: 'fleet2', group: 'poor_photos', description: 'Front photo far too dark; the rear slot holds a second front photo',
    expected_path: 'B', no_new_damage: false, expected_damage: [], amount_inr: null,
    return: { front: { brightness: 0.22 }, rear: { source: 'front' } },
  },

  // Damage already there at pickup: ignored, only new damage counts.
  {
    slug: 'old-scratch', fleet: 'fleet2', group: 'pre_existing', description: 'Scratch on the left panel was already there at pickup',
    expected_path: 'A', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 },
    pickup: { left: { damage: ['leftPanelScratch'] } }, return: { left: { damage: ['leftPanelScratch'] } },
  },
  {
    slug: 'old-dent', fleet: 'fleet3', group: 'pre_existing', description: 'Dent on the right panel was already there at pickup',
    expected_path: 'A', no_new_damage: true, expected_damage: [], amount_inr: { min: 0, max: 0 },
    pickup: { right: { damage: ['rightPanelDent'] } }, return: { right: { damage: ['rightPanelDent'] } },
  },
];

/** Hidden eval rental per case (scripts/eval-rentals.sql): ...-000000000401 to ...-000000000415. */
function rentalId(index: number): string {
  return `00000000-0000-4000-8000-000000000${String(401 + index)}`;
}

async function main(): Promise<void> {
  if (CASES.length !== 15) throw new Error(`Expected 15 cases, got ${CASES.length}`);
  rmSync(CASES_DIR, { recursive: true, force: true });

  for (const [index, spec] of CASES.entries()) {
    const id = `E${String(index + 1).padStart(2, '0')}-${spec.slug}`;
    const { fleet, pickup = {}, return: returned = {} } = spec;
    const expected = ExpectedSchema.parse({
      id,
      group: spec.group,
      description: spec.description,
      rental_id: rentalId(index),
      expected_path: spec.expected_path,
      no_new_damage: spec.no_new_damage,
      expected_damage: spec.expected_damage,
      amount_inr: spec.amount_inr,
    });

    for (const [stage, shots] of [['pickup', pickup], ['return', returned]] as const) {
      const dir = `${CASES_DIR}${id}/${stage}/`;
      mkdirSync(dir, { recursive: true });
      for (const angle of ANGLES) {
        const shot = shots[angle] ?? {};
        const image = await renderPhoto(
          {
            source: shot.source ?? angle,
            fleet,
            damage: shot.damage ?? [],
            isReturn: stage === 'return',
            blur: shot.blur,
            brightness: shot.brightness,
          },
          WIDTH,
          HEIGHT,
        );
        await image.jpeg({ quality: 80, mozjpeg: true }).toFile(`${dir}${angle}.jpg`);
      }
    }
    writeFileSync(`${CASES_DIR}${id}/expected.json`, `${JSON.stringify(expected, null, 2)}\n`);
    console.log(`  ${id}  →  Path ${expected.expected_path}`);
  }
  console.log(`evals:make: wrote ${CASES.length} cases to evals/cases`);
}

await main();
