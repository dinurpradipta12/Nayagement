import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase'

export type UsernameLoginSession = Session
export { isSupabaseConfigured }

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/

/**
 * The seed script provisions the private Auth address from this username. The
 * app never exposes the service-role key, and Supabase Auth still verifies the
 * password before returning a session.
 */
export async function loginWithUsername(username: string, password: string): Promise<UsernameLoginSession> {
  const normalized = username.trim().toLowerCase()
  if (!usernamePattern.test(normalized)) throw new Error('Username tidak valid.')

  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: `${normalized}@auth.nayagement.local`,
    password,
  })
  if (error || !data.session) throw new Error(error?.message ?? 'Username atau password tidak sesuai.')
  return data.session
}
