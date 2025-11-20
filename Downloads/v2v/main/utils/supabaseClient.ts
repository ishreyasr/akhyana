// Requires installation: pnpm add @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

// Runtime guard: these env vars must be provided in Next.js runtime (public anon key is acceptable for RLS-protected reads)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  })
  : null;

export async function upsertUserSetting(userId: string, key: string, value: any) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchUserSettings(userId: string): Promise<Record<string, any>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('user_settings').select('key,value').eq('user_id', userId);
  if (error) throw error;
  const out: Record<string, any> = {};
  (data || []).forEach((r: any) => { out[r.key] = r.value; });
  return out;
}