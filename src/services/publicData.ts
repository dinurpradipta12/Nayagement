import { supabase } from '../lib/supabase'
import type { InvoiceDocumentStatus, InvoiceEditorDraft, OrderFormFieldType, Project, ProjectStatus, TaskStatus, TimelineItem } from '../types'

interface PublicTimelineRow {
  title?: unknown
  description?: unknown
  occurred_at?: unknown
}

interface PublicProjectPayload {
  project_name?: unknown
  project_type?: unknown
  client_name?: unknown
  current_status?: unknown
  progress?: unknown
  start_date?: unknown
  deadline?: unknown
  description?: unknown
  timeline?: unknown
  tasks?: unknown
}

interface PublicTaskRow {
  name?: unknown
  status?: unknown
  due_at?: unknown
  completed_at?: unknown
}

export interface PublicProjectTask {
  name: string
  status: TaskStatus
  dueAt: string | null
  completedAt: string | null
}

export interface PublicProjectSnapshot {
  project: Project
  timeline: TimelineItem[]
  tasks: PublicProjectTask[]
}

export type PublicProjectLookup = 'token' | 'code' | 'slug'

interface PublicInvoiceItemPayload {
  id?: unknown
  description?: unknown
  detail?: unknown
  quantity?: unknown
  unit_price?: unknown
}

interface PublicInvoicePayload {
  id?: unknown
  invoice_number?: unknown
  issue_date?: unknown
  due_date?: unknown
  status?: unknown
  currency?: unknown
  discount_amount?: unknown
  tax_rate?: unknown
  document_title?: unknown
  brand_color?: unknown
  logo_path?: unknown
  signature_path?: unknown
  recipient_name?: unknown
  recipient_company?: unknown
  recipient_email?: unknown
  recipient_whatsapp?: unknown
  sender_name?: unknown
  sender_email?: unknown
  sender_phone?: unknown
  sender_address?: unknown
  payment_instructions?: unknown
  notes?: unknown
  terms?: unknown
  footer_note?: unknown
  items?: unknown
}

const accentOptions: Project['accent'][] = ['blue', 'violet', 'peach', 'mint', 'pink']

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function publicInvoiceStatus(value: unknown): InvoiceDocumentStatus {
  const normalized = text(value).toLowerCase()
  if (normalized === 'paid') return 'Paid'
  if (normalized === 'sent' || normalized === 'partial' || normalized === 'dp') return 'DP'
  if (normalized === 'overdue') return 'Overdue'
  if (normalized === 'void') return 'Void'
  return 'Draft'
}

function publicInvoiceAssetUrl(path: unknown) {
  const storagePath = text(path).trim()
  if (!storagePath || !supabase) return undefined
  return supabase.storage.from('invoice-logos').getPublicUrl(storagePath).data.publicUrl || undefined
}

export async function loadPublicInvoice(publicCode: string): Promise<InvoiceEditorDraft | null> {
  if (!supabase || !/^[a-f0-9]{16}$/.test(publicCode)) return null
  const { data, error } = await supabase.rpc('get_public_invoice', { p_code: publicCode })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const payload = data as PublicInvoicePayload
  const invoiceNumber = text(payload.invoice_number).trim()
  if (!invoiceNumber) return null
  const items = Array.isArray(payload.items)
    ? payload.items.map((value) => {
      const item = value as PublicInvoiceItemPayload
      return {
        id: text(item.id) || undefined,
        description: text(item.description, 'Layanan'),
        detail: text(item.detail),
        quantity: numberValue(item.quantity),
        unitPrice: numberValue(item.unit_price),
      }
    })
    : []
  const logoPath = text(payload.logo_path) || undefined
  const signaturePath = text(payload.signature_path) || undefined

  return {
    id: text(payload.id) || publicCode,
    invoiceNumber,
    clientId: '',
    projectId: '',
    issueDate: text(payload.issue_date),
    dueDate: text(payload.due_date) || text(payload.issue_date),
    status: publicInvoiceStatus(payload.status),
    currency: text(payload.currency, 'IDR'),
    documentTitle: text(payload.document_title, 'Invoice'),
    brandColor: /^#[0-9a-f]{6}$/i.test(text(payload.brand_color)) ? text(payload.brand_color) : '#30343b',
    logoPath,
    logoUrl: publicInvoiceAssetUrl(logoPath),
    signaturePath,
    signatureUrl: publicInvoiceAssetUrl(signaturePath),
    recipientName: text(payload.recipient_name),
    recipientCompany: text(payload.recipient_company),
    recipientEmail: text(payload.recipient_email),
    recipientWhatsapp: text(payload.recipient_whatsapp),
    senderName: text(payload.sender_name, 'Nayagement Studio'),
    senderEmail: text(payload.sender_email),
    senderPhone: text(payload.sender_phone),
    senderAddress: text(payload.sender_address),
    paymentInstructions: text(payload.payment_instructions),
    notes: text(payload.notes),
    terms: text(payload.terms),
    footerNote: text(payload.footer_note),
    taxRate: numberValue(payload.tax_rate),
    discountAmount: numberValue(payload.discount_amount),
    items: items.length ? items : [{ description: 'Layanan', detail: '', quantity: 1, unitPrice: 0 }],
  }
}

function dateValue(value: unknown) {
  const candidate = text(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : new Date().toISOString().slice(0, 10)
}

function statusValue(value: unknown): ProjectStatus {
  const normalized = text(value).split(/[ _]+/).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ')
  const allowed: ProjectStatus[] = ['Inquiry', 'Pending', 'Confirmed', 'In Progress', 'Review', 'Revision', 'Completed', 'Cancelled']
  return allowed.includes(normalized as ProjectStatus) ? normalized as ProjectStatus : 'In Progress'
}

function timelineValue(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const row = item as PublicTimelineRow
    const occurredAt = new Date(text(row.occurred_at))
    const future = occurredAt.getTime() > Date.now()
    return {
      title: text(row.title, 'Pembaruan proyek'),
      description: text(row.description, 'Ada pembaruan pada proyek ini.'),
      date: Number.isNaN(occurredAt.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(occurredAt),
      time: Number.isNaN(occurredAt.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(occurredAt).replace('.', ':'),
      state: future ? 'next' : index === value.length - 1 ? 'current' : 'done',
      visibleToClient: true,
    }
  })
}

function taskStatusValue(value: unknown): TaskStatus {
  const normalized = text(value).split(/[ _]+/).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ')
  const allowed: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Completed']
  return allowed.includes(normalized as TaskStatus) ? normalized as TaskStatus : 'Todo'
}

function taskValue(value: unknown): PublicProjectTask[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item as PublicTaskRow
    return {
      name: text(row.name, 'Tugas proyek'),
      status: taskStatusValue(row.status),
      dueAt: text(row.due_at) || null,
      completedAt: text(row.completed_at) || null,
    }
  })
}

export async function loadPublicProject(accessKey: string, lookup: PublicProjectLookup = 'token'): Promise<PublicProjectSnapshot | null> {
  if (!supabase) return null
  const result = lookup === 'slug'
    ? await supabase.rpc('get_public_project_by_slug', { p_slug: accessKey })
    : lookup === 'code'
      ? await supabase.rpc('get_public_project_by_code', { p_code: accessKey })
      : await supabase.rpc('get_public_project', { p_token: accessKey })
  const { data, error } = result
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  const payload = data as PublicProjectPayload
  const name = text(payload.project_name)
  if (!name) return null
  const deadline = dateValue(payload.deadline)
  const progress = Number(payload.progress)
  const project: Project = {
    id: accessKey,
    code: 'Client portal',
    name,
    type: text(payload.project_type, 'Project'),
    client: text(payload.client_name, 'Klien'),
    status: statusValue(payload.current_status),
    priority: 'Medium',
    progress: Number.isFinite(progress) ? progress : 0,
    dueDate: deadline,
    startDate: dateValue(payload.start_date),
    estimatedValue: 0,
    paid: 0,
    description: text(payload.description, 'Tim sedang mengerjakan proyek ini.'),
    owner: 'Nayagement Studio',
    accent: accentOptions[[...accessKey].reduce((sum, character) => sum + character.charCodeAt(0), 0) % accentOptions.length],
    publicToken: lookup === 'token' ? accessKey : undefined,
    publicCode: lookup === 'code' ? accessKey : undefined,
    publicSlug: lookup === 'slug' ? accessKey : undefined,
  }
  return { project, timeline: timelineValue(payload.timeline), tasks: taskValue(payload.tasks) }
}

export interface PublicOrderForm {
  title: string
  description: string
  confirmationMessage: string
  headerImageUrl: string
  fields: PublicOrderFormField[]
}

export interface PublicOrderFormField {
  key: string
  label: string
  type: OrderFormFieldType
  options: string[]
  required: boolean
}

const publicOrderFieldTypes: OrderFormFieldType[] = ['text', 'email', 'phone', 'textarea', 'select', 'date', 'number', 'url']

function publicOrderField(value: unknown): PublicOrderFormField | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as { key?: unknown; label?: unknown; type?: unknown; options?: unknown; required?: unknown }
  const key = text(row.key).trim()
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(key)) return null
  const type = text(row.type)
  return {
    key,
    label: text(row.label, 'Pertanyaan'),
    type: publicOrderFieldTypes.includes(type as OrderFormFieldType) ? type as OrderFormFieldType : 'text',
    options: Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [],
    required: row.required === true,
  }
}

export async function loadPublicOrderForm(token: string): Promise<PublicOrderForm | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_public_order_form', { p_token: token })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  const payload = data as { title?: unknown; description?: unknown; confirmation_message?: unknown; header_image_url?: unknown; fields?: unknown }
  const title = text(payload.title)
  if (!title) return null
  return {
    title,
    description: text(payload.description, 'Ceritakan kebutuhan Anda agar kami dapat menyiapkan scope yang tepat.'),
    confirmationMessage: text(payload.confirmation_message, 'Terima kasih, brief Anda sudah kami terima.'),
    headerImageUrl: text(payload.header_image_url).trim(),
    fields: Array.isArray(payload.fields) ? payload.fields.map(publicOrderField).filter((field): field is PublicOrderFormField => Boolean(field)) : [],
  }
}

export async function submitPublicOrder(token: string, payload: Record<string, string>) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('submit_public_order', { p_token: token, p_payload: payload })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  const result = data as { message?: unknown }
  return text(result.message, 'Terima kasih, brief Anda sudah kami terima.')
}

export interface PublicConsultationSlot {
  id: string
  startsAt: string
  endsAt: string
}

export interface PublicConsultationBooking {
  title: string
  subtitle: string
  durationMinutes: number
  timezone: string
  instructions: string
  whatsappNumber: string
  slots: PublicConsultationSlot[]
}

export async function loadPublicConsultationBooking(): Promise<PublicConsultationBooking | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_public_consultation_booking')
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  const payload = data as { title?: unknown; subtitle?: unknown; duration_minutes?: unknown; timezone?: unknown; instructions?: unknown; whatsapp_number?: unknown; slots?: unknown }
  const slots = Array.isArray(payload.slots)
    ? payload.slots.map((value) => value as { id?: unknown; starts_at?: unknown; ends_at?: unknown }).filter((row) => typeof row.id === 'string' && typeof row.starts_at === 'string' && typeof row.ends_at === 'string').map((row) => ({ id: row.id as string, startsAt: row.starts_at as string, endsAt: row.ends_at as string }))
    : []
  const title = text(payload.title).trim()
  return title ? {
    title,
    subtitle: text(payload.subtitle, 'Pilih jadwal yang nyaman dan ceritakan hal yang ingin Anda konsultasikan.'),
    durationMinutes: Math.max(15, Number(payload.duration_minutes) || 60),
    timezone: text(payload.timezone, 'Asia/Makassar'),
    instructions: text(payload.instructions, ''),
    whatsappNumber: text(payload.whatsapp_number).replace(/\D/g, ''),
    slots,
  } : null
}

export async function submitPublicConsultationBooking(input: { slotId: string; name: string; email: string; whatsapp: string; topic: string; details: string }) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('submit_public_consultation_booking', {
    p_slot_id: input.slotId,
    p_name: input.name,
    p_email: input.email,
    p_whatsapp: input.whatsapp,
    p_topic: input.topic,
    p_details: input.details,
  })
  if (error) throw new Error(error.message)
  return data as { message?: unknown } | null
}
