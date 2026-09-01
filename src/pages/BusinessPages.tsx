import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Link2,
  Palette,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Volume2,
  WalletCards,
} from 'lucide-react'
import { createDemoOrderForm, createOrderFormDraft } from '../data/orderFormTemplate'
import { isSupabaseConfigured } from '../lib/supabase'
import { generateInvoiceNumber } from '../lib/invoice'
import { createWorkspaceOrderForm, deleteWorkspaceOrderForm, loadWorkspaceOrderData, updateWorkspaceOrderForm, uploadWorkspaceOrderFormHeaderImage } from '../services/workspaceData'
import type { AppNotification, Client, Invoice, InvoiceDocumentStatus, InvoiceEditorDraft, OrderForm, OrderFormDraft, OrderFormField, OrderFormFieldType, OrderSubmission, Project, ProjectPayment, ProjectPaymentInput, ServiceCatalog, ServiceCatalogInput, ServiceQuote, ServiceQuoteDraft } from '../types'
import { rupiah } from '../lib/format'
import { BrandMark, Modal, ProgressBar } from '../components/ui'
import { InvoiceEditor } from '../components/InvoiceEditor'
import { ServiceCalculator } from '../components/ServiceCalculator'

const paymentMethodOptions = ['Transfer bank', 'Tunai', 'E-wallet', 'Lainnya']
const financeColors = ['#477fdf', '#8872dc', '#5dc19e', '#f0ad77', '#db719f']

function todayInputValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function paymentDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tanggal belum tersedia'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function paymentMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function lastSixPaymentMonths(payments: ProjectPayment[]) {
  const today = new Date()
  const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' })
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)
    return { key: paymentMonthKey(date), label: monthFormatter.format(date), total: 0 }
  })
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  payments.forEach((payment) => {
    const date = new Date(payment.paidAt)
    const bucket = Number.isNaN(date.getTime()) ? undefined : byKey.get(paymentMonthKey(date))
    if (bucket) bucket.total += payment.amount
  })
  return buckets
}

function financeServiceBreakdown(projects: Project[]) {
  const totals = new Map<string, number>()
  projects.forEach((project) => {
    if (project.paid <= 0) return
    const service = project.type.trim() || 'Lainnya'
    totals.set(service, (totals.get(service) ?? 0) + project.paid)
  })
  const entries = [...totals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((left, right) => right.amount - left.amount)
  if (entries.length <= 4) return entries
  const visible = entries.slice(0, 3)
  return [...visible, { label: 'Lainnya', amount: entries.slice(3).reduce((total, entry) => total + entry.amount, 0) }]
}

function FinancePaymentModal({ projects, onClose, onSubmit }: {
  projects: Project[]
  onClose: () => void
  onSubmit: (input: ProjectPaymentInput) => Promise<void>
}) {
  const availableProjects = projects.filter((project) => project.estimatedValue <= 0 || project.paid < project.estimatedValue)
  const [projectId, setProjectId] = useState(() => availableProjects[0]?.id ?? projects[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(todayInputValue)
  const [method, setMethod] = useState(paymentMethodOptions[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedProject = projects.find((project) => project.id === projectId)
  const outstanding = selectedProject ? Math.max(0, selectedProject.estimatedValue - selectedProject.paid) : 0

  useEffect(() => {
    if (!projects.some((project) => project.id === projectId)) setProjectId(availableProjects[0]?.id ?? projects[0]?.id ?? '')
  }, [availableProjects, projectId, projects])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const paymentAmount = Number(amount.replace(/[^0-9]/g, ''))
    if (!selectedProject) {
      setError('Pilih proyek terlebih dahulu.')
      return
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('Masukkan nominal pembayaran yang valid.')
      return
    }
    if (selectedProject.estimatedValue > 0 && paymentAmount > outstanding) {
      setError(`Nominal melebihi sisa pembayaran ${rupiah(outstanding)}.`)
      return
    }
    try {
      setSubmitting(true)
      setError('')
      await onSubmit({ projectId: selectedProject.id, amount: paymentAmount, paidAt, method, notes })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Pembayaran tidak dapat disimpan.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Catat pembayaran" onClose={onClose}>
      <form className="project-form finance-payment-form" onSubmit={submit}>
        <div className="form-intro"><span className="form-intro-icon"><WalletCards size={19} /></span><p>Setiap catatan akan menambah total pembayaran proyek dan langsung muncul di riwayat serta grafik Finance.</p></div>
        <div className="form-grid">
          <label className="form-field form-field-full"><span>Proyek <b>*</b></span><span className="select-wrap"><select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!projects.length}><option value="">Pilih proyek</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.client}</option>)}</select><ChevronDown size={16} /></span></label>
          {selectedProject && <div className="finance-payment-project-summary form-field-full"><span><small>Sudah diterima</small><strong>{rupiah(selectedProject.paid)}</strong></span><span><small>{selectedProject.estimatedValue > 0 ? 'Sisa pembayaran' : 'Nilai proyek'}</small><strong>{selectedProject.estimatedValue > 0 ? rupiah(outstanding) : 'Belum ditentukan'}</strong></span></div>}
          <label className="form-field"><span>Nominal diterima <b>*</b></span><div className="currency-input"><span>Rp</span><input autoFocus inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} placeholder="0" /></div></label>
          <label className="form-field"><span><CalendarDays size={15} /> Tanggal diterima <b>*</b></span><input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
          <label className="form-field form-field-full"><span>Metode pembayaran</span><span className="select-wrap"><select value={method} onChange={(event) => setMethod(event.target.value)}>{paymentMethodOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field form-field-full"><span>Catatan pembayaran</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: DP tahap pertama, transfer rekening BCA." /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Batal</button><button type="submit" className="primary-button" disabled={submitting || !projects.length}><CheckCircle2 size={18} /> {submitting ? 'Menyimpan…' : 'Simpan pembayaran'}</button></div>
      </form>
    </Modal>
  )
}

export function FinancePage({
  projects,
  invoices,
  payments,
  paymentHistorySupported,
  onRecordPayment,
}: {
  projects: Project[]
  invoices: Invoice[]
  payments: ProjectPayment[]
  paymentHistorySupported: boolean
  onRecordPayment: (input: ProjectPaymentInput) => Promise<void>
}) {
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)
  const paid = projects.reduce((total, project) => total + project.paid, 0)
  const pipeline = projects.reduce((total, project) => total + project.estimatedValue, 0)
  const outstanding = Math.max(0, pipeline - paid)
  const isInvoicePaid = (invoice: Invoice) => invoice.documentStatus ? invoice.documentStatus === 'Paid' : invoice.status === 'Paid'
  const isInvoiceVoid = (invoice: Invoice) => invoice.documentStatus === 'Void'
  const invoiceReceivable = invoices
    .filter((invoice) => !isInvoicePaid(invoice) && !isInvoiceVoid(invoice))
    .reduce((total, invoice) => total + invoice.amount, 0)
  const paidInvoices = invoices
    .filter(isInvoicePaid)
    .reduce((total, invoice) => total + invoice.amount, 0)
  const collectionRate = pipeline ? Math.round((paid / pipeline) * 100) : 0
  const averageProject = projects.length ? Math.round(pipeline / projects.length) : 0
  const cashflowMonths = useMemo(() => lastSixPaymentMonths(payments), [payments])
  const cashflowMax = Math.max(...cashflowMonths.map((month) => month.total), 0)
  const cashflowTotal = cashflowMonths.reduce((total, month) => total + month.total, 0)
  const serviceBreakdown = useMemo(() => financeServiceBreakdown(projects), [projects])
  const serviceTotal = serviceBreakdown.reduce((total, service) => total + service.amount, 0)
  const donutGradient = useMemo(() => {
    if (!serviceTotal) return 'conic-gradient(#e4ebf6 0 100%)'
    let current = 0
    const parts = serviceBreakdown.map((service, index) => {
      const next = current + (service.amount / serviceTotal) * 100
      const value = `${financeColors[index % financeColors.length]} ${current}% ${next}%`
      current = next
      return value
    })
    return `conic-gradient(${parts.join(', ')})`
  }, [serviceBreakdown, serviceTotal])
  const sortedPayments = useMemo(() => [...payments].sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime()), [payments])
  const visiblePayments = showAllPayments ? sortedPayments : sortedPayments.slice(0, 5)

  return (
    <div className="module-page finance-page">
      <section className="page-title-row"><div><p className="eyebrow">Business health</p><h1>Finance</h1><p>Lihat aliran pendapatan, tagihan, dan kesehatan cashflow studio.</p></div><button className="primary-button" onClick={() => setPaymentFormOpen(true)} disabled={!projects.length}><Plus size={18} /> Catat pembayaran</button></section>
      <section className="finance-stat-grid"><article className="finance-stat main"><span>Revenue tercatat</span><strong>{rupiah(paid)}</strong><p><ArrowUpRight size={15} /> Total pembayaran dari proyek</p></article><article className="finance-stat"><span>Tagihan belum dibayar</span><strong>{rupiah(invoiceReceivable)}</strong><p className="warning-text">Dari {invoices.filter((invoice) => !isInvoicePaid(invoice) && !isInvoiceVoid(invoice)).length} invoice aktif</p></article><article className="finance-stat"><span>Invoice lunas</span><strong>{rupiah(paidInvoices)}</strong><p>{invoices.filter(isInvoicePaid).length} invoice dibayar</p></article><article className="finance-stat"><span>Outstanding proyek</span><strong>{rupiah(outstanding)}</strong><p>{collectionRate}% collection rate · {rupiah(averageProject, true)} rata-rata</p></article></section>
      <section className="finance-grid"><article className="card cashflow-card"><div className="card-heading"><div><p className="eyebrow">Cashflow aktual</p><h2>Arus masuk 6 bulan terakhir</h2></div><span className="finance-period-label">{cashflowMonths[0]?.label}—{cashflowMonths[cashflowMonths.length - 1]?.label}</span></div><div className={`cashflow-bars ${cashflowMax ? '' : 'is-empty'}`}>{cashflowMonths.map((month, index) => <span key={month.key} className={index === cashflowMonths.length - 1 ? 'selected' : ''} title={`${month.label}: ${rupiah(month.total)}`}><i style={{ height: cashflowMax ? `${Math.max(6, Math.round((month.total / cashflowMax) * 100))}%` : '4px' }} /><em>{month.label}</em></span>)}</div><div className="cashflow-legend"><span><i className="legend-blue" />Pembayaran dicatat</span><strong>{rupiah(cashflowTotal)}</strong></div>{!paymentHistorySupported && <p className="finance-setup-note">Riwayat pembayaran belum diaktifkan. Jalankan pembaruan Finance agar grafik memakai transaksi yang disimpan.</p>}{paymentHistorySupported && !payments.length && <p className="finance-setup-note">Belum ada pembayaran dicatat dalam 6 bulan terakhir.</p>}</article><article className="card income-source-card"><div className="card-heading"><div><p className="eyebrow">Berdasarkan layanan</p><h2>Sumber revenue</h2></div></div><div className={`service-donut ${serviceTotal ? '' : 'is-empty'}`} style={{ background: donutGradient }}><div><strong>{serviceTotal ? `${serviceBreakdown.length}` : '0'}</strong><span>{serviceTotal ? 'layanan' : 'revenue'}</span></div></div><ul>{serviceBreakdown.map((service, index) => <li key={service.label}><span><i style={{ background: financeColors[index % financeColors.length] }} />{service.label}</span><b>{serviceTotal ? Math.round((service.amount / serviceTotal) * 100) : 0}%</b></li>)}{!serviceBreakdown.length && <li className="finance-empty-service">Belum ada revenue proyek.</li>}</ul></article></section>
      <section className="card payment-table-card"><div className="card-heading"><div><p className="eyebrow">Riwayat aktual</p><h2>Transaksi pembayaran</h2></div>{payments.length > 5 && <button className="text-button" onClick={() => setShowAllPayments((current) => !current)}>{showAllPayments ? 'Sembunyikan' : 'Lihat semua'}</button>}</div><div className="payment-table"><div className="payment-table-head"><span>Transaksi</span><span>Tanggal bayar</span><span>Metode</span><span>Jumlah</span></div>{visiblePayments.map((payment, index) => <div key={payment.id} className="payment-table-row"><span><span className={`payment-icon payment-${index % 2 ? 'violet' : 'blue'}`}><WalletCards size={17} /></span><span><strong>{payment.client}</strong><small>{payment.projectName}{payment.notes ? ` · ${payment.notes}` : ''}</small></span></span><span>{paymentDate(payment.paidAt)}</span><span>{payment.method || 'Tidak dicantumkan'}</span><strong>{rupiah(payment.amount)}</strong></div>)}{!visiblePayments.length && <p className="payment-empty">Belum ada transaksi pembayaran. Gunakan tombol Catat pembayaran untuk menambahkan pemasukan pertama.</p>}</div></section>
      {paymentFormOpen && <FinancePaymentModal projects={projects} onClose={() => setPaymentFormOpen(false)} onSubmit={onRecordPayment} />}
    </div>
  )
}

function invoiceEditorDate(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function newInvoiceDraft(clients: Client[], projects: Project[]): InvoiceEditorDraft {
  const project = projects[0]
  const client = clients.find((item) => item.id === project?.clientId) ?? clients[0]
  return {
    invoiceNumber: generateInvoiceNumber(project),
    clientId: client?.id ?? '',
    projectId: project?.id ?? '',
    issueDate: invoiceEditorDate(),
    dueDate: invoiceEditorDate(14),
    status: 'Draft',
    currency: 'IDR',
    documentTitle: 'Invoice',
    brandColor: '#30343b',
    recipientName: client?.name ?? '',
    recipientCompany: client?.company ?? '',
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
    items: [{ description: project?.name || 'Layanan kreatif', detail: '', quantity: 1, unitPrice: project?.estimatedValue || 0 }],
  }
}

function invoiceDraftFromQuote(quote: ServiceQuote, clients: Client[], projects: Project[]): InvoiceEditorDraft {
  const project = projects.find((item) => item.id === quote.projectId)
  const client = clients.find((item) => item.id === quote.clientId)
    ?? clients.find((item) => item.id === project?.clientId)
  return {
    invoiceNumber: generateInvoiceNumber(project),
    clientId: client?.id ?? quote.clientId,
    projectId: project?.id ?? quote.projectId,
    issueDate: invoiceEditorDate(),
    dueDate: invoiceEditorDate(14),
    status: 'Draft',
    currency: quote.currency || 'IDR',
    documentTitle: 'Invoice',
    brandColor: '#30343b',
    recipientName: client?.name ?? '',
    recipientCompany: client?.company ?? '',
    recipientEmail: client?.email ?? '',
    recipientWhatsapp: client?.whatsapp ?? '',
    senderName: 'Nayagement Studio',
    senderEmail: '',
    senderPhone: '',
    senderAddress: '',
    paymentInstructions: '',
    notes: quote.notes,
    terms: '',
    footerNote: 'Terima kasih telah mempercayakan kebutuhan kreatif Anda kepada kami.',
    taxRate: quote.taxRate,
    discountAmount: quote.discountAmount,
    items: quote.items.map((item) => {
      const quantity = Math.max(0.01, Number(item.quantity) || 1)
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0)
      const minimumFee = Math.max(0, Number(item.minimumFee) || 0)
      const minimumApplies = minimumFee > quantity * unitPrice
      return {
        description: item.name,
        detail: [item.detail, minimumApplies ? `Fee minimum untuk ${quantity} ${item.unitLabel}.` : ''].filter(Boolean).join('\n'),
        quantity: minimumApplies ? 1 : quantity,
        unitPrice: minimumApplies ? minimumFee : unitPrice,
      }
    }),
  }
}

interface InvoicesPageProps {
  invoices: Invoice[]
  clients: Client[]
  projects: Project[]
  initialInvoiceId?: string | null
  downloadOnOpen?: boolean
  onToast: (message: string) => void
  onLoadInvoice: (invoiceId: string) => Promise<InvoiceEditorDraft>
  onSaveInvoice: (draft: InvoiceEditorDraft, logoFile: File | null, signatureFile: File | null) => Promise<InvoiceEditorDraft>
  onUpdateInvoiceStatus: (invoice: Invoice, status: InvoiceDocumentStatus) => Promise<void>
  serviceCatalogs: ServiceCatalog[]
  serviceQuotes: ServiceQuote[]
  onLoadServiceQuoteData: () => Promise<void>
  onSaveServiceCatalog: (input: ServiceCatalogInput, catalogId?: string) => Promise<void>
  onDeleteServiceCatalog: (catalog: ServiceCatalog) => Promise<void>
  onSaveServiceQuote: (draft: ServiceQuoteDraft) => Promise<ServiceQuote>
  onDeleteServiceQuote: (quote: ServiceQuote) => Promise<void>
  onMarkServiceQuoteConverted: (quoteId: string, invoiceId: string) => Promise<void>
}

function invoiceStatusForControl(invoice: Invoice): InvoiceDocumentStatus {
  if (invoice.documentStatus) return invoice.documentStatus
  if (invoice.status === 'Paid') return 'Paid'
  if (invoice.status === 'Partial') return 'DP'
  return 'Draft'
}

function invoiceStatusLabel(status: InvoiceDocumentStatus) {
  return status === 'DP' ? 'DP / sebagian dibayar' : status
}

function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  const status = invoiceStatusForControl(invoice)
  const tone = status === 'Paid' ? 'paid' : status === 'DP' ? 'partial' : status === 'Overdue' ? 'overdue' : 'unpaid'
  return <span className={`invoice-document-status ${tone}`}>{invoiceStatusLabel(status)}</span>
}

export function InvoicesPage({ invoices, clients, projects, initialInvoiceId = null, downloadOnOpen = false, onToast, onLoadInvoice, onSaveInvoice, onUpdateInvoiceStatus, serviceCatalogs, serviceQuotes, onLoadServiceQuoteData, onSaveServiceCatalog, onDeleteServiceCatalog, onSaveServiceQuote, onDeleteServiceQuote, onMarkServiceQuoteConverted }: InvoicesPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'editor' | 'calculator'>(initialInvoiceId ? 'editor' : 'overview')
  const [draft, setDraft] = useState<InvoiceEditorDraft>(() => newInvoiceDraft(clients, projects))
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [previewMode, setPreviewMode] = useState(Boolean(initialInvoiceId))
  const [openedInvoiceLink, setOpenedInvoiceLink] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [quoteConversionId, setQuoteConversionId] = useState('')
  const [calculatorLoading, setCalculatorLoading] = useState(false)
  const [calculatorLoadError, setCalculatorLoadError] = useState('')
  const totalBilled = invoices.reduce((total, invoice) => total + invoice.amount, 0)
  const paid = invoices.filter((invoice) => invoice.status === 'Paid').reduce((total, invoice) => total + invoice.amount, 0)
  const outstanding = totalBilled - paid
  const preview = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0]

  useEffect(() => {
    setDraft((current) => {
      if (current.id || !clients.length) return current
      const client = clients.find((item) => item.id === current.clientId)
        ?? clients.find((item) => item.company === current.recipientCompany || item.name === current.recipientName)
      if (!client) return current
      const project = projects.find((item) => item.id === current.projectId)
        ?? projects.find((item) => item.clientId === client.id)
      if (current.clientId === client.id && current.projectId === (project?.id ?? current.projectId)) return current
      return { ...current, clientId: client.id, projectId: project?.id ?? current.projectId }
    })
  }, [clients, projects])

  useEffect(() => {
    if (!invoices.length) {
      setSelectedInvoiceId('')
      return
    }
    if (!invoices.some((invoice) => invoice.id === selectedInvoiceId)) setSelectedInvoiceId(invoices[0].id)
  }, [invoices, selectedInvoiceId])

  const openNewInvoice = () => {
    setQuoteConversionId('')
    setPreviewMode(false)
    setDraft(newInvoiceDraft(clients, projects))
    setActiveTab('editor')
  }

  const openExistingInvoice = async (invoice: Invoice, asPreview = false) => {
    setQuoteConversionId('')
    setPreviewMode(asPreview)
    setActiveTab('editor')
    setLoadingDraft(true)
    try {
      const loaded = await onLoadInvoice(invoice.id)
      setDraft(loaded)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Invoice tidak dapat dimuat.')
      setDraft(newInvoiceDraft(clients, projects))
    } finally {
      setLoadingDraft(false)
    }
  }

  useEffect(() => {
    if (!initialInvoiceId || openedInvoiceLink === initialInvoiceId || !invoices.length) return
    setOpenedInvoiceLink(initialInvoiceId)
    const invoice = invoices.find((item) => item.id === initialInvoiceId)
    if (!invoice) {
      onToast('Invoice dari tautan tidak ditemukan atau sudah dihapus.')
      setActiveTab('overview')
      setPreviewMode(false)
      return
    }
    void openExistingInvoice(invoice, true)
  }, [initialInvoiceId, invoices, openedInvoiceLink])

  const saveEditor = async (nextDraft: InvoiceEditorDraft, logoFile: File | null, signatureFile: File | null) => {
    const saved = await onSaveInvoice(nextDraft, logoFile, signatureFile)
    setDraft(saved)
    if (saved.id) setSelectedInvoiceId(saved.id)
    if (saved.id && quoteConversionId) {
      try {
        await onMarkServiceQuoteConverted(quoteConversionId, saved.id)
        onToast('Penawaran telah menjadi invoice dan sekarang tercatat di Finance.')
        setQuoteConversionId('')
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Invoice tersimpan, tetapi status penawaran belum dapat diperbarui.')
      }
    }
  }

  const changeInvoiceStatus = async (status: InvoiceDocumentStatus) => {
    if (!preview || status === invoiceStatusForControl(preview)) return
    try {
      setUpdatingStatus(true)
      await onUpdateInvoiceStatus(preview, status)
    } catch {
      // Pesan kesalahan sudah ditampilkan oleh penyimpanan status di aplikasi.
    } finally {
      setUpdatingStatus(false)
    }
  }

  const loadCalculatorData = async () => {
    try {
      setCalculatorLoading(true)
      setCalculatorLoadError('')
      await onLoadServiceQuoteData()
    } catch (error) {
      setCalculatorLoadError(error instanceof Error ? error.message : 'Katalog dan penawaran tidak dapat dimuat.')
    } finally {
      setCalculatorLoading(false)
    }
  }

  const openCalculator = () => {
    setActiveTab('calculator')
    void loadCalculatorData()
  }

  const convertQuoteToInvoice = (quote: ServiceQuote) => {
    setDraft(invoiceDraftFromQuote(quote, clients, projects))
    setQuoteConversionId(quote.id)
    setActiveTab('editor')
    onToast('Penawaran dimuat ke editor invoice. Simpan invoice untuk mulai mencatatnya di Finance.')
  }

  return (
    <div className="module-page invoices-page">
      <section className="page-title-row"><div><p className="eyebrow">Billing studio</p><h1>Invoices</h1><p>Buat tagihan profesional dan pantau pembayaran tanpa berpindah tempat.</p></div><button className="primary-button" onClick={openNewInvoice}><FilePlus2 size={18} /> Buat invoice</button></section>
      <section className="invoice-overview"><article><ReceiptText size={21} /><div><small>Total ditagihkan</small><strong>{rupiah(totalBilled)}</strong></div></article><article><CreditCard size={21} /><div><small>Terbayar</small><strong>{rupiah(paid)}</strong></div></article><article className="invoice-due"><ArrowDownLeft size={21} /><div><small>Menunggu pembayaran</small><strong>{rupiah(outstanding)}</strong></div></article></section>
      <nav className="invoice-page-tabs" aria-label="Tampilan invoice">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => { setPreviewMode(false); setActiveTab('overview') }}><ReceiptText size={16} /> Semua invoice <span>{invoices.length}</span></button>
        <button className={activeTab === 'editor' ? 'active' : ''} onClick={() => { setPreviewMode(false); setActiveTab('editor') }}><FileText size={16} /> Editor invoice</button>
        <button className={activeTab === 'calculator' ? 'active' : ''} onClick={openCalculator}><Calculator size={16} /> Kalkulator & penawaran <span>{serviceQuotes.length}</span></button>
      </nav>
      {activeTab === 'overview' ? <section className="invoice-layout"><article className="card invoice-list-card"><div className="card-heading"><div><p className="eyebrow">All invoices</p><h2>Tagihan terbaru</h2></div><button className="filter-button"><SlidersHorizontal size={16} /> Filter</button></div><div className="invoice-list">{invoices.map((invoice) => <button key={invoice.id} className={`invoice-row ${preview?.id === invoice.id ? 'selected' : ''}`} onClick={() => setSelectedInvoiceId(invoice.id)}><span className="invoice-file-icon"><FileText size={19} /></span><span className="invoice-row-main"><strong>{invoice.number}</strong><small>{invoice.client} · {invoice.project}</small></span><span className="invoice-due-date"><small>Jatuh tempo</small><strong>{invoice.dueDate}</strong></span><InvoiceStatusBadge invoice={invoice} /><strong className="invoice-amount">{rupiah(invoice.amount)}</strong><ChevronRight size={17} /></button>)}{!invoices.length && <p className="muted-copy">Belum ada invoice di workspace ini. Buat invoice pertama dari tab Editor invoice.</p>}</div></article><aside className="card invoice-preview-card"><div className="invoice-preview-heading"><div><p className="eyebrow">Preview invoice</p><h3>{preview?.number ?? 'Pilih invoice'}</h3></div>{preview && <InvoiceStatusBadge invoice={preview} />}</div><div className="invoice-paper"><div className="invoice-paper-top"><BrandMark className="mini-logo" /><strong>Nayagement Studio</strong><span>INVOICE</span></div><h3>{preview?.number ?? 'Belum ada invoice'}</h3><p>Kepada <b>{preview?.client ?? '—'}</b></p><div className="invoice-paper-line" /><div className="invoice-paper-item"><span>{preview?.project ?? 'Tambahkan invoice untuk melihat preview'}</span><strong>{preview ? rupiah(preview.amount) : '—'}</strong></div><div className="invoice-paper-total"><span>Total</span><strong>{preview ? rupiah(preview.amount) : '—'}</strong></div></div>{preview && <label className="invoice-status-control"><span>Status pembayaran</span><span className="select-wrap"><select value={invoiceStatusForControl(preview)} onChange={(event) => { void changeInvoiceStatus(event.target.value as InvoiceDocumentStatus) }} disabled={updatingStatus}><option value="Draft">Draft</option><option value="DP">DP / sebagian dibayar</option><option value="Paid">Paid</option><option value="Overdue">Jatuh tempo</option><option value="Void">Dibatalkan</option></select><ChevronDown size={16} /></span><small>{invoiceStatusLabel(invoiceStatusForControl(preview))} akan langsung tercatat di Finance.</small></label>}<div className="preview-actions"><button className="soft-button" disabled={!preview} onClick={() => { if (preview) void openExistingInvoice(preview) }}>Lihat A4 & editor <ExternalLink size={15} /></button></div></aside></section> : activeTab === 'calculator' ? <ServiceCalculator clients={clients} projects={projects} catalogs={serviceCatalogs} quotes={serviceQuotes} loading={calculatorLoading} loadError={calculatorLoadError} onRefresh={loadCalculatorData} onSaveCatalog={onSaveServiceCatalog} onDeleteCatalog={onDeleteServiceCatalog} onSaveQuote={onSaveServiceQuote} onDeleteQuote={onDeleteServiceQuote} onConvertToInvoice={convertQuoteToInvoice} onToast={onToast} /> : <InvoiceEditor draft={draft} clients={clients} projects={projects} loading={loadingDraft} previewOnly={previewMode} autoDownloadPdf={previewMode && downloadOnOpen} onChange={setDraft} onSave={saveEditor} onToast={onToast} />}
    </div>
  )
}

const orderFieldTypeLabels: Record<OrderFormFieldType, string> = {
  text: 'Teks singkat',
  email: 'Email',
  phone: 'Nomor telepon',
  textarea: 'Paragraf',
  select: 'Pilihan',
  date: 'Tanggal',
  number: 'Angka',
  url: 'Tautan',
}

function sortFormFields(fields: OrderFormField[]) {
  return fields.map((field, index) => ({ ...field, options: [...field.options], sortOrder: index }))
}

function draftFromForm(form: OrderForm): OrderFormDraft {
  return {
    title: form.title,
    description: form.description,
    confirmationMessage: form.confirmationMessage,
    headerImageUrl: form.headerImageUrl,
    isActive: form.isActive,
    fields: sortFormFields(form.fields),
  }
}

function customField(fields: OrderFormField[]): OrderFormField {
  let index = fields.filter((field) => field.key.startsWith('custom_field_')).length + 1
  let key = `custom_field_${index}`
  while (fields.some((field) => field.key === key)) {
    index += 1
    key = `custom_field_${index}`
  }
  return { key, label: 'Pertanyaan baru', type: 'text', options: [], required: false, sortOrder: fields.length }
}

function orderFormUrl(form: OrderForm) {
  return window.location.origin + window.location.pathname + '#/order/' + encodeURIComponent(form.publicToken)
}

function submissionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Baru saja'
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `Masuk ${minutes} menit lalu`
  if (minutes < 1_440) return `Masuk ${Math.round(minutes / 60)} jam lalu`
  return `Masuk ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)}`
}

function validateOrderFormDraft(draft: OrderFormDraft) {
  if (draft.title.trim().length < 2) return 'Judul form minimal 2 karakter.'
  if (draft.confirmationMessage.trim().length < 2) return 'Pesan konfirmasi perlu diisi.'
  if (!draft.fields.some((field) => field.key === 'name')) return 'Field Nama lengkap perlu dipertahankan agar order dapat dicatat sebagai klien.'
  if (!draft.fields.length) return 'Tambahkan minimal satu field pada form.'
  const keys = new Set<string>()
  for (const field of draft.fields) {
    if (field.label.trim().length < 2) return 'Setiap pertanyaan membutuhkan label minimal 2 karakter.'
    if (!/^[a-z][a-z0-9_]{1,62}$/.test(field.key)) return 'Ada identitas field yang tidak valid.'
    if (keys.has(field.key)) return 'Setiap field harus berbeda.'
    if (field.type === 'select' && !field.options.some((option) => option.trim())) return `Tambahkan pilihan untuk “${field.label}”.`
    keys.add(field.key)
  }
  return ''
}

const headerImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxHeaderImageSize = 5 * 1024 * 1024

function headerImageFileError(file: File) {
  if (!headerImageTypes.has(file.type)) return 'Gunakan gambar JPG, PNG, atau WebP untuk header form.'
  if (file.size > maxHeaderImageSize) return 'Ukuran gambar header maksimal 5 MB.'
  return ''
}

function imageFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Gambar header tidak dapat dibaca.'))
    reader.onerror = () => reject(new Error('Gambar header tidak dapat dibaca.'))
    reader.readAsDataURL(file)
  })
}

interface OrderFormsPageProps {
  workspaceId: string | null
  submissions: OrderSubmission[]
  incomingOrderCount: number
  onOpenOrders: () => void
  onToast: (message: string) => void
}

export function OrderFormsPage({ workspaceId, submissions = [], incomingOrderCount = 0, onOpenOrders = () => {}, onToast }: OrderFormsPageProps) {
  const [forms, setForms] = useState<OrderForm[]>(() => isSupabaseConfigured ? [] : [createDemoOrderForm()])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<OrderFormDraft | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    if (!workspaceId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await loadWorkspaceOrderData(workspaceId)
      setForms(data.forms)
      setSelectedId((current) => current && data.forms.some((form) => form.id === current) ? current : data.forms[0]?.id ?? '')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Data form order tidak dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [onToast, workspaceId])

  useEffect(() => { void refresh() }, [refresh])

  const selectedForm = useMemo(() => forms.find((form) => form.id === selectedId) ?? forms[0] ?? null, [forms, selectedId])
  const selectedFormOrderCount = useMemo(() => selectedForm ? submissions.filter((submission) => submission.orderFormId === selectedForm.id).length : 0, [selectedForm, submissions])
  const headerImagePreviewUrl = useMemo(() => headerImageFile ? URL.createObjectURL(headerImageFile) : draft?.headerImageUrl ?? '', [draft?.headerImageUrl, headerImageFile])

  useEffect(() => {
    setDraft(selectedForm ? draftFromForm(selectedForm) : null)
  }, [selectedForm])

  useEffect(() => {
    setHeaderImageFile(null)
  }, [selectedForm?.id])

  useEffect(() => () => {
    if (headerImagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(headerImagePreviewUrl)
  }, [headerImagePreviewUrl])

  const addForm = async () => {
    const nextDraft = createOrderFormDraft()
    if (!isSupabaseConfigured) {
      const next: OrderForm = {
        id: `demo-order-form-${Date.now()}`,
        publicToken: `demo-order-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...nextDraft,
      }
      setForms((current) => [next, ...current])
      setSelectedId(next.id)
      onToast('Form order baru dibuat.')
      return
    }
    if (!workspaceId) {
      onToast('Workspace belum siap. Coba lagi sesaat.')
      return
    }
    try {
      setSaving(true)
      const next = await createWorkspaceOrderForm(workspaceId, nextDraft)
      setForms((current) => [next, ...current])
      setSelectedId(next.id)
      onToast('Form order baru disimpan.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Form order tidak dapat dibuat.')
    } finally {
      setSaving(false)
    }
  }

  const saveForm = async () => {
    if (!selectedForm || !draft) return
    const validation = validateOrderFormDraft(draft)
    if (validation) {
      onToast(validation)
      return
    }
    const nextDraft = { ...draft, fields: sortFormFields(draft.fields) }
    if (!isSupabaseConfigured) {
      try {
        setSaving(true)
        const savedDraft = headerImageFile
          ? { ...nextDraft, headerImageUrl: await imageFileDataUrl(headerImageFile) }
          : nextDraft
        setForms((current) => current.map((form) => form.id === selectedForm.id ? { ...form, ...savedDraft } : form))
        setHeaderImageFile(null)
        onToast('Form order diperbarui.')
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Gambar header tidak dapat disimpan.')
      } finally {
        setSaving(false)
      }
      return
    }
    if (!workspaceId) {
      onToast('Workspace belum siap. Coba lagi sesaat.')
      return
    }
    if (headerImageFile && !selectedForm.headerImageSupported) {
      onToast('Penyimpanan gambar header belum aktif. Jalankan SQL pembaruan gambar header terlebih dahulu.')
      return
    }
    try {
      setSaving(true)
      const savedDraft = headerImageFile
        ? { ...nextDraft, headerImageUrl: await uploadWorkspaceOrderFormHeaderImage(workspaceId, selectedForm.id, headerImageFile) }
        : nextDraft
      const saved = await updateWorkspaceOrderForm(workspaceId, selectedForm.id, savedDraft, selectedForm.headerImageSupported ?? false)
      setForms((current) => current.map((form) => form.id === saved.id ? saved : form))
      setHeaderImageFile(null)
      onToast('Form order diperbarui.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Form order tidak dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const deleteForm = async () => {
    if (!selectedForm) return
    if (selectedFormOrderCount > 0) {
      onToast(`Form ini memiliki ${selectedFormOrderCount} order masuk. Nonaktifkan form untuk menghentikan order baru tanpa menghapus riwayat.`)
      return
    }
    if (!window.confirm(`Hapus form “${selectedForm.title}”? Tautan publiknya tidak akan dapat dipakai lagi.`)) return
    try {
      setSaving(true)
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Coba lagi sesaat.')
        await deleteWorkspaceOrderForm(workspaceId, selectedForm.id)
      }
      const remainingForms = forms.filter((form) => form.id !== selectedForm.id)
      setForms(remainingForms)
      setSelectedId(remainingForms[0]?.id ?? '')
      onToast('Form order dihapus.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Form order tidak dapat dihapus.')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    if (!selectedForm) return
    const url = orderFormUrl(selectedForm)
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
      else {
        const helper = document.createElement('textarea')
        helper.value = url
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.append(helper)
        helper.select()
        document.execCommand('copy')
        helper.remove()
      }
      onToast('Tautan form disalin.')
    } catch {
      onToast('Browser menolak menyalin otomatis. Gunakan Preview untuk menyalin tautan.')
    }
  }

  const previewForm = () => {
    if (!selectedForm) return
    const preview = window.open(orderFormUrl(selectedForm), '_blank')
    if (preview) {
      preview.opener = null
      return
    }
    onToast('Browser memblokir jendela preview. Izinkan pop-up lalu coba lagi.')
  }

  const selectHeaderImage = (file: File | null) => {
    if (!file) return
    const error = headerImageFileError(file)
    if (error) {
      onToast(error)
      return
    }
    setHeaderImageFile(file)
  }

  const removeHeaderImage = () => {
    setHeaderImageFile(null)
    setDraft((current) => current ? { ...current, headerImageUrl: '' } : current)
  }

  const updateField = (index: number, changes: Partial<OrderFormField>) => {
    setDraft((current) => current ? {
      ...current,
      fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field),
    } : current)
  }

  const moveField = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.fields.length) return current
      const fields = [...current.fields]
      const [field] = fields.splice(index, 1)
      fields.splice(nextIndex, 0, field)
      return { ...current, fields: sortFormFields(fields) }
    })
  }

  const removeField = (index: number) => {
    if (draft?.fields[index]?.key === 'name') {
      onToast('Field Nama lengkap dijaga agar setiap order dapat tercatat sebagai klien.')
      return
    }
    setDraft((current) => {
      if (!current) return current
      return { ...current, fields: sortFormFields(current.fields.filter((_, fieldIndex) => fieldIndex !== index)) }
    })
  }

  return (
    <div className="module-page forms-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Inbound engine</p><h1>Order forms</h1><p>Buat form order yang bisa dibagikan ke klien, lalu kelola setiap brief masuk dari satu tempat.</p></div>
        <button className="primary-button" onClick={() => { void addForm() }} disabled={saving}><Plus size={18} /> Buat form</button>
      </section>

      <section className="forms-workbench">
        <aside className="form-collection-card">
          <div className="form-collection-heading"><div><p className="eyebrow">Form Anda</p><h2>{forms.length} form</h2></div><button className="mini-action-button" onClick={() => { void addForm() }} aria-label="Buat form baru" title="Buat form baru" disabled={saving}><Plus size={16} /></button></div>
          <div className="form-collection-list">
            {forms.map((form) => <button key={form.id} className={selectedForm?.id === form.id ? 'active' : ''} onClick={() => setSelectedId(form.id)}><span className="form-collection-icon"><FileText size={17} /></span><span><strong>{form.title}</strong><small>{form.isActive ? 'Aktif' : 'Nonaktif'} · {form.fields.length} field</small></span><ChevronRight size={16} /></button>)}
          </div>
          <p className="form-collection-note"><Link2 size={14} /> Setiap form memiliki tautan publik sendiri untuk dibagikan ke klien.</p>
        </aside>

        {loading && !selectedForm ? <article className="form-builder-empty"><RefreshCw size={22} className="is-spinning" /><strong>Memuat form order…</strong></article> : selectedForm && draft ? <main className="form-builder-card">
          <header className="form-builder-head">
            <div><p className="eyebrow">Form builder</p><h2>{selectedForm.title}</h2><span className={draft.isActive ? 'form-status active' : 'form-status'}>{draft.isActive ? 'Aktif dan dapat dibagikan' : 'Tidak menerima order'}</span></div>
            <div className="form-builder-actions">
              <button className="soft-button" onClick={() => { void refresh() }} title="Muat ulang data" disabled={loading || saving}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Muat ulang</button>
              <button className="secondary-button" onClick={() => { void copyLink() }} disabled={saving}><Copy size={16} /> Salin link</button>
              <button className="primary-button" onClick={previewForm} disabled={!draft.isActive}><ExternalLink size={16} /> Preview</button>
              <button className="form-delete-button" onClick={() => { void deleteForm() }} title={selectedFormOrderCount ? `Tidak dapat dihapus: ${selectedFormOrderCount} order tersimpan` : 'Hapus form'} aria-label="Hapus form" disabled={saving}><Trash2 size={16} /></button>
            </div>
          </header>

          <section className="form-share-strip"><span><Link2 size={17} /></span><div><small>Tautan untuk klien</small><strong>{window.location.host}/#/order/{selectedForm.publicToken.slice(0, 14)}…</strong></div><button onClick={() => { void copyLink() }} aria-label="Salin tautan form"><Copy size={16} /></button></section>

          <section className="form-settings-grid">
            <label>Judul form<input value={draft.title} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} placeholder="Contoh: Form order kreatif" /></label>
            <label className="builder-activity-toggle"><span>Terima order baru<small>Klien hanya dapat mengisi form yang aktif.</small></span><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => current ? { ...current, isActive: event.target.checked } : current)} /></label>
            <label className="form-setting-full">Deskripsi untuk klien<textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Jelaskan tujuan form atau informasi yang Anda butuhkan." /></label>
            <div className="form-setting-full form-header-image-setting"><label htmlFor="form-header-image">Gambar header form</label><input id="form-header-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { selectHeaderImage(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} disabled={saving} /><small>Unggah dari perangkat Anda. Rekomendasi 1600 × 500 px (rasio 16:5); minimal 1200 × 375 px. JPG, PNG, atau WebP, maksimal 5 MB.</small><span className={`form-header-image-preview ${headerImagePreviewUrl ? 'has-image' : ''}`}>{headerImagePreviewUrl && <img src={headerImagePreviewUrl} alt="Preview gambar header" onError={(event) => { event.currentTarget.style.display = 'none' }} />}<strong>{headerImagePreviewUrl ? headerImageFile?.name || 'Gambar header aktif' : draft.title || 'Judul form'}</strong></span>{headerImagePreviewUrl && <button className="text-button form-header-image-remove" type="button" onClick={removeHeaderImage} disabled={saving}><Trash2 size={15} /> Hapus gambar</button>}</div>
            <label className="form-setting-full">Pesan setelah form dikirim<textarea rows={2} value={draft.confirmationMessage} onChange={(event) => setDraft((current) => current ? { ...current, confirmationMessage: event.target.value } : current)} placeholder="Terima kasih, order Anda sudah kami terima." /></label>
          </section>

          <section className="form-builder-section">
            <div className="form-builder-section-head"><div><p className="eyebrow">Pertanyaan</p><h3>Atur isi form</h3><p>Tambahkan, hapus, ubah tipe jawaban, urutan, dan pilihan seperti form builder.</p></div><button className="secondary-button" onClick={() => setDraft((current) => current ? { ...current, fields: [...current.fields, customField(current.fields)] } : current)}><Plus size={16} /> Tambah field</button></div>
            <p className="builder-core-note">Field Nama lengkap dijaga agar setiap isian dapat tercatat sebagai klien dan order masuk. Field lainnya bebas Anda atur.</p>
            <div className="builder-fields">
              {draft.fields.map((field, index) => {
                const locked = field.key === 'name'
                return <article key={field.key} className="builder-field-card">
                  <div className="builder-field-top"><span>Field {index + 1}</span><div><button onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Geser ke atas" title="Geser ke atas"><ChevronUp size={15} /></button><button onClick={() => moveField(index, 1)} disabled={index === draft.fields.length - 1} aria-label="Geser ke bawah" title="Geser ke bawah"><ChevronDown size={15} /></button><button className="builder-remove-button" onClick={() => removeField(index)} disabled={locked} aria-label="Hapus field" title={locked ? 'Field inti tidak dapat dihapus' : 'Hapus field'}><Trash2 size={15} /></button></div></div>
                  <div className="builder-field-grid"><label>Pertanyaan<input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /></label><label>Jenis jawaban<select value={field.type} onChange={(event) => { const type = event.target.value as OrderFormFieldType; updateField(index, { type, options: type === 'select' && !field.options.length ? ['Pilihan 1', 'Pilihan 2'] : field.options }) }} disabled={locked}>{Object.entries(orderFieldTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{field.type === 'select' && <label className="builder-field-full">Pilihan jawaban (pisahkan dengan koma)<input value={field.options.join(', ')} onChange={(event) => updateField(index, { options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean) })} placeholder="Pilihan 1, Pilihan 2" /></label>}</div>
                  <footer><span>{locked ? 'Field inti kontak' : `Field kustom · ${field.key.replace(/_/g, ' ')}`}</span><label className="builder-required"><input type="checkbox" checked={field.required} disabled={locked} onChange={(event) => updateField(index, { required: event.target.checked })} /> Wajib diisi</label></footer>
                </article>
              })}
            </div>
            <div className="form-builder-save"><span>Perubahan akan tersimpan di database dan langsung dipakai pada tautan form ini.</span><button className="primary-button" onClick={() => { void saveForm() }} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'} <Check size={16} /></button></div>
          </section>
        </main> : <article className="form-builder-empty"><FileText size={24} /><strong>Belum ada form order</strong><p>Buat form pertama lalu bagikan tautannya kepada calon klien.</p><button className="primary-button" onClick={() => { void addForm() }} disabled={saving}><Plus size={17} /> Buat form order</button></article>}
      </section>

      <section className="form-orders-link-card">
        <div><p className="eyebrow">Incoming orders</p><h2>Order masuk kini memiliki halaman khusus</h2><p>Semua brief dari tautan publik tersimpan di inbox agar editor form tetap rapi dan fokus pada pembuatan form.</p></div>
        <div className="form-orders-link-actions"><span><strong>{incomingOrderCount}</strong><small>order baru</small></span><button className="primary-button" onClick={onOpenOrders}>Buka order masuk <ChevronRight size={16} /></button></div>
      </section>
    </div>
  )
}

type OrderInboxFilter = 'All' | OrderSubmission['status']

const orderInboxFilters: OrderInboxFilter[] = ['All', 'New', 'Reviewing', 'Accepted', 'Converted', 'Rejected']
const orderStatusLabels: Record<OrderSubmission['status'], string> = {
  New: 'Baru',
  Reviewing: 'Ditinjau',
  Accepted: 'Diterima',
  Converted: 'Menjadi proyek',
  Rejected: 'Ditolak',
}

function orderSummary(submission: OrderSubmission) {
  return submission.payload.project_description
    || submission.payload.project_name
    || submission.payload.request
    || submission.payload.payment_preference
    || 'Klien mengirimkan detail order baru.'
}

function orderNeed(submission: OrderSubmission) {
  return submission.payload.project_type || submission.payload.service || submission.payload.order || submission.orderFormTitle
}

const orderPayloadLabels: Record<string, string> = {
  name: 'Nama lengkap',
  full_name: 'Nama lengkap',
  email: 'Email',
  whatsapp: 'Nomor WhatsApp',
  phone: 'Nomor telepon',
  company: 'Nama bisnis / perusahaan',
  business: 'Nama bisnis / perusahaan',
  project_name: 'Nama proyek',
  project_type: 'Jenis kebutuhan',
  service: 'Layanan',
  order: 'Jenis order',
  project_description: 'Ceritakan kebutuhan Anda',
  request: 'Permintaan',
  deadline: 'Target deadline',
  budget: 'Rentang budget',
  payment_preference: 'Preferensi pembayaran',
  payment_method: 'Metode pembayaran',
}

function orderPayloadLabel(key: string) {
  if (orderPayloadLabels[key]) return orderPayloadLabels[key]
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

interface OrdersPageProps {
  submissions: OrderSubmission[]
  onRefresh: () => void
  onUpdateStatus: (submission: OrderSubmission, status: OrderSubmission['status']) => Promise<void>
  onDeleteSubmission: (submission: OrderSubmission) => Promise<boolean>
  onOpenProject: (projectId: string) => void
}

export function OrdersPage({ submissions, onRefresh, onUpdateStatus, onDeleteSubmission, onOpenProject }: OrdersPageProps) {
  const [filter, setFilter] = useState<OrderInboxFilter>('All')
  const [updatingId, setUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<OrderSubmission | null>(null)
  const newCount = submissions.filter((submission) => submission.status === 'New').length
  const reviewingCount = submissions.filter((submission) => submission.status === 'Reviewing').length
  const filteredSubmissions = useMemo(() => filter === 'All' ? submissions : submissions.filter((submission) => submission.status === filter), [filter, submissions])

  const updateStatus = async (submission: OrderSubmission, status: OrderSubmission['status']) => {
    try {
      setUpdatingId(submission.id)
      await onUpdateStatus(submission, status)
    } finally {
      setUpdatingId('')
    }
  }

  const deleteSubmission = async (submission: OrderSubmission) => {
    try {
      setDeletingId(submission.id)
      const deleted = await onDeleteSubmission(submission)
      if (deleted) setSelectedSubmission((current) => current?.id === submission.id ? null : current)
    } finally {
      setDeletingId('')
    }
  }

  const submissionAnswers = selectedSubmission
    ? Object.entries(selectedSubmission.payload).filter(([, value]) => value.trim())
    : []

  return (
    <div className="module-page orders-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Incoming orders</p><h1>Order masuk</h1><p>Setiap brief dari form publik masuk ke satu inbox yang mudah ditinjau dan ditindaklanjuti.</p></div>
        <div className="page-title-actions"><button className="soft-button" onClick={onRefresh}><RefreshCw size={16} /> Muat ulang</button></div>
      </section>

      <section className="order-inbox-stats">
        <article><small>Total order</small><strong>{submissions.length}</strong><span>Semua brief tersimpan</span></article>
        <article className="new-orders"><small>Perlu ditinjau</small><strong>{newCount}</strong><span>Order baru menunggu respons</span></article>
        <article><small>Sedang ditinjau</small><strong>{reviewingCount}</strong><span>Siap diterima atau ditolak</span></article>
      </section>

      <section className="orders-inbox-card">
        <div className="orders-inbox-head"><div><p className="eyebrow">Inbox</p><h2>Brief klien</h2></div><div className="order-filter-tabs" aria-label="Filter status order">{orderInboxFilters.map((option) => <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option === 'All' ? 'Semua' : orderStatusLabels[option]}{option === 'New' && newCount > 0 && <b>{newCount}</b>}</button>)}</div></div>
        <div className="orders-inbox-list">
          {filteredSubmissions.map((submission) => {
            const contact = [submission.submitterWhatsapp, submission.submitterEmail].filter(Boolean).join(' · ') || 'Kontak tidak dicantumkan'
            const isUpdating = updatingId === submission.id
            const isDeleting = deletingId === submission.id
            return <article key={submission.id} className="order-inbox-row">
              <span className="order-submission-avatar">{submission.submitterName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'CL'}</span>
              <button type="button" className="order-inbox-main" onClick={() => setSelectedSubmission(submission)} aria-label={`Buka brief dari ${submission.submitterName}`}><span className="order-inbox-name"><strong>{submission.submitterName}</strong><span className={`order-status-chip ${submission.status.toLowerCase()}`}>{orderStatusLabels[submission.status]}</span></span><span className="order-inbox-summary">{orderSummary(submission)}</span><small>{submissionTime(submission.createdAt)} · {contact}</small><span className="order-inbox-meta"><span><b>Form</b><em>{submission.orderFormTitle}</em></span><span><b>Kebutuhan</b><em>{orderNeed(submission)}</em></span>{submission.projectName && <span><b>Proyek</b><em>{submission.projectName}</em></span>}</span><span className="order-inbox-open-cue">Lihat detail <ChevronRight size={14} /></span></button>
              <div className="order-inbox-actions">
                {submission.status === 'New' && <button className="secondary-button" onClick={() => { void updateStatus(submission, 'Reviewing') }} disabled={isUpdating || isDeleting}>{isUpdating ? 'Menyimpan…' : 'Tinjau'} <ChevronRight size={15} /></button>}
                {submission.status === 'Reviewing' && <><button className="primary-button" onClick={() => { void updateStatus(submission, 'Accepted') }} disabled={isUpdating || isDeleting}>{isUpdating ? 'Menyimpan…' : 'Terima'} <Check size={15} /></button><button className="quiet-button danger-text" onClick={() => { void updateStatus(submission, 'Rejected') }} disabled={isUpdating || isDeleting}>Tolak</button></>}
                {submission.projectId && <button className="soft-button" onClick={() => onOpenProject(submission.projectId!)}>Buka proyek <ArrowUpRight size={15} /></button>}
                <button type="button" className="order-delete-button" onClick={() => { void deleteSubmission(submission) }} disabled={isUpdating || isDeleting} aria-label={`Hapus brief dari ${submission.submitterName}`} title={`Hapus brief dari ${submission.submitterName}`}><Trash2 size={15} /></button>
              </div>
            </article>
          })}
          {!filteredSubmissions.length && <div className="orders-inbox-empty"><FileText size={22} /><div><strong>{filter === 'All' ? 'Belum ada order masuk' : 'Tidak ada order pada status ini'}</strong><p>Order dari tautan publik akan tercatat di halaman ini.</p></div></div>}
        </div>
      </section>
      {selectedSubmission && <Modal title={`Brief dari ${selectedSubmission.submitterName}`} onClose={() => setSelectedSubmission(null)} wide><div className="order-detail-modal"><section className="order-detail-overview"><div><p className="eyebrow">{selectedSubmission.orderFormTitle}</p><h3>{selectedSubmission.submitterName}</h3><p>{orderSummary(selectedSubmission)}</p></div><span className={`order-status-chip ${selectedSubmission.status.toLowerCase()}`}>{orderStatusLabels[selectedSubmission.status]}</span></section><section className="order-detail-contact"><div><small>WhatsApp</small><strong>{selectedSubmission.submitterWhatsapp || 'Tidak dicantumkan'}</strong></div><div><small>Email</small><strong>{selectedSubmission.submitterEmail || 'Tidak dicantumkan'}</strong></div><div><small>Diterima</small><strong>{submissionTime(selectedSubmission.createdAt)}</strong></div>{selectedSubmission.projectName && <div><small>Proyek</small><strong>{selectedSubmission.projectName}</strong></div>}</section><section className="order-detail-answers"><div><p className="eyebrow">Jawaban klien</p><h3>Detail brief</h3></div>{submissionAnswers.length ? <dl>{submissionAnswers.map(([key, value]) => <div key={key}><dt>{orderPayloadLabel(key)}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted-copy">Klien belum memberikan jawaban tambahan.</p>}</section><footer className="order-detail-footer"><button className="soft-button" type="button" onClick={() => setSelectedSubmission(null)}>Tutup</button><button className="order-detail-delete" type="button" onClick={() => { void deleteSubmission(selectedSubmission) }} disabled={deletingId === selectedSubmission.id}><Trash2 size={16} /> {deletingId === selectedSubmission.id ? 'Menghapus…' : 'Hapus brief'}</button></footer></div></Modal>}
    </div>
  )
}

export function NotificationsPage({ notifications, onToast, onRead, onMarkAllRead }: { notifications: AppNotification[]; onToast: (message: string) => void; onRead: (id: string) => void | Promise<void>; onMarkAllRead: () => void | Promise<void> }) {
  return (
    <div className="module-page notifications-page"><section className="page-title-row"><div><p className="eyebrow">Stay in sync</p><h1>Notifications</h1><p>Perubahan penting dari order, klien, proyek, task, dan pembayaran.</p></div><button className="secondary-button" onClick={() => { void onMarkAllRead() }}><Check size={17} /> Tandai semua dibaca</button></section><section className="notification-category-tabs"><button className="active">Semua <b>{notifications.length}</b></button><button>Projects</button><button>Orders</button><button>Finance</button><button>Deadline</button></section><section className="notifications-feed">{notifications.map((notification) => { const icon = notification.kind === 'finance' ? <WalletCards size={19} /> : notification.kind === 'deadline' ? <Bell size={19} /> : notification.kind === 'order' ? <Send size={19} /> : notification.kind === 'client' ? <UserRound size={19} /> : <Sparkles size={19} />; return <button key={notification.id} className={`notification-row ${notification.unread ? 'unread' : ''}`} onClick={() => { void onRead(notification.id); onToast('Notifikasi dibuka.') }}><span className={`notification-icon notification-${notification.kind}`}>{icon}</span><span><strong>{notification.title}</strong><p>{notification.detail}</p><small>{notification.time}</small></span>{notification.unread && <i className="unread-dot" />}<ChevronRight size={18} /></button> })}{!notifications.length && <p className="muted-copy">Belum ada notifikasi.</p>}</section></div>
  )
}
