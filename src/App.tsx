import { useCallback, useEffect, useState } from 'react'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { ProjectFormModal } from './components/ProjectFormModal'
import { SearchModal } from './components/SearchModal'
import { Toast } from './components/ui'
import { initials } from './lib/format'
import { generateInvoiceNumber } from './lib/invoice'
import { supabase } from './lib/supabase'
import { sanitizeUserMessage } from './lib/userMessage'
import { CalendarPage } from './pages/CalendarPage'
import { ClientProfilePage } from './pages/ClientProfilePage'
import { ClientsPage } from './pages/ClientsPage'
import { ConsultationsPage } from './pages/ConsultationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FinancePage, InvoicesPage, NotificationsPage, OrderFormsPage, OrdersPage } from './pages/BusinessPages'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicConsultationBookingPage, PublicInvoicePage, PublicOrderFormPage, PublicProjectPage, PublicProjectUnavailablePage } from './pages/PublicPages'
import { PersonalFinancePage } from './pages/PersonalFinancePage'
import { ContentPlanPage } from './pages/ContentPlanPage'
import { TasksPage } from './pages/TasksPage'
import type { PublicProjectLookup } from './services/publicData'
import { isSupabaseConfigured, loginWithUsername } from './services/usernameAuth'
import {
  createWorkspaceClient,
  createWorkspaceProjectPayment,
  createWorkspaceProject,
  createWorkspaceTaskNote,
  createWorkspaceTask,
  createWorkspaceTimelineActivity,
  deleteWorkspaceClient,
  deleteWorkspaceTaskAttachment,
  deleteWorkspaceOrderSubmission,
  deleteWorkspaceProject,
  deleteWorkspaceServiceCatalog,
  deleteWorkspaceServiceQuote,
  deleteWorkspaceTask,
  deleteWorkspaceTimelineActivity,
  enableWorkspaceProjectPortal,
  loadWorkspaceTaskDetail,
  loadWorkspaceInvoiceEditor,
  loadWorkspaceConsultationData,
  loadWorkspaceSettings,
  loadWorkspaceServiceQuoteData,
  loadWorkspaceSnapshot,
  markAllWorkspaceNotificationsRead,
  markWorkspaceNotificationRead,
  updateWorkspaceProject,
  updateWorkspaceProjectPayment,
  updateWorkspaceProjectProgress,
  updateWorkspaceOrderSubmissionStatus,
  updateWorkspaceClientProfile,
  saveWorkspaceInvoiceEditor,
  saveWorkspaceServiceCatalog,
  saveWorkspaceServiceQuote,
  markWorkspaceServiceQuoteConverted,
  updateWorkspaceInvoiceStatus,
  updateWorkspaceTaskDetail,
  updateWorkspaceTaskStatus,
  updateWorkspaceTimelineActivity,
  uploadWorkspaceClientLogo,
  uploadWorkspaceInvoiceLogo,
  uploadWorkspaceInvoiceSignature,
  uploadWorkspaceTaskAttachment,
} from './services/workspaceData'
import type { AppNotification, Client, ClientFormData, ClientProfileFormData, ConsultationBooking, Invoice, InvoiceDocumentStatus, InvoiceEditorDraft, OrderSubmission, OrderSubmissionStatus, Project, ProjectFormData, ProjectPayment, ProjectPaymentInput, RouteName, ServiceCatalog, ServiceCatalogInput, ServiceQuote, ServiceQuoteDraft, SettingsProfile, Task, TaskAttachment, TaskDetailInput, TimelineItem, ToastMessage } from './types'

const demoSessionKey = 'nayagement-demo-session'
const themeKey = 'nayagement-theme'
const routeNames: RouteName[] = ['dashboard', 'projects', 'tasks', 'calendar', 'clients', 'content-plan', 'finance', 'invoices', 'forms', 'orders', 'bookings', 'personal-finance', 'notifications', 'settings']
const accentOptions: Project['accent'][] = ['blue', 'violet', 'peach', 'mint', 'pink']

const getHash = () => window.location.hash.replace(/^#/, '') || '/dashboard'
const getRoute = (hash = getHash()): RouteName => {
  const value = hash.split('/')[1] as RouteName | undefined
  return value && routeNames.includes(value) ? value : 'dashboard'
}

type PublicPortalRoute =
  | { kind: 'valid'; lookup: PublicProjectLookup; key: string }
  | { kind: 'unavailable' }
  | null

function decodePublicRouteSegment(value: string) {
  try {
    const decoded = decodeURIComponent(value)
    return decoded.includes('/') ? null : decoded
  } catch {
    return null
  }
}

function parsePublicPortalRoute(hash: string): PublicPortalRoute {
  const segments = hash.split('/').filter(Boolean)
  if (segments[0] === 'client') {
    if (segments.length === 3 && segments[1] === 'project') {
      const key = decodePublicRouteSegment(segments[2])
      return key ? { kind: 'valid', lookup: 'token', key } : { kind: 'unavailable' }
    }
    if (segments.length === 2 && segments[1] !== 'project') {
      const key = decodePublicRouteSegment(segments[1])
      return key && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)
        ? { kind: 'valid', lookup: 'slug', key }
        : { kind: 'unavailable' }
    }
    return { kind: 'unavailable' }
  }
  if (segments[0] === 'p') {
    const key = segments.length === 2 ? decodePublicRouteSegment(segments[1]) : null
    return key && /^[a-z0-9]{8}$/.test(key)
      ? { kind: 'valid', lookup: 'code', key }
      : { kind: 'unavailable' }
  }
  return null
}

function routeDetailId(hash: string, section: 'projects' | 'clients' | 'invoices') {
  const segments = hash.split('/').filter(Boolean)
  return segments[0] === section && segments[1] ? decodeURIComponent(segments[1]) : null
}

function parsePublicInvoiceRoute(hash: string) {
  const segments = hash.split('/').filter(Boolean)
  if (segments[0] !== 'invoice') return null
  const publicCode = segments.length >= 2 ? decodePublicRouteSegment(segments[1]) : null
  if (!publicCode || !/^[a-f0-9]{16}$/.test(publicCode) || segments.length > 3 || (segments[2] && segments[2] !== 'pdf')) {
    return { publicCode: '', autoDownloadPdf: false }
  }
  return { publicCode, autoDownloadPdf: segments[2] === 'pdf' }
}

function clientPortalPath(project: Project) {
  if (project.publicSlug) return '/client/' + encodeURIComponent(project.publicSlug)
  if (project.publicCode) return '/p/' + encodeURIComponent(project.publicCode)
  if (project.publicToken) return '/client/project/' + encodeURIComponent(project.publicToken)
  return null
}

function demoProjectSlug(project: Project) {
  const base = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'project-' + project.id.replace(/[^a-z0-9]+/gi, '').toLowerCase()
}

function localTaskDueLabel(value?: string) {
  if (!value) return 'Belum dijadwalkan'
  const date = new Date(value + 'T09:00:00')
  if (Number.isNaN(date.getTime())) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function localFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Lampiran tidak dapat dibaca.'))
    reader.onerror = () => reject(new Error('Lampiran tidak dapat dibaca.'))
    reader.readAsDataURL(file)
  })
}

function invoiceEditorDate(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function invoiceEditorFromSummary(invoice: Invoice | undefined, clients: Client[], projects: Project[]): InvoiceEditorDraft {
  const project = invoice?.projectId ? projects.find((item) => item.id === invoice.projectId) : projects.find((item) => item.name === invoice?.project)
  const client = invoice?.clientId ? clients.find((item) => item.id === invoice.clientId) : clients.find((item) => item.company === invoice?.client)
  return {
    id: invoice?.id,
    invoiceNumber: invoice?.number ?? generateInvoiceNumber(project),
    clientId: client?.id ?? '',
    projectId: project?.id ?? '',
    issueDate: invoiceEditorDate(),
    dueDate: invoiceEditorDate(14),
    status: invoice?.status === 'Paid' ? 'Paid' : invoice?.status === 'Partial' ? 'DP' : 'Draft',
    currency: 'IDR',
    documentTitle: 'Invoice',
    brandColor: '#30343b',
    recipientName: client?.name ?? '',
    recipientCompany: client?.company ?? invoice?.client ?? '',
    recipientEmail: client?.email ?? '',
    recipientWhatsapp: client?.whatsapp ?? '',
    senderName: 'Nayagement Studio',
    senderEmail: '',
    senderPhone: '',
    senderAddress: '',
    paymentInstructions: '',
    notes: '',
    terms: '',
    footerNote: 'Terima kasih telah mempercayakan kebutuhan kreatif Anda kepada kami.',
    taxRate: 0,
    discountAmount: 0,
    items: [{ description: project?.name ?? invoice?.project ?? 'Layanan kreatif', detail: '', quantity: 1, unitPrice: invoice?.amount ?? project?.estimatedValue ?? 0 }],
  }
}

function invoiceDraftTotal(draft: InvoiceEditorDraft) {
  const subtotal = draft.items.reduce((total, item) => total + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0)
  const discount = Math.min(subtotal, Math.max(0, draft.discountAmount))
  const taxable = Math.max(0, subtotal - discount)
  return taxable + Math.round(taxable * Math.min(100, Math.max(0, draft.taxRate)) / 100)
}

function invoiceSummaryFromDraft(draft: InvoiceEditorDraft, clients: Client[], projects: Project[]): Invoice {
  const client = clients.find((item) => item.id === draft.clientId)
  const project = projects.find((item) => item.id === draft.projectId)
  return {
    id: draft.id ?? `invoice-${Date.now()}`,
    number: draft.invoiceNumber,
    clientId: draft.clientId || undefined,
    projectId: draft.projectId || undefined,
    client: draft.recipientCompany || client?.company || draft.recipientName || 'Tanpa klien',
    project: project?.name || draft.items[0]?.description || 'Tanpa proyek',
    issuedDate: localTaskDueLabel(draft.issueDate),
    dueDate: localTaskDueLabel(draft.dueDate),
    amount: invoiceDraftTotal(draft),
    status: draft.status === 'Paid' ? 'Paid' : draft.status === 'DP' ? 'Partial' : 'Unpaid',
    documentStatus: draft.status,
  }
}

function serviceQuoteTotals(draft: Pick<ServiceQuoteDraft, 'items' | 'discountAmount' | 'taxRate'>) {
  const subtotal = draft.items.reduce((total, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0)
    const price = Math.max(0, Number(item.unitPrice) || 0)
    const minimum = Math.max(0, Number(item.minimumFee) || 0)
    return total + Math.max(minimum, Math.round(quantity * price))
  }, 0)
  const discount = Math.min(subtotal, Math.max(0, Number(draft.discountAmount) || 0))
  const taxable = Math.max(0, subtotal - discount)
  const taxAmount = Math.round(taxable * Math.min(100, Math.max(0, Number(draft.taxRate) || 0)) / 100)
  return { subtotal, taxAmount, totalAmount: taxable + taxAmount }
}

export default function App() {
  const [signedIn, setSignedIn] = useState(() => !isSupabaseConfigured && sessionStorage.getItem(demoSessionKey) === 'true')
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [hash, setHash] = useState(getHash)
  const [route, setRoute] = useState<RouteName>(() => getRoute(getHash()))
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [sidebarProfile, setSidebarProfile] = useState<SettingsProfile>({ id: 'local-user', fullName: 'Arunika', displayName: 'Arunika', username: 'arunika', email: '', phone: '', bio: '', roleTitle: 'Developer · Owner', accountType: 'Owner' })
  const [projects, setProjects] = useState<Project[]>([])
  const [payments, setPayments] = useState<ProjectPayment[]>([])
  const [paymentHistorySupported, setPaymentHistorySupported] = useState(() => !isSupabaseConfigured)
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, InvoiceEditorDraft>>({})
  const [serviceCatalogs, setServiceCatalogs] = useState<ServiceCatalog[]>([])
  const [serviceQuotes, setServiceQuotes] = useState<ServiceQuote[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [orderSubmissions, setOrderSubmissions] = useState<OrderSubmission[]>([])
  const [consultationBookings, setConsultationBookings] = useState<ConsultationBooking[]>([])
  const [timelines, setTimelines] = useState<Record<string, TimelineItem[]>>({})
  const [dataError, setDataError] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem(themeKey) === 'dark')
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const notify = useCallback((message: string, action?: string) => setToast({
    id: Date.now(),
    message: sanitizeUserMessage(message),
    action: action ? sanitizeUserMessage(action, '') : undefined,
  }), [])

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured) return
    try {
      if (!silent) setDataError('')
      const snapshot = await loadWorkspaceSnapshot()
      setWorkspaceId(snapshot.workspaceId)
      setProjects(snapshot.projects)
      setPayments(snapshot.payments)
      setPaymentHistorySupported(snapshot.paymentHistorySupported)
      setTasks(snapshot.tasks)
      setClients(snapshot.clients)
      setInvoices(snapshot.invoices)
      setNotifications(snapshot.notifications)
      setOrderSubmissions(snapshot.orderSubmissions)
      setTimelines(snapshot.timelines)
      const consultationData = await loadWorkspaceConsultationData(snapshot.workspaceId).catch(() => null)
      if (consultationData) setConsultationBookings(consultationData.bookings)
    } catch (error) {
      if (!silent) setDataError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Data workspace belum dapat dimuat.')
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false)
      return
    }
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSignedIn(Boolean(data.session))
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setSignedIn(Boolean(session))
      setAuthLoading(false)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (signedIn && isSupabaseConfigured) void loadWorkspace()
  }, [loadWorkspace, signedIn])

  useEffect(() => {
    if (!signedIn || !isSupabaseConfigured || !supabase || !workspaceId) return
    const supabaseClient = supabase
    const channel = supabaseClient
      .channel('workspace-intake-' + workspaceId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_submissions', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
        notify('Order baru masuk untuk ditinjau. Data klien dan proyek telah diperbarui.')
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_submissions', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_bookings', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_timeline', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
    if (paymentHistorySupported) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_payment_records', filter: 'workspace_id=eq.' + workspaceId }, () => {
        void loadWorkspace(true)
      })
    }
    channel.subscribe()
    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }, [loadWorkspace, notify, paymentHistorySupported, signedIn, workspaceId])

  useEffect(() => {
    if (!signedIn || !isSupabaseConfigured) return
    let refreshRunning = false
    const refreshSilently = () => {
      if (document.visibilityState !== 'visible' || refreshRunning) return
      refreshRunning = true
      void loadWorkspace(true).finally(() => { refreshRunning = false })
    }
    const timer = window.setInterval(refreshSilently, 20_000)
    window.addEventListener('focus', refreshSilently)
    document.addEventListener('visibilitychange', refreshSilently)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshSilently)
      document.removeEventListener('visibilitychange', refreshSilently)
    }
  }, [loadWorkspace, signedIn])

  useEffect(() => {
    const syncRoute = () => {
      const nextHash = getHash()
      setHash(nextHash)
      setRoute(getRoute(nextHash))
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const commandSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (signedIn) setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', commandSearch)
    return () => document.removeEventListener('keydown', commandSearch)
  }, [signedIn])

  useEffect(() => {
    localStorage.setItem(themeKey, dark ? 'dark' : 'light')
    document.documentElement.classList.toggle('theme-dark', dark)
    document.body.classList.toggle('theme-dark', dark)
    document.body.classList.toggle('settings-theme-dark', dark)
  }, [dark])

  useEffect(() => {
    if (!signedIn || !isSupabaseConfigured || !workspaceId) return
    let active = true
    void loadWorkspaceSettings(workspaceId).then((settings) => {
      if (!active) return
      const preference = settings.preferences
      setSidebarProfile(settings.profile)
      const effectiveDark = preference.theme === 'system'
        ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
        : preference.theme === 'dark'
      setDark(effectiveDark)
      document.body.classList.toggle('settings-accent-purple', preference.accentColor === 'purple')
      document.body.classList.toggle('settings-accent-green', preference.accentColor === 'green')
      document.body.classList.toggle('settings-accent-orange', preference.accentColor === 'orange')
      document.body.classList.toggle('settings-density-compact', preference.density === 'Compact')
      document.body.classList.toggle('settings-large-text', preference.largerText)
      document.body.classList.toggle('settings-reduced-motion', preference.reduceAnimations)
      document.body.classList.toggle('settings-high-contrast', preference.highContrast)
      document.body.classList.toggle('settings-sidebar-collapsed', preference.sidebarMode === 'Collapsed')
      document.body.classList.toggle('settings-hide-breadcrumbs', !preference.showBreadcrumbs)
      document.body.classList.toggle('settings-hide-page-descriptions', !preference.showPageDescriptions)
    }).catch(() => {
      // Settings is optional until the incremental SQL update has been applied.
    })
    return () => { active = false }
  }, [signedIn, workspaceId])

  const navigateToHash = (nextHash: string, nextRoute: RouteName) => {
    window.location.hash = nextHash
    setHash(nextHash)
    setRoute(nextRoute)
  }

  const navigate = (next: RouteName) => navigateToHash('/' + next, next)

  const openProjectDetail = (project: Project) => {
    navigateToHash('/projects/' + encodeURIComponent(project.id), 'projects')
  }

  const openClientProfile = (client: Client) => {
    navigateToHash('/clients/' + encodeURIComponent(client.id), 'clients')
  }

  const openProjectForm = () => {
    setEditingProject(null)
    setProjectFormOpen(true)
  }

  const openEditProject = (project: Project) => {
    setEditingProject(project)
    setProjectFormOpen(true)
  }

  const login = async (username: string, password: string) => {
    if (isSupabaseConfigured) await loginWithUsername(username, password)
    else sessionStorage.setItem(demoSessionKey, 'true')
    setSignedIn(true)
    navigate('dashboard')
    notify('Selamat datang kembali, Arunika.')
  }

  const startDemo = () => {
    sessionStorage.setItem(demoSessionKey, 'true')
    setSignedIn(true)
    navigate('dashboard')
    notify('Demo Nayagement siap digunakan.')
  }

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut()
    sessionStorage.removeItem(demoSessionKey)
    setWorkspaceId(null)
    setSignedIn(false)
    navigateToHash('/login', 'dashboard')
    notify('Anda telah keluar dari workspace.')
  }

  const openClientPortal = (project: Project) => {
    const path = clientPortalPath(project)
    if (!path) {
      notify('Akses portal klien belum diaktifkan untuk proyek ini.')
      return
    }
    const url = window.location.origin + window.location.pathname + '#' + path
    const popup = window.open(url, '_blank')
    if (popup) {
      popup.opener = null
      return
    }
    window.location.hash = path
    setHash(path)
    setRoute('projects')
  }

  const copyClientLink = async (project: Project) => {
    const path = clientPortalPath(project)
    if (!path) {
      notify('Akses portal klien belum diaktifkan untuk proyek ini.')
      return
    }
    const url = window.location.origin + window.location.pathname + '#' + path
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const helper = document.createElement('textarea')
        helper.value = url
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.append(helper)
        helper.select()
        document.execCommand('copy')
        helper.remove()
      }
      notify('Tautan portal klien disalin.')
    } catch {
      notify('Browser menolak menyalin otomatis. Buka Preview untuk menyalin URL dari halaman portal.')
    }
  }

  const createProject = async (data: ProjectFormData) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const project = await createWorkspaceProject(workspaceId, data)
      setProjects((current) => [project, ...current])
      setProjectFormOpen(false)
      setEditingProject(null)
      openProjectDetail(project)
      void loadWorkspace()
      notify(data.name + ' berhasil disimpan.')
      return
    }
    const next: Project = {
      id: 'p-' + Date.now(),
      code: 'NAYA-' + String(projects.length + 20).padStart(3, '0'),
      name: data.name,
      client: data.client,
      type: data.type,
      dueDate: data.dueDate,
      priority: data.priority,
      estimatedValue: data.value,
      description: data.description,
      startDate: new Date().toISOString().slice(0, 10),
      paid: 0,
      progress: 0,
      status: 'Inquiry',
      owner: 'Arunika',
      accent: accentOptions[projects.length % accentOptions.length],
    }
    setProjects((current) => [next, ...current])
    setProjectFormOpen(false)
    setEditingProject(null)
    openProjectDetail(next)
    notify(data.name + ' berhasil dibuat.')
  }

  const createClient = async (data: ClientFormData) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const client = await createWorkspaceClient(workspaceId, data)
      setClients((current) => [client, ...current])
      void loadWorkspace()
      notify('Klien baru berhasil ditambahkan.')
      return
    }

    const company = data.company || data.name
    const client: Client = {
      id: 'c-' + Date.now(),
      name: data.name,
      company,
      email: data.email || undefined,
      whatsapp: data.whatsapp || undefined,
      notes: data.notes || undefined,
      initials: initials(company),
      status: data.status,
      projects: 0,
      revenue: 0,
      lastOrder: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      accent: accentOptions[clients.length % accentOptions.length],
    }
    setClients((current) => [client, ...current])
    notify('Klien baru berhasil ditambahkan.')
  }

  const saveClientProfile = async (client: Client, data: ClientProfileFormData, logoFile?: File | null) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      let logoPath = client.logoPath ?? null
      if (logoFile) {
        const uploaded = await uploadWorkspaceClientLogo(workspaceId, client.id, logoFile)
        logoPath = uploaded.logoPath
      }
      const saved = await updateWorkspaceClientProfile(workspaceId, client.id, { ...data, logoPath })
      const next = {
        ...client,
        ...saved,
        projects: client.projects,
        revenue: client.revenue,
        lastOrder: client.lastOrder,
        accent: client.accent,
      }
      setClients((current) => current.map((item) => item.id === client.id ? next : item))
      void loadWorkspace()
      notify('Profil klien diperbarui.')
      return
    }

    const company = data.company || data.name
    const logoUrl = logoFile ? await localFileDataUrl(logoFile) : client.logoUrl
    setClients((current) => current.map((item) => item.id === client.id ? {
      ...item,
      name: data.name,
      company,
      email: data.email || undefined,
      whatsapp: data.whatsapp || undefined,
      description: data.description || undefined,
      notes: data.notes || undefined,
      logoUrl,
      initials: initials(company),
      status: data.status,
    } : item))
    notify('Profil klien diperbarui.')
  }

  const deleteClient = async (client: Client) => {
    if (!window.confirm(`Hapus klien "${client.company || client.name}"? Proyek dan invoice yang pernah terhubung tetap tersimpan tanpa relasi klien.`)) return
    try {
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
        await deleteWorkspaceClient(workspaceId, client.id)
      }
      setClients((current) => current.filter((item) => item.id !== client.id))
      setProjects((current) => current.map((project) => project.clientId === client.id
        ? { ...project, clientId: undefined, client: 'Tanpa klien' }
        : project))
      if (routeDetailId(getHash(), 'clients') === client.id) navigate('clients')
      if (isSupabaseConfigured) void loadWorkspace()
      notify('Klien berhasil dihapus.')
    } catch (error) {
      notify(error instanceof Error ? sanitizeUserMessage(error.message) : 'Klien tidak dapat dihapus.')
    }
  }

  const saveProjectForm = async (data: ProjectFormData) => {
    if (!editingProject) {
      await createProject(data)
      return
    }
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const saved = await updateWorkspaceProject(workspaceId, editingProject.id, data)
      const project = {
        ...saved,
        publicToken: editingProject.publicToken,
        publicCode: editingProject.publicCode,
        publicSlug: editingProject.publicSlug,
        paid: editingProject.paid,
      }
      setProjects((current) => current.map((item) => item.id === project.id ? project : item))
      setProjectFormOpen(false)
      setEditingProject(null)
      void loadWorkspace()
      notify(project.name + ' berhasil diperbarui.')
      return
    }
    const project: Project = {
      ...editingProject,
      name: data.name,
      client: data.client,
      type: data.type,
      dueDate: data.dueDate,
      priority: data.priority,
      estimatedValue: data.value,
      description: data.description,
      status: data.status,
      progress: data.progress,
    }
    setProjects((current) => current.map((item) => item.id === project.id ? project : item))
    setProjectFormOpen(false)
    setEditingProject(null)
    notify(project.name + ' berhasil diperbarui.')
  }

  const saveProjectProgress = async (project: Project, progress: number, status: Project['status']) => {
    const previous = projects
    const nextProgress = Math.min(100, Math.max(0, Math.round(progress)))
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, progress: nextProgress, status } : item))
    if (!isSupabaseConfigured) {
      notify('Kemajuan proyek diperbarui.')
      return
    }
    if (!workspaceId) {
      setProjects(previous)
      throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
    }
    try {
      await updateWorkspaceProjectProgress(workspaceId, project.id, nextProgress, status)
      void loadWorkspace()
      notify('Kemajuan proyek disimpan.')
    } catch (error) {
      setProjects(previous)
      notify(error instanceof Error ? error.message : 'Kemajuan proyek tidak dapat diperbarui.')
      throw error
    }
  }

  const saveProjectPayment = async (project: Project, paidAmount: number) => {
    const previous = projects
    const normalizedEstimatedValue = Math.max(0, Math.round(project.estimatedValue))
    const normalizedPaidAmount = Math.max(0, Math.min(Number.isFinite(paidAmount) ? Math.round(paidAmount) : 0, normalizedEstimatedValue))
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, paid: normalizedPaidAmount } : item))
    if (!isSupabaseConfigured) {
      notify('Pembayaran proyek diperbarui.')
      return
    }
    if (!workspaceId) {
      setProjects(previous)
      throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
    }
    try {
      await updateWorkspaceProjectPayment(workspaceId, project.id, normalizedPaidAmount, project.estimatedValue)
      void loadWorkspace()
      notify('Pembayaran proyek diperbarui.')
    } catch (error) {
      setProjects(previous)
      notify(error instanceof Error ? error.message : 'Pembayaran proyek tidak dapat diperbarui.')
      throw error
    }
  }

  const recordFinancePayment = async (input: ProjectPaymentInput) => {
    const project = projects.find((item) => item.id === input.projectId)
    if (!project) throw new Error('Proyek tidak ditemukan.')

    const amount = Math.round(Number(input.amount))
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Masukkan nominal pembayaran yang valid.')
    const outstanding = Math.max(0, project.estimatedValue - project.paid)
    if (project.estimatedValue > 0 && amount > outstanding) throw new Error(`Nominal melebihi sisa pembayaran ${outstanding.toLocaleString('id-ID')}.`)

    const parsedPaidAt = input.paidAt ? new Date(`${input.paidAt}T12:00:00`) : new Date()
    const localPaidAt = Number.isNaN(parsedPaidAt.getTime()) ? new Date().toISOString() : parsedPaidAt.toISOString()

    if (!isSupabaseConfigured) {
      const nextPaid = project.paid + amount
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, paid: nextPaid } : item))
      setPayments((current) => [{
        id: `payment-${Date.now()}`,
        projectId: project.id,
        projectName: project.name,
        client: project.client,
        amount,
        paidAt: localPaidAt,
        method: input.method,
        notes: input.notes || undefined,
      }, ...current])
      setPaymentHistorySupported(true)
      notify('Pembayaran berhasil dicatat.')
      return
    }

    if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
    const saved = await createWorkspaceProjectPayment(workspaceId, input)
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, paid: saved.projectPaidAmount } : item))
    setPayments((current) => [{
      id: saved.id,
      projectId: project.id,
      projectName: project.name,
      client: project.client,
      amount: saved.amount,
      paidAt: saved.paidAt,
      method: input.method || undefined,
      notes: input.notes || undefined,
    }, ...current])
    setPaymentHistorySupported(true)
    void loadWorkspace()
    notify('Pembayaran berhasil dicatat.')
  }

  const loadInvoiceEditor = async (invoiceId: string) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      return await loadWorkspaceInvoiceEditor(workspaceId, invoiceId)
    }
    return invoiceDrafts[invoiceId] ?? invoiceEditorFromSummary(invoices.find((invoice) => invoice.id === invoiceId), clients, projects)
  }

  const saveInvoiceEditor = async (draft: InvoiceEditorDraft, logoFile: File | null, signatureFile: File | null) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      let nextDraft = draft
      if (logoFile) {
        const uploaded = await uploadWorkspaceInvoiceLogo(workspaceId, draft.id, logoFile)
        nextDraft = { ...nextDraft, logoPath: uploaded.logoPath, logoUrl: uploaded.logoUrl }
      }
      if (signatureFile) {
        const uploaded = await uploadWorkspaceInvoiceSignature(workspaceId, draft.id, signatureFile)
        nextDraft = { ...nextDraft, signaturePath: uploaded.signaturePath, signatureUrl: uploaded.signatureUrl }
      }
      const saved = await saveWorkspaceInvoiceEditor(workspaceId, nextDraft)
      setInvoiceDrafts((current) => ({ ...current, [saved.id ?? nextDraft.id ?? `invoice-${Date.now()}`]: saved }))
      const summary = invoiceSummaryFromDraft(saved, clients, projects)
      setInvoices((current) => current.some((invoice) => invoice.id === summary.id)
        ? current.map((invoice) => invoice.id === summary.id ? summary : invoice)
        : [summary, ...current])
      void loadWorkspace()
      notify('Invoice berhasil disimpan.')
      return saved
    }

    const id = draft.id ?? `invoice-${Date.now()}`
    const logoUrl = logoFile ? await localFileDataUrl(logoFile) : draft.logoUrl
    const signatureUrl = signatureFile ? await localFileDataUrl(signatureFile) : draft.signatureUrl
    const saved = { ...draft, id, logoUrl, signatureUrl }
    const summary = invoiceSummaryFromDraft(saved, clients, projects)
    setInvoiceDrafts((current) => ({ ...current, [id]: saved }))
    setInvoices((current) => current.some((invoice) => invoice.id === id)
      ? current.map((invoice) => invoice.id === id ? summary : invoice)
      : [summary, ...current])
    notify('Invoice berhasil disimpan.')
    return saved
  }

  const saveInvoiceStatus = async (invoice: Invoice, status: InvoiceDocumentStatus) => {
    const previous = invoices
    const summaryStatus: Invoice['status'] = status === 'Paid' ? 'Paid' : status === 'DP' ? 'Partial' : 'Unpaid'
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: summaryStatus, documentStatus: status } : item))
    setInvoiceDrafts((current) => current[invoice.id] ? { ...current, [invoice.id]: { ...current[invoice.id], status } } : current)
    if (!isSupabaseConfigured) {
      notify('Status invoice diperbarui.')
      return
    }
    try {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      await updateWorkspaceInvoiceStatus(workspaceId, invoice.id, status)
      void loadWorkspace()
      notify('Status invoice diperbarui.')
    } catch (error) {
      setInvoices(previous)
      notify(error instanceof Error ? error.message : 'Status invoice tidak dapat diperbarui.')
      throw error
    }
  }

  const loadServiceQuoteData = async () => {
    if (!isSupabaseConfigured) return
    if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
    const data = await loadWorkspaceServiceQuoteData(workspaceId)
    setServiceCatalogs(data.catalogs)
    setServiceQuotes(data.quotes)
  }

  const saveServiceCatalog = async (input: ServiceCatalogInput, catalogId?: string) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const saved = await saveWorkspaceServiceCatalog(workspaceId, input, catalogId)
      setServiceCatalogs((current) => [saved, ...current.filter((catalog) => catalog.id !== saved.id)]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()))
      return
    }
    const now = new Date().toISOString()
    const existing = catalogId ? serviceCatalogs.find((catalog) => catalog.id === catalogId) : undefined
    const saved: ServiceCatalog = {
      id: catalogId ?? `service-${Date.now()}`,
      name: input.name.trim(),
      category: input.category.trim() || 'Lainnya',
      description: input.description.trim(),
      pricingMode: input.pricingMode,
      minimumFee: Math.max(0, Math.round(Number(input.minimumFee) || 0)),
      defaultUnitLabel: input.defaultUnitLabel.trim() || 'paket',
      defaultUnitPrice: Math.max(0, Math.round(Number(input.defaultUnitPrice) || 0)),
      defaultQuantity: Math.max(0.01, Number(input.defaultQuantity) || 1),
      isActive: input.isActive,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    setServiceCatalogs((current) => [saved, ...current.filter((catalog) => catalog.id !== saved.id)]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()))
  }

  const deleteServiceCatalog = async (catalog: ServiceCatalog) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      await deleteWorkspaceServiceCatalog(workspaceId, catalog.id)
    }
    setServiceCatalogs((current) => current.filter((item) => item.id !== catalog.id))
  }

  const saveServiceQuote = async (draft: ServiceQuoteDraft) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const saved = await saveWorkspaceServiceQuote(workspaceId, draft)
      setServiceQuotes((current) => [saved, ...current.filter((quote) => quote.id !== saved.id)]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()))
      return saved
    }
    const now = new Date().toISOString()
    const existing = draft.id ? serviceQuotes.find((quote) => quote.id === draft.id) : undefined
    const totals = serviceQuoteTotals(draft)
    const saved: ServiceQuote = {
      ...draft,
      id: draft.id ?? `quote-${Date.now()}`,
      title: draft.title.trim() || 'Penawaran layanan',
      quoteNumber: draft.quoteNumber.trim(),
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      items: draft.items.map((item) => ({ ...item })),
      convertedInvoiceId: existing?.convertedInvoiceId,
    }
    setServiceQuotes((current) => [saved, ...current.filter((quote) => quote.id !== saved.id)]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()))
    return saved
  }

  const deleteServiceQuote = async (quote: ServiceQuote) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      await deleteWorkspaceServiceQuote(workspaceId, quote.id)
    }
    setServiceQuotes((current) => current.filter((item) => item.id !== quote.id))
  }

  const markServiceQuoteConverted = async (quoteId: string, invoiceId: string) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const saved = await markWorkspaceServiceQuoteConverted(workspaceId, quoteId, invoiceId)
      setServiceQuotes((current) => current.map((quote) => quote.id === quoteId ? saved : quote))
      return
    }
    setServiceQuotes((current) => current.map((quote) => quote.id === quoteId ? {
      ...quote,
      status: 'Converted',
      convertedInvoiceId: invoiceId,
      updatedAt: new Date().toISOString(),
    } : quote))
  }

  const saveOrderSubmissionStatus = async (submission: OrderSubmission, status: OrderSubmissionStatus) => {
    const previous = orderSubmissions
    setOrderSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, status } : item))
    if (!isSupabaseConfigured) {
      notify('Status order diperbarui.')
      return
    }
    try {
      await updateWorkspaceOrderSubmissionStatus(submission.id, status)
      void loadWorkspace()
      notify('Status order diperbarui.')
    } catch (error) {
      setOrderSubmissions(previous)
      const message = error instanceof Error ? error.message : 'Status order tidak dapat diperbarui.'
      notify(message)
      throw error
    }
  }

  const deleteOrderSubmission = async (submission: OrderSubmission) => {
    if (!window.confirm('Hapus brief dari "' + submission.submitterName + '"? Data brief akan dihapus, tetapi data klien dan proyek yang sudah dibuat tetap aman.')) return false
    const previous = orderSubmissions
    setOrderSubmissions((current) => current.filter((item) => item.id !== submission.id))
    if (!isSupabaseConfigured) {
      notify('Brief klien dihapus.')
      return true
    }
    try {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      await deleteWorkspaceOrderSubmission(workspaceId, submission.id)
      void loadWorkspace()
      notify('Brief klien dihapus.')
      return true
    } catch (error) {
      setOrderSubmissions(previous)
      notify(error instanceof Error ? error.message : 'Brief klien tidak dapat dihapus.')
      throw error
    }
  }

  const deleteProject = async (project: Project) => {
    if (!window.confirm('Hapus proyek "' + project.name + '"? Tugas, aktivitas, dan akses portal yang terkait juga akan dihapus dari database.')) return
    try {
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
        await deleteWorkspaceProject(workspaceId, project.id)
      }
      setProjects((current) => current.filter((item) => item.id !== project.id))
      setTasks((current) => current.filter((task) => task.projectId !== project.id && task.project !== project.name))
      setTimelines((current) => {
        const next = { ...current }
        delete next[project.id]
        return next
      })
      if (routeDetailId(hash, 'projects') === project.id) navigate('projects')
      if (isSupabaseConfigured) void loadWorkspace()
      notify(project.name + ' telah dihapus dari database.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Proyek tidak dapat dihapus.')
    }
  }

  const enableClientPortal = async (project: Project) => {
    try {
      if (isSupabaseConfigured) {
        await enableWorkspaceProjectPortal(project.id)
        await loadWorkspace()
      } else {
        setProjects((current) => current.map((item) => item.id === project.id ? {
          ...item,
          publicToken: 'demo-' + item.id,
          publicSlug: item.publicSlug ?? demoProjectSlug(item),
        } : item))
      }
      notify('Akses portal klien aktif. Tautan siap dibagikan.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Akses portal klien tidak dapat diaktifkan.')
    }
  }

  const addProjectTask = async (project: Project, input: { name: string; description?: string; dueAt?: string; priority: Project['priority']; visibleToClient: boolean }) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const task = await createWorkspaceTask(workspaceId, { projectId: project.id, ...input })
      setTasks((current) => [...current, task])
      void loadWorkspace()
    } else {
      setTasks((current) => [...current, {
        id: 'task-' + Date.now(),
        projectId: project.id,
        project: project.name,
        name: input.name,
        description: input.description,
        due: input.dueAt || 'Belum dijadwalkan',
        dueAt: input.dueAt ?? null,
        status: 'Todo',
        priority: input.priority,
        visibleToClient: input.visibleToClient,
        progress: 0,
        notes: [],
        attachments: [],
      }])
    }
    notify('Tugas baru disimpan.')
  }

  const loadTaskDetail = async (task: Task) => {
    if (!isSupabaseConfigured) return task
    const detail = await loadWorkspaceTaskDetail(task.id)
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...detail } : item))
    return detail
  }

  const saveTaskDetail = async (task: Task, input: TaskDetailInput) => {
    try {
      const saved = isSupabaseConfigured
        ? await updateWorkspaceTaskDetail(task.id, input)
        : {
            ...task,
            name: input.name.trim(),
            description: input.description?.trim() || undefined,
            brief: input.brief?.trim() || undefined,
            dueAt: input.dueAt || null,
            due: localTaskDueLabel(input.dueAt),
            priority: input.priority,
            status: input.status,
            progress: Math.min(100, Math.max(0, Math.round(input.progress))),
            visibleToClient: input.visibleToClient,
          }
      setTasks((current) => current.map((item) => item.id === task.id ? {
        ...item,
        ...saved,
        notes: item.notes,
        attachments: item.attachments,
      } : item))
      notify('Detail task disimpan.')
      return saved
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Detail task tidak dapat disimpan.')
      throw error
    }
  }

  const addTaskNote = async (task: Task, body: string) => {
    try {
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
        const note = await createWorkspaceTaskNote(workspaceId, task.id, body)
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, notes: [note, ...(item.notes ?? [])] } : item))
      } else {
        const note = { id: `task-note-${Date.now()}`, body: body.trim(), createdAt: new Date().toISOString() }
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, notes: [note, ...(item.notes ?? [])] } : item))
      }
      notify('Catatan task ditambahkan.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Catatan task tidak dapat ditambahkan.')
      throw error
    }
  }

  const addTaskAttachment = async (task: Task, file: File) => {
    try {
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
        const attachment = await uploadWorkspaceTaskAttachment(workspaceId, task.id, file)
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, attachments: [attachment, ...(item.attachments ?? [])] } : item))
      } else {
        if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran lampiran task maksimal 15 MB.')
        const attachment: TaskAttachment = {
          id: `task-file-${Date.now()}`,
          fileName: file.name,
          storagePath: `demo/${task.id}/${file.name}`,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          createdAt: new Date().toISOString(),
          url: file.type.startsWith('image/') ? await localFileDataUrl(file) : undefined,
        }
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, attachments: [attachment, ...(item.attachments ?? [])] } : item))
      }
      notify('Lampiran task diunggah.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Lampiran task tidak dapat diunggah.')
      throw error
    }
  }

  const removeTaskAttachment = async (task: Task, attachment: TaskAttachment) => {
    if (!window.confirm(`Hapus lampiran "${attachment.fileName}"?`)) return
    try {
      if (isSupabaseConfigured) await deleteWorkspaceTaskAttachment(attachment)
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, attachments: (item.attachments ?? []).filter((itemAttachment) => itemAttachment.id !== attachment.id) } : item))
      notify('Lampiran task dihapus.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Lampiran task tidak dapat dihapus.')
      throw error
    }
  }

  const toggleProjectTask = async (task: Task, status: Task['status']) => {
    const previous = tasks
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item))
    if (!isSupabaseConfigured) {
      notify('Status tugas diperbarui.')
      return
    }
    try {
      await updateWorkspaceTaskStatus(task.id, status)
      void loadWorkspace()
      notify('Status tugas diperbarui.')
    } catch (error) {
      setTasks(previous)
      notify(error instanceof Error ? error.message : 'Status tugas tidak dapat diperbarui.')
    }
  }

  const deleteProjectTask = async (task: Task) => {
    if (!window.confirm('Hapus tugas "' + task.name + '"?')) return
    try {
      if (isSupabaseConfigured) await deleteWorkspaceTask(task.id)
      setTasks((current) => current.filter((item) => item.id !== task.id))
      if (isSupabaseConfigured) void loadWorkspace()
      notify('Tugas dihapus.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Tugas tidak dapat dihapus.')
    }
  }

  const addProjectActivity = async (project: Project, input: { title: string; description?: string; visibleToClient: boolean; occurredAt?: string }) => {
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const activity = await createWorkspaceTimelineActivity(workspaceId, { projectId: project.id, ...input })
      setTimelines((current) => ({ ...current, [project.id]: [...(current[project.id] ?? []), activity] }))
      void loadWorkspace()
    } else {
      const now = input.occurredAt ? new Date(input.occurredAt) : new Date()
      const activity: TimelineItem = {
        id: 'activity-' + Date.now(),
        title: input.title,
        description: input.description || 'Pembaruan proyek.',
        date: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(now),
        time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(now).replace('.', ':'),
        occurredAt: now.toISOString(),
        state: 'current',
        visibleToClient: input.visibleToClient,
      }
      setTimelines((current) => ({ ...current, [project.id]: [...(current[project.id] ?? []), activity] }))
    }
    notify(input.visibleToClient ? 'Aktivitas disimpan dan terlihat di portal klien.' : 'Aktivitas internal disimpan.')
  }

  const updateProjectActivity = async (project: Project, item: TimelineItem, input: { title: string; description?: string; visibleToClient: boolean; occurredAt?: string }) => {
    if (!item.id) return
    if (isSupabaseConfigured) {
      if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
      const activity = await updateWorkspaceTimelineActivity(workspaceId, item.id, { projectId: project.id, ...input })
      setTimelines((current) => ({
        ...current,
        [project.id]: (current[project.id] ?? []).map((entry) => entry.id === item.id ? activity : entry),
      }))
      void loadWorkspace()
    } else {
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date(item.occurredAt ?? Date.now())
      const activity: TimelineItem = {
        ...item,
        title: input.title,
        description: input.description || 'Pembaruan proyek.',
        occurredAt: occurredAt.toISOString(),
        date: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(occurredAt),
        time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(occurredAt).replace('.', ':'),
        visibleToClient: input.visibleToClient,
      }
      setTimelines((current) => ({ ...current, [project.id]: (current[project.id] ?? []).map((entry) => entry.id === item.id ? activity : entry) }))
    }
    notify('Aktivitas proyek diperbarui.')
  }

  const deleteProjectActivity = async (project: Project, item: TimelineItem) => {
    if (!item.id) return
    if (!window.confirm('Hapus aktivitas "' + item.title + '"?')) return
    try {
      if (isSupabaseConfigured) await deleteWorkspaceTimelineActivity(item.id)
      setTimelines((current) => ({ ...current, [project.id]: (current[project.id] ?? []).filter((activity) => activity.id !== item.id) }))
      if (isSupabaseConfigured) void loadWorkspace()
      notify('Aktivitas dihapus.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Aktivitas tidak dapat dihapus.')
    }
  }

  const toggleTask = async (id: string) => {
    const target = tasks.find((task) => task.id === id)
    if (!target) return
    await toggleProjectTask(target, target.status === 'Completed' ? 'Todo' : 'Completed')
  }

  const readNotification = async (id: string) => {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, unread: false } : notification))
    if (isSupabaseConfigured) {
      try {
        await markWorkspaceNotificationRead(id)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Notifikasi tidak dapat diperbarui.')
      }
    }
  }

  const markAllNotificationsRead = async () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, unread: false })))
    if (isSupabaseConfigured && workspaceId) {
      try {
        await markAllWorkspaceNotificationsRead(workspaceId)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Notifikasi tidak dapat diperbarui.')
      }
    }
    notify('Semua notifikasi ditandai sudah dibaca.')
  }

  const projectDetailId = routeDetailId(hash, 'projects')
  const clientDetailId = routeDetailId(hash, 'clients')
  const invoiceDetailId = routeDetailId(hash, 'invoices')
  const invoiceDetailAction = hash.split('/').filter(Boolean)[2] ?? ''
  let page: JSX.Element

  switch (route) {
    case 'projects': {
      const project = projectDetailId ? projects.find((item) => item.id === projectDetailId) : null
      if (projectDetailId && !project) {
        page = <div className="empty-state"><strong>Proyek tidak ditemukan</strong><p>Proyek ini mungkin sudah dihapus atau Anda tidak lagi memiliki akses.</p><button className="soft-button" onClick={() => navigate('projects')}>Kembali ke proyek</button></div>
      } else if (project) {
        page = <ProjectDetailPage
          project={project}
          tasks={tasks}
          timeline={timelines[project.id] ?? []}
          onBack={() => navigate('projects')}
          onEdit={() => openEditProject(project)}
          onDelete={() => { void deleteProject(project) }}
          onCopyLink={() => { void copyClientLink(project) }}
          onOpenPortal={() => openClientPortal(project)}
          onEnablePortal={() => enableClientPortal(project)}
          onOpenClient={() => {
            const client = clients.find((item) => item.id === project.clientId || item.company === project.client)
            if (client) openClientProfile(client)
            else navigate('clients')
          }}
          onSaveProgress={(progress, status) => saveProjectProgress(project, progress, status)}
          onSavePayment={(paidAmount) => saveProjectPayment(project, paidAmount)}
          onAddTask={(input) => addProjectTask(project, input)}
          onToggleTask={(task, status) => toggleProjectTask(task, status)}
          onDeleteTask={(task) => deleteProjectTask(task)}
          onAddActivity={(input) => addProjectActivity(project, input)}
          onUpdateActivity={(item, input) => updateProjectActivity(project, item, input)}
          onDeleteActivity={(item) => deleteProjectActivity(project, item)}
        />
      } else {
        page = <ProjectsPage projects={projects} onOpenProject={openProjectForm} onOpenOrderForms={() => navigate('forms')} onViewProject={openProjectDetail} onOpenClientPortal={openClientPortal} onEditProject={openEditProject} onDeleteProject={(project) => { void deleteProject(project) }} />
      }
      break
    }
    case 'calendar':
      page = <CalendarPage
        projects={projects}
        tasks={tasks}
        timelines={timelines}
        consultationBookings={consultationBookings}
        onCreateProject={openProjectForm}
        onOpenProject={(projectId) => {
          const project = projects.find((item) => item.id === projectId)
          if (project) openProjectDetail(project)
          else navigate('projects')
        }}
        onOpenConsultations={() => navigate('bookings')}
        onLoadTaskDetail={loadTaskDetail}
        onSaveTaskDetail={saveTaskDetail}
        onAddTaskNote={addTaskNote}
        onUploadTaskAttachment={addTaskAttachment}
        onDeleteTaskAttachment={removeTaskAttachment}
      />
      break
    case 'tasks':
      page = <TasksPage projects={projects} tasks={tasks} onAddTask={addProjectTask} onUpdateTask={toggleProjectTask} onDeleteTask={deleteProjectTask} onLoadTaskDetail={loadTaskDetail} onSaveTaskDetail={saveTaskDetail} onAddTaskNote={addTaskNote} onUploadTaskAttachment={addTaskAttachment} onDeleteTaskAttachment={removeTaskAttachment} onOpenProject={(projectId) => {
        const project = projects.find((item) => item.id === projectId)
        if (project) openProjectDetail(project)
        else navigate('projects')
      }} />
      break
    case 'clients': {
      const client = clientDetailId ? clients.find((item) => item.id === clientDetailId) : null
      page = client
        ? <ClientProfilePage client={client} projects={projects} onBack={() => navigateToHash('/clients', 'clients')} onOpenProject={openProjectDetail} onSaveProfile={(data, logoFile) => saveClientProfile(client, data, logoFile)} />
        : <ClientsPage clients={clients} onOpenClient={openClientProfile} onCreateClient={createClient} onUpdateClient={saveClientProfile} onDeleteClient={(client) => { void deleteClient(client) }} />
      break
    }
    case 'finance':
      page = <FinancePage projects={projects} invoices={invoices} payments={payments} paymentHistorySupported={paymentHistorySupported} onRecordPayment={recordFinancePayment} />
      break
    case 'personal-finance':
      page = <PersonalFinancePage workspaceId={workspaceId} businessPayments={payments} onToast={notify} />
      break
    case 'content-plan':
      page = <ContentPlanPage workspaceId={workspaceId} clients={clients} onToast={notify} />
      break
    case 'invoices':
      page = <InvoicesPage invoices={invoices} clients={clients} projects={projects} initialInvoiceId={invoiceDetailId} downloadOnOpen={invoiceDetailAction === 'pdf'} onToast={notify} onLoadInvoice={loadInvoiceEditor} onSaveInvoice={saveInvoiceEditor} onUpdateInvoiceStatus={saveInvoiceStatus} serviceCatalogs={serviceCatalogs} serviceQuotes={serviceQuotes} onLoadServiceQuoteData={loadServiceQuoteData} onSaveServiceCatalog={saveServiceCatalog} onDeleteServiceCatalog={deleteServiceCatalog} onSaveServiceQuote={saveServiceQuote} onDeleteServiceQuote={deleteServiceQuote} onMarkServiceQuoteConverted={markServiceQuoteConverted} />
      break
    case 'forms':
      page = <OrderFormsPage workspaceId={workspaceId} submissions={orderSubmissions} incomingOrderCount={orderSubmissions.filter((submission) => submission.status === 'New').length} onOpenOrders={() => navigate('orders')} onToast={notify} />
      break
    case 'orders':
      page = <OrdersPage submissions={orderSubmissions} onRefresh={() => { void loadWorkspace() }} onUpdateStatus={saveOrderSubmissionStatus} onDeleteSubmission={deleteOrderSubmission} onOpenProject={(projectId) => {
        const project = projects.find((item) => item.id === projectId)
        if (project) openProjectDetail(project)
        else navigate('projects')
      }} />
      break
    case 'bookings':
      page = <ConsultationsPage workspaceId={workspaceId} onToast={notify} onBookingsChange={setConsultationBookings} />
      break
    case 'notifications':
      page = <NotificationsPage notifications={notifications} onToast={notify} onRead={readNotification} onMarkAllRead={markAllNotificationsRead} />
      break
    case 'settings':
      page = <SettingsPage workspaceId={workspaceId} dark={dark} onApplyTheme={(theme) => setDark(theme === 'system' ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false : theme === 'dark')} onProfileSaved={setSidebarProfile} onToast={notify} />
      break
    default:
      page = <DashboardPage projects={projects} tasks={tasks} payments={payments} clients={clients} invoices={invoices} consultationBookings={consultationBookings} userName={sidebarProfile.displayName || sidebarProfile.fullName} onOpenProject={openProjectForm} onOpenProjects={() => navigate('projects')} onOpenCalendar={() => navigate('calendar')} onOpenClients={() => navigate('clients')} onOpenFinance={() => navigate('finance')} onToggleTask={toggleTask} />
  }

  const publicPortalRoute = parsePublicPortalRoute(hash)
  const publicInvoiceRoute = parsePublicInvoiceRoute(hash)
  const isPublicOrder = hash === '/order' || hash.startsWith('/order/')
  if (publicInvoiceRoute) return publicInvoiceRoute.publicCode
    ? <PublicInvoicePage publicCode={publicInvoiceRoute.publicCode} autoDownloadPdf={publicInvoiceRoute.autoDownloadPdf} />
    : <main className="public-page public-unavailable"><div className="brand"><span className="brand-word">nayagement</span></div><h1>Invoice tidak tersedia</h1><p>Tautan invoice tidak lengkap atau tidak valid.</p></main>
  if (publicPortalRoute?.kind === 'unavailable') return <PublicProjectUnavailablePage onBack={() => signedIn ? navigate('dashboard') : navigateToHash('/login', 'dashboard')} />
  if (publicPortalRoute?.kind === 'valid') {
    const project = projects.find((item) => publicPortalRoute.lookup === 'slug'
      ? item.publicSlug === publicPortalRoute.key
      : publicPortalRoute.lookup === 'code'
        ? item.publicCode === publicPortalRoute.key
        : item.publicToken === publicPortalRoute.key)
    const publicTasks = project
      ? tasks
        .filter((task) => (task.projectId === project.id || (!task.projectId && task.project === project.name)) && task.visibleToClient)
        .map((task) => ({ name: task.name, status: task.status, dueAt: task.dueAt ?? null, completedAt: task.status === 'Completed' ? task.dueAt ?? null : null }))
      : []
    return <PublicProjectPage project={project} timeline={project ? timelines[project.id] ?? [] : []} tasks={publicTasks} portalKey={publicPortalRoute.key} lookup={publicPortalRoute.lookup} onBack={() => signedIn ? navigate('dashboard') : navigateToHash('/login', 'dashboard')} />
  }
  if (isPublicOrder) return <PublicOrderFormPage token={hash.split('/').filter(Boolean)[1] ?? ''} onBack={() => signedIn ? navigate('dashboard') : navigateToHash('/login', 'dashboard')} />
  if (hash === '/booking') return <PublicConsultationBookingPage />
  if (authLoading) return <main className="login-page"><section className="login-panel"><div className="login-form-wrap"><p className="eyebrow">Private workspace</p><h2>Menyiapkan workspace…</h2><p>Mengecek sesi aman Anda.</p></div></section></main>
  if (!signedIn) return <LoginPage onLogin={login} onDemo={startDemo} showDemo={!isSupabaseConfigured} />

  return (
    <div className={'nayagement-root ' + (dark ? 'theme-dark' : '')}>
      <WorkspaceLayout
        route={route}
        dark={dark}
        unreadCount={notifications.filter((notification) => notification.unread).length}
        newOrderCount={orderSubmissions.filter((submission) => submission.status === 'New').length}
        newBookingCount={consultationBookings.filter((booking) => booking.status === 'New').length}
        userProfile={sidebarProfile}
        onRouteChange={navigate}
        onOpenProject={openProjectForm}
        onOpenSearch={() => setSearchOpen(true)}
        onToggleDark={() => setDark((current) => !current)}
        onSignOut={() => { void signOut() }}
      >
        {dataError && <p className="workspace-data-warning">{dataError}</p>}
        {page}
      </WorkspaceLayout>
      {projectFormOpen && <ProjectFormModal project={editingProject} onClose={() => { setProjectFormOpen(false); setEditingProject(null) }} onSubmit={saveProjectForm} />}
      {searchOpen && <SearchModal projects={projects} clients={clients} onClose={() => setSearchOpen(false)} onOpenProject={(project) => { setSearchOpen(false); openProjectDetail(project) }} onOpenRoute={(next) => { setSearchOpen(false); navigate(next) }} />}
      {toast && <Toast key={toast.id} message={toast.message} action={toast.action} onDismiss={() => setToast(null)} />}
    </div>
  )
}
