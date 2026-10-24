import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config, isConfigured } from '@/lib/config';

let client: SupabaseClient | null = null;

/** Returns null when Supabase is not configured; callers must handle local-only mode. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!isConfigured.supabase) return null;
  client = createClient(config.supabase.url!, config.supabase.anonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** Anonymous sign-in: no email, no password, no public profile. */
export async function ensureSession(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error) {
    if (__DEV__) console.warn('[supabase] anonymous sign-in failed', error.message);
    return null;
  }
  return anon.user?.id ?? null;
}

export async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}
