import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && publicKey)

/**
 * The browser client intentionally uses only a publishable/anon key. The
 * service-role key is reserved for local seeding or trusted server code.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, publicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'nayagement.auth',
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Layanan data belum dikonfigurasi.')
  return supabase
}
