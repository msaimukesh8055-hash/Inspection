// lib/functions.ts
// Calls an Edge Function and surfaces its { error } message on failure.
import { supabase } from './supabase';

export async function invokeFunction(name: string, body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke(name, { body });
  if (!error) return;
  const context: unknown = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const reply = (await context.json().catch(() => null)) as { error?: string } | null;
    if (reply?.error) throw new Error(reply.error);
  }
  throw new Error(error.message);
}
