export type ProjectStatus =
  | 'Inquiry'
  | 'Pending'
  | 'Confirmed'
  | 'In Progress'
  | 'Review'
  | 'Revision'
  | 'Completed'
  | 'Cancelled'

export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TaskStatus = 'Todo' | 'In Progress' | 'Review' | 'Completed'

export interface TaskNote {
  id: string
  body: string
  createdAt: string
}

export interface TaskAttachment {
  id: string
  fileName: string
  storagePath: string
  mimeType: string
  fileSize: number
  caption?: string
  createdAt: string
  url?: string
}

export interface TaskDetailInput {
  name: string
  description?: string
  brief?: string
  dueAt?: string
  priority: ProjectPriority
  status: TaskStatus
  progress: number
  visibleToClient: boolean
}

export type SettingsTheme = 'light' | 'dark' | 'system'
export type SettingsAccent = 'blue' | 'purple' | 'green' | 'orange'

export interface SettingsProfile {
  id: string
  fullName: string
  displayName: string
  username: string
  email: string
  phone: string
  bio: string
  roleTitle: string
  avatarUrl?: string
  accountType: string
  createdAt?: string
  lastActive?: string
}

export interface SettingsWorkspace {
  name: string
  description: string
  logoPath?: string
  logoUrl?: string
  ownerName: string
  defaultPriority: ProjectPriority
  defaultStatus: TaskStatus
  defaultTaskView: 'List' | 'Board' | 'Calendar'
  defaultReminder: string
  timezone: string
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12 hour' | '24 hour'
  firstDayOfWeek: 'Monday' | 'Sunday'
  autoMarkOverdue: boolean
  showCompletedTasks: boolean
  autoArchiveCompleted: boolean
  confirmBeforeDelete: boolean
  workDayStart: string
  workDayEnd: string
  workingDays: string[]
}

export interface SettingsPreferences {
  theme: SettingsTheme
  accentColor: SettingsAccent
  sidebarMode: 'Expanded' | 'Collapsed'
  density: 'Comfortable' | 'Compact'
  showBreadcrumbs: boolean
  showPageDescriptions: boolean
  defaultLandingPage: 'Dashboard' | 'My Tasks' | 'Calendar'
  dashboardTaskView: 'List' | 'Board' | 'Calendar'
  showOverdueTasks: boolean
  showCompletedTasks: boolean
  largerText: boolean
  reduceAnimations: boolean
  highContrast: boolean
  inAppNotifications: boolean
  browserNotifications: boolean
  emailNotifications: boolean
  taskReminder: boolean
  taskCompleted: boolean
  taskOverdue: boolean
  deadlineReminder: boolean
  reminderIntervals: string[]
  dailySummary: boolean
  dailySummaryTime: string
  weeklySummary: boolean
  weeklySummaryDay: 'Monday' | 'Sunday'
  weeklySummaryTime: string
  loginNotification: boolean
  newDeviceNotification: boolean
  suspiciousLoginAlert: boolean
}

export interface SettingsSnapshot {
  profile: SettingsProfile
  workspace: SettingsWorkspace
  preferences: SettingsPreferences
}

export interface TelegramSettings {
  workspaceId: string
  pairingCode: string
  chatId?: string
  chatUsername?: string
  botUsername?: string
  appBaseUrl: string
  isEnabled: boolean
  notifyOrders: boolean
  notifyBookings: boolean
  notifyTasks: boolean
  notifyProjects: boolean
  notifyInvoices: boolean
  reminderEnabled: boolean
  reminderMorning: string
  reminderNoon: string
  reminderEvening: string
  timezone: string
}

export interface Project {
  id: string
  clientId?: string
  code: string
  name: string
  type: string
  client: string
  status: ProjectStatus
  priority: ProjectPriority
  progress: number
  dueDate: string
  startDate: string
  estimatedValue: number
  paid: number
  description: string
  owner: string
  accent: 'blue' | 'violet' | 'peach' | 'mint' | 'pink'
  publicToken?: string
  publicCode?: string
  publicSlug?: string
}

export interface ProjectPayment {
  id: string
  projectId: string
  projectName: string
  client: string
  amount: number
  paidAt: string
  method?: string
  notes?: string
}

export interface ProjectPaymentInput {
  projectId: string
  amount: number
  paidAt: string
  method: string
  notes: string
}

export type PersonalFinanceKind = 'Income' | 'Expense'
export type PersonalFinanceScope = 'Personal' | 'Family'

export interface PersonalFinanceCategory {
  id: string
  name: string
  kind: PersonalFinanceKind
  color: string
  isSystem: boolean
}

export interface PersonalFinanceTransaction {
  id: string
  categoryId?: string
  title: string
  kind: PersonalFinanceKind
  amount: number
  occurredOn: string
  paymentMethod: string
  notes: string
  scope: PersonalFinanceScope
  familyMember: string
  isRecurring: boolean
  source: 'Manual' | 'Business'
  sourceId?: string
}

export interface PersonalFinanceBudget {
  id: string
  categoryId: string
  month: string
  kind: PersonalFinanceKind
  plannedAmount: number
}

export interface PersonalSavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate?: string
  color: string
  notes: string
}

export type PersonalWishlistStatus = 'Planned' | 'Purchased'
export type PersonalWishlistPriority = 'Low' | 'Medium' | 'High'

export interface PersonalWishlistItem {
  id: string
  categoryId?: string
  name: string
  estimatedAmount: number
  actualAmount?: number
  priority: PersonalWishlistPriority
  targetDate?: string
  purchasedAt?: string
  notes: string
  status: PersonalWishlistStatus
  transactionId?: string
}

export interface PersonalFinanceSnapshot {
  categories: PersonalFinanceCategory[]
  transactions: PersonalFinanceTransaction[]
  budgets: PersonalFinanceBudget[]
  savingsGoals: PersonalSavingsGoal[]
  wishlist: PersonalWishlistItem[]
}

export interface Task {
  id: string
  projectId?: string
  name: string
  project: string
  due: string
  dueAt?: string | null
  description?: string
  status: TaskStatus
  priority: ProjectPriority
  visibleToClient: boolean
  progress?: number
  brief?: string
  notes?: TaskNote[]
  attachments?: TaskAttachment[]
}

export interface Client {
  id: string
  name: string
  company: string
  email?: string
  whatsapp?: string
  description?: string
  notes?: string
  logoPath?: string
  logoUrl?: string
  initials: string
  status: 'Lead' | 'Active' | 'Inactive' | 'Returning'
  projects: number
  revenue: number
  lastOrder: string
  accent: 'blue' | 'violet' | 'peach' | 'mint' | 'pink'
}

export interface ClientFormData {
  name: string
  company: string
  email: string
  whatsapp: string
  status: Client['status']
  notes: string
}

export interface ClientProfileFormData extends ClientFormData {
  description: string
}

export interface TimelineItem {
  id?: string
  title: string
  description: string
  date: string
  time: string
  occurredAt?: string
  state: 'done' | 'current' | 'next'
  visibleToClient: boolean
}

export interface ProjectFormData {
  name: string
  client: string
  type: string
  dueDate: string
  priority: ProjectPriority
  value: number
  description: string
  status: ProjectStatus
  progress: number
}

export interface Invoice {
  id: string
  number: string
  clientId?: string
  projectId?: string
  client: string
  project: string
  issuedDate: string
  dueDate: string
  amount: number
  status: 'Paid' | 'Unpaid' | 'Partial'
  documentStatus?: InvoiceDocumentStatus
}

export type InvoiceDocumentStatus = 'Draft' | 'DP' | 'Paid' | 'Overdue' | 'Void'

export interface InvoiceLineItem {
  id?: string
  description: string
  detail?: string
  quantity: number
  unitPrice: number
}

export interface InvoiceEditorDraft {
  id?: string
  invoiceNumber: string
  clientId: string
  projectId: string
  issueDate: string
  dueDate: string
  status: InvoiceDocumentStatus
  currency: string
  documentTitle: string
  brandColor: string
  logoPath?: string
  logoUrl?: string
  signaturePath?: string
  signatureUrl?: string
  recipientName: string
  recipientCompany: string
  recipientEmail: string
  recipientWhatsapp: string
  senderName: string
  senderEmail: string
  senderPhone: string
  senderAddress: string
  paymentInstructions: string
  notes: string
  terms: string
  footerNote: string
  taxRate: number
  discountAmount: number
  items: InvoiceLineItem[]
}

export type ServicePricingMode = 'Fixed' | 'Per Hour' | 'Per Unit' | 'Package'
export type ServiceQuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Expired' | 'Converted'

export interface ServiceCatalog {
  id: string
  name: string
  category: string
  description: string
  pricingMode: ServicePricingMode
  minimumFee: number
  defaultUnitLabel: string
  defaultUnitPrice: number
  defaultQuantity: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ServiceCatalogInput = Omit<ServiceCatalog, 'id' | 'createdAt' | 'updatedAt'>

export interface ServiceQuoteItem {
  id?: string
  catalogId?: string
  name: string
  detail: string
  pricingMode: ServicePricingMode
  quantity: number
  unitLabel: string
  unitPrice: number
  minimumFee: number
}

export interface ServiceQuoteDraft {
  id?: string
  quoteNumber: string
  title: string
  clientId: string
  projectId: string
  status: ServiceQuoteStatus
  currency: string
  issueDate: string
  validUntil: string
  taxRate: number
  discountAmount: number
  notes: string
  items: ServiceQuoteItem[]
}

export interface ServiceQuote extends ServiceQuoteDraft {
  id: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  convertedInvoiceId?: string
  createdAt: string
  updatedAt: string
}

export interface AppNotification {
  id: string
  title: string
  detail: string
  time: string
  unread: boolean
  kind: 'project' | 'task' | 'order' | 'finance' | 'deadline' | 'client' | 'system'
}

export type OrderFormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date' | 'number' | 'url'

export interface OrderFormField {
  id?: string
  key: string
  label: string
  type: OrderFormFieldType
  options: string[]
  required: boolean
  sortOrder: number
}

export interface OrderFormDraft {
  title: string
  description: string
  confirmationMessage: string
  headerImageUrl: string
  isActive: boolean
  fields: OrderFormField[]
}

export interface OrderForm extends OrderFormDraft {
  id: string
  publicToken: string
  createdAt: string
  headerImageSupported?: boolean
}

export type OrderSubmissionStatus = 'New' | 'Reviewing' | 'Accepted' | 'Rejected' | 'Converted'

export interface OrderSubmission {
  id: string
  orderFormId: string
  orderFormTitle: string
  projectId?: string
  projectName?: string
  submitterName: string
  submitterEmail?: string
  submitterWhatsapp?: string
  payload: Record<string, string>
  status: OrderSubmissionStatus
  createdAt: string
}

export type ConsultationBookingStatus = 'New' | 'Confirmed' | 'Completed' | 'Cancelled'

export interface ConsultationSettings {
  workspaceId: string
  title: string
  subtitle: string
  durationMinutes: number
  timezone: string
  instructions: string
  whatsappNumber: string
  isPublic: boolean
}

export interface ConsultationSlot {
  id: string
  workspaceId: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

export interface ConsultationWeeklyAvailability {
  workspaceId: string
  weekday: number
  isEnabled: boolean
  times: string[]
}

export interface ConsultationBooking {
  id: string
  workspaceId: string
  slotId?: string
  startsAt: string
  endsAt: string
  name: string
  email: string
  whatsapp: string
  topic: string
  details: string
  status: ConsultationBookingStatus
  createdAt: string
}

export interface NavItem {
  id: RouteName
  label: string
}

export type RouteName =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'calendar'
  | 'clients'
  | 'finance'
  | 'personal-finance'
  | 'invoices'
  | 'forms'
  | 'orders'
  | 'bookings'
  | 'notifications'
  | 'settings'

export interface ToastMessage {
  id: number
  message: string
  action?: string
}
