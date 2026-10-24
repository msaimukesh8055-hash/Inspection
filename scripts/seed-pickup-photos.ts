// scripts/seed-pickup-photos.ts
// Uploads the clean pickup photo set for each seeded rental and records the photos rows.
// Uses the anon key (RLS allows photo uploads). Safe to re-run: it overwrites the same paths.
// Run with: npm run seed:photos
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types.ts';
import { ANGLES, PHOTO_BUCKET, photoPath } from '../lib/photos.ts';
import type { SampleVehicleKey } from '../lib/photos.ts';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('seed:photos: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const db = createClient<Database>(url, anonKey, { auth: { persistSession: false } });

// Seeded rental ids (supabase/seed.sql) and the sample vehicle each one uses
const RENTALS: { rentalId: string; vehicle: SampleVehicleKey }[] = [
  { rentalId: '00000000-0000-4000-8000-000000000301', vehicle: 'fleet1' },
  { rentalId: '00000000-0000-4000-8000-000000000302', vehicle: 'fleet2' },
  { rentalId: '00000000-0000-4000-8000-000000000303', vehicle: 'fleet3' },
];

async function main(): Promise<void> {
  let failures = 0;
  for (const { rentalId, vehicle } of RENTALS) {
    for (const angle of ANGLES) {
      const file = fileURLToPath(new URL(`../assets/samples/${vehicle}/pickup/${angle}.jpg`, import.meta.url));
      const path = photoPath(rentalId, 'pickup', angle);
      const upload = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, readFileSync(file), { contentType: 'image/jpeg', upsert: true });
      const row = upload.error
        ? null
        : await db
            .from('photos')
            .upsert({ rental_id: rentalId, stage: 'pickup', angle, storage_path: path }, { onConflict: 'rental_id,stage,angle' });
      const error = upload.error?.message ?? row?.error?.message;
      if (error) failures += 1;
      console.log(`${error ? 'FAIL' : 'ok  '}  ${path}${error ? `  (${error})` : ''}`);
    }
  }
  console.log(failures === 0 ? 'seed:photos: done' : `seed:photos: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
