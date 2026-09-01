import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const invalidCredentials = () => new Response(
  JSON.stringify({ error: 'Username atau password tidak valid.' }),
  { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const { username: rawUsername, password } = await request.json()
    const username = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : ''

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || typeof password !== 'string' || password.length < 8) {
      return invalidCredentials()
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Supabase function secrets are incomplete')
      return new Response(JSON.stringify({ error: 'Layanan login belum dikonfigurasi.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: identity, error: identityError } = await admin
      .from('admin_login_identities')
      .select('login_email')
      .eq('username', username)
      .maybeSingle()

    if (identityError || !identity) return invalidCredentials()

    // The admin's internal email is never returned. The browser only supplies
    // its intended username and password to this function.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await authClient.auth.signInWithPassword({
      email: identity.login_email,
      password,
    })

    if (error || !data.session) return invalidCredentials()

    return new Response(JSON.stringify({ session: data.session, user: data.user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('username-login failed', error)
    return new Response(JSON.stringify({ error: 'Tidak dapat memproses login saat ini.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
