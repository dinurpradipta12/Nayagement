import { useMemo, useState, type FormEvent } from 'react'
import {
  Calculator,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  FilePlus2,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { rupiah } from '../lib/format'
import type { Client, Project, ServiceCatalog, ServiceCatalogInput, ServicePricingMode, ServiceQuote, ServiceQuoteDraft, ServiceQuoteItem, ServiceQuoteStatus } from '../types'
import { Modal } from './ui'

const pricingModes: { value: ServicePricingMode; label: string }[] = [
  { value: 'Fixed', label: 'Harga tetap' },
  { value: 'Per Hour', label: 'Per jam' },
  { value: 'Per Unit', label: 'Per unit' },
  { value: 'Package', label: 'Paket' },
]

const quoteStatuses: { value: ServiceQuoteStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Dikirim' },
  { value: 'Accepted', label: 'Disetujui' },
  { value: 'Expired', label: 'Kedaluwarsa' },
]

const quickCatalogs: Pick<ServiceCatalogInput, 'name' | 'category' | 'description' | 'pricingMode' | 'defaultUnitLabel'>[] = [
  { name: 'Konsultasi kreatif', category: 'Konsultasi', description: 'Sesi konsultasi untuk arah strategi dan kebutuhan kreatif.', pricingMode: 'Per Hour', defaultUnitLabel: 'jam' },
  { name: 'Spreadsheet custom', category: 'Sistem', description: 'Pembuatan spreadsheet atau dashboard sesuai kebutuhan.', pricingMode: 'Package', defaultUnitLabel: 'paket' },
  { name: 'Social media management', category: 'Social Media', description: 'Pengelolaan strategi dan konten media sosial.', pricingMode: 'Package', defaultUnitLabel: 'bulan' },
]

function todayInputValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function randomQuoteNumber() {
  const now = new Date()
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const random = globalThis.crypto?.getRandomValues
    ? (() => {
        const values = new Uint32Array(1)
        globalThis.crypto.getRandomValues(values)
        return 100 + (values[0] % 900)
      })()
    : 100 + Math.floor(Math.random() * 900)
  return `OFF-${prefix}-${random}`
}

function newQuote(clients: Client[], projects: Project[]): ServiceQuoteDraft {
  const project = projects[0]
  const client = clients.find((item) => item.id === project?.clientId) ?? clients[0]
  return {
    quoteNumber: randomQuoteNumber(),
    title: 'Penawaran layanan',
    clientId: client?.id ?? '',
    projectId: project?.id ?? '',
    status: 'Draft',
    currency: 'IDR',
    issueDate: todayInputValue(),
    validUntil: dateAfter(14),
    taxRate: 0,
    discountAmount: 0,
    notes: '',
    items: [],
  }
}

function emptyCatalog(input?: Partial<ServiceCatalogInput>): ServiceCatalogInput {
  return {
    name: input?.name ?? '',
    category: input?.category ?? 'Lainnya',
    description: input?.description ?? '',
    pricingMode: input?.pricingMode ?? 'Package',
    minimumFee: input?.minimumFee ?? 0,
    defaultUnitLabel: input?.defaultUnitLabel ?? 'paket',
    defaultUnitPrice: input?.defaultUnitPrice ?? 0,
    defaultQuantity: input?.defaultQuantity ?? 1,
    isActive: input?.isActive ?? true,
  }
}

function catalogInput(catalog: ServiceCatalog): ServiceCatalogInput {
  return {
    name: catalog.name,
    category: catalog.category,
    description: catalog.description,
    pricingMode: catalog.pricingMode,
    minimumFee: catalog.minimumFee,
    defaultUnitLabel: catalog.defaultUnitLabel,
    defaultUnitPrice: catalog.defaultUnitPrice,
    defaultQuantity: catalog.defaultQuantity,
    isActive: catalog.isActive,
  }
}

function quoteItemTotal(item: ServiceQuoteItem) {
  const quantity = Math.max(0, Number(item.quantity) || 0)
  const price = Math.max(0, Number(item.unitPrice) || 0)
  const minimum = Math.max(0, Number(item.minimumFee) || 0)
  return Math.max(minimum, Math.round(quantity * price))
}

function quoteTotals(draft: Pick<ServiceQuoteDraft, 'items' | 'discountAmount' | 'taxRate'>) {
  const subtotal = draft.items.reduce((total, item) => total + quoteItemTotal(item), 0)
  const discount = Math.min(subtotal, Math.max(0, Number(draft.discountAmount) || 0))
  const taxable = Math.max(0, subtotal - discount)
  const tax = Math.round(taxable * Math.min(100, Math.max(0, Number(draft.taxRate) || 0)) / 100)
  return { subtotal, discount, tax, total: taxable + tax }
}

function quoteItemFromCatalog(catalog: ServiceCatalog): ServiceQuoteItem {
  return {
    catalogId: catalog.id,
    name: catalog.name,
    detail: catalog.description,
    pricingMode: catalog.pricingMode,
    quantity: catalog.defaultQuantity || 1,
    unitLabel: catalog.defaultUnitLabel || 'paket',
    unitPrice: catalog.defaultUnitPrice,
    minimumFee: catalog.minimumFee,
  }
}

function manualQuoteItem(): ServiceQuoteItem {
  return {
    name: 'Layanan baru',
    detail: '',
    pricingMode: 'Fixed',
    quantity: 1,
    unitLabel: 'paket',
    unitPrice: 0,
    minimumFee: 0,
  }
}

function quoteStatusLabel(status: ServiceQuoteStatus) {
  if (status === 'Sent') return 'Dikirim'
  if (status === 'Accepted') return 'Disetujui'
  if (status === 'Expired') return 'Kedaluwarsa'
  if (status === 'Converted') return 'Menjadi invoice'
  return 'Draft'
}

function quoteStatusTone(status: ServiceQuoteStatus) {
  if (status === 'Accepted' || status === 'Converted') return 'accepted'
  if (status === 'Sent') return 'sent'
  if (status === 'Expired') return 'expired'
  return 'draft'
}

function dateLabel(value: string) {
  if (!value) return 'Belum ditentukan'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Belum ditentukan'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function ServiceCatalogModal({ catalog, template, onClose, onSave }: {
  catalog?: ServiceCatalog
  template?: Partial<ServiceCatalogInput>
  onClose: () => void
  onSave: (input: ServiceCatalogInput, catalogId?: string) => Promise<void>
}) {
  const [input, setInput] = useState<ServiceCatalogInput>(() => catalog ? catalogInput(catalog) : emptyCatalog(template))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await onSave(input, catalog?.id)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Layanan tidak dapat disimpan.')
      setSaving(false)
    }
  }

  return (
    <Modal title={catalog ? 'Edit layanan' : 'Tambah layanan'} onClose={onClose}>
      <form className="project-form service-catalog-form" onSubmit={submit}>
        <div className="form-intro"><span className="form-intro-icon"><PackagePlus size={19} /></span><p>Simpan harga dasar dan fee minimum agar bisa dipakai kembali untuk menghitung penawaran berikutnya.</p></div>
        <div className="form-grid">
          <label className="form-field"><span>Nama layanan <b>*</b></span><input autoFocus value={input.name} onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Konsultasi strategi" /></label>
          <label className="form-field"><span>Kategori</span><input value={input.category} onChange={(event) => setInput((current) => ({ ...current, category: event.target.value }))} placeholder="Contoh: Konsultasi" /></label>
          <label className="form-field form-field-full"><span>Detail default</span><textarea rows={3} value={input.description} onChange={(event) => setInput((current) => ({ ...current, description: event.target.value }))} placeholder="Ringkasan yang ikut muncul pada penawaran." /></label>
          <label className="form-field"><span>Basis harga</span><span className="select-wrap"><select value={input.pricingMode} onChange={(event) => setInput((current) => ({ ...current, pricingMode: event.target.value as ServicePricingMode }))}>{pricingModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Nama unit</span><input value={input.defaultUnitLabel} onChange={(event) => setInput((current) => ({ ...current, defaultUnitLabel: event.target.value }))} placeholder="paket, jam, desain" /></label>
          <label className="form-field"><span>Harga per unit</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={input.defaultUnitPrice || ''} onChange={(event) => setInput((current) => ({ ...current, defaultUnitPrice: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 }))} placeholder="0" /></div></label>
          <label className="form-field"><span>Jumlah default</span><input type="number" min="0.01" step="0.01" value={input.defaultQuantity} onChange={(event) => setInput((current) => ({ ...current, defaultQuantity: Number(event.target.value) || 1 }))} /></label>
          <label className="form-field form-field-full"><span>Fee minimum</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={input.minimumFee || ''} onChange={(event) => setInput((current) => ({ ...current, minimumFee: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 }))} placeholder="0" /></div><small className="field-helper">Total layanan tidak akan lebih rendah dari nominal ini.</small></label>
          <label className="check-field form-field-full"><input type="checkbox" checked={input.isActive} onChange={(event) => setInput((current) => ({ ...current, isActive: event.target.checked }))} /><span><b>Tampilkan di katalog aktif</b><small>Layanan masih bisa digunakan dalam penawaran lama saat dinonaktifkan.</small></span></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" type="submit" disabled={saving}><Save size={17} /> {saving ? 'Menyimpan…' : 'Simpan layanan'}</button></div>
      </form>
    </Modal>
  )
}

export function ServiceCalculator({
  clients,
  projects,
  catalogs,
  quotes,
  loading,
  loadError,
  onRefresh,
  onSaveCatalog,
  onDeleteCatalog,
  onSaveQuote,
  onDeleteQuote,
  onConvertToInvoice,
  onToast,
}: {
  clients: Client[]
  projects: Project[]
  catalogs: ServiceCatalog[]
  quotes: ServiceQuote[]
  loading: boolean
  loadError: string
  onRefresh: () => Promise<void>
  onSaveCatalog: (input: ServiceCatalogInput, catalogId?: string) => Promise<void>
  onDeleteCatalog: (catalog: ServiceCatalog) => Promise<void>
  onSaveQuote: (draft: ServiceQuoteDraft) => Promise<ServiceQuote>
  onDeleteQuote: (quote: ServiceQuote) => Promise<void>
  onConvertToInvoice: (quote: ServiceQuote) => void
  onToast: (message: string) => void
}) {
  const [draft, setDraft] = useState<ServiceQuoteDraft>(() => newQuote(clients, projects))
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [catalogModal, setCatalogModal] = useState<{ catalog?: ServiceCatalog; template?: Partial<ServiceCatalogInput> } | null>(null)
  const [savingQuote, setSavingQuote] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const activeCatalogs = useMemo(() => catalogs.filter((catalog) => catalog.isActive), [catalogs])
  const selectedClient = clients.find((client) => client.id === draft.clientId)
  const selectedProject = projects.find((project) => project.id === draft.projectId)
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId)
  const totals = useMemo(() => quoteTotals(draft), [draft])

  const saveCatalog = async (input: ServiceCatalogInput, catalogId?: string) => {
    await onSaveCatalog(input, catalogId)
    onToast(catalogId ? 'Layanan diperbarui.' : 'Layanan ditambahkan ke katalog.')
  }

  const selectClient = (clientId: string) => {
    const project = projects.find((item) => item.clientId === clientId)
    setDraft((current) => ({ ...current, clientId, projectId: project?.id ?? '' }))
  }

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    setDraft((current) => ({ ...current, projectId, clientId: project?.clientId ?? current.clientId }))
  }

  const addCatalogItem = (catalog: ServiceCatalog) => {
    setDraft((current) => ({ ...current, items: [...current.items, quoteItemFromCatalog(catalog)] }))
  }

  const addManualItem = () => setDraft((current) => ({ ...current, items: [...current.items, manualQuoteItem()] }))

  const updateItem = (index: number, patch: Partial<ServiceQuoteItem>) => {
    setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  const removeItem = (index: number) => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const openQuote = (quote: ServiceQuote) => {
    setDraft({ ...quote, items: quote.items.map((item) => ({ ...item })) })
    setSelectedQuoteId(quote.id)
  }

  const createNewQuote = () => {
    setDraft(newQuote(clients, projects))
    setSelectedQuoteId('')
  }

  const saveQuote = async () => {
    try {
      setSavingQuote(true)
      const saved = await onSaveQuote(draft)
      setDraft(saved)
      setSelectedQuoteId(saved.id)
      onToast('Penawaran disimpan. Belum tercatat sebagai tagihan Finance.')
      return saved
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Penawaran tidak dapat disimpan.')
      return null
    } finally {
      setSavingQuote(false)
    }
  }

  const convertToInvoice = async () => {
    if (selectedQuote?.status === 'Converted') {
      onToast('Penawaran ini sudah terhubung ke invoice. Buka invoice terkait dari daftar invoice untuk mengubahnya.')
      return
    }
    const saved = await saveQuote()
    if (saved) onConvertToInvoice(saved)
  }

  const deleteCatalog = async (catalog: ServiceCatalog) => {
    if (!window.confirm(`Hapus layanan "${catalog.name}" dari katalog? Penawaran yang sudah ada tidak akan ikut terhapus.`)) return
    try {
      setDeletingId(catalog.id)
      await onDeleteCatalog(catalog)
      onToast('Layanan dihapus dari katalog.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Layanan tidak dapat dihapus.')
    } finally {
      setDeletingId('')
    }
  }

  const deleteQuote = async (quote: ServiceQuote) => {
    if (!window.confirm(`Hapus penawaran "${quote.title}"?`)) return
    try {
      setDeletingId(quote.id)
      await onDeleteQuote(quote)
      if (selectedQuoteId === quote.id) createNewQuote()
      onToast('Penawaran dihapus.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Penawaran tidak dapat dihapus.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="service-calculator-shell">
      <aside className="service-calculator-library">
        <article className="card service-library-card">
          <div className="service-library-head"><div><p className="eyebrow">Service catalog</p><h2>Katalog jasa</h2></div><button className="icon-button" aria-label="Tambah layanan" onClick={() => setCatalogModal({})}><Plus size={17} /></button></div>
          <p className="service-library-copy">Simpan fee minimum, harga unit, dan detail agar konsisten di setiap penawaran.</p>
          <div className="service-catalog-list">
            {activeCatalogs.map((catalog) => <article key={catalog.id} className="service-catalog-item"><button className="service-catalog-add" onClick={() => addCatalogItem(catalog)} title="Tambahkan ke penawaran"><span><PackagePlus size={16} /></span><span><strong>{catalog.name}</strong><small>{catalog.category} · mulai {rupiah(catalog.minimumFee || catalog.defaultUnitPrice)}</small></span><Plus size={15} /></button><span className="service-catalog-actions"><button aria-label={`Edit ${catalog.name}`} onClick={() => setCatalogModal({ catalog })}><Pencil size={13} /></button><button aria-label={`Hapus ${catalog.name}`} onClick={() => { void deleteCatalog(catalog) }} disabled={deletingId === catalog.id}><Trash2 size={13} /></button></span></article>)}
            {!activeCatalogs.length && <div className="service-catalog-empty"><PackagePlus size={19} /><strong>Katalog masih kosong</strong><p>Mulai dengan layanan sendiri atau pakai salah satu saran singkat berikut.</p><div>{quickCatalogs.map((catalog) => <button key={catalog.name} onClick={() => setCatalogModal({ template: catalog })}>+ {catalog.name}</button>)}</div></div>}
          </div>
          {catalogs.some((catalog) => !catalog.isActive) && <p className="service-inactive-note">{catalogs.filter((catalog) => !catalog.isActive).length} layanan nonaktif disembunyikan dari katalog.</p>}
        </article>

        <article className="card service-library-card quote-library-card">
          <div className="service-library-head"><div><p className="eyebrow">Saved quotes</p><h2>Penawaran tersimpan</h2></div><button className="icon-button" aria-label="Penawaran baru" onClick={createNewQuote}><FilePlus2 size={16} /></button></div>
          <div className="saved-quote-list">
            {quotes.map((quote) => <article key={quote.id} className={`saved-quote-item ${selectedQuoteId === quote.id ? 'active' : ''}`}><button className="saved-quote-select" onClick={() => openQuote(quote)}><span className={`quote-status-dot ${quoteStatusTone(quote.status)}`} /><span><strong>{quote.title}</strong><small>{quote.quoteNumber} · {rupiah(quote.totalAmount)}</small></span><span className={`quote-status-chip ${quoteStatusTone(quote.status)}`}>{quoteStatusLabel(quote.status)}</span></button><button className="saved-quote-delete" aria-label={`Hapus ${quote.title}`} disabled={deletingId === quote.id} onClick={() => { void deleteQuote(quote) }}><Trash2 size={13} /></button></article>)}
            {!quotes.length && <p className="saved-quote-empty">Penawaran yang Anda simpan akan muncul di sini. Draft penawaran tidak menambah angka Finance.</p>}
          </div>
        </article>
      </aside>

      <article className="card service-calculator-main">
        <header className="service-calculator-head"><div><p className="eyebrow">Price builder</p><h2>{draft.id ? 'Edit penawaran' : 'Penawaran baru'}</h2><p>Hitung jasa, paket, atau fee minimal sebelum diterbitkan sebagai invoice.</p></div><div className="service-calculator-head-actions"><button className="soft-button" onClick={() => { void onRefresh() }} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Muat ulang</button><button className="primary-button" onClick={() => { void saveQuote() }} disabled={savingQuote}>{savingQuote ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} {savingQuote ? 'Menyimpan…' : 'Simpan penawaran'}</button></div></header>
        {loadError && <div className="service-calculator-setup"><Calculator size={17} /><span>{loadError}</span></div>}
        <div className="service-calculator-settings">
          <label className="form-field"><span>Judul penawaran</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: Penawaran Social Media September" /></label>
          <label className="form-field"><span>Nomor penawaran</span><div className="quote-number-field"><input value={draft.quoteNumber} onChange={(event) => setDraft((current) => ({ ...current, quoteNumber: event.target.value }))} /><button type="button" onClick={() => setDraft((current) => ({ ...current, quoteNumber: randomQuoteNumber() }))}><RefreshCw size={13} /> Acak</button></div></label>
          <label className="form-field"><span>Klien</span><span className="select-wrap"><select value={draft.clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Pilih klien (opsional)</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company || client.name}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Proyek</span><span className="select-wrap"><select value={draft.projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Belum terhubung ke proyek</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.client}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Tanggal dibuat</span><input type="date" value={draft.issueDate} onChange={(event) => setDraft((current) => ({ ...current, issueDate: event.target.value }))} /></label>
          <label className="form-field"><span>Berlaku sampai</span><input type="date" value={draft.validUntil} onChange={(event) => setDraft((current) => ({ ...current, validUntil: event.target.value }))} /></label>
          <label className="form-field"><span>Status penawaran</span><span className="select-wrap"><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ServiceQuoteStatus }))}>{quoteStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}{draft.status === 'Converted' && <option value="Converted">Menjadi invoice</option>}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Mata uang</span><input value={draft.currency} maxLength={3} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="IDR" /></label>
        </div>

        <section className="quote-items-section"><div className="quote-section-heading"><div><p className="eyebrow">Layanan & perhitungan</p><h3>Rincian penawaran</h3></div><div><button className="soft-button" onClick={addManualItem}><Plus size={15} /> Item custom</button></div></div>
          <div className="quote-item-list">
            {draft.items.map((item, index) => <article className="quote-item-editor" key={`${item.catalogId ?? 'manual'}-${index}`}><span className="quote-item-index">{String(index + 1).padStart(2, '0')}</span><div className="quote-item-fields"><label className="form-field quote-item-name"><span>Nama layanan</span><input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value, catalogId: undefined })} /></label><label className="form-field quote-item-detail"><span>Detail</span><input value={item.detail} onChange={(event) => updateItem(index, { detail: event.target.value })} placeholder="Output, cakupan, atau ketentuan layanan" /></label><label className="form-field"><span>Basis</span><span className="select-wrap"><select value={item.pricingMode} onChange={(event) => updateItem(index, { pricingMode: event.target.value as ServicePricingMode })}>{pricingModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select><ChevronDown size={14} /></span></label><label className="form-field"><span>Unit</span><input value={item.unitLabel} onChange={(event) => updateItem(index, { unitLabel: event.target.value })} /></label><label className="form-field"><span>Jumlah</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })} /></label><label className="form-field"><span>Harga/unit</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={item.unitPrice || ''} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" /></div></label><label className="form-field"><span>Fee minimum</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={item.minimumFee || ''} onChange={(event) => updateItem(index, { minimumFee: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" /></div></label></div><aside className="quote-item-total"><small>Total layanan</small><strong>{rupiah(quoteItemTotal(item))}</strong>{item.minimumFee > item.quantity * item.unitPrice && <em>Fee minimum aktif</em>}<button aria-label={`Hapus ${item.name}`} onClick={() => removeItem(index)}><Trash2 size={14} /></button></aside></article>)}
            {!draft.items.length && <div className="quote-items-empty"><ClipboardList size={23} /><strong>Tambahkan layanan untuk mulai menghitung</strong><p>Pilih layanan dari katalog di sebelah kiri atau buat item custom yang bisa diubah bebas.</p><button className="soft-button" onClick={addManualItem}><Plus size={15} /> Tambah item custom</button></div>}
          </div>
        </section>

        <section className="quote-bottom-grid"><label className="form-field quote-notes"><span>Catatan penawaran</span><textarea rows={5} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Contoh: Harga sudah termasuk dua kali revisi. Pembayaran dimulai dengan DP 50%." /></label><article className="quote-totals"><div><span>Subtotal</span><strong>{rupiah(totals.subtotal)}</strong></div><label><span>Diskon</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={draft.discountAmount || ''} onChange={(event) => setDraft((current) => ({ ...current, discountAmount: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 }))} placeholder="0" /></div></label><label><span>Pajak (%)</span><input type="number" min="0" max="100" value={draft.taxRate || ''} onChange={(event) => setDraft((current) => ({ ...current, taxRate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))} placeholder="0" /></label>{totals.tax > 0 && <div><span>Pajak</span><strong>{rupiah(totals.tax)}</strong></div>}<div className="quote-grand-total"><span>Total penawaran</span><strong>{rupiah(totals.total)}</strong></div></article></section>

        <footer className="quote-conversion-footer"><div><span><Check size={15} /> Tidak masuk Finance dulu</span><p>Penawaran baru menjadi tagihan setelah Anda mengonversinya dan menyimpan invoice.</p></div><button className="primary-button" onClick={() => { void convertToInvoice() }} disabled={savingQuote || !draft.items.length || selectedQuote?.status === 'Converted'}><ReceiptText size={17} /> {selectedQuote?.status === 'Converted' ? 'Invoice sudah dibuat' : 'Jadikan invoice'}</button></footer>
      </article>

      <aside className="card quote-preview-card">
        <div className="quote-preview-head"><div><p className="eyebrow">Realtime preview</p><h2>Penawaran harga</h2></div><span className={`quote-status-chip ${quoteStatusTone(draft.status)}`}>{quoteStatusLabel(draft.status)}</span></div>
        <section className="quote-paper"><div className="quote-paper-brand"><span><Calculator size={17} /></span><strong>Nayagement Studio</strong><small>PENAWARAN</small></div><h3>{draft.title || 'Penawaran layanan'}</h3><p className="quote-paper-number">{draft.quoteNumber || 'Nomor belum dibuat'}</p><div className="quote-paper-client"><small>Kepada</small><strong>{selectedClient?.company || selectedClient?.name || 'Klien belum dipilih'}</strong>{selectedProject && <span>{selectedProject.name}</span>}</div><div className="quote-paper-lines">{draft.items.map((item, index) => <div key={`${item.name}-${index}`}><span><strong>{item.name || 'Layanan'}</strong>{item.detail && <small>{item.detail}</small>}<em>{item.quantity} {item.unitLabel} × {rupiah(item.unitPrice)}</em></span><b>{rupiah(quoteItemTotal(item))}</b></div>)}{!draft.items.length && <p>Rincian layanan akan muncul di sini.</p>}</div><div className="quote-paper-total"><span>Total</span><strong>{rupiah(totals.total)}</strong></div><div className="quote-paper-meta"><span>Dibuat {dateLabel(draft.issueDate)}</span><span>Berlaku hingga {dateLabel(draft.validUntil)}</span></div>{draft.notes && <p className="quote-paper-notes">{draft.notes}</p>}</section>
        <div className="quote-preview-info"><Copy size={15} /><p>Setelah disimpan, penawaran bisa dipilih lagi dari daftar dan diubah menjadi invoice saat siap ditagihkan.</p></div>
      </aside>

      {catalogModal && <ServiceCatalogModal catalog={catalogModal.catalog} template={catalogModal.template} onClose={() => setCatalogModal(null)} onSave={saveCatalog} />}
    </section>
  )
}
