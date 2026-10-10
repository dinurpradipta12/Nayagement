import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

type SyncRequest = { workspaceId?: unknown; bookingId?: unknown }

type ConsultationBookingRow = {
  id: string
  workspace_id: string
  starts_at: string
  ends_at: string
  name: string
  email: string | null
  whatsapp: string | null
  topic: string
  details: string | null
  status: string
  updated_at: string
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })

const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), item => item.toString(16).padStart(2, '0')).join('')

const hmacHex = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}

const accessTokenFrom = (request: Request) => {
  const value = request.headers.get('authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const arunikaSyncUrl = Deno.env.get('ARUNIKA_BOOKING_SYNC_URL') || ''
  const syncSecret = Deno.env.get('ARUNIKA_SYNC_SECRET') || ''
  if (!supabaseUrl || !serviceRoleKey || !arunikaSyncUrl || !syncSecret) {
    console.error('Arunika booking sync is missing required server secrets.')
    return json({ error: 'server_configuration_error' }, 500)
  }

  let body: SyncRequest
  try {
    body = await request.json() as SyncRequest
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : ''
  if (!isUuid(workspaceId) || !isUuid(bookingId)) return json({ error: 'invalid_request' }, 400)

  const accessToken = accessTokenFrom(request)
  if (!accessToken) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
  const userId = authData.user?.id
  if (authError || !userId) return json({ error: 'unauthorized' }, 401)

  // Syncing contact data to another application is an administrative action.
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (membershipError) {
    console.error(`Failed to verify Nayagement workspace membership: ${membershipError.code || 'unknown'}`)
    return json({ error: 'membership_check_failed' }, 500)
  }
  if (!membership || !['owner', 'admin'].includes(String(membership.role))) return json({ error: 'forbidden' }, 403)

  const { data: booking, error: bookingError } = await supabase
    .from('consultation_bookings')
    .select('id, workspace_id, starts_at, ends_at, name, email, whatsapp, topic, details, status, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('id', bookingId)
    .maybeSingle()
  if (bookingError) {
    console.error(`Failed to read Nayagement booking: ${bookingError.code || 'unknown'}`)
    return json({ error: 'booking_lookup_failed' }, 500)
  }
  if (!booking) return json({ error: 'booking_not_found' }, 404)

  const sourceBooking = booking as ConsultationBookingRow
  const payload = JSON.stringify({
    source: 'nayagement',
    workspaceId: sourceBooking.workspace_id,
    bookingId: sourceBooking.id,
    name: sourceBooking.name,
    email: sourceBooking.email || '',
    whatsapp: sourceBooking.whatsapp || '',
    topic: sourceBooking.topic,
    details: sourceBooking.details || '',
    status: sourceBooking.status,
    startsAt: sourceBooking.starts_at,
    endsAt: sourceBooking.ends_at,
    updatedAt: sourceBooking.updated_at,
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = await hmacHex(syncSecret, `${timestamp}.${payload}`)

  let upstream: { ok?: boolean; error?: string; sync?: unknown } | null = null
  let response: Response
  try {
    response = await fetch(arunikaSyncUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-nayagement-timestamp': timestamp,
        'x-nayagement-signature': signature,
      },
      body: payload,
    })
    upstream = await response.json().catch(() => null) as typeof upstream
  } catch (error) {
    console.error(`Arunika booking sync request failed: ${error instanceof Error ? error.name : 'unknown'}`)
    return json({ error: 'arunika_unreachable' }, 502)
  }

  if (!response.ok || !upstream?.ok) {
    const errorCode = response.status === 409 && upstream?.error === 'sync_connection_not_configured'
      ? 'arunika_connection_not_configured'
      : 'arunika_sync_failed'
    console.error(`Arunika booking sync returned ${response.status}: ${errorCode}`)
    return json({ error: errorCode }, response.status === 409 ? 409 : 502)
  }

  return json({ ok: true, sync: upstream.sync || null })
})
