// scripts/verify-db.ts
// Checks the hosted database as the app sees it (anon key): seed counts, RLS and the photo bucket.
// Run with: npm run db:verify (reads .env). Read-only: every write it tries must be refused.
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types.ts';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('db:verify: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const db = createClient<Database>(url, anonKey, { auth: { persistSession: false } });

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

async function checkSeedCounts(): Promise<void> {
  const vehicles = await db.from('vehicles').select('*', { count: 'exact', head: true });
  record('3 vehicles', vehicles.count === 3, `count=${vehicles.count} ${vehicles.error?.message ?? ''}`);

  const riders = await db.from('riders').select('*', { count: 'exact', head: true });
  record('3 riders', riders.count === 3, `count=${riders.count} ${riders.error?.message ?? ''}`);

  const rentals = await db.from('rentals').select('deposit_inr').eq('status', 'active');
  const deposits = (rentals.data ?? []).map((r) => r.deposit_inr);
  record(
    '3 active rentals, ₹2,000 deposit each',
    deposits.length === 3 && deposits.every((d) => d === 2000),
    `deposits=${deposits.join(',')} ${rentals.error?.message ?? ''}`,
  );

  const parts = await db.from('parts_catalog').select('*', { count: 'exact', head: true }).eq('vehicle_model', 'Honda Activa');
  const partCount = parts.count ?? 0;
  record('Honda Activa parts catalog (9 parts)', partCount === 9, `count=${partCount}`);

  const config = await db.from('config').select('key, value');
  const values = Object.fromEntries((config.data ?? []).map((c) => [c.key, c.value]));
  record(
    'config threshold 1500, min confidence 0.75',
    values.threshold_inr === 1500 && values.min_confidence === 0.75,
    JSON.stringify(values),
  );
}

async function checkRls(): Promise<void> {
  const insert = await db
    .from('parts_catalog')
    .insert({ part_code: 'VERIFY-SHOULD-FAIL', vehicle_model: 'x', description: 'x', parts_inr: 1, labour_inr: 1 });
  record('anon cannot add catalog prices', insert.error !== null, insert.error?.message ?? 'insert succeeded');

  const update = await db.from('parts_catalog').update({ parts_inr: 1 }).eq('part_code', 'JUP-MIRROR').select();
  record(
    'anon cannot change catalog prices',
    update.error !== null || (update.data ?? []).length === 0,
    update.error?.message ?? `rows changed=${update.data?.length ?? 0}`,
  );

  const notify = await db.from('notifications').update({ message: 'x' }).eq('recipient_role', 'counter');
  record('anon can only change read_at on notifications', notify.error !== null, notify.error?.message ?? 'update allowed');

  const order = await db
    .from('diagnostic_orders')
    .insert({ assessment_id: '00000000-0000-4000-8000-000000000000', summary: 'x', provisional_total_inr: 0, held_inr: 0 });
  record('anon cannot raise orders directly', order.error !== null, order.error?.message ?? 'insert succeeded');
}

async function checkBucket(): Promise<void> {
  const signed = await db.storage.from('vehicle-photos').createSignedUrl('verify/missing.jpg', 60);
  const message = signed.error?.message ?? '';
  record('vehicle-photos bucket exists', !/bucket not found/i.test(message), message || 'signed url created');
}

await checkSeedCounts();
await checkRls();
await checkBucket();

for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.detail.trim()})`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(failed === 0 ? `db:verify: all ${checks.length} checks passed` : `db:verify: ${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
