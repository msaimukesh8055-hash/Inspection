// lib/supabase.ts
// App-side Supabase client. Uses the public anon key only; RLS limits what it can do.
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).');
}

// No login in the demo, so there is no session to keep.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
