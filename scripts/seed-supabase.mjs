import { createClient } from '@supabase/supabase-js'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} belum diisi.`)
  return value
}

const supabaseUrl = required('SUPABASE_URL')
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
const adminUsername = (process.env.NAYA_ADMIN_USERNAME || 'arunika').trim().toLowerCase()
const adminPassword = required('NAYA_ADMIN_PASSWORD')
const adminDisplayName = (process.env.NAYA_ADMIN_DISPLAY_NAME || adminUsername).trim()
const resetAdminPassword = process.env.NAYA_RESET_ADMIN_PASSWORD === 'true'
const batchLabel = process.env.NAYA_DEMO_SEED_LABEL || 'initial-ui-demo'
const adminEmail = `${adminUsername}@auth.nayagement.local`
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const now = new Date()
const dateAt = (offset) => {
  const value = new Date(now)
  value.setDate(value.getDate() + offset)
  return value.toISOString().slice(0, 10)
}
const timeAt = (offsetDays, hour, minute = 0) => {
  const value = new Date(now)
  value.setDate(value.getDate() + offsetDays)
  value.setHours(hour, minute, 0, 0)
  return value.toISOString()
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const raise = (error) => {
  if (error) throw new Error(error.message)
}

async function findOrCreateAdmin() {
  let page = 1
  let user
  while (!user) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    raise(error)
    user = data.users.find((candidate) => candidate.email?.toLowerCase() === adminEmail)
    if (user || data.users.length < 200) break
    page += 1
  }
  if (user) {
    if (!resetAdminPassword) return { user, created: false }
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: { username: adminUsername, display_name: adminDisplayName },
      app_metadata: { ...(user.app_metadata ?? {}), app_role: 'superuser' },
    })
    raise(error)
    assert(data.user, 'Kredensial akun admin tidak dapat diperbarui.')
    return { user: data.user, created: false }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { username: adminUsername, display_name: adminDisplayName },
    app_metadata: { app_role: 'superuser' },
  })
  raise(error)
  assert(data.user, 'Akun admin tidak dapat dibuat.')
  return { user: data.user, created: true }
}

async function verifySchema() {
  const { error } = await supabase.from('demo_seed_batches').select('id').limit(1)
  if (error) {
    throw new Error('Schema Nayagement belum tersedia. Jalankan supabase/schema.sql di SQL Editor terlebih dahulu.')
  }
}

async function ensureWorkspace(userId) {
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, display_name: adminDisplayName, timezone: 'Asia/Makassar' })
  raise(profileError)
  const { error: identityError } = await supabase
    .from('admin_login_identities')
    .upsert({ user_id: userId, username: adminUsername, login_email: adminEmail })
  raise(identityError)
  const { data: existingMembership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  raise(membershipError)
  if (existingMembership?.workspace_id) {
    const { error: roleError } = await supabase
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', existingMembership.workspace_id)
      .eq('user_id', userId)
    raise(roleError)
    return existingMembership.workspace_id
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ owner_id: userId, name: 'Nayagement Studio', slug: `nayagement-${userId.slice(0, 8)}` })
    .select('id')
    .single()
  raise(workspaceError)
  assert(workspace?.id, 'Workspace tidak dapat dibuat.')
  const { error: roleError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })
  raise(roleError)
  const { error: settingsError } = await supabase
    .from('business_settings')
    .upsert({ workspace_id: workspace.id, business_name: 'Nayagement Studio', email: 'hello@nayagement.studio', website: 'nayagement.studio' })
  raise(settingsError)
  return workspace.id
}

async function createBatch(workspaceId) {
  const { data: previous, error: previousError } = await supabase
    .from('demo_seed_batches')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('label', batchLabel)
    .maybeSingle()
  raise(previousError)
  if (previous?.id) {
    const { error } = await supabase.rpc('clear_demo_seed', { p_seed_id: previous.id })
    raise(error)
  }
  const { data, error } = await supabase
    .from('demo_seed_batches')
    .insert({ workspace_id: workspaceId, label: batchLabel })
    .select('id')
    .single()
  raise(error)
  assert(data?.id, 'Batch demo tidak dapat dibuat.')
  return data.id
}

async function ensureProjectTypes(workspaceId, seedId) {
  const definitions = [
    { name: 'Branding', color: '#5B8EE6', sort_order: 1 },
    { name: 'Social Media', color: '#8A76D9', sort_order: 2 },
    { name: 'Spreadsheet Custom', color: '#54B997', sort_order: 3 },
    { name: 'Website', color: '#E09A6A', sort_order: 4 },
    { name: 'Presentation', color: '#D8789B', sort_order: 5 },
  ]
  const { data: existing, error: existingError } = await supabase
    .from('project_types')
    .select('id, name')
    .eq('workspace_id', workspaceId)
  raise(existingError)
  const byName = new Map((existing ?? []).map((item) => [item.name, item.id]))
  const missing = definitions.filter((item) => !byName.has(item.name)).map((item) => ({ ...item, workspace_id: workspaceId, demo_seed_id: seedId, is_default: true }))
  if (missing.length) {
    const { data, error } = await supabase.from('project_types').insert(missing).select('id, name')
    raise(error)
    data?.forEach((item) => byName.set(item.name, item.id))
  }
  return byName
}

async function ensureClients(workspaceId, seedId) {
  const definitions = [
    { name: 'Aurelia Ramadhan', company: 'Aurora Studio', status: 'active', email: 'aurelia@aurorastudio.example' },
    { name: 'Irfan Pratama', company: 'Bilik Strategi', status: 'returning', email: 'irfan@bilikstrategi.example' },
    { name: 'Salsa Rahmi', company: 'Kala Ventures', status: 'active', email: 'salsa@kalaventures.example' },
    { name: 'Kevin Lim', company: 'Arka Foods', status: 'lead', email: 'kevin@arkafoods.example' },
    { name: 'Nadia Sora', company: 'Sora Atelier', status: 'inactive', email: 'nadia@soraatelier.example' },
  ]
  const { data: existing, error: existingError } = await supabase
    .from('clients')
    .select('id, company')
    .eq('workspace_id', workspaceId)
  raise(existingError)
  const byCompany = new Map((existing ?? []).filter((item) => item.company).map((item) => [item.company, item.id]))
  const missing = definitions.filter((item) => !byCompany.has(item.company)).map((item) => ({ ...item, workspace_id: workspaceId, demo_seed_id: seedId }))
  if (missing.length) {
    const { data, error } = await supabase.from('clients').insert(missing).select('id, company')
    raise(error)
    data?.forEach((item) => byCompany.set(item.company, item.id))
  }
  return byCompany
}

async function seedProjects(workspaceId, seedId, projectTypes, clients) {
  const definitions = [
    { name: 'Aurora Brand Refresh', client: 'Aurora Studio', type: 'Branding', description: 'Visual identity dan guideline untuk relaunch Aurora Studio.', client_visible_description: 'Kami sedang menyempurnakan sistem visual dan aplikasi brand.', status: 'in_progress', priority: 'high', start: -18, deadline: 3, value: 12800000, progress: 72, client_visibility: true },
    { name: 'Monthly Social Sprint', client: 'Bilik Strategi', type: 'Social Media', description: 'Konten sosial media, moodboard, dan kalender publikasi untuk Bilik Strategi.', client_visible_description: null, status: 'review', priority: 'urgent', start: -21, deadline: 1, value: 7500000, progress: 88, client_visibility: false },
    { name: 'Investor Pitch Deck', client: 'Kala Ventures', type: 'Presentation', description: 'Deck pendanaan dengan visual data yang mudah dibaca.', client_visible_description: null, status: 'confirmed', priority: 'medium', start: -2, deadline: 10, value: 5800000, progress: 25, client_visibility: false },
    { name: 'Operations Dashboard', client: 'Arka Foods', type: 'Spreadsheet Custom', description: 'Dashboard operasional dan proyeksi penjualan untuk tim Arka Foods.', client_visible_description: null, status: 'in_progress', priority: 'high', start: -12, deadline: 7, value: 9600000, progress: 54, client_visibility: false },
    { name: 'Launch Website', client: 'Sora Atelier', type: 'Website', description: 'Landing page koleksi musim panas untuk Sora Atelier.', client_visible_description: null, status: 'completed', priority: 'low', start: -35, deadline: -6, value: 14500000, progress: 100, client_visibility: false },
  ]
  const { data: existing, error: existingError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
  raise(existingError)
  const byName = new Map((existing ?? []).map((item) => [item.name, item.id]))
  const missing = definitions.filter((item) => !byName.has(item.name)).map((item) => ({
    workspace_id: workspaceId,
    demo_seed_id: seedId,
    client_id: clients.get(item.client),
    project_type_id: projectTypes.get(item.type),
    name: item.name,
    description: item.description,
    client_visible_description: item.client_visible_description,
    status: item.status,
    priority: item.priority,
    start_date: dateAt(item.start),
    deadline: dateAt(item.deadline),
    estimated_value: item.value,
    payment_status: item.name === 'Monthly Social Sprint' || item.name === 'Launch Website' ? 'paid' : item.name === 'Aurora Brand Refresh' ? 'partial' : 'unpaid',
    progress_percentage: item.progress,
    client_visibility: item.client_visibility,
  }))
  const seededIds = new Set()
  if (missing.length) {
    const { data, error } = await supabase.from('projects').insert(missing).select('id, name')
    raise(error)
    data?.forEach((item) => {
      byName.set(item.name, item.id)
      seededIds.add(item.id)
    })
  }
  return { byName, seededIds }
}

async function seedTasksAndTimeline(workspaceId, projects) {
  const tasks = [
    { project: 'Aurora Brand Refresh', name: 'Kirim brand direction v2', status: 'in_progress', priority: 'high', due_at: timeAt(0, 16), client_visible: true },
    { project: 'Monthly Social Sprint', name: 'Review caption carousel', status: 'review', priority: 'urgent', due_at: timeAt(1, 10), client_visible: true },
    { project: 'Investor Pitch Deck', name: 'Susun struktur narasi deck', status: 'todo', priority: 'medium', due_at: timeAt(3, 14), client_visible: false },
    { project: 'Operations Dashboard', name: 'Validasi data sales Q2', status: 'todo', priority: 'high', due_at: timeAt(4, 11), client_visible: false },
  ].filter((item) => projects.seededIds.has(projects.byName.get(item.project)))
  let taskRows = []
  if (tasks.length) {
    const { data, error } = await supabase
      .from('project_tasks')
      .insert(tasks.map(({ project, ...item }) => ({
        ...item,
        workspace_id: workspaceId,
        project_id: projects.byName.get(project),
      })))
      .select('id, name, project_id')
    raise(error)
    taskRows = data ?? []
  }

  const auroraId = projects.byName.get('Aurora Brand Refresh')
  if (auroraId && projects.seededIds.has(auroraId)) {
    const { error } = await supabase.from('project_timeline').insert([
      { workspace_id: workspaceId, project_id: auroraId, title: 'Brief disepakati', description: 'Arah proyek dan ruang lingkup telah dikonfirmasi bersama.', occurred_at: timeAt(-18, 10, 30), status_snapshot: 'confirmed', visibility: 'client' },
      { workspace_id: workspaceId, project_id: auroraId, title: 'Eksplorasi visual selesai', description: 'Tiga arah visual disiapkan untuk dipilih.', occurred_at: timeAt(-10, 15), status_snapshot: 'in_progress', visibility: 'client' },
      { workspace_id: workspaceId, project_id: auroraId, title: 'Penyempurnaan identitas', description: 'Menyiapkan sistem warna dan aplikasi brand.', occurred_at: timeAt(0, 10), status_snapshot: 'in_progress', visibility: 'client' },
      { workspace_id: workspaceId, project_id: auroraId, title: 'Kirim final guideline', description: 'Finalisasi aset dan handover file.', occurred_at: timeAt(3, 16), status_snapshot: 'in_progress', visibility: 'client' },
    ])
    raise(error)
    const { error: portalError } = await supabase.from('project_public_access').insert({
      workspace_id: workspaceId,
      project_id: auroraId,
      public_token: 'a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5',
      is_enabled: true,
      show_client_name: true,
    })
    raise(portalError)
  }

  return taskRows
}

async function seedInvoices(workspaceId, seedId, projects, clients) {
  const definitions = [
    { number: 'INV/024/08/2026', project: 'Aurora Brand Refresh', client: 'Aurora Studio', issue: -5, due: 3, amount: 12800000, payment: 6400000, description: 'Brand identity dan guideline · tahap 1' },
    { number: 'INV/023/08/2026', project: 'Launch Website', client: 'Sora Atelier', issue: -12, due: -7, amount: 14500000, payment: 14500000, description: 'Landing page dan handover website' },
    { number: 'INV/022/08/2026', project: 'Operations Dashboard', client: 'Arka Foods', issue: -8, due: 7, amount: 9600000, payment: 0, description: 'Operations dashboard dan proyeksi Q2' },
  ].filter((item) => projects.seededIds.has(projects.byName.get(item.project)))
  if (!definitions.length) return 0
  const { data: invoices, error } = await supabase
    .from('invoices')
    .insert(definitions.map((item) => ({
      workspace_id: workspaceId,
      demo_seed_id: seedId,
      project_id: projects.byName.get(item.project),
      client_id: clients.get(item.client),
      invoice_number: item.number,
      issue_date: dateAt(item.issue),
      due_date: dateAt(item.due),
      status: 'sent',
      payment_instructions: 'Transfer bank sesuai detail yang telah disepakati.',
    })))
    .select('id, invoice_number, project_id')
  raise(error)
  const idByNumber = new Map((invoices ?? []).map((item) => [item.invoice_number, item.id]))
  const { error: itemsError } = await supabase.from('invoice_items').insert(definitions.map((item, index) => ({
    workspace_id: workspaceId,
    invoice_id: idByNumber.get(item.number),
    description: item.description,
    quantity: 1,
    unit_price: item.amount,
    sort_order: index + 1,
  })))
  raise(itemsError)
  const payments = definitions.filter((item) => item.payment > 0).map((item) => ({
    workspace_id: workspaceId,
    invoice_id: idByNumber.get(item.number),
    project_id: projects.byName.get(item.project),
    amount: item.payment,
    paid_at: timeAt(item.project === 'Launch Website' ? -7 : -1, 10),
    method: 'Bank transfer',
    reference: `DEMO-${item.number}`,
  }))
  if (payments.length) {
    const { error: paymentsError } = await supabase.from('payments').insert(payments)
    raise(paymentsError)
  }
  return definitions.length
}

async function seedNotifications(workspaceId, seedId, recipientId) {
  const rows = [
    { kind: 'project', title: 'Revisi baru dari Bilik Strategi', body: 'Monthly Social Sprint membutuhkan approval caption.', created_at: timeAt(0, 0, -12) },
    { kind: 'finance', title: 'Invoice Launch Website telah dibayar', body: 'Sora Atelier · pembayaran berhasil tercatat.', created_at: timeAt(0, -1) },
    { kind: 'deadline', title: 'Deadline Aurora tinggal 3 hari', body: 'Aurora Brand Refresh perlu final guideline.', created_at: timeAt(0, -3) },
    { kind: 'order', title: 'Order baru masuk', body: 'Nara Tumbuh mengirimkan Creative Brief.', created_at: timeAt(-1, 9) },
  ].map((item, index) => ({
    workspace_id: workspaceId,
    demo_seed_id: seedId,
    recipient_id: recipientId,
    kind: item.kind,
    title: item.title,
    body: item.body,
    read_at: index > 1 ? timeAt(0, 8) : null,
    created_at: item.created_at,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  raise(error)
  return rows.length
}

async function seedCalendar(workspaceId, seedId, projects, taskRows) {
  const taskByName = new Map(taskRows.map((item) => [item.name, item.id]))
  const rows = [
    { title: 'Weekly studio sync', starts_at: timeAt(0, 9, 30), ends_at: timeAt(0, 10), color: '#8A76D9' },
    { title: 'Presentasi Aurora direction', starts_at: timeAt(0, 13), ends_at: timeAt(0, 13, 45), color: '#5B8EE6', project_id: projects.byName.get('Aurora Brand Refresh') },
    { title: 'Review konten Bilik Strategi', starts_at: timeAt(0, 16), ends_at: timeAt(0, 16, 30), color: '#E09A6A', task_id: taskByName.get('Review caption carousel'), project_id: projects.byName.get('Monthly Social Sprint') },
  ]
  const { error } = await supabase.from('calendar_events').insert(rows.map((item) => ({ ...item, workspace_id: workspaceId, demo_seed_id: seedId })))
  raise(error)
  return rows.length
}

async function seedOrderForm(workspaceId, seedId) {
  const { data: form, error } = await supabase
    .from('order_forms')
    .insert({
      workspace_id: workspaceId,
      demo_seed_id: seedId,
      title: 'Creative project brief',
      description: 'Ceritakan kebutuhan kreatif Anda agar kami dapat menyiapkan scope yang tepat.',
      confirmation_message: 'Terima kasih, brief Anda sudah kami terima. Kami akan menghubungi Anda segera.',
      public_token: 'c5e7a9b1d3f5c7e9a1b3d5f7c9e1a3b5d7f9c1e3a5b7d9f1c3e5a7b9d1f3c5e7',
      is_active: true,
    })
    .select('id')
    .single()
  raise(error)
  assert(form?.id, 'Order form demo tidak dapat dibuat.')
  const { error: fieldsError } = await supabase.from('order_form_fields').insert([
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'name', label: 'Nama lengkap', field_type: 'text', is_required: true, sort_order: 1 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'company', label: 'Nama bisnis / perusahaan', field_type: 'text', is_required: false, sort_order: 2 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'whatsapp', label: 'Nomor WhatsApp', field_type: 'phone', is_required: true, sort_order: 3 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'project_type', label: 'Jenis kebutuhan', field_type: 'select', options: ['Branding', 'Social Media', 'Website', 'Presentation', 'Consulting'], is_required: true, sort_order: 4 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'project_description', label: 'Ceritakan kebutuhan Anda', field_type: 'textarea', is_required: true, sort_order: 5 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'budget', label: 'Rentang budget', field_type: 'select', options: ['Di bawah Rp5 juta', 'Rp5–10 juta', 'Rp10–20 juta', 'Di atas Rp20 juta'], is_required: true, sort_order: 6 },
    { workspace_id: workspaceId, order_form_id: form.id, field_key: 'deadline_preference', label: 'Target deadline', field_type: 'date', is_required: false, sort_order: 7 },
  ].map((field) => ({ ...field, options: field.options ?? [] })))
  raise(fieldsError)
  const { data: submissions, error: submissionsError } = await supabase
    .from('order_submissions')
    .insert([
      { workspace_id: workspaceId, demo_seed_id: seedId, order_form_id: form.id, submitter_name: 'Nara Tumbuh', submitter_whatsapp: '081234567890', payload: { name: 'Nara Tumbuh', company: 'Nara Tumbuh', project_type: 'Branding', project_description: 'Butuh identity system untuk brand lifestyle baru.', budget: 'Rp10–20 juta' } },
      { workspace_id: workspaceId, demo_seed_id: seedId, order_form_id: form.id, submitter_name: 'Mantra Rasa', submitter_whatsapp: '081298765432', payload: { name: 'Mantra Rasa', company: 'Mantra Rasa', project_type: 'Social Media', project_description: 'Memerlukan template konten dan kalender September.', budget: 'Rp5–10 juta' } },
    ])
    .select('id')
  raise(submissionsError)
  const submissionIds = (submissions ?? []).map((item) => item.id)
  if (submissionIds.length) {
    const { error: notificationError } = await supabase
      .from('notifications')
      .update({ demo_seed_id: seedId })
      .eq('entity_type', 'order_submission')
      .in('entity_id', submissionIds)
    raise(notificationError)
  }
  return { formId: form.id, submissions: submissionIds.length }
}

async function main() {
  try {
    await verifySchema()
    const { user, created } = await findOrCreateAdmin()
    const workspaceId = await ensureWorkspace(user.id)
    const seedId = await createBatch(workspaceId)
    const projectTypes = await ensureProjectTypes(workspaceId, seedId)
    const clients = await ensureClients(workspaceId, seedId)
    const projects = await seedProjects(workspaceId, seedId, projectTypes, clients)
    const taskRows = await seedTasksAndTimeline(workspaceId, projects)
    const invoiceCount = await seedInvoices(workspaceId, seedId, projects, clients)
    const notificationCount = await seedNotifications(workspaceId, seedId, user.id)
    const calendarCount = await seedCalendar(workspaceId, seedId, projects, taskRows)
    const orderForm = await seedOrderForm(workspaceId, seedId)
    console.log(JSON.stringify({
      ok: true,
      createdAdmin: created,
      workspaceId,
      seedId,
      label: batchLabel,
      records: {
        projects: projects.seededIds.size,
        tasks: taskRows.length,
        invoices: invoiceCount,
        notifications: notificationCount,
        calendarEvents: calendarCount,
        orderFormSubmissions: orderForm.submissions,
      },
    }, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seed gagal dijalankan.'
    if (/relation .* does not exist|Could not find the table|PGRST205/i.test(message)) {
      console.error('Seed gagal: schema belum tersedia. Jalankan supabase/schema.sql di SQL Editor terlebih dahulu.')
    } else {
      console.error(`Seed gagal: ${message}`)
    }
    process.exitCode = 1
  }
}

void main()
