import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const dispatchKey = Deno.env.get('TELEGRAM_DISPATCH_KEY') ?? ''
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

type JsonRecord = Record<string, unknown>
type Integration = {
  workspace_id: string
  chat_id: number | string | null
  chat_username?: string | null
  bot_username?: string | null
  app_base_url?: string | null
  is_enabled: boolean
  notify_orders: boolean
  notify_bookings: boolean
  notify_tasks: boolean
  notify_projects: boolean
  notify_invoices: boolean
  reminder_enabled: boolean
  reminder_morning: string
  reminder_noon: string
  reminder_evening: string
  timezone: string
}

const json = (body: JsonRecord, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const first = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value
const text = (value: unknown) => typeof value === 'string' ? value : ''
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const escapeHtml = (value: unknown) => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rupiah = (value: unknown) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number(value))
const appUrl = (integration: Integration, hashPath: string) => `${text(integration.app_base_url).replace(/\/$/, '')}#${hashPath}`
const waNumber = (value: unknown) => text(value).replace(/\D/g, '').replace(/^0/, '62')

async function telegram(method: string, body: JsonRecord) {
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN belum tersedia')
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as { ok?: boolean; result?: unknown; description?: string }
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} gagal`)
  return result.result
}

async function sendMessage(chatId: number | string, message: string, inlineKeyboard?: JsonRecord[][]) {
  return await telegram('sendMessage', {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(inlineKeyboard?.length ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
  })
}

async function answerCallback(id: string, message: string) {
  if (!id) return
  try {
    await telegram('answerCallbackQuery', { callback_query_id: id, text: message, show_alert: false })
  } catch (error) {
    // A callback acknowledgement can expire while Telegram is retrying an
    // update. The requested action must still continue in that situation.
    console.warn('Telegram callback acknowledgement failed', error)
  }
}

function mainMenu(integration: Integration): JsonRecord[][] {
  return [
    [{ text: '📥 Order', callback_data: 'menu:orders' }, { text: '📅 Booking', callback_data: 'menu:bookings' }],
    [{ text: '📁 Project', callback_data: 'menu:projects' }, { text: '✅ Task', callback_data: 'menu:tasks' }],
    [{ text: '💰 Pendapatan', callback_data: 'menu:revenue' }, { text: '🧾 Invoice', callback_data: 'menu:invoices' }],
    [{ text: '📋 Salin form order', callback_data: 'menu:forms' }, { text: '🔗 Salin link booking', copy_text: { text: appUrl(integration, '/booking') } }],
  ]
}

async function integrationForChat(chatId: number | string) {
  const { data } = await supabase.from('telegram_integrations').select('*').eq('chat_id', chatId).maybeSingle()
  return data as Integration | null
}

async function ensureBotIdentity() {
  const bot = await telegram('getMe', {}) as JsonRecord
  const username = text(bot.username)
  if (username) await supabase.from('telegram_integrations').update({ bot_username: username }).is('bot_username', null)

  if (webhookSecret && supabaseUrl) {
    const expected = `${supabaseUrl}/functions/v1/telegram-bot`
    await telegram('setWebhook', {
      url: expected,
      secret_token: webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    })
  }
  await telegram('setMyCommands', { commands: [
    { command: 'menu', description: 'Buka menu Nayagement' },
    { command: 'orders', description: 'Lihat order masuk' },
    { command: 'bookings', description: 'Lihat booking konsultasi' },
    { command: 'projects', description: 'Status dan link project' },
    { command: 'tasks', description: 'Status task aktif' },
    { command: 'revenue', description: 'Ringkasan pendapatan' },
    { command: 'invoices', description: 'Invoice yang perlu ditindaklanjuti' },
    { command: 'forms', description: 'Salin form order' },
  ] })
  return username
}

async function connectChat(message: JsonRecord, pairingCode: string) {
  const chat = message.chat as JsonRecord | undefined
  const from = message.from as JsonRecord | undefined
  const chatId = number(chat?.id)
  if (!chatId || !pairingCode) {
    if (chatId) await sendMessage(chatId, 'Gunakan kode koneksi dari <b>Settings → Notifications → Telegram bot</b>.')
    return
  }
  const botUsername = await ensureBotIdentity()
  const { data, error } = await supabase.from('telegram_integrations').update({
    chat_id: chatId,
    chat_username: text(from?.username) || null,
    bot_username: botUsername || null,
    connected_at: new Date().toISOString(),
    is_enabled: true,
  }).eq('pairing_code', pairingCode.toLowerCase()).select('*').maybeSingle()
  if (error || !data) {
    await sendMessage(chatId, 'Kode koneksi tidak ditemukan atau sudah diganti. Buat kode baru dari halaman Settings.')
    return
  }
  const integration = data as Integration
  await sendMessage(chatId, '✅ <b>Telegram berhasil terhubung ke Nayagement.</b>\n\nSaya akan mengirim pembaruan penting dan ringkasan pekerjaan sesuai jadwal Anda.', mainMenu(integration))
}

async function sendProjects(integration: Integration) {
  const { data } = await supabase.from('projects')
    .select('id, name, status, progress_percentage, deadline, public_access:project_public_access(public_slug, public_token, is_enabled)')
    .eq('workspace_id', integration.workspace_id)
    .not('status', 'in', '(completed,cancelled)')
    .order('deadline', { ascending: true, nullsFirst: false }).limit(8)
  const projects = (data ?? []) as JsonRecord[]
  if (!projects.length) return await sendMessage(integration.chat_id!, '📁 Belum ada project aktif.', mainMenu(integration))
  const keyboard: JsonRecord[][] = projects.map((project) => {
    const access = first(project.public_access as JsonRecord | JsonRecord[] | null)
    const publicPath = access?.is_enabled && access.public_slug ? `/client/${encodeURIComponent(text(access.public_slug))}` : `/projects/${project.id}`
    return [{ text: `Salin · ${text(project.name).slice(0, 30)}`, copy_text: { text: appUrl(integration, publicPath) } }]
  })
  const lines = projects.map((project, index) => `${index + 1}. <b>${escapeHtml(project.name)}</b> — ${escapeHtml(text(project.status).replaceAll('_', ' '))} · ${number(project.progress_percentage)}%`)
  await sendMessage(integration.chat_id!, `📁 <b>Status project</b>\n\n${lines.join('\n')}`, keyboard)
}

async function sendTasks(integration: Integration) {
  const { data } = await supabase.from('project_tasks').select('name, status, progress_percentage, due_at, project:projects(name)').eq('workspace_id', integration.workspace_id).neq('status', 'completed').order('due_at', { ascending: true, nullsFirst: false }).limit(12)
  const tasks = (data ?? []) as JsonRecord[]
  const lines = tasks.map((task, index) => {
    const project = first(task.project as JsonRecord | JsonRecord[] | null)
    const due = task.due_at ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: integration.timezone }).format(new Date(text(task.due_at))) : 'tanpa deadline'
    return `${index + 1}. <b>${escapeHtml(task.name)}</b>\n   ${escapeHtml(project?.name)} · ${number(task.progress_percentage)}% · ${escapeHtml(due)}`
  })
  await sendMessage(integration.chat_id!, tasks.length ? `✅ <b>Task aktif</b>\n\n${lines.join('\n')}` : '✅ Tidak ada task aktif.', [[{ text: 'Buka halaman task', url: appUrl(integration, '/tasks') }]])
}

async function sendRevenue(integration: Integration) {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data: payments } = await supabase.from('project_payment_records').select('amount').eq('workspace_id', integration.workspace_id).gte('paid_at', monthStart)
  const { data: invoices } = await supabase.from('invoices').select('total_amount, status').eq('workspace_id', integration.workspace_id)
  const revenue = (payments ?? []).reduce((sum, row) => sum + number(row.amount), 0)
  const outstanding = (invoices ?? []).filter((row) => !['paid', 'void'].includes(text(row.status))).reduce((sum, row) => sum + number(row.total_amount), 0)
  await sendMessage(integration.chat_id!, `💰 <b>Ringkasan keuangan bulan ini</b>\n\nPendapatan tercatat: <b>${rupiah(revenue)}</b>\nInvoice outstanding: <b>${rupiah(outstanding)}</b>`, [[{ text: 'Buka Finance', url: appUrl(integration, '/finance') }]])
}

async function sendOrders(integration: Integration) {
  const { data } = await supabase.from('order_submissions').select('id, submitter_name, submitter_whatsapp, status, created_at, form:order_forms(title)').eq('workspace_id', integration.workspace_id).in('status', ['new', 'reviewing']).order('created_at', { ascending: false }).limit(8)
  const orders = (data ?? []) as JsonRecord[]
  if (!orders.length) return await sendMessage(integration.chat_id!, '📥 Tidak ada order baru.', mainMenu(integration))
  for (const order of orders) {
    const form = first(order.form as JsonRecord | JsonRecord[] | null)
    await sendMessage(integration.chat_id!, `📥 <b>${escapeHtml(order.submitter_name)}</b>\n${escapeHtml(form?.title || 'Form order')} · ${escapeHtml(order.status)}`, [[{ text: '✅ Konfirmasi order', callback_data: `oc:${order.id}` }, { text: 'Buka detail', url: appUrl(integration, '/orders') }]])
  }
}

async function sendBookings(integration: Integration) {
  const { data } = await supabase.from('consultation_bookings').select('id, name, topic, starts_at, status').eq('workspace_id', integration.workspace_id).in('status', ['new', 'confirmed']).order('starts_at').limit(8)
  const bookings = (data ?? []) as JsonRecord[]
  if (!bookings.length) return await sendMessage(integration.chat_id!, '📅 Tidak ada booking aktif.', mainMenu(integration))
  for (const booking of bookings) {
    const starts = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: integration.timezone }).format(new Date(text(booking.starts_at)))
    await sendMessage(integration.chat_id!, `📅 <b>${escapeHtml(booking.name)}</b>\n${escapeHtml(booking.topic)}\n${escapeHtml(starts)}`, [[{ text: '✅ Konfirmasi booking', callback_data: `bc:${booking.id}` }, { text: 'Buka detail', url: appUrl(integration, '/bookings') }], [{ text: 'Salin link booking', copy_text: { text: appUrl(integration, '/booking') } }]])
  }
}

async function sendForms(integration: Integration) {
  const { data } = await supabase.from('order_forms').select('title, public_token').eq('workspace_id', integration.workspace_id).eq('is_active', true).order('created_at', { ascending: false }).limit(10)
  const forms = (data ?? []) as JsonRecord[]
  if (!forms.length) return await sendMessage(integration.chat_id!, '📋 Belum ada form order aktif.')
  const keyboard = forms.map((form) => [{ text: `Salin · ${text(form.title).slice(0, 32)}`, copy_text: { text: appUrl(integration, `/order/${encodeURIComponent(text(form.public_token))}`) } }])
  await sendMessage(integration.chat_id!, '📋 <b>Pilih form order yang ingin disalin</b>', keyboard)
}

async function publicInvoiceCode(invoiceId: string) {
  if (!invoiceId) return ''
  const { data } = await supabase.from('invoice_public_access')
    .select('public_code, is_enabled')
    .eq('invoice_id', invoiceId)
    .maybeSingle()
  return data?.is_enabled ? text(data.public_code) : ''
}

async function sendInvoices(integration: Integration) {
  const { data } = await supabase.from('invoices').select('id, invoice_number, total_amount, status, due_date, recipient_whatsapp, client:clients(name, company, whatsapp)').eq('workspace_id', integration.workspace_id).not('status', 'in', '(paid,void)').order('due_date', { ascending: true, nullsFirst: false }).limit(8)
  const invoices = (data ?? []) as JsonRecord[]
  if (!invoices.length) return await sendMessage(integration.chat_id!, '🧾 Tidak ada invoice yang perlu ditindaklanjuti.', mainMenu(integration))
  for (const invoice of invoices) {
    const client = first(invoice.client as JsonRecord | JsonRecord[] | null)
    const clientName = text(client?.company) || text(client?.name) || 'Klien'
    const phone = waNumber(invoice.recipient_whatsapp || client?.whatsapp)
    const followUp = `Halo ${clientName}, kami ingin menindaklanjuti invoice ${text(invoice.invoice_number)} sebesar ${rupiah(invoice.total_amount)}. Apakah ada yang dapat kami bantu terkait pembayarannya?`
    const publicCode = await publicInvoiceCode(text(invoice.id))
    const keyboard: JsonRecord[][] = publicCode ? [[
      { text: '👁 Preview A4 publik', url: appUrl(integration, `/invoice/${encodeURIComponent(publicCode)}`) },
      { text: '⬇️ Download PDF', url: appUrl(integration, `/invoice/${encodeURIComponent(publicCode)}/pdf`) },
    ]] : [[{ text: 'Buka daftar invoice', url: appUrl(integration, '/invoices') }]]
    if (phone) keyboard.unshift([{ text: '💬 Follow up WhatsApp', url: `https://wa.me/${phone}?text=${encodeURIComponent(followUp)}` }])
    await sendMessage(integration.chat_id!, `🧾 <b>${escapeHtml(invoice.invoice_number)}</b>\n${escapeHtml(clientName)} · ${rupiah(invoice.total_amount)}\nStatus: ${escapeHtml(invoice.status)}`, keyboard)
  }
}

async function routeMenu(integration: Integration, route: string) {
  if (route === 'projects') return await sendProjects(integration)
  if (route === 'tasks') return await sendTasks(integration)
  if (route === 'revenue') return await sendRevenue(integration)
  if (route === 'orders') return await sendOrders(integration)
  if (route === 'bookings') return await sendBookings(integration)
  if (route === 'invoices') return await sendInvoices(integration)
  if (route === 'forms') return await sendForms(integration)
  return await sendMessage(integration.chat_id!, 'Pilih tindakan yang Anda perlukan:', mainMenu(integration))
}

async function handleMessage(message: JsonRecord) {
  const chat = message.chat as JsonRecord | undefined
  const chatId = number(chat?.id)
  const body = text(message.text).trim()
  if (!chatId || !body) return
  const [commandRaw, argument = ''] = body.split(/\s+/, 2)
  const command = commandRaw.toLowerCase().split('@')[0]
  if (command === '/start') return await connectChat(message, argument)
  const integration = await integrationForChat(chatId)
  if (!integration) return await sendMessage(chatId, 'Chat ini belum terhubung. Gunakan kode koneksi dari halaman Settings Nayagement.')
  await routeMenu(integration, command.replace(/^\//, '') || 'menu')
}

async function handleCallback(callback: JsonRecord) {
  const callbackId = text(callback.id)
  const message = callback.message as JsonRecord | undefined
  const chat = message?.chat as JsonRecord | undefined
  const chatId = number(chat?.id)
  const data = text(callback.data)
  const integration = chatId ? await integrationForChat(chatId) : null
  if (!integration) return await answerCallback(callbackId, 'Chat belum terhubung')
  if (data.startsWith('menu:')) {
    await answerCallback(callbackId, 'Membuka data terbaru…')
    return await routeMenu(integration, data.slice(5))
  }
  if (data.startsWith('oc:')) {
    const id = data.slice(3)
    const { error } = await supabase.from('order_submissions').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('workspace_id', integration.workspace_id).eq('id', id)
    await answerCallback(callbackId, error ? 'Order gagal dikonfirmasi' : 'Order dikonfirmasi')
    if (!error) await sendMessage(chatId, '✅ Order sudah dikonfirmasi dan statusnya tersimpan di Nayagement.')
    return
  }
  if (data.startsWith('bc:')) {
    const id = data.slice(3)
    const { error } = await supabase.from('consultation_bookings').update({ status: 'confirmed' }).eq('workspace_id', integration.workspace_id).eq('id', id)
    await answerCallback(callbackId, error ? 'Booking gagal dikonfirmasi' : 'Booking dikonfirmasi')
    if (!error) await sendMessage(chatId, '✅ Booking konsultasi sudah dikonfirmasi dan kalender ikut diperbarui.')
    return
  }
  await answerCallback(callbackId, 'Aksi tidak dikenali')
}

function eventAllowed(integration: Integration, eventType: string) {
  if (eventType === 'order') return integration.notify_orders
  if (eventType === 'booking') return integration.notify_bookings
  if (eventType === 'task') return integration.notify_tasks
  if (eventType === 'project') return integration.notify_projects
  if (eventType === 'invoice' || eventType === 'finance') return integration.notify_invoices
  return true
}

async function notificationKeyboard(integration: Integration, item: JsonRecord): Promise<JsonRecord[][]> {
  const entityType = text(item.entity_type)
  const entityId = text(item.entity_id)
  if (entityType === 'order_submission' && entityId) return [[{ text: '✅ Konfirmasi order', callback_data: `oc:${entityId}` }, { text: 'Buka order', url: appUrl(integration, '/orders') }]]
  if (entityType === 'consultation_booking' && entityId) return [[{ text: '✅ Konfirmasi booking', callback_data: `bc:${entityId}` }, { text: 'Buka booking', url: appUrl(integration, '/bookings') }], [{ text: 'Salin link booking', copy_text: { text: appUrl(integration, '/booking') } }]]
  if (entityType === 'project' && entityId) {
    const { data } = await supabase.from('project_public_access').select('public_slug, is_enabled').eq('project_id', entityId).maybeSingle()
    const link = data?.is_enabled && data.public_slug ? appUrl(integration, `/client/${encodeURIComponent(data.public_slug)}`) : appUrl(integration, `/projects/${entityId}`)
    return [[{ text: 'Salin link project', copy_text: { text: link } }, { text: 'Buka project', url: appUrl(integration, `/projects/${entityId}`) }]]
  }
  if (entityType === 'project_task') return [[{ text: 'Lihat status task', url: appUrl(integration, '/tasks') }]]
  if (entityType === 'invoice' && entityId) {
    const publicCode = await publicInvoiceCode(entityId)
    if (!publicCode) return [[{ text: 'Lihat invoice', url: appUrl(integration, '/invoices') }], [{ text: 'Lihat invoice lainnya', callback_data: 'menu:invoices' }]]
    return [[
      { text: '👁 Preview A4 publik', url: appUrl(integration, `/invoice/${encodeURIComponent(publicCode)}`) },
      { text: '⬇️ Download PDF', url: appUrl(integration, `/invoice/${encodeURIComponent(publicCode)}/pdf`) },
    ], [{ text: 'Lihat invoice lainnya', callback_data: 'menu:invoices' }]]
  }
  return mainMenu(integration)
}

async function processOutbox() {
  const { data } = await supabase.from('telegram_outbox').select('*').in('status', ['pending', 'failed']).lte('next_attempt_at', new Date().toISOString()).lt('attempts', 5).order('created_at').limit(30)
  for (const item of (data ?? []) as JsonRecord[]) {
    const id = text(item.id)
    await supabase.from('telegram_outbox').update({ status: 'processing', attempts: number(item.attempts) + 1 }).eq('id', id).in('status', ['pending', 'failed'])
    try {
      const { data: integrationData } = await supabase.from('telegram_integrations').select('*').eq('workspace_id', item.workspace_id).maybeSingle()
      const integration = integrationData as Integration | null
      if (!integration?.chat_id || !integration.is_enabled || !eventAllowed(integration, text(item.event_type))) {
        await supabase.from('telegram_outbox').update({ status: 'skipped', sent_at: new Date().toISOString() }).eq('id', id)
        continue
      }
      const payload = (item.payload ?? {}) as JsonRecord
      const keyboard = await notificationKeyboard(integration, item)
      await sendMessage(integration.chat_id, `🔔 <b>${escapeHtml(payload.title || 'Pembaruan Nayagement')}</b>\n${escapeHtml(payload.body)}`, keyboard)
      await supabase.from('telegram_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', id)
    } catch (error) {
      const nextAttempt = new Date(Date.now() + 5 * 60_000).toISOString()
      await supabase.from('telegram_outbox').update({ status: 'failed', next_attempt_at: nextAttempt, last_error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' }).eq('id', id)
    }
  }
}

function zonedClock(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` }
}

async function buildReminder(integration: Integration, slot: string) {
  const clock = zonedClock(integration.timezone)
  const { data: tasks } = await supabase.from('project_tasks').select('status, due_at').eq('workspace_id', integration.workspace_id).neq('status', 'completed')
  const todayTasks = (tasks ?? []).filter((task) => task.due_at && new Intl.DateTimeFormat('en-CA', { timeZone: integration.timezone }).format(new Date(task.due_at)) === clock.date).length
  const overdueTasks = (tasks ?? []).filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length
  const { count: orders } = await supabase.from('order_submissions').select('id', { count: 'exact', head: true }).eq('workspace_id', integration.workspace_id).eq('status', 'new')
  const { count: bookings } = await supabase.from('consultation_bookings').select('id', { count: 'exact', head: true }).eq('workspace_id', integration.workspace_id).eq('status', 'new')
  const { data: invoices } = await supabase.from('invoices').select('total_amount, status').eq('workspace_id', integration.workspace_id)
  const outstanding = (invoices ?? []).filter((invoice) => !['paid', 'void'].includes(invoice.status)).reduce((sum, invoice) => sum + number(invoice.total_amount), 0)
  const greeting = slot === 'morning' ? 'Selamat pagi' : slot === 'noon' ? 'Selamat siang' : 'Selamat malam'
  return `${greeting}! 👋\n\n<b>Ringkasan yang perlu Anda cek</b>\n• ${todayTasks} task jatuh tempo hari ini\n• ${overdueTasks} task terlambat\n• ${orders ?? 0} order baru\n• ${bookings ?? 0} booking baru\n• ${rupiah(outstanding)} invoice outstanding`
}

async function processReminders() {
  const { data } = await supabase.from('telegram_integrations').select('*').eq('is_enabled', true).eq('reminder_enabled', true).not('chat_id', 'is', null)
  for (const integration of (data ?? []) as Integration[]) {
    const clock = zonedClock(integration.timezone || 'Asia/Makassar')
    const slots = [
      { key: 'morning', time: text(integration.reminder_morning).slice(0, 5) },
      { key: 'noon', time: text(integration.reminder_noon).slice(0, 5) },
      { key: 'evening', time: text(integration.reminder_evening).slice(0, 5) },
    ]
    for (const slot of slots) {
      if (clock.time !== slot.time) continue
      const { error } = await supabase.from('telegram_reminder_runs').insert({ workspace_id: integration.workspace_id, reminder_date: clock.date, reminder_slot: slot.key })
      if (error) continue
      try { await sendMessage(integration.chat_id!, await buildReminder(integration, slot.key), mainMenu(integration)) }
      catch { await supabase.from('telegram_reminder_runs').delete().eq('workspace_id', integration.workspace_id).eq('reminder_date', clock.date).eq('reminder_slot', slot.key) }
    }
  }
}

async function dispatch() {
  await ensureBotIdentity()
  await processOutbox()
  await processReminders()
  return json({ ok: true })
}

async function hasValidDispatchAuthorization(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return false
  if ((dispatchKey && token === dispatchKey) || (anonKey && token === anonKey)) return true

  // The project can expose both a legacy anon JWT and a newer publishable key.
  // Validate either form against this project's API instead of comparing it
  // with only one environment-provided key.
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/telegram_integrations?select=workspace_id&limit=0`, {
      headers: {
        apikey: token,
        authorization: `Bearer ${token}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

Deno.serve(async (request) => {
  if (!supabaseUrl || !serviceRoleKey || !botToken) return json({ ok: false, error: 'Server secrets belum lengkap' }, 500)
  const url = new URL(request.url)
  if (url.searchParams.get('mode') === 'dispatch') {
    if (!await hasValidDispatchAuthorization(request)) return json({ ok: false }, 401)
    return await dispatch()
  }
  if (!webhookSecret || request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) return json({ ok: false }, 401)
  let update: JsonRecord = {}
  try {
    update = await request.json() as JsonRecord
    if (update.message) await handleMessage(update.message as JsonRecord)
    if (update.callback_query) await handleCallback(update.callback_query as JsonRecord)
    return json({ ok: true })
  } catch (error) {
    console.error(error)
    try {
      const callback = update.callback_query as JsonRecord | undefined
      const message = callback?.message as JsonRecord | undefined
      const chat = message?.chat as JsonRecord | undefined
      const chatId = number(chat?.id)
      if (chatId) await sendMessage(chatId, 'Terjadi kendala saat mengambil data terbaru. Silakan coba tombolnya kembali.')
    } catch {
      // Respons error utama tetap dikirim meskipun pesan bantuan tidak dapat dikirim.
    }
    return json({ ok: false }, 500)
  }
})
