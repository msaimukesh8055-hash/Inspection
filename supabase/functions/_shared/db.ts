// supabase/functions/_shared/db.ts
// Service-role client, query result checks, status changes and the request wrapper shared by every function.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import type { Database } from './database.types.ts';
import { json, preflight } from './http.ts';

export type Db = SupabaseClient<Database>;
export type AssessmentStatus = Database['public']['Tables']['assessments']['Row']['status'];

/** A problem with the request itself (400), as opposed to a server or model failure. */
export class RequestError extends Error {}

export function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** Like check, for queries that always return data (select, insert…select). */
export function need<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(result);
  if (data === null || data === undefined) throw new Error('Query returned no data');
  return data;
}

/** Moves an assessment to a status and records it on the rider timeline. */
export async function setStatus(db: Db, assessmentId: string, status: AssessmentStatus): Promise<void> {
  check(await db.from('assessments').update({ status, updated_at: new Date().toISOString() }).eq('id', assessmentId));
  check(await db.from('status_events').insert({ assessment_id: assessmentId, status }));
}

/** POST handler with CORS, Zod-validated body, a service-role client and uniform errors. */
export function serve<T>(name: string, schema: z.ZodType<T>, usage: string, handler: (db: Db, body: T) => Promise<unknown>): void {
  Deno.serve(async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return json(405, { error: 'Use POST' });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json(400, { error: `Body must be ${usage}` });

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return json(500, { error: 'Function is missing Supabase env vars' });
    const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

    try {
      return json(200, await handler(db, parsed.data));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`${name} failed: ${message}`);
      return json(e instanceof RequestError ? 400 : 502, { error: message });
    }
  });
}
