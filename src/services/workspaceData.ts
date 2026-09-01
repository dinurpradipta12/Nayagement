import { initials } from '../lib/format'
import { requireSupabase } from '../lib/supabase'
import type { AppNotification, Client, ClientFormData, ClientProfileFormData, ConsultationBooking, ConsultationBookingStatus, ConsultationSettings, ConsultationSlot, ConsultationWeeklyAvailability, Invoice, InvoiceDocumentStatus, InvoiceEditorDraft, InvoiceLineItem, OrderForm, OrderFormDraft, OrderFormField, OrderFormFieldType, OrderSubmission, OrderSubmissionStatus, Project, ProjectFormData, ProjectPayment, ProjectPaymentInput, ProjectPriority, ProjectStatus, ServiceCatalog, ServiceCatalogInput, ServicePricingMode, ServiceQuote, ServiceQuoteDraft, ServiceQuoteItem, ServiceQuoteStatus, SettingsPreferences, SettingsProfile, SettingsSnapshot, SettingsWorkspace, Task, TaskAttachment, TaskDetailInput, TaskNote, TaskStatus, TelegramSettings, TimelineItem } from '../types'

export type CreateProjectInput = Pick<ProjectFormData, 'name' | 'client' | 'type' | 'dueDate' | 'priority' | 'value' | 'description'>
export type CreateClientInput = ClientFormData
export type UpdateClientProfileInput = ClientProfileFormData & { logoPath?: string | null }

export interface ProjectTaskInput {
  projectId: string
  name: string
  description?: string
  dueAt?: string
  priority: ProjectPriority
  visibleToClient: boolean
}

export type UpdateProjectTaskInput = TaskDetailInput

export interface ProjectTimelineInput {
  projectId: string
  title: string
  description?: string
  visibleToClient: boolean
}

export interface WorkspaceSnapshot {
  workspaceId: string
  projects: Project[]
  payments: ProjectPayment[]
  paymentHistorySupported: boolean
  tasks: Task[]
  clients: Client[]
  invoices: Invoice[]
  notifications: AppNotification[]
  orderSubmissions: OrderSubmission[]
  timelines: Record<string, TimelineItem[]>
}

type Relation<T> = T | T[] | null

interface ProjectRow {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  priority: string
  progress_percentage: number | string
  deadline: string | null
  start_date: string | null
  estimated_value: number | string
  payment_status: string
  paid_amount?: number | string | null
  client_id: string | null
  client: Relation<{ name: string; company: string | null }>
  project_type: Relation<{ name: string }>
  public_access: Relation<{
    public_token: string
    public_code?: string | null
    public_slug?: string | null
    is_enabled: boolean
  }>
}

interface TaskRow {
  id: string
  project_id: string
  name: string
  description: string | null
  brief?: string | null
  status: string
  priority: string
  due_at: string | null
  client_visible: boolean
  progress_percentage?: number | string | null
  project: Relation<{ name: string }>
}

interface TaskNoteRow {
  id: string
  task_id: string
  body: string
  created_at: string
}

interface TaskAttachmentRow {
  id: string
  task_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  file_size: number | string | null
  caption: string | null
  created_at: string
}

interface TimelineRow {
  id: string
  project_id: string
  title: string
  description: string | null
  occurred_at: string
  visibility: string
}

interface ClientRow {
  id: string
  name: string
  company: string | null
  whatsapp: string | null
  email?: string | null
  notes?: string | null
  description?: string | null
  logo_path?: string | null
  status: string
  created_at: string
}

interface InvoiceRow {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  total_amount: number | string
  status: string
  client_id: string | null
  project_id: string | null
  client: Relation<{ name: string; company: string | null }>
  project: Relation<{ name: string }>
}

interface InvoiceEditorItemRow {
  id: string
  description: string
  detail: string | null
  quantity: number | string
  unit_price: number | string
  sort_order: number
}

interface InvoiceEditorRow {
  id: string
  invoice_number: string
  client_id: string | null
  project_id: string | null
  issue_date: string
  due_date: string | null
  status: string
  currency: string
  discount_amount: number | string
  tax_rate: number | string
  payment_instructions: string | null
  notes: string | null
  document_title: string | null
  brand_color: string | null
  logo_path: string | null
  signature_path: string | null
  recipient_name: string | null
  recipient_company: string | null
  recipient_email: string | null
  recipient_whatsapp: string | null
  sender_name: string | null
  sender_email: string | null
  sender_phone: string | null
  sender_address: string | null
  terms: string | null
  footer_note: string | null
  client: Relation<{ name: string; company: string | null; email: string | null; whatsapp: string | null }>
  project: Relation<{ name: string }>
  items: Relation<InvoiceEditorItemRow>
}

interface ServiceCatalogRow {
  id: string
  name: string
  category: string
  description: string | null
  pricing_mode: string
  minimum_fee: number | string
  default_unit_label: string
  default_unit_price: number | string
  default_quantity: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ServiceQuoteItemRow {
  id: string
  catalog_id: string | null
  name: string
  detail: string | null
  pricing_mode: string
  quantity: number | string
  unit_label: string
  unit_price: number | string
  minimum_fee: number | string
  sort_order: number
}

interface ServiceQuoteRow {
  id: string
  quote_number: string
  title: string
  client_id: string | null
  project_id: string | null
  status: string
  currency: string
  issue_date: string
  valid_until: string | null
  subtotal: number | string
  discount_amount: number | string
  tax_rate: number | string
  tax_amount: number | string
  total_amount: number | string
  notes: string | null
  converted_invoice_id: string | null
  created_at: string
  updated_at: string
  items: Relation<ServiceQuoteItemRow>
}

interface SettingsProfileRow {
  id: string
  display_name: string
  full_name?: string | null
  username?: string | null
  phone?: string | null
  bio?: string | null
  role_title?: string | null
  avatar_url: string | null
  timezone?: string | null
  preferences?: unknown
  created_at: string
  updated_at: string
}

interface SettingsWorkspaceRow {
  id: string
  name: string
  description?: string | null
  logo_path?: string | null
  owner_id: string
  created_at: string
}

interface ProjectPaymentRow {
  id: string
  project_id: string
  amount: number | string
  paid_at: string
  method: string | null
  notes: string | null
  project: Relation<{
    name: string
    client: Relation<{ name: string; company: string | null }>
  }>
}

interface NotificationRow {
  id: string
  title: string
  body: string | null
  kind: string
  read_at: string | null
  created_at: string
}

interface OrderFormFieldRow {
  id: string
  field_key: string
  label: string
  field_type: string
  options: unknown
  is_required: boolean
  sort_order: number
}

interface OrderFormRow {
  id: string
  title: string
  description: string | null
  confirmation_message: string
  header_image_url?: string | null
  public_token: string
  is_active: boolean
  created_at: string
  fields: Relation<OrderFormFieldRow>
}

interface OrderSubmissionRow {
  id: string
  order_form_id: string
  project_id: string | null
  submitter_name: string
  submitter_email: string | null
  submitter_whatsapp: string | null
  payload: unknown
  status: string
  created_at: string
  order_form: Relation<{ title: string }>
  project: Relation<{ name: string }>
}

const accentOptions: Project['accent'][] = ['blue', 'violet', 'peach', 'mint', 'pink']
const orderFieldTypes: OrderFormFieldType[] = ['text', 'email', 'phone', 'textarea', 'select', 'date', 'number', 'url']
const orderSubmissionSelect = 'id, order_form_id, project_id, submitter_name, submitter_email, submitter_whatsapp, payload, status, created_at, order_form:order_forms(title), project:projects(name)'
const orderFormHeaderImageBucket = 'nayagement-order-headers'
const orderFormHeaderImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxOrderFormHeaderImageBytes = 5 * 1024 * 1024
const clientLogoBucket = 'client-logos'
const clientLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxClientLogoBytes = 5 * 1024 * 1024
const invoiceLogoBucket = 'invoice-logos'
const invoiceLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxInvoiceLogoBytes = 5 * 1024 * 1024
const maxInvoiceSignatureBytes = 3 * 1024 * 1024
const taskAttachmentBucket = 'task-attachments'
const taskAttachmentTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/zip', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const maxTaskAttachmentBytes = 15 * 1024 * 1024

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function titleCase(value: string) {
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function projectStatus(value: string): ProjectStatus {
  const normalized = titleCase(value)
  const allowed: ProjectStatus[] = ['Inquiry', 'Pending', 'Confirmed', 'In Progress', 'Review', 'Revision', 'Completed', 'Cancelled']
  return allowed.includes(normalized as ProjectStatus) ? normalized as ProjectStatus : 'Inquiry'
}

function projectPriority(value: string): ProjectPriority {
  const normalized = titleCase(value)
  const allowed: ProjectPriority[] = ['Low', 'Medium', 'High', 'Urgent']
  return allowed.includes(normalized as ProjectPriority) ? normalized as ProjectPriority : 'Medium'
}

function taskStatus(value: string): TaskStatus {
  const normalized = titleCase(value)
  const allowed: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Completed']
  return allowed.includes(normalized as TaskStatus) ? normalized as TaskStatus : 'Todo'
}

function hashIndex(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0) % accentOptions.length
}

function formatDate(value: string | null, fallback = 'Belum ditentukan') {
  if (!value) return fallback
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Baru saja'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} mnt`
  if (seconds < 86_400) return `${Math.max(1, Math.round(seconds / 3600))} jam`
  if (seconds < 172_800) return 'Kemarin'
  return `${Math.round(seconds / 86_400)} hari`
}

function formatTaskDue(value: string | null) {
  if (!value) return 'Belum dijadwalkan'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date).replace('.', ':')
}

function mapProject(row: ProjectRow): Project {
  const client = first(row.client)
  const type = first(row.project_type)
  const access = first(row.public_access)
  const accent = accentOptions[hashIndex(row.id)]
  const estimatedValue = numberValue(row.estimated_value)
  const inferredPaidAmount = row.payment_status === 'paid'
    ? estimatedValue
    : row.payment_status === 'partial'
      ? Math.round(estimatedValue / 2)
      : 0
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    code: row.code,
    name: row.name,
    type: type?.name ?? 'Project',
    client: client?.company ?? client?.name ?? 'Tanpa klien',
    status: projectStatus(row.status),
    priority: projectPriority(row.priority),
    progress: numberValue(row.progress_percentage),
    dueDate: row.deadline ?? new Date().toISOString().slice(0, 10),
    startDate: row.start_date ?? new Date().toISOString().slice(0, 10),
    estimatedValue,
    paid: row.paid_amount === undefined ? inferredPaidAmount : numberValue(row.paid_amount),
    description: row.description ?? 'Belum ada ringkasan proyek.',
    owner: 'Arunika',
    accent,
    publicToken: access?.is_enabled ? access.public_token : undefined,
    publicCode: access?.is_enabled ? access?.public_code ?? undefined : undefined,
    publicSlug: access?.is_enabled ? access?.public_slug ?? undefined : undefined,
  }
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    project: first(row.project)?.name ?? 'Proyek',
    due: formatTaskDue(row.due_at),
    dueAt: row.due_at,
    description: row.description ?? undefined,
    brief: row.brief ?? undefined,
    status: taskStatus(row.status),
    priority: projectPriority(row.priority),
    visibleToClient: row.client_visible,
    progress: Math.min(100, Math.max(0, numberValue(row.progress_percentage))),
  }
}

function mapTaskNote(row: TaskNoteRow): TaskNote {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
  }
}

function mapTaskAttachment(row: TaskAttachmentRow, url?: string): TaskAttachment {
  return {
    id: row.id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type ?? 'application/octet-stream',
    fileSize: numberValue(row.file_size),
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
    url,
  }
}

function mapInvoice(row: InvoiceRow): Invoice {
  const documentStatus = invoiceDocumentStatus(row.status)
  const status = documentStatus === 'Paid' ? 'Paid' : documentStatus === 'DP' ? 'Partial' : 'Unpaid'
  return {
    id: row.id,
    number: row.invoice_number,
    clientId: row.client_id ?? undefined,
    projectId: row.project_id ?? undefined,
    client: first(row.client)?.company ?? first(row.client)?.name ?? 'Tanpa klien',
    project: first(row.project)?.name ?? 'Tanpa proyek',
    issuedDate: formatDate(row.issue_date),
    dueDate: formatDate(row.due_date),
    amount: numberValue(row.total_amount),
    status,
    documentStatus,
  }
}

function invoiceDocumentStatus(value: string): InvoiceDocumentStatus {
  const normalized = value === 'partial' || value === 'sent' ? 'DP' : titleCase(value) as InvoiceDocumentStatus
  const allowed: InvoiceDocumentStatus[] = ['Draft', 'DP', 'Paid', 'Overdue', 'Void']
  return allowed.includes(normalized) ? normalized : 'Draft'
}

function invoiceStatusValue(value: InvoiceDocumentStatus) {
  return value === 'DP' ? 'sent' : enumValue(value)
}

function invoiceLogoUrl(path?: string | null) {
  if (!path) return undefined
  return requireSupabase().storage.from(invoiceLogoBucket).getPublicUrl(path).data.publicUrl
}

function mapInvoiceEditor(row: InvoiceEditorRow): InvoiceEditorDraft {
  const client = first(row.client)
  const project = first(row.project)
  const items = (Array.isArray(row.items) ? row.items : row.items ? [row.items] : [])
    .sort((left, right) => left.sort_order - right.sort_order)
    .map<InvoiceLineItem>((item) => ({
      id: item.id,
      description: item.description,
      detail: item.detail ?? '',
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
    }))
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id ?? '',
    projectId: row.project_id ?? '',
    issueDate: row.issue_date,
    dueDate: row.due_date ?? row.issue_date,
    status: invoiceDocumentStatus(row.status),
    currency: row.currency || 'IDR',
    documentTitle: row.document_title || 'Invoice',
    brandColor: row.brand_color || '#30343b',
    logoPath: row.logo_path ?? undefined,
    logoUrl: invoiceLogoUrl(row.logo_path),
    signaturePath: row.signature_path ?? undefined,
    signatureUrl: invoiceLogoUrl(row.signature_path),
    recipientName: row.recipient_name || client?.name || '',
    recipientCompany: row.recipient_company || client?.company || '',
    recipientEmail: row.recipient_email || client?.email || '',
    recipientWhatsapp: row.recipient_whatsapp || client?.whatsapp || '',
    senderName: row.sender_name || 'Nayagement Studio',
    senderEmail: row.sender_email || '',
    senderPhone: row.sender_phone || '',
    senderAddress: row.sender_address || '',
    paymentInstructions: row.payment_instructions || '',
    notes: row.notes || '',
    terms: row.terms || '',
    footerNote: row.footer_note || '',
    taxRate: numberValue(row.tax_rate),
    discountAmount: numberValue(row.discount_amount),
    items: items.length ? items : [{ description: project?.name || 'Layanan kreatif', detail: '', quantity: 1, unitPrice: 0 }],
  }
}

const servicePricingModes: ServicePricingMode[] = ['Fixed', 'Per Hour', 'Per Unit', 'Package']
const serviceQuoteStatuses: ServiceQuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Expired', 'Converted']

function servicePricingMode(value: string): ServicePricingMode {
  const normalized = value === 'per_hour'
    ? 'Per Hour'
    : value === 'per_unit'
      ? 'Per Unit'
      : value === 'package'
        ? 'Package'
        : 'Fixed'
  return servicePricingModes.includes(normalized) ? normalized : 'Fixed'
}

function servicePricingModeValue(value: ServicePricingMode) {
  return value === 'Per Hour'
    ? 'per_hour'
    : value === 'Per Unit'
      ? 'per_unit'
      : value === 'Package'
        ? 'package'
        : 'fixed'
}

function serviceQuoteStatus(value: string): ServiceQuoteStatus {
  const normalized = titleCase(value) as ServiceQuoteStatus
  return serviceQuoteStatuses.includes(normalized) ? normalized : 'Draft'
}

function serviceQuoteStatusValue(value: ServiceQuoteStatus) {
  return enumValue(value)
}

function mapServiceCatalog(row: ServiceCatalogRow): ServiceCatalog {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    pricingMode: servicePricingMode(row.pricing_mode),
    minimumFee: numberValue(row.minimum_fee),
    defaultUnitLabel: row.default_unit_label || 'paket',
    defaultUnitPrice: numberValue(row.default_unit_price),
    defaultQuantity: Math.max(0.01, numberValue(row.default_quantity) || 1),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapServiceQuoteItem(row: ServiceQuoteItemRow): ServiceQuoteItem {
  return {
    id: row.id,
    catalogId: row.catalog_id ?? undefined,
    name: row.name,
    detail: row.detail ?? '',
    pricingMode: servicePricingMode(row.pricing_mode),
    quantity: Math.max(0.01, numberValue(row.quantity) || 1),
    unitLabel: row.unit_label || 'paket',
    unitPrice: numberValue(row.unit_price),
    minimumFee: numberValue(row.minimum_fee),
  }
}

function mapServiceQuote(row: ServiceQuoteRow): ServiceQuote {
  const items = (Array.isArray(row.items) ? row.items : row.items ? [row.items] : [])
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(mapServiceQuoteItem)
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    title: row.title,
    clientId: row.client_id ?? '',
    projectId: row.project_id ?? '',
    status: serviceQuoteStatus(row.status),
    currency: row.currency || 'IDR',
    issueDate: row.issue_date,
    validUntil: row.valid_until ?? '',
    subtotal: numberValue(row.subtotal),
    discountAmount: numberValue(row.discount_amount),
    taxRate: numberValue(row.tax_rate),
    taxAmount: numberValue(row.tax_amount),
    totalAmount: numberValue(row.total_amount),
    notes: row.notes ?? '',
    convertedInvoiceId: row.converted_invoice_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  }
}

function mapProjectPayment(row: ProjectPaymentRow): ProjectPayment {
  const project = first(row.project)
  const client = first(project?.client ?? null)
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: project?.name ?? 'Proyek',
    client: client?.company ?? client?.name ?? 'Tanpa klien',
    amount: numberValue(row.amount),
    paidAt: row.paid_at,
    method: row.method ?? undefined,
    notes: row.notes ?? undefined,
  }
}

function clientLogoUrl(path?: string | null) {
  if (!path) return undefined
  return requireSupabase().storage.from(clientLogoBucket).getPublicUrl(path).data.publicUrl
}

function mapClient(row: ClientRow, projects = 0, revenue = 0): Client {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? row.name,
    email: row.email ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    logoPath: row.logo_path ?? undefined,
    logoUrl: clientLogoUrl(row.logo_path),
    initials: initials(row.company ?? row.name),
    status: titleCase(row.status) as Client['status'],
    projects,
    revenue,
    lastOrder: formatDate(row.created_at),
    accent: accentOptions[hashIndex(row.id)],
  }
}

function mapNotification(row: NotificationRow): AppNotification {
  const allowedKinds: AppNotification['kind'][] = ['project', 'task', 'order', 'finance', 'deadline', 'client', 'system']
  const kind = allowedKinds.includes(row.kind as AppNotification['kind']) ? row.kind as AppNotification['kind'] : 'system'
  return {
    id: row.id,
    title: row.title,
    detail: row.body ?? 'Ada pembaruan di workspace Anda.',
    time: relativeTime(row.created_at),
    unread: !row.read_at,
    kind,
  }
}

function orderFieldType(value: string): OrderFormFieldType {
  return orderFieldTypes.includes(value as OrderFormFieldType) ? value as OrderFormFieldType : 'text'
}

function optionsValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
}

function payloadValue(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((output, [key, item]) => {
    if (typeof item === 'string') output[key] = item
    else if (typeof item === 'number' || typeof item === 'boolean') output[key] = String(item)
    return output
  }, {})
}

function submissionStatus(value: string): OrderSubmissionStatus {
  const normalized = titleCase(value) as OrderSubmissionStatus
  const allowed: OrderSubmissionStatus[] = ['New', 'Reviewing', 'Accepted', 'Rejected', 'Converted']
  return allowed.includes(normalized) ? normalized : 'New'
}

function mapOrderForm(row: OrderFormRow, headerImageSupported = Object.prototype.hasOwnProperty.call(row, 'header_image_url')): OrderForm {
  const fieldRows = Array.isArray(row.fields) ? row.fields : row.fields ? [row.fields] : []
  const fields = fieldRows
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((field) => ({
      id: field.id,
      key: field.field_key,
      label: field.label,
      type: orderFieldType(field.field_type),
      options: optionsValue(field.options),
      required: field.is_required,
      sortOrder: field.sort_order,
    }))
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    confirmationMessage: row.confirmation_message,
    headerImageUrl: row.header_image_url ?? '',
    headerImageSupported,
    publicToken: row.public_token,
    isActive: row.is_active,
    createdAt: row.created_at,
    fields,
  }
}

function mapOrderSubmission(row: OrderSubmissionRow): OrderSubmission {
  return {
    id: row.id,
    orderFormId: row.order_form_id,
    orderFormTitle: first(row.order_form)?.title ?? 'Form order',
    projectId: row.project_id ?? undefined,
    projectName: first(row.project)?.name,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email ?? undefined,
    submitterWhatsapp: row.submitter_whatsapp ?? undefined,
    payload: payloadValue(row.payload),
    status: submissionStatus(row.status),
    createdAt: row.created_at,
  }
}

function mapTimelineItem(row: TimelineRow, index: number, total: number): TimelineItem {
  const date = new Date(row.occurred_at)
  const inFuture = date.getTime() > Date.now()
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? 'Pembaruan proyek.',
    date: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date),
    time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date).replace('.', ':'),
    occurredAt: row.occurred_at,
    state: inFuture ? 'next' : index === total - 1 ? 'current' : 'done',
    visibleToClient: row.visibility === 'client',
  }
}

function mapTimelines(rows: TimelineRow[]) {
  const output: Record<string, TimelineItem[]> = {}
  const grouped = new Map<string, TimelineRow[]>()
  rows.forEach((row) => grouped.set(row.project_id, [...(grouped.get(row.project_id) ?? []), row]))
  grouped.forEach((items, projectId) => {
    output[projectId] = items.map((row, index) => mapTimelineItem(row, index, items.length))
  })
  return output
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const settingsAssetBucket = 'nayagement-settings'
const settingsImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxSettingsImageBytes = 5 * 1024 * 1024

function settingsDefaults(): SettingsPreferences {
  return {
    theme: 'light', accentColor: 'blue', sidebarMode: 'Expanded', density: 'Comfortable',
    showBreadcrumbs: true, showPageDescriptions: true, defaultLandingPage: 'Dashboard', dashboardTaskView: 'List',
    showOverdueTasks: true, showCompletedTasks: true, largerText: false, reduceAnimations: false, highContrast: false,
    inAppNotifications: true, browserNotifications: false, emailNotifications: false, taskReminder: true,
    taskCompleted: false, taskOverdue: true, deadlineReminder: true, reminderIntervals: ['1 day', '3 days', '7 days'],
    dailySummary: false, dailySummaryTime: '08:30', weeklySummary: false, weeklySummaryDay: 'Monday', weeklySummaryTime: '09:00',
    loginNotification: true, newDeviceNotification: true, suspiciousLoginAlert: true,
  }
}

function workspaceSettingsDefaults(timezone: string, name: string, ownerName: string): SettingsWorkspace {
  return {
    name: name || 'Workspace Anda', description: '', ownerName,
    defaultPriority: 'Medium', defaultStatus: 'Todo', defaultTaskView: 'List', defaultReminder: '1 day',
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
    dateFormat: 'DD/MM/YYYY', timeFormat: '24 hour', firstDayOfWeek: 'Monday',
    autoMarkOverdue: true, showCompletedTasks: true, autoArchiveCompleted: false, confirmBeforeDelete: true,
    workDayStart: '09:00', workDayEnd: '17:00', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  }
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function arrayStringValue(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fallback
}

function settingsPreferencesValue(value: unknown): SettingsPreferences {
  const input = recordValue(value)
  const defaults = settingsDefaults()
  return {
    ...defaults,
    theme: ['light', 'dark', 'system'].includes(stringValue(input.theme)) ? stringValue(input.theme) as SettingsPreferences['theme'] : defaults.theme,
    accentColor: ['blue', 'purple', 'green', 'orange'].includes(stringValue(input.accentColor)) ? stringValue(input.accentColor) as SettingsPreferences['accentColor'] : defaults.accentColor,
    sidebarMode: ['Expanded', 'Collapsed'].includes(stringValue(input.sidebarMode)) ? stringValue(input.sidebarMode) as SettingsPreferences['sidebarMode'] : defaults.sidebarMode,
    density: ['Comfortable', 'Compact'].includes(stringValue(input.density)) ? stringValue(input.density) as SettingsPreferences['density'] : defaults.density,
    defaultLandingPage: ['Dashboard', 'My Tasks', 'Calendar'].includes(stringValue(input.defaultLandingPage)) ? stringValue(input.defaultLandingPage) as SettingsPreferences['defaultLandingPage'] : defaults.defaultLandingPage,
    dashboardTaskView: ['List', 'Board', 'Calendar'].includes(stringValue(input.dashboardTaskView)) ? stringValue(input.dashboardTaskView) as SettingsPreferences['dashboardTaskView'] : defaults.dashboardTaskView,
    weeklySummaryDay: ['Monday', 'Sunday'].includes(stringValue(input.weeklySummaryDay)) ? stringValue(input.weeklySummaryDay) as SettingsPreferences['weeklySummaryDay'] : defaults.weeklySummaryDay,
    showBreadcrumbs: booleanValue(input.showBreadcrumbs, defaults.showBreadcrumbs), showPageDescriptions: booleanValue(input.showPageDescriptions, defaults.showPageDescriptions),
    showOverdueTasks: booleanValue(input.showOverdueTasks, defaults.showOverdueTasks), showCompletedTasks: booleanValue(input.showCompletedTasks, defaults.showCompletedTasks),
    largerText: booleanValue(input.largerText, defaults.largerText), reduceAnimations: booleanValue(input.reduceAnimations, defaults.reduceAnimations), highContrast: booleanValue(input.highContrast, defaults.highContrast),
    inAppNotifications: booleanValue(input.inAppNotifications, defaults.inAppNotifications), browserNotifications: booleanValue(input.browserNotifications, defaults.browserNotifications), emailNotifications: booleanValue(input.emailNotifications, defaults.emailNotifications),
    taskReminder: booleanValue(input.taskReminder, defaults.taskReminder), taskCompleted: booleanValue(input.taskCompleted, defaults.taskCompleted), taskOverdue: booleanValue(input.taskOverdue, defaults.taskOverdue), deadlineReminder: booleanValue(input.deadlineReminder, defaults.deadlineReminder),
    reminderIntervals: arrayStringValue(input.reminderIntervals, defaults.reminderIntervals), dailySummary: booleanValue(input.dailySummary, defaults.dailySummary),
    dailySummaryTime: stringValue(input.dailySummaryTime, defaults.dailySummaryTime), weeklySummary: booleanValue(input.weeklySummary, defaults.weeklySummary), weeklySummaryTime: stringValue(input.weeklySummaryTime, defaults.weeklySummaryTime),
    loginNotification: booleanValue(input.loginNotification, defaults.loginNotification), newDeviceNotification: booleanValue(input.newDeviceNotification, defaults.newDeviceNotification), suspiciousLoginAlert: booleanValue(input.suspiciousLoginAlert, defaults.suspiciousLoginAlert),
  }
}

function workspaceSettingsValue(value: unknown, timezone: string, name: string, ownerName: string): SettingsWorkspace {
  const input = recordValue(value)
  const defaults = workspaceSettingsDefaults(timezone, name, ownerName)
  return {
    ...defaults,
    defaultPriority: ['Low', 'Medium', 'High', 'Urgent'].includes(stringValue(input.defaultPriority)) ? stringValue(input.defaultPriority) as ProjectPriority : defaults.defaultPriority,
    defaultStatus: ['Todo', 'In Progress', 'Review', 'Completed'].includes(stringValue(input.defaultStatus)) ? stringValue(input.defaultStatus) as TaskStatus : defaults.defaultStatus,
    defaultTaskView: ['List', 'Board', 'Calendar'].includes(stringValue(input.defaultTaskView)) ? stringValue(input.defaultTaskView) as SettingsWorkspace['defaultTaskView'] : defaults.defaultTaskView,
    defaultReminder: stringValue(input.defaultReminder, defaults.defaultReminder), timezone: stringValue(input.timezone, defaults.timezone),
    dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(stringValue(input.dateFormat)) ? stringValue(input.dateFormat) as SettingsWorkspace['dateFormat'] : defaults.dateFormat,
    timeFormat: ['12 hour', '24 hour'].includes(stringValue(input.timeFormat)) ? stringValue(input.timeFormat) as SettingsWorkspace['timeFormat'] : defaults.timeFormat,
    firstDayOfWeek: ['Monday', 'Sunday'].includes(stringValue(input.firstDayOfWeek)) ? stringValue(input.firstDayOfWeek) as SettingsWorkspace['firstDayOfWeek'] : defaults.firstDayOfWeek,
    autoMarkOverdue: booleanValue(input.autoMarkOverdue, defaults.autoMarkOverdue), showCompletedTasks: booleanValue(input.showCompletedTasks, defaults.showCompletedTasks), autoArchiveCompleted: booleanValue(input.autoArchiveCompleted, defaults.autoArchiveCompleted), confirmBeforeDelete: booleanValue(input.confirmBeforeDelete, defaults.confirmBeforeDelete),
    workDayStart: stringValue(input.workDayStart, defaults.workDayStart), workDayEnd: stringValue(input.workDayEnd, defaults.workDayEnd), workingDays: arrayStringValue(input.workingDays, defaults.workingDays),
  }
}

function enumValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, '_')
}

function isMissingProjectField(error: { code?: string; message?: string } | null, field: 'public_code' | 'public_slug' | 'paid_amount') {
  if (!error) return false
  return new RegExp('\\b' + field + '\\b', 'i').test(error.message ?? '')
}

function isMissingOrderFormHeaderImage(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\bheader_image_url\b/i.test(error.message ?? '')
}

function isMissingTaskDetailSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\b(progress_percentage|brief|project_task_notes|project_task_attachments)\b/i.test(error.message ?? '')
}

function isMissingClientProfileField(error: { code?: string; message?: string } | null, field: 'description' | 'logo_path') {
  if (!error) return false
  return new RegExp('\\b' + field + '\\b', 'i').test(error.message ?? '')
}

function isMissingPaymentHistorySchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\b(project_payment_records|record_project_payment)\b/i.test(error.message ?? '')
}

function isMissingInvoiceEditorSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\b(document_title|brand_color|logo_path|signature_path|recipient_name|recipient_company|recipient_email|recipient_whatsapp|sender_name|sender_email|sender_phone|sender_address|terms|footer_note|detail|invoice-logos)\b/i.test(error.message ?? '')
}

function isMissingServiceCalculatorSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\b(service_catalogs|service_quotes|service_quote_items|pricing_mode|minimum_fee|converted_invoice_id)\b/i.test(error.message ?? '')
}

function paymentHistorySetupError() {
  return new Error('Riwayat pembayaran belum disiapkan di database. Jalankan SQL pembaruan Finance terlebih dahulu.')
}

function invoiceEditorSetupError() {
  return new Error('Editor invoice belum disiapkan di database. Jalankan SQL pembaruan invoice terlebih dahulu.')
}

function serviceCalculatorSetupError() {
  return new Error('Kalkulator jasa belum disiapkan di database. Jalankan SQL Kalkulator & penawaran terlebih dahulu.')
}

function taskDetailSetupError() {
  return new Error('Detail tugas belum disiapkan di database. Jalankan SQL pembaruan detail task terlebih dahulu.')
}

function clientProfileSetupError() {
  return new Error('Profil klien belum disiapkan di database. Jalankan SQL pembaruan profil klien terlebih dahulu.')
}

function clientLogoFileError(file: File) {
  if (!clientLogoTypes.has(file.type)) return 'Gunakan gambar JPG, PNG, atau WebP untuk logo klien.'
  if (file.size > maxClientLogoBytes) return 'Ukuran logo klien maksimal 5 MB.'
  return ''
}

function clientLogoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clientLogoFileName(file: File) {
  const normalized = file.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return (normalized || `logo-${clientLogoId()}`).slice(0, 150)
}

function invoiceLogoFileError(file: File) {
  if (!invoiceLogoTypes.has(file.type)) return 'Gunakan gambar JPG, PNG, atau WebP untuk logo invoice.'
  if (file.size > maxInvoiceLogoBytes) return 'Ukuran logo invoice maksimal 5 MB.'
  return ''
}

function invoiceSignatureFileError(file: File) {
  if (file.type !== 'image/png') return 'Gunakan file PNG transparan untuk tanda tangan invoice.'
  if (file.size > maxInvoiceSignatureBytes) return 'Ukuran tanda tangan invoice maksimal 3 MB.'
  return ''
}

function taskAttachmentFileError(file: File) {
  if (!taskAttachmentTypes.has(file.type)) return 'Gunakan gambar, PDF, dokumen Office, TXT, atau ZIP untuk lampiran task.'
  if (file.size > maxTaskAttachmentBytes) return 'Ukuran lampiran task maksimal 15 MB.'
  return ''
}

function taskAttachmentId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function taskAttachmentFileName(file: File) {
  const normalized = file.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return (normalized || `lampiran-${taskAttachmentId()}`).slice(0, 150)
}

const projectSelect = (includePublicCode: boolean, includePublicSlug: boolean, includePaidAmount: boolean) => [
  'id, code, name, description, status, priority, progress_percentage, deadline, start_date, estimated_value, payment_status, client_id' + (includePaidAmount ? ', paid_amount' : ''),
  'client:clients(name, company)',
  'project_type:project_types(name)',
  'public_access:project_public_access(' + [
    'public_token',
    includePublicCode ? 'public_code' : '',
    includePublicSlug ? 'public_slug' : '',
    'is_enabled',
  ].filter(Boolean).join(', ') + ')',
].join(', ')

async function loadProjectRows(workspaceId: string): Promise<ProjectRow[]> {
  const client = requireSupabase()
  let includePublicCode = true
  let includePublicSlug = true
  let includePaidAmount = true
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await client
      .from('projects')
      .select(projectSelect(includePublicCode, includePublicSlug, includePaidAmount))
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
    if (!result.error) return (result.data ?? []) as unknown as ProjectRow[]
    if (includePaidAmount && isMissingProjectField(result.error, 'paid_amount')) {
      includePaidAmount = false
      continue
    }
    if (includePublicSlug && isMissingProjectField(result.error, 'public_slug')) {
      includePublicSlug = false
      continue
    }
    if (includePublicCode && isMissingProjectField(result.error, 'public_code')) {
      includePublicCode = false
      continue
    }
    throwIfError(result.error)
  }
  throw new Error('Kolom akses portal tidak dapat dimuat.')
}

const clientSelect = (includeDescription: boolean, includeLogoPath: boolean) => [
  'id, name, company, email, whatsapp, notes, status, created_at',
  includeDescription ? 'description' : '',
  includeLogoPath ? 'logo_path' : '',
].filter(Boolean).join(', ')

async function loadWorkspaceClients(workspaceId: string): Promise<ClientRow[]> {
  const client = requireSupabase()
  let includeDescription = true
  let includeLogoPath = true
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await client
      .from('clients')
      .select(clientSelect(includeDescription, includeLogoPath))
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (!result.error) return (result.data ?? []) as unknown as ClientRow[]
    if (includeDescription && isMissingClientProfileField(result.error, 'description')) {
      includeDescription = false
      continue
    }
    if (includeLogoPath && isMissingClientProfileField(result.error, 'logo_path')) {
      includeLogoPath = false
      continue
    }
    throwIfError(result.error)
  }
  throw new Error('Data profil klien tidak dapat dimuat.')
}

async function loadWorkspaceProjectPayments(workspaceId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_payment_records')
    .select('id, project_id, amount, paid_at, method, notes, project:projects(name, client:clients(name, company))')
    .eq('workspace_id', workspaceId)
    .order('paid_at', { ascending: false })
  if (isMissingPaymentHistorySchema(error)) return { rows: [] as ProjectPaymentRow[], supported: false }
  throwIfError(error)
  return { rows: (data ?? []) as unknown as ProjectPaymentRow[], supported: true }
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const client = requireSupabase()
  const { data: authData, error: authError } = await client.auth.getUser()
  throwIfError(authError)
  if (!authData.user) throw new Error('Sesi Anda tidak ditemukan. Silakan masuk kembali.')

  const { data: membership, error: membershipError } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', authData.user.id)
    .limit(1)
    .single()
  throwIfError(membershipError)
  if (!membership?.workspace_id) throw new Error('Workspace untuk akun ini belum tersedia.')
  const workspaceId = membership.workspace_id as string

  const [projectRows, tasksResult, timelinesResult, clientRows, invoicesResult, notificationsResult, orderSubmissionsResult, projectPayments] = await Promise.all([
    loadProjectRows(workspaceId),
    client.from('project_tasks').select('*, project:projects(name)').eq('workspace_id', workspaceId).order('due_at', { ascending: true, nullsFirst: false }),
    client.from('project_timeline').select('id, project_id, title, description, occurred_at, visibility').eq('workspace_id', workspaceId).order('occurred_at', { ascending: true }),
    loadWorkspaceClients(workspaceId),
    client.from('invoices').select('id, invoice_number, issue_date, due_date, total_amount, status, client_id, project_id, client:clients(name, company), project:projects(name)').eq('workspace_id', workspaceId).order('issue_date', { ascending: false }),
    client.from('notifications').select('id, title, body, kind, read_at, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    client.from('order_submissions').select(orderSubmissionSelect).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    loadWorkspaceProjectPayments(workspaceId),
  ])

  throwIfError(tasksResult.error)
  throwIfError(timelinesResult.error)
  throwIfError(invoicesResult.error)
  throwIfError(notificationsResult.error)
  throwIfError(orderSubmissionsResult.error)

  const invoiceRows = (invoicesResult.data ?? []) as unknown as InvoiceRow[]
  const invoices = invoiceRows.map(mapInvoice)
  const revenueByClient = new Map<string, number>()
  invoiceRows.forEach((invoice) => {
    if (invoice.client_id) revenueByClient.set(invoice.client_id, (revenueByClient.get(invoice.client_id) ?? 0) + numberValue(invoice.total_amount))
  })
  const projectCountByClient = new Map<string, number>()
  projectRows.forEach((project) => {
    if (project.client_id) projectCountByClient.set(project.client_id, (projectCountByClient.get(project.client_id) ?? 0) + 1)
  })
  const clients = clientRows.map((row) => mapClient(
    row,
    projectCountByClient.get(row.id) ?? 0,
    revenueByClient.get(row.id) ?? 0,
  ))

  return {
    workspaceId,
    projects: projectRows.map(mapProject),
    payments: projectPayments.rows.map(mapProjectPayment),
    paymentHistorySupported: projectPayments.supported,
    tasks: ((tasksResult.data ?? []) as unknown as TaskRow[]).map(mapTask),
    clients,
    invoices,
    notifications: ((notificationsResult.data ?? []) as unknown as NotificationRow[]).map(mapNotification),
    orderSubmissions: ((orderSubmissionsResult.data ?? []) as unknown as OrderSubmissionRow[]).map(mapOrderSubmission),
    timelines: mapTimelines((timelinesResult.data ?? []) as unknown as TimelineRow[]),
  }
}

export interface WorkspaceOrderData {
  forms: OrderForm[]
  submissions: OrderSubmission[]
}

const orderFormSelect = (includeHeaderImage: boolean) => [
  'id, title, description, confirmation_message, public_token, is_active, created_at',
  includeHeaderImage ? 'header_image_url' : '',
  'fields:order_form_fields(id, field_key, label, field_type, options, is_required, sort_order)',
].filter(Boolean).join(', ')

function orderFormHeaderImageExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function orderFormHeaderImageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function uploadWorkspaceOrderFormHeaderImage(workspaceId: string, formId: string, file: File) {
  if (!orderFormHeaderImageTypes.has(file.type)) throw new Error('Gunakan gambar JPG, PNG, atau WebP untuk header form.')
  if (file.size > maxOrderFormHeaderImageBytes) throw new Error('Ukuran gambar header maksimal 5 MB.')

  const client = requireSupabase()
  const path = `${workspaceId}/${formId}/${orderFormHeaderImageId()}.${orderFormHeaderImageExtension(file)}`
  const { error } = await client.storage
    .from(orderFormHeaderImageBucket)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })
  if (error) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error.message)) {
      throw new Error('Penyimpanan gambar header belum aktif. Jalankan SQL pembaruan gambar header terlebih dahulu.')
    }
    throw new Error(error.message)
  }

  const { data } = client.storage.from(orderFormHeaderImageBucket).getPublicUrl(path)
  if (!data.publicUrl) throw new Error('Gambar header tidak dapat dipublikasikan.')
  return data.publicUrl
}

function formFieldRows(workspaceId: string, orderFormId: string, fields: OrderFormField[]) {
  return fields.map((field, index) => ({
    workspace_id: workspaceId,
    order_form_id: orderFormId,
    field_key: field.key.trim(),
    label: field.label.trim(),
    field_type: field.type,
    options: field.type === 'select' ? optionsValue(field.options) : [],
    is_required: field.required,
    sort_order: index,
  }))
}

async function loadOrderFormRows(workspaceId: string, formId?: string) {
  const client = requireSupabase()
  let includeHeaderImage = true
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = formId
      ? await client
        .from('order_forms')
        .select(orderFormSelect(includeHeaderImage))
        .eq('workspace_id', workspaceId)
        .eq('id', formId)
      : await client
        .from('order_forms')
        .select(orderFormSelect(includeHeaderImage))
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
    if (!result.error) {
      return {
        rows: (result.data ?? []) as unknown as OrderFormRow[],
        headerImageSupported: includeHeaderImage,
      }
    }
    if (includeHeaderImage && isMissingOrderFormHeaderImage(result.error)) {
      includeHeaderImage = false
      continue
    }
    throwIfError(result.error)
  }
  throw new Error('Data form order tidak dapat dimuat.')
}

async function loadWorkspaceOrderForm(workspaceId: string, formId: string) {
  const data = await loadOrderFormRows(workspaceId, formId)
  const form = data.rows[0]
  if (!form) throw new Error('Form order tidak ditemukan.')
  return mapOrderForm(form, data.headerImageSupported)
}

export async function loadWorkspaceOrderData(workspaceId: string): Promise<WorkspaceOrderData> {
  const client = requireSupabase()
  const [formsData, submissionsResult] = await Promise.all([
    loadOrderFormRows(workspaceId),
    client
      .from('order_submissions')
      .select(orderSubmissionSelect)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
  ])
  throwIfError(submissionsResult.error)
  return {
    forms: formsData.rows.map((form) => mapOrderForm(form, formsData.headerImageSupported)),
    submissions: ((submissionsResult.data ?? []) as unknown as OrderSubmissionRow[]).map(mapOrderSubmission),
  }
}

export async function createWorkspaceOrderForm(workspaceId: string, draft: OrderFormDraft) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('order_forms')
    .insert({
      workspace_id: workspaceId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      confirmation_message: draft.confirmationMessage.trim(),
      is_active: draft.isActive,
    })
    .select('id')
    .single()
  throwIfError(error)
  const formId = data?.id as string | undefined
  if (!formId) throw new Error('Form order tidak dapat dibuat.')
  try {
    const fields = formFieldRows(workspaceId, formId, draft.fields)
    if (fields.length) {
      const { error: fieldsError } = await client.from('order_form_fields').insert(fields)
      throwIfError(fieldsError)
    }
    return await loadWorkspaceOrderForm(workspaceId, formId)
  } catch (error) {
    await client.from('order_forms').delete().eq('workspace_id', workspaceId).eq('id', formId)
    throw error
  }
}

export async function updateWorkspaceOrderForm(workspaceId: string, formId: string, draft: OrderFormDraft, headerImageSupported = false) {
  const client = requireSupabase()
  if (draft.headerImageUrl.trim() && !headerImageSupported) {
    throw new Error('Pengaturan gambar header belum aktif di database. Jalankan SQL pembaruan gambar header terlebih dahulu.')
  }
  const changes: Record<string, string | boolean | null> = {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    confirmation_message: draft.confirmationMessage.trim(),
    is_active: draft.isActive,
  }
  if (headerImageSupported) changes.header_image_url = draft.headerImageUrl.trim() || null
  const { error } = await client
    .from('order_forms')
    .update(changes)
    .eq('workspace_id', workspaceId)
    .eq('id', formId)
  if (isMissingOrderFormHeaderImage(error)) {
    throw new Error('Pengaturan gambar header belum aktif di database. Jalankan SQL pembaruan gambar header terlebih dahulu.')
  }
  throwIfError(error)

  const { error: deleteError } = await client
    .from('order_form_fields')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('order_form_id', formId)
  throwIfError(deleteError)

  const fields = formFieldRows(workspaceId, formId, draft.fields)
  if (fields.length) {
    const { error: fieldsError } = await client.from('order_form_fields').insert(fields)
    throwIfError(fieldsError)
  }
  return await loadWorkspaceOrderForm(workspaceId, formId)
}

export async function deleteWorkspaceOrderForm(workspaceId: string, formId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('order_forms')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', formId)
    .select('id')
  if (error) {
    if (/order_submissions|foreign key/i.test(error.message)) {
      throw new Error('Form ini masih memiliki order tersimpan. Nonaktifkan form untuk menghentikan order baru tanpa menghapus riwayat.')
    }
    throw new Error(error.message)
  }
  if (!data?.length) throw new Error('Form order tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.')
}

export async function updateWorkspaceOrderSubmissionStatus(id: string, status: OrderSubmissionStatus) {
  const client = requireSupabase()
  const { error } = await client
    .from('order_submissions')
    .update({ status: status.toLowerCase() })
    .eq('id', id)
  throwIfError(error)
}

export async function deleteWorkspaceOrderSubmission(workspaceId: string, submissionId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('order_submissions')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', submissionId)
    .select('id')
  throwIfError(error)
  if (!data?.length) throw new Error('Brief tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.')
}

type ConsultationSettingsRow = {
  workspace_id: string
  title: string | null
  subtitle: string | null
  duration_minutes: number | string | null
  timezone: string | null
  instructions: string | null
  whatsapp_number?: string | null
  is_public: boolean | null
}

type ConsultationSlotRow = {
  id: string
  workspace_id: string
  starts_at: string
  ends_at: string
  is_active: boolean
}

type ConsultationBookingRow = {
  id: string
  workspace_id: string
  slot_id: string | null
  starts_at: string
  ends_at: string
  name: string
  email: string | null
  whatsapp: string | null
  topic: string | null
  details: string | null
  status: string
  created_at: string
}

export interface WorkspaceConsultationData {
  settings: ConsultationSettings
  slots: ConsultationSlot[]
  availability: ConsultationWeeklyAvailability[]
  bookings: ConsultationBooking[]
}

const defaultConsultationSettings = (workspaceId: string): ConsultationSettings => ({
  workspaceId,
  title: 'Booking konsultasi',
  subtitle: 'Pilih jadwal yang nyaman, lalu ceritakan hal yang ingin Anda konsultasikan.',
  durationMinutes: 60,
  timezone: 'Asia/Makassar',
  instructions: 'Harap hadir 10 menit sebelum jadwal. Jika perlu menjadwalkan ulang, silakan hubungi kami terlebih dahulu.',
  whatsappNumber: '',
  isPublic: true,
})

function mapConsultationSettings(row: ConsultationSettingsRow | null | undefined, workspaceId: string): ConsultationSettings {
  const fallback = defaultConsultationSettings(workspaceId)
  return {
    workspaceId,
    title: row?.title?.trim() || fallback.title,
    subtitle: row?.subtitle?.trim() || fallback.subtitle,
    durationMinutes: Math.max(15, Number(row?.duration_minutes) || fallback.durationMinutes),
    timezone: row?.timezone?.trim() || fallback.timezone,
    instructions: row?.instructions?.trim() || fallback.instructions,
    whatsappNumber: row?.whatsapp_number?.trim() || '',
    isPublic: row?.is_public ?? fallback.isPublic,
  }
}

function mapConsultationSlot(row: ConsultationSlotRow): ConsultationSlot {
  return { id: row.id, workspaceId: row.workspace_id, startsAt: row.starts_at, endsAt: row.ends_at, isActive: row.is_active }
}

type ConsultationAvailabilityRow = { workspace_id: string; weekday: number; is_enabled: boolean; times: unknown }

function mapConsultationAvailability(row: ConsultationAvailabilityRow): ConsultationWeeklyAvailability {
  const times = Array.isArray(row.times) ? row.times.filter((value): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).sort() : []
  return { workspaceId: row.workspace_id, weekday: Number(row.weekday), isEnabled: row.is_enabled, times }
}

function mapConsultationBooking(row: ConsultationBookingRow): ConsultationBooking {
  const statusMap: Record<string, ConsultationBookingStatus> = { new: 'New', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    slotId: row.slot_id ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    name: row.name,
    email: row.email ?? '',
    whatsapp: row.whatsapp ?? '',
    topic: row.topic ?? '',
    details: row.details ?? '',
    status: statusMap[row.status] ?? 'New',
    createdAt: row.created_at,
  }
}

export async function loadWorkspaceConsultationData(workspaceId: string): Promise<WorkspaceConsultationData> {
  const client = requireSupabase()
  const [settingsResult, slotsResult, availabilityResult, bookingsResult] = await Promise.all([
    client.from('consultation_settings').select('workspace_id, title, subtitle, duration_minutes, timezone, instructions, whatsapp_number, is_public').eq('workspace_id', workspaceId).maybeSingle(),
    client.from('consultation_slots').select('id, workspace_id, starts_at, ends_at, is_active').eq('workspace_id', workspaceId).order('starts_at'),
    client.from('consultation_weekly_availability').select('workspace_id, weekday, is_enabled, times').eq('workspace_id', workspaceId).order('weekday'),
    client.from('consultation_bookings').select('id, workspace_id, slot_id, starts_at, ends_at, name, email, whatsapp, topic, details, status, created_at').eq('workspace_id', workspaceId).order('starts_at'),
  ])
  throwIfError(settingsResult.error)
  throwIfError(slotsResult.error)
  throwIfError(availabilityResult.error)
  throwIfError(bookingsResult.error)
  return {
    settings: mapConsultationSettings(settingsResult.data as ConsultationSettingsRow | null, workspaceId),
    slots: ((slotsResult.data ?? []) as ConsultationSlotRow[]).map(mapConsultationSlot),
    availability: ((availabilityResult.data ?? []) as ConsultationAvailabilityRow[]).map(mapConsultationAvailability),
    bookings: ((bookingsResult.data ?? []) as ConsultationBookingRow[]).map(mapConsultationBooking),
  }
}

export async function saveWorkspaceConsultationAvailability(workspaceId: string, availability: ConsultationWeeklyAvailability[]) {
  const client = requireSupabase()
  const rows = availability.map((item) => ({
    workspace_id: workspaceId,
    weekday: item.weekday,
    is_enabled: item.isEnabled,
    times: [...new Set(item.times.filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))].sort(),
  }))
  const { error: deleteError } = await client.from('consultation_weekly_availability').delete().eq('workspace_id', workspaceId)
  throwIfError(deleteError)
  if (rows.length) {
    const { error: insertError } = await client.from('consultation_weekly_availability').insert(rows)
    throwIfError(insertError)
  }
  const { error: refreshError } = await client.rpc('refresh_consultation_slots', { p_workspace_id: workspaceId })
  throwIfError(refreshError)
}

export async function saveWorkspaceConsultationSettings(workspaceId: string, settings: ConsultationSettings) {
  const client = requireSupabase()
  const { error } = await client.from('consultation_settings').upsert({
    workspace_id: workspaceId,
    title: settings.title.trim(),
    subtitle: settings.subtitle.trim() || null,
    duration_minutes: Math.max(15, Math.round(settings.durationMinutes || 60)),
    timezone: settings.timezone.trim() || 'Asia/Makassar',
    instructions: settings.instructions.trim() || null,
    whatsapp_number: settings.whatsappNumber.trim() || null,
    is_public: settings.isPublic,
  }, { onConflict: 'workspace_id' })
  throwIfError(error)
}

export async function createWorkspaceConsultationSlot(workspaceId: string, startsAt: string, endsAt: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('consultation_slots').insert({ workspace_id: workspaceId, starts_at: startsAt, ends_at: endsAt, is_active: true }).select('id, workspace_id, starts_at, ends_at, is_active').single()
  throwIfError(error)
  return mapConsultationSlot(data as ConsultationSlotRow)
}

export async function deleteWorkspaceConsultationSlot(workspaceId: string, slotId: string) {
  const client = requireSupabase()
  const { error } = await client.from('consultation_slots').delete().eq('workspace_id', workspaceId).eq('id', slotId)
  throwIfError(error)
}

export async function updateWorkspaceConsultationBookingStatus(workspaceId: string, bookingId: string, status: ConsultationBookingStatus) {
  const client = requireSupabase()
  const { error } = await client.from('consultation_bookings').update({ status: status.toLowerCase() }).eq('workspace_id', workspaceId).eq('id', bookingId)
  throwIfError(error)
}

export async function deleteWorkspaceConsultationBooking(workspaceId: string, bookingId: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('delete_workspace_consultation_booking', {
    p_workspace_id: workspaceId,
    p_booking_id: bookingId,
  })
  throwIfError(error)
  if (data !== bookingId) throw new Error('Booking tidak ditemukan atau tidak dapat dihapus.')
}

export async function createWorkspaceClient(workspaceId: string, input: CreateClientInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      company: input.company || null,
      email: input.email || null,
      whatsapp: input.whatsapp || null,
      notes: input.notes || null,
      status: enumValue(input.status),
    })
    .select('id, name, company, email, whatsapp, notes, status, created_at')
    .single()
  throwIfError(error)
  return mapClient(data as unknown as ClientRow)
}

export async function uploadWorkspaceClientLogo(workspaceId: string, clientId: string, file: File) {
  const fileError = clientLogoFileError(file)
  if (fileError) throw new Error(fileError)

  const client = requireSupabase()
  const path = `${workspaceId}/${clientId}/${clientLogoId()}-${clientLogoFileName(file)}`
  const { error } = await client.storage.from(clientLogoBucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  throwIfError(error)
  const { data } = client.storage.from(clientLogoBucket).getPublicUrl(path)
  return { logoPath: path, logoUrl: data.publicUrl }
}

export async function updateWorkspaceClientProfile(workspaceId: string, clientId: string, input: UpdateClientProfileInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('clients')
    .update({
      name: input.name,
      company: input.company || null,
      email: input.email || null,
      whatsapp: input.whatsapp || null,
      description: input.description || null,
      notes: input.notes || null,
      logo_path: input.logoPath ?? null,
      status: enumValue(input.status),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', clientId)
    .select(clientSelect(true, true))
    .single()
  if (isMissingClientProfileField(error, 'description') || isMissingClientProfileField(error, 'logo_path')) throw clientProfileSetupError()
  throwIfError(error)
  return mapClient(data as unknown as ClientRow)
}

function settingsSetupError() {
  return new Error('Pengaturan akun belum disiapkan di database. Jalankan SQL pembaruan Settings terlebih dahulu.')
}

function isMissingSettingsSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return /\b(full_name|username|phone|bio|role_title|preferences|description|logo_path|nayagement-settings)\b/i.test(error.message ?? '')
}

function profileFromSettingsRow(row: SettingsProfileRow, email: string): SettingsProfile {
  return {
    id: row.id,
    fullName: row.full_name?.trim() || row.display_name || 'Pengguna Nayagement',
    displayName: row.display_name || row.full_name?.trim() || 'Pengguna Nayagement',
    username: row.username ?? '',
    email,
    phone: row.phone ?? '',
    bio: row.bio ?? '',
    roleTitle: row.role_title?.trim() || 'Developer · Owner',
    avatarUrl: row.avatar_url ?? undefined,
    accountType: 'Owner',
    createdAt: row.created_at,
    lastActive: row.updated_at,
  }
}

export async function loadWorkspaceSettings(workspaceId: string): Promise<SettingsSnapshot> {
  const client = requireSupabase()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.')
  const user = authData.user
  const [{ data: profileData, error: profileError }, { data: workspaceData, error: workspaceError }] = await Promise.all([
    client.from('user_profiles').select('id, display_name, full_name, username, phone, bio, role_title, avatar_url, timezone, preferences, created_at, updated_at').eq('id', user.id).maybeSingle(),
    client.from('workspaces').select('id, name, description, logo_path, owner_id, created_at').eq('id', workspaceId).single(),
  ])
  if (isMissingSettingsSchema(profileError) || isMissingSettingsSchema(workspaceError)) throw settingsSetupError()
  throwIfError(profileError)
  throwIfError(workspaceError)

  const fallbackRow: SettingsProfileRow = {
    id: user.id,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Pengguna Nayagement',
    avatar_url: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar',
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  }
  const profileRow = (profileData ?? fallbackRow) as SettingsProfileRow
  const workspaceRow = workspaceData as unknown as SettingsWorkspaceRow
  const preferences = settingsPreferencesValue(profileRow.preferences)
  const workspacePreference = workspaceSettingsValue(profileRow.preferences && recordValue(profileRow.preferences).workspace, profileRow.timezone ?? '', workspaceRow.name, profileRow.full_name || profileRow.display_name)
  return {
    profile: profileFromSettingsRow(profileRow, user.email ?? ''),
    workspace: {
      ...workspacePreference,
      name: workspaceRow.name,
      description: workspaceRow.description ?? '',
      logoPath: workspaceRow.logo_path ?? undefined,
      logoUrl: workspaceRow.logo_path ? client.storage.from(settingsAssetBucket).getPublicUrl(workspaceRow.logo_path).data.publicUrl : undefined,
      ownerName: profileRow.full_name?.trim() || profileRow.display_name,
    },
    preferences,
  }
}

export async function uploadWorkspaceSettingsAvatar(userId: string, file: File) {
  if (!settingsImageTypes.has(file.type)) throw new Error('Gunakan gambar JPG, PNG, atau WebP untuk foto profil.')
  if (file.size > maxSettingsImageBytes) throw new Error('Ukuran foto profil maksimal 5 MB.')
  const client = requireSupabase()
  const path = `profiles/${userId}/avatar-${clientLogoId()}-${clientLogoFileName(file)}`
  const { error } = await client.storage.from(settingsAssetBucket).upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
  if (error) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error.message)) throw settingsSetupError()
    throw new Error(error.message)
  }
  return { path, url: client.storage.from(settingsAssetBucket).getPublicUrl(path).data.publicUrl }
}

export async function uploadWorkspaceSettingsLogo(workspaceId: string, file: File) {
  if (!settingsImageTypes.has(file.type)) throw new Error('Gunakan gambar JPG, PNG, atau WebP untuk logo workspace.')
  if (file.size > maxSettingsImageBytes) throw new Error('Ukuran logo workspace maksimal 5 MB.')
  const client = requireSupabase()
  const path = `workspaces/${workspaceId}/logo-${clientLogoId()}-${clientLogoFileName(file)}`
  const { error } = await client.storage.from(settingsAssetBucket).upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
  if (error) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error.message)) throw settingsSetupError()
    throw new Error(error.message)
  }
  return { path, url: client.storage.from(settingsAssetBucket).getPublicUrl(path).data.publicUrl }
}

export async function saveWorkspaceSettings(workspaceId: string, profile: SettingsProfile, workspace: SettingsWorkspace, preferences: SettingsPreferences) {
  const client = requireSupabase()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.')
  const user = authData.user
  const username = profile.username.trim().toLowerCase()
  if (username && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error('Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau strip.')
  const profilePayload = {
    id: user.id,
    display_name: profile.displayName.trim() || profile.fullName.trim() || 'Pengguna Nayagement',
    full_name: profile.fullName.trim() || null,
    username: username || null,
    phone: profile.phone.trim() || null,
    bio: profile.bio.trim() || null,
    role_title: profile.roleTitle.trim() || null,
    avatar_url: profile.avatarUrl || null,
    timezone: workspace.timezone || 'Asia/Makassar',
    preferences: { ...preferences, workspace: { ...workspace, logoPath: undefined, logoUrl: undefined, ownerName: undefined, name: undefined, description: undefined } },
  }
  const { error: profileError } = await client.from('user_profiles').upsert(profilePayload, { onConflict: 'id' })
  if (isMissingSettingsSchema(profileError)) throw settingsSetupError()
  if (profileError?.code === '23505') throw new Error('Username tersebut sudah digunakan.')
  throwIfError(profileError)

  const { error: workspaceError } = await client.from('workspaces').update({
    name: workspace.name.trim() || 'Workspace Anda',
    description: workspace.description.trim() || null,
    logo_path: workspace.logoPath || null,
  }).eq('id', workspaceId)
  if (isMissingSettingsSchema(workspaceError)) throw settingsSetupError()
  throwIfError(workspaceError)

  if (profile.email.trim() && profile.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
    const { error: emailError } = await client.auth.updateUser({ email: profile.email.trim() })
    throwIfError(emailError)
  }
  return await loadWorkspaceSettings(workspaceId)
}

const telegramSettingsSelect = 'workspace_id, pairing_code, chat_id, chat_username, bot_username, app_base_url, is_enabled, notify_orders, notify_bookings, notify_tasks, notify_projects, notify_invoices, reminder_enabled, reminder_morning, reminder_noon, reminder_evening, timezone'

function telegramSetupError() {
  return new Error('Integrasi Telegram belum disiapkan. Jalankan SQL pembaruan Telegram terlebih dahulu.')
}

function isMissingTelegramSchema(error: { code?: string; message?: string } | null) {
  return Boolean(error && (/42P01|42703|PGRST20[045]/i.test(error.code ?? '') || /telegram_integrations|telegram_outbox/i.test(error.message ?? '')))
}

function telegramSettingsValue(workspaceId: string, row?: Record<string, unknown> | null): TelegramSettings {
  const time = (value: unknown, fallback: string) => typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback
  return {
    workspaceId,
    pairingCode: stringValue(row?.pairing_code),
    chatId: row?.chat_id == null ? undefined : String(row.chat_id),
    chatUsername: stringValue(row?.chat_username) || undefined,
    botUsername: stringValue(row?.bot_username) || undefined,
    appBaseUrl: stringValue(row?.app_base_url),
    isEnabled: booleanValue(row?.is_enabled, true),
    notifyOrders: booleanValue(row?.notify_orders, true),
    notifyBookings: booleanValue(row?.notify_bookings, true),
    notifyTasks: booleanValue(row?.notify_tasks, true),
    notifyProjects: booleanValue(row?.notify_projects, true),
    notifyInvoices: booleanValue(row?.notify_invoices, true),
    reminderEnabled: booleanValue(row?.reminder_enabled, true),
    reminderMorning: time(row?.reminder_morning, '08:00'),
    reminderNoon: time(row?.reminder_noon, '13:00'),
    reminderEvening: time(row?.reminder_evening, '19:00'),
    timezone: stringValue(row?.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar'),
  }
}

export function defaultWorkspaceTelegramSettings(workspaceId: string, appBaseUrl = ''): TelegramSettings {
  return { ...telegramSettingsValue(workspaceId), appBaseUrl }
}

export async function loadWorkspaceTelegramSettings(workspaceId: string): Promise<TelegramSettings> {
  const { data, error } = await requireSupabase().from('telegram_integrations').select(telegramSettingsSelect).eq('workspace_id', workspaceId).maybeSingle()
  if (isMissingTelegramSchema(error)) throw telegramSetupError()
  throwIfError(error)
  return telegramSettingsValue(workspaceId, data as unknown as Record<string, unknown> | null)
}

export async function saveWorkspaceTelegramSettings(workspaceId: string, input: TelegramSettings): Promise<TelegramSettings> {
  const payload = {
    workspace_id: workspaceId,
    app_base_url: input.appBaseUrl.trim().replace(/\/$/, ''),
    is_enabled: input.isEnabled,
    notify_orders: input.notifyOrders,
    notify_bookings: input.notifyBookings,
    notify_tasks: input.notifyTasks,
    notify_projects: input.notifyProjects,
    notify_invoices: input.notifyInvoices,
    reminder_enabled: input.reminderEnabled,
    reminder_morning: input.reminderMorning,
    reminder_noon: input.reminderNoon,
    reminder_evening: input.reminderEvening,
    timezone: input.timezone || 'Asia/Makassar',
  }
  const { data, error } = await requireSupabase().from('telegram_integrations').upsert(payload, { onConflict: 'workspace_id' }).select(telegramSettingsSelect).single()
  if (isMissingTelegramSchema(error)) throw telegramSetupError()
  throwIfError(error)
  return telegramSettingsValue(workspaceId, data as unknown as Record<string, unknown>)
}

export async function regenerateWorkspaceTelegramPairingCode(workspaceId: string) {
  const { data, error } = await requireSupabase().rpc('regenerate_telegram_pairing_code', { p_workspace_id: workspaceId })
  if (isMissingTelegramSchema(error)) throw telegramSetupError()
  throwIfError(error)
  return String(data ?? '')
}

export async function queueWorkspaceTelegramTest(workspaceId: string) {
  const { error } = await requireSupabase().rpc('queue_telegram_test', { p_workspace_id: workspaceId })
  if (isMissingTelegramSchema(error)) throw telegramSetupError()
  throwIfError(error)
}

export async function changeWorkspacePassword(currentPassword: string, newPassword: string) {
  const client = requireSupabase()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user?.email) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.')
  const { error: checkError } = await client.auth.signInWithPassword({ email: authData.user.email, password: currentPassword })
  if (checkError) throw new Error('Password saat ini tidak sesuai.')
  const { error } = await client.auth.updateUser({ password: newPassword })
  throwIfError(error)
}

export async function signOutOtherWorkspaceSessions() {
  const { error } = await requireSupabase().auth.signOut({ scope: 'others' })
  throwIfError(error)
}

async function resolveProjectRelations(workspaceId: string, input: Pick<ProjectFormData, 'client' | 'type'>) {
  const client = requireSupabase()
  const { data: existingClient, error: clientSearchError } = await client
    .from('clients')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('company', input.client)
    .maybeSingle()
  throwIfError(clientSearchError)

  let clientId = existingClient?.id as string | undefined
  if (!clientId) {
    const { data, error } = await client
      .from('clients')
      .insert({ workspace_id: workspaceId, name: input.client, company: input.client, status: 'lead' })
      .select('id')
      .single()
    throwIfError(error)
    if (!data?.id) throw new Error('Klien baru tidak dapat disimpan.')
    clientId = data.id as string
  }

  const { data: existingType, error: typeSearchError } = await client
    .from('project_types')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', input.type)
    .maybeSingle()
  throwIfError(typeSearchError)

  let projectTypeId = existingType?.id as string | undefined
  if (!projectTypeId) {
    const { data, error } = await client
      .from('project_types')
      .insert({ workspace_id: workspaceId, name: input.type, sort_order: 99 })
      .select('id')
      .single()
    throwIfError(error)
    if (!data?.id) throw new Error('Tipe proyek baru tidak dapat disimpan.')
    projectTypeId = data.id as string
  }

  return { clientId, projectTypeId }
}

const projectReturnSelect = 'id, code, name, description, status, priority, progress_percentage, deadline, start_date, estimated_value, payment_status, client_id, client:clients(name, company), project_type:project_types(name), public_access:project_public_access(public_token, is_enabled)'

export async function createWorkspaceProject(workspaceId: string, input: CreateProjectInput) {
  const client = requireSupabase()
  const { clientId, projectTypeId } = await resolveProjectRelations(workspaceId, input)
  const { data, error } = await client
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      project_type_id: projectTypeId,
      name: input.name,
      description: input.description,
      client_visible_description: input.description,
      client_visibility: true,
      status: 'inquiry',
      priority: enumValue(input.priority),
      start_date: new Date().toISOString().slice(0, 10),
      deadline: input.dueDate || null,
      estimated_value: input.value,
      payment_status: 'unpaid',
      progress_percentage: 0,
    })
    .select(projectReturnSelect)
    .single()
  throwIfError(error)
  return mapProject(data as unknown as ProjectRow)
}

export async function updateWorkspaceProject(workspaceId: string, projectId: string, input: ProjectFormData) {
  const client = requireSupabase()
  const { clientId, projectTypeId } = await resolveProjectRelations(workspaceId, input)
  const { data, error } = await client
    .from('projects')
    .update({
      client_id: clientId,
      project_type_id: projectTypeId,
      name: input.name,
      description: input.description,
      client_visible_description: input.description,
      client_visibility: true,
      status: enumValue(input.status),
      priority: enumValue(input.priority),
      deadline: input.dueDate || null,
      estimated_value: input.value,
      progress_percentage: Math.min(100, Math.max(0, Math.round(input.progress))),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', projectId)
    .select(projectReturnSelect)
    .single()
  throwIfError(error)
  return mapProject(data as unknown as ProjectRow)
}

export async function updateWorkspaceProjectProgress(workspaceId: string, projectId: string, progress: number, status: ProjectStatus) {
  const client = requireSupabase()
  const { error } = await client
    .from('projects')
    .update({
      progress_percentage: Math.min(100, Math.max(0, Math.round(progress))),
      status: enumValue(status),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', projectId)
  throwIfError(error)
}

export async function updateWorkspaceProjectPayment(workspaceId: string, projectId: string, paidAmount: number, estimatedValue: number) {
  const client = requireSupabase()
  const normalizedEstimatedValue = Math.max(0, Math.round(estimatedValue))
  const normalizedPaidAmount = Math.max(0, Math.min(Number.isFinite(paidAmount) ? Math.round(paidAmount) : 0, normalizedEstimatedValue))
  const paymentStatus = normalizedPaidAmount >= normalizedEstimatedValue && normalizedEstimatedValue > 0
    ? 'paid'
    : normalizedPaidAmount > 0
      ? 'partial'
      : 'unpaid'
  const { error } = await client
    .from('projects')
    .update({ paid_amount: normalizedPaidAmount, payment_status: paymentStatus })
    .eq('workspace_id', workspaceId)
    .eq('id', projectId)
  if (isMissingProjectField(error, 'paid_amount')) {
    throw new Error('Fitur pembayaran belum disiapkan. Jalankan pembaruan data terlebih dahulu.')
  }
  throwIfError(error)
}

export async function createWorkspaceProjectPayment(workspaceId: string, input: ProjectPaymentInput) {
  const amount = Math.round(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Masukkan nominal pembayaran yang valid.')

  const sourceDate = input.paidAt ? new Date(`${input.paidAt}T12:00:00`) : new Date()
  const paidAt = Number.isNaN(sourceDate.getTime()) ? new Date().toISOString() : sourceDate.toISOString()
  const client = requireSupabase()
  const { data, error } = await client.rpc('record_project_payment', {
    p_workspace_id: workspaceId,
    p_project_id: input.projectId,
    p_amount: amount,
    p_paid_at: paidAt,
    p_method: input.method.trim() || null,
    p_notes: input.notes.trim() || null,
  })
  if (isMissingPaymentHistorySchema(error)) throw paymentHistorySetupError()
  throwIfError(error)

  const result = data && typeof data === 'object' ? data as Record<string, unknown> : null
  const id = typeof result?.payment_id === 'string' ? result.payment_id : ''
  const recordedAmount = typeof result?.amount === 'number' || typeof result?.amount === 'string' ? result.amount : 0
  const projectPaidAmount = typeof result?.project_paid_amount === 'number' || typeof result?.project_paid_amount === 'string'
    ? result.project_paid_amount
    : 0
  if (!id) throw new Error('Pembayaran tidak dapat disimpan.')
  return {
    id,
    amount: numberValue(recordedAmount),
    paidAt: typeof result?.paid_at === 'string' ? result.paid_at : paidAt,
    projectPaidAmount: numberValue(projectPaidAmount),
  }
}

const invoiceEditorSelect = [
  'id, invoice_number, client_id, project_id, issue_date, due_date, status, currency, discount_amount, tax_rate, payment_instructions, notes',
  'document_title, brand_color, logo_path, signature_path, recipient_name, recipient_company, recipient_email, recipient_whatsapp',
  'sender_name, sender_email, sender_phone, sender_address, terms, footer_note',
  'client:clients(name, company, email, whatsapp)',
  'project:projects(name)',
  'items:invoice_items(id, description, detail, quantity, unit_price, sort_order)',
].join(', ')

function invoiceEditorItems(input: InvoiceLineItem[]) {
  return input
    .map((item, index) => ({
      description: item.description.trim(),
      detail: item.detail?.trim() || null,
      quantity: Math.max(0.01, Number(item.quantity) || 0),
      unit_price: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
      sort_order: index,
    }))
    .filter((item) => item.description)
}

function invoiceEditorPayload(workspaceId: string, draft: InvoiceEditorDraft) {
  const invoiceNumber = draft.invoiceNumber.trim()
  if (!invoiceNumber) throw new Error('Nomor invoice perlu diisi.')
  if (!draft.issueDate) throw new Error('Tanggal invoice perlu diisi.')
  const items = invoiceEditorItems(draft.items)
  if (!items.length) throw new Error('Tambahkan minimal satu layanan atau item invoice.')
  return {
    invoiceNumber,
    items,
    data: {
      workspace_id: workspaceId,
      client_id: draft.clientId || null,
      project_id: draft.projectId || null,
      invoice_number: invoiceNumber,
      issue_date: draft.issueDate,
      due_date: draft.dueDate || null,
      status: invoiceStatusValue(draft.status),
      currency: draft.currency.trim().toUpperCase() || 'IDR',
      discount_amount: Math.max(0, Math.round(Number(draft.discountAmount) || 0)),
      tax_rate: Math.min(100, Math.max(0, Number(draft.taxRate) || 0)),
      payment_instructions: draft.paymentInstructions.trim() || null,
      notes: draft.notes.trim() || null,
      document_title: draft.documentTitle.trim() || 'Invoice',
      brand_color: /^#[0-9A-Fa-f]{6}$/.test(draft.brandColor) ? draft.brandColor : '#30343b',
      logo_path: draft.logoPath || null,
      signature_path: draft.signaturePath || null,
      recipient_name: draft.recipientName.trim() || null,
      recipient_company: draft.recipientCompany.trim() || null,
      recipient_email: draft.recipientEmail.trim() || null,
      recipient_whatsapp: draft.recipientWhatsapp.trim() || null,
      sender_name: draft.senderName.trim() || 'Nayagement Studio',
      sender_email: draft.senderEmail.trim() || null,
      sender_phone: draft.senderPhone.trim() || null,
      sender_address: draft.senderAddress.trim() || null,
      terms: draft.terms.trim() || null,
      footer_note: draft.footerNote.trim() || null,
    },
  }
}

export async function loadWorkspaceInvoiceEditor(workspaceId: string, invoiceId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('invoices')
    .select(invoiceEditorSelect)
    .eq('workspace_id', workspaceId)
    .eq('id', invoiceId)
    .single()
  if (isMissingInvoiceEditorSchema(error)) throw invoiceEditorSetupError()
  throwIfError(error)
  return mapInvoiceEditor(data as unknown as InvoiceEditorRow)
}

export async function saveWorkspaceInvoiceEditor(workspaceId: string, draft: InvoiceEditorDraft) {
  const client = requireSupabase()
  const payload = invoiceEditorPayload(workspaceId, draft)
  let invoiceId = draft.id
  if (invoiceId) {
    const { data, error } = await client
      .from('invoices')
      .update(payload.data)
      .eq('workspace_id', workspaceId)
      .eq('id', invoiceId)
      .select('id')
      .single()
    if (isMissingInvoiceEditorSchema(error)) throw invoiceEditorSetupError()
    throwIfError(error)
    invoiceId = data?.id as string | undefined
  } else {
    const { data, error } = await client
      .from('invoices')
      .insert(payload.data)
      .select('id')
      .single()
    if (isMissingInvoiceEditorSchema(error)) throw invoiceEditorSetupError()
    throwIfError(error)
    invoiceId = data?.id as string | undefined
  }
  if (!invoiceId) throw new Error('Invoice tidak dapat disimpan.')

  const { error: deleteItemsError } = await client
    .from('invoice_items')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('invoice_id', invoiceId)
  throwIfError(deleteItemsError)

  const { error: insertItemsError } = await client
    .from('invoice_items')
    .insert(payload.items.map((item) => ({ ...item, workspace_id: workspaceId, invoice_id: invoiceId })))
  throwIfError(insertItemsError)
  return await loadWorkspaceInvoiceEditor(workspaceId, invoiceId)
}

export async function updateWorkspaceInvoiceStatus(workspaceId: string, invoiceId: string, status: InvoiceDocumentStatus) {
  const client = requireSupabase()
  const { error } = await client
    .from('invoices')
    .update({ status: invoiceStatusValue(status) })
    .eq('workspace_id', workspaceId)
    .eq('id', invoiceId)
  if (isMissingInvoiceEditorSchema(error)) throw invoiceEditorSetupError()
  throwIfError(error)
}

async function uploadWorkspaceInvoiceAsset(workspaceId: string, invoiceId: string | undefined, file: File, kind: 'logo' | 'signature') {
  const validationError = kind === 'signature' ? invoiceSignatureFileError(file) : invoiceLogoFileError(file)
  if (validationError) throw new Error(validationError)
  const client = requireSupabase()
  const path = `${workspaceId}/${invoiceId || 'draft'}/${kind}-${clientLogoId()}-${clientLogoFileName(file)}`
  const { error } = await client.storage
    .from(invoiceLogoBucket)
    .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
  if (error) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error.message)) throw invoiceEditorSetupError()
    throw new Error(error.message)
  }
  const { data } = client.storage.from(invoiceLogoBucket).getPublicUrl(path)
  if (!data.publicUrl) throw new Error(`${kind === 'signature' ? 'Tanda tangan' : 'Logo'} invoice tidak dapat dipublikasikan.`)
  return { path, url: data.publicUrl }
}

export async function uploadWorkspaceInvoiceLogo(workspaceId: string, invoiceId: string | undefined, file: File) {
  const uploaded = await uploadWorkspaceInvoiceAsset(workspaceId, invoiceId, file, 'logo')
  return { logoPath: uploaded.path, logoUrl: uploaded.url }
}

export async function uploadWorkspaceInvoiceSignature(workspaceId: string, invoiceId: string | undefined, file: File) {
  const uploaded = await uploadWorkspaceInvoiceAsset(workspaceId, invoiceId, file, 'signature')
  return { signaturePath: uploaded.path, signatureUrl: uploaded.url }
}

const serviceCatalogSelect = 'id, name, category, description, pricing_mode, minimum_fee, default_unit_label, default_unit_price, default_quantity, is_active, created_at, updated_at'
const serviceQuoteSelect = [
  'id, quote_number, title, client_id, project_id, status, currency, issue_date, valid_until, subtotal, discount_amount, tax_rate, tax_amount, total_amount, notes, converted_invoice_id, created_at, updated_at',
  'items:service_quote_items(id, catalog_id, name, detail, pricing_mode, quantity, unit_label, unit_price, minimum_fee, sort_order)',
].join(', ')

function serviceCatalogPayload(workspaceId: string, input: ServiceCatalogInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Nama layanan perlu diisi.')
  return {
    workspace_id: workspaceId,
    name,
    category: input.category.trim() || 'Lainnya',
    description: input.description.trim() || null,
    pricing_mode: servicePricingModeValue(input.pricingMode),
    minimum_fee: Math.max(0, Math.round(Number(input.minimumFee) || 0)),
    default_unit_label: input.defaultUnitLabel.trim() || 'paket',
    default_unit_price: Math.max(0, Math.round(Number(input.defaultUnitPrice) || 0)),
    default_quantity: Math.max(0.01, Number(input.defaultQuantity) || 1),
    is_active: input.isActive,
  }
}

function serviceQuoteItems(items: ServiceQuoteItem[]) {
  return items
    .map((item, index) => ({
      catalog_id: item.catalogId || null,
      name: item.name.trim(),
      detail: item.detail.trim() || null,
      pricing_mode: servicePricingModeValue(item.pricingMode),
      quantity: Math.max(0.01, Number(item.quantity) || 0),
      unit_label: item.unitLabel.trim() || 'paket',
      unit_price: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
      minimum_fee: Math.max(0, Math.round(Number(item.minimumFee) || 0)),
      sort_order: index,
    }))
    .filter((item) => item.name)
}

function serviceQuotePayload(workspaceId: string, draft: ServiceQuoteDraft) {
  const quoteNumber = draft.quoteNumber.trim()
  if (!quoteNumber) throw new Error('Nomor penawaran perlu diisi.')
  if (!draft.issueDate) throw new Error('Tanggal penawaran perlu diisi.')
  const items = serviceQuoteItems(draft.items)
  if (!items.length) throw new Error('Tambahkan minimal satu layanan ke penawaran.')
  return {
    items,
    data: {
      workspace_id: workspaceId,
      quote_number: quoteNumber,
      title: draft.title.trim() || 'Penawaran layanan',
      client_id: draft.clientId || null,
      project_id: draft.projectId || null,
      status: serviceQuoteStatusValue(draft.status),
      currency: draft.currency.trim().toUpperCase() || 'IDR',
      issue_date: draft.issueDate,
      valid_until: draft.validUntil || null,
      discount_amount: Math.max(0, Math.round(Number(draft.discountAmount) || 0)),
      tax_rate: Math.min(100, Math.max(0, Number(draft.taxRate) || 0)),
      notes: draft.notes.trim() || null,
    },
  }
}

export async function loadWorkspaceServiceQuoteData(workspaceId: string) {
  const client = requireSupabase()
  const [catalogResult, quoteResult] = await Promise.all([
    client.from('service_catalogs').select(serviceCatalogSelect).eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    client.from('service_quotes').select(serviceQuoteSelect).eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
  ])
  if (isMissingServiceCalculatorSchema(catalogResult.error) || isMissingServiceCalculatorSchema(quoteResult.error)) throw serviceCalculatorSetupError()
  throwIfError(catalogResult.error)
  throwIfError(quoteResult.error)
  return {
    catalogs: ((catalogResult.data ?? []) as unknown as ServiceCatalogRow[]).map(mapServiceCatalog),
    quotes: ((quoteResult.data ?? []) as unknown as ServiceQuoteRow[]).map(mapServiceQuote),
  }
}

export async function saveWorkspaceServiceCatalog(workspaceId: string, input: ServiceCatalogInput, catalogId?: string) {
  const client = requireSupabase()
  const payload = serviceCatalogPayload(workspaceId, input)
  const query = catalogId
    ? client.from('service_catalogs').update(payload).eq('workspace_id', workspaceId).eq('id', catalogId).select(serviceCatalogSelect).single()
    : client.from('service_catalogs').insert(payload).select(serviceCatalogSelect).single()
  const { data, error } = await query
  if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
  throwIfError(error)
  return mapServiceCatalog(data as unknown as ServiceCatalogRow)
}

export async function deleteWorkspaceServiceCatalog(workspaceId: string, catalogId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('service_catalogs')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', catalogId)
  if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
  throwIfError(error)
}

export async function loadWorkspaceServiceQuote(workspaceId: string, quoteId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('service_quotes')
    .select(serviceQuoteSelect)
    .eq('workspace_id', workspaceId)
    .eq('id', quoteId)
    .single()
  if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
  throwIfError(error)
  return mapServiceQuote(data as unknown as ServiceQuoteRow)
}

export async function saveWorkspaceServiceQuote(workspaceId: string, draft: ServiceQuoteDraft) {
  const client = requireSupabase()
  const payload = serviceQuotePayload(workspaceId, draft)
  let quoteId = draft.id
  if (quoteId) {
    const { data, error } = await client
      .from('service_quotes')
      .update(payload.data)
      .eq('workspace_id', workspaceId)
      .eq('id', quoteId)
      .select('id')
      .single()
    if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
    throwIfError(error)
    quoteId = data?.id as string | undefined
  } else {
    const { data, error } = await client
      .from('service_quotes')
      .insert(payload.data)
      .select('id')
      .single()
    if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
    throwIfError(error)
    quoteId = data?.id as string | undefined
  }
  if (!quoteId) throw new Error('Penawaran tidak dapat disimpan.')

  const { error: deleteItemsError } = await client
    .from('service_quote_items')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('quote_id', quoteId)
  if (isMissingServiceCalculatorSchema(deleteItemsError)) throw serviceCalculatorSetupError()
  throwIfError(deleteItemsError)

  const { error: insertItemsError } = await client
    .from('service_quote_items')
    .insert(payload.items.map((item) => ({ ...item, workspace_id: workspaceId, quote_id: quoteId })))
  if (isMissingServiceCalculatorSchema(insertItemsError)) throw serviceCalculatorSetupError()
  throwIfError(insertItemsError)
  return await loadWorkspaceServiceQuote(workspaceId, quoteId)
}

export async function deleteWorkspaceServiceQuote(workspaceId: string, quoteId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('service_quotes')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', quoteId)
  if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
  throwIfError(error)
}

export async function markWorkspaceServiceQuoteConverted(workspaceId: string, quoteId: string, invoiceId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('service_quotes')
    .update({ status: 'converted', converted_invoice_id: invoiceId })
    .eq('workspace_id', workspaceId)
    .eq('id', quoteId)
    .select(serviceQuoteSelect)
    .single()
  if (isMissingServiceCalculatorSchema(error)) throw serviceCalculatorSetupError()
  throwIfError(error)
  return mapServiceQuote(data as unknown as ServiceQuoteRow)
}

export async function deleteWorkspaceProject(workspaceId: string, projectId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('projects')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', projectId)
    .select('id')
  throwIfError(error)
  if (!data?.length) throw new Error('Proyek tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.')
}

export async function enableWorkspaceProjectPortal(projectId: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('regenerate_project_public_token', { p_project_id: projectId })
  throwIfError(error)
  if (typeof data !== 'string' || !data) throw new Error('Akses portal klien tidak dapat diaktifkan.')
  return data
}

export async function updateWorkspaceTaskStatus(id: string, status: TaskStatus) {
  const client = requireSupabase()
  const { error } = await client.from('project_tasks').update({ status: status.toLowerCase().replace(' ', '_') }).eq('id', id)
  throwIfError(error)
}

export async function loadWorkspaceTaskDetail(taskId: string) {
  const client = requireSupabase()
  const [taskResult, notesResult, attachmentsResult] = await Promise.all([
    client.from('project_tasks').select('*, project:projects(name)').eq('id', taskId).single(),
    client.from('project_task_notes').select('id, task_id, body, created_at').eq('task_id', taskId).order('created_at', { ascending: false }),
    client.from('project_task_attachments').select('id, task_id, file_name, storage_path, mime_type, file_size, caption, created_at').eq('task_id', taskId).order('created_at', { ascending: false }),
  ])

  if (isMissingTaskDetailSchema(taskResult.error) || isMissingTaskDetailSchema(notesResult.error) || isMissingTaskDetailSchema(attachmentsResult.error)) throw taskDetailSetupError()
  throwIfError(taskResult.error)
  throwIfError(notesResult.error)
  throwIfError(attachmentsResult.error)

  const attachmentRows = (attachmentsResult.data ?? []) as unknown as TaskAttachmentRow[]
  const attachments = await Promise.all(attachmentRows.map(async (row) => {
    const { data, error } = await client.storage.from(taskAttachmentBucket).createSignedUrl(row.storage_path, 60 * 60)
    return mapTaskAttachment(row, error ? undefined : data?.signedUrl)
  }))

  return {
    ...mapTask(taskResult.data as unknown as TaskRow),
    notes: ((notesResult.data ?? []) as unknown as TaskNoteRow[]).map(mapTaskNote),
    attachments,
  }
}

export async function updateWorkspaceTaskDetail(id: string, input: UpdateProjectTaskInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_tasks')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      brief: input.brief?.trim() || null,
      status: enumValue(input.status),
      priority: enumValue(input.priority),
      due_at: input.dueAt ? new Date(input.dueAt + 'T09:00:00').toISOString() : null,
      progress_percentage: Math.min(100, Math.max(0, Math.round(input.progress))),
      client_visible: input.visibleToClient,
    })
    .eq('id', id)
    .select('*, project:projects(name)')
    .single()
  if (isMissingTaskDetailSchema(error)) throw taskDetailSetupError()
  throwIfError(error)
  return mapTask(data as unknown as TaskRow)
}

export async function createWorkspaceTaskNote(workspaceId: string, taskId: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Catatan tidak boleh kosong.')
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_task_notes')
    .insert({ workspace_id: workspaceId, task_id: taskId, body: trimmed })
    .select('id, task_id, body, created_at')
    .single()
  if (isMissingTaskDetailSchema(error)) throw taskDetailSetupError()
  throwIfError(error)
  return mapTaskNote(data as unknown as TaskNoteRow)
}

export async function uploadWorkspaceTaskAttachment(workspaceId: string, taskId: string, file: File) {
  const fileError = taskAttachmentFileError(file)
  if (fileError) throw new Error(fileError)

  const client = requireSupabase()
  const path = `${workspaceId}/${taskId}/${taskAttachmentId()}-${taskAttachmentFileName(file)}`
  const { error: uploadError } = await client.storage.from(taskAttachmentBucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(uploadError.message)) throw taskDetailSetupError()
    throw new Error(uploadError.message)
  }

  const { data, error } = await client
    .from('project_task_attachments')
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
    })
    .select('id, task_id, file_name, storage_path, mime_type, file_size, caption, created_at')
    .single()
  if (error) {
    await client.storage.from(taskAttachmentBucket).remove([path])
    if (isMissingTaskDetailSchema(error)) throw taskDetailSetupError()
    throw new Error(error.message)
  }

  const { data: signedUrlData } = await client.storage.from(taskAttachmentBucket).createSignedUrl(path, 60 * 60)
  return mapTaskAttachment(data as unknown as TaskAttachmentRow, signedUrlData?.signedUrl)
}

export async function deleteWorkspaceTaskAttachment(attachment: TaskAttachment) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_task_attachments')
    .delete()
    .eq('id', attachment.id)
    .select('id')
  if (isMissingTaskDetailSchema(error)) throw taskDetailSetupError()
  throwIfError(error)
  if (!data?.length) throw new Error('Lampiran tidak ditemukan atau tidak dapat dihapus.')
  const { error: storageError } = await client.storage.from(taskAttachmentBucket).remove([attachment.storagePath])
  if (storageError) throw new Error(storageError.message)
}

export async function createWorkspaceTask(workspaceId: string, input: ProjectTaskInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_tasks')
    .insert({
      workspace_id: workspaceId,
      project_id: input.projectId,
      name: input.name,
      description: input.description || null,
      status: 'todo',
      priority: enumValue(input.priority),
      due_at: input.dueAt ? new Date(input.dueAt + 'T09:00:00').toISOString() : null,
      client_visible: input.visibleToClient,
    })
    .select('*, project:projects(name)')
    .single()
  throwIfError(error)
  return mapTask(data as unknown as TaskRow)
}

export async function deleteWorkspaceTask(id: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('project_tasks').delete().eq('id', id).select('id')
  throwIfError(error)
  if (!data?.length) throw new Error('Tugas tidak ditemukan atau tidak dapat dihapus.')
}

export async function createWorkspaceTimelineActivity(workspaceId: string, input: ProjectTimelineInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('project_timeline')
    .insert({
      workspace_id: workspaceId,
      project_id: input.projectId,
      title: input.title,
      description: input.description || null,
      occurred_at: new Date().toISOString(),
      visibility: input.visibleToClient ? 'client' : 'internal',
    })
    .select('id, project_id, title, description, occurred_at, visibility')
    .single()
  throwIfError(error)
  return mapTimelineItem(data as unknown as TimelineRow, 0, 1)
}

export async function deleteWorkspaceTimelineActivity(id: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('project_timeline').delete().eq('id', id).select('id')
  throwIfError(error)
  if (!data?.length) throw new Error('Aktivitas tidak ditemukan atau tidak dapat dihapus.')
}

export async function markWorkspaceNotificationRead(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  throwIfError(error)
}

export async function markAllWorkspaceNotificationsRead(workspaceId: string) {
  const client = requireSupabase()
  const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('workspace_id', workspaceId).is('read_at', null)
  throwIfError(error)
}
