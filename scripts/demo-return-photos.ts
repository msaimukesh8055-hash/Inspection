// scripts/demo-return-photos.ts
// Second half of npm run demo:reset: uploads the four return photos of Vikram's sent-back return
// (GA07M2212, its light-scratch set) and records the photos rows, so the upload page opens with them.
// Uses the anon key (RLS allows photo uploads). Safe to re-run: it overwrites the same paths.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types.ts';
import { ANGLES, DEMO_RETURN_SET, PHOTO_BUCKET, photoPath } from '../lib/photos.ts';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('demo:reset: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const db = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
const RENTAL_ID = '00000000-0000-4000-8000-000000000302';
const VEHICLE = 'fleet2';

async function main(): Promise<void> {
  for (const angle of ANGLES) {
    const file = fileURLToPath(new URL(`../assets/samples/${VEHICLE}/${DEMO_RETURN_SET[VEHICLE]}/${angle}.jpg`, import.meta.url));
    const path = photoPath(RENTAL_ID, 'return', angle);
    const upload = await db.storage.from(PHOTO_BUCKET).upload(path, readFileSync(file), { contentType: 'image/jpeg', upsert: true });
    if (upload.error) throw new Error(`${path}: ${upload.error.message}`);
    const row = await db
      .from('photos')
      .upsert({ rental_id: RENTAL_ID, stage: 'return', angle, storage_path: path }, { onConflict: 'rental_id,stage,angle' });
    if (row.error) throw new Error(`${path}: ${row.error.message}`);
  }
  console.log('demo:reset: GA07M2212 return photos uploaded (sent back by the inspector)');
}

await main();
