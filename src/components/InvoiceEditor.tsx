import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { CalendarDays, CheckCircle2, ChevronDown, Download, FileText, ImagePlus, Mail, MessageCircle, Palette, Plus, ReceiptText, Trash2, UserRound, X } from 'lucide-react'
import type { Client, InvoiceEditorDraft, InvoiceLineItem, Project } from '../types'
import { generateInvoiceNumber } from '../lib/invoice'
import { BrandMark } from './ui'

const invoicePalette = ['#30343b', '#1f4e79', '#166650', '#7a3d66', '#983f30', '#8b6518']

function invoiceMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
  } catch {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)
  }
}

function invoiceDate(value: string) {
  const date = new Date(`${value || new Date().toISOString().slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function invoiceTotals(draft: InvoiceEditorDraft) {
  const subtotal = draft.items.reduce((total, item) => total + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0)
  const discount = Math.min(subtotal, Math.max(0, draft.discountAmount))
  const taxable = Math.max(0, subtotal - discount)
  const tax = Math.round(taxable * (Math.min(100, Math.max(0, draft.taxRate)) / 100))
  return { subtotal, discount, tax, total: taxable + tax }
}

function printableInvoiceStyles() {
  return `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-a4 { --invoice-accent: #30343b; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 15mm 13mm; color: #29313b; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .invoice-a4-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18mm; min-height: 37mm; }
    .invoice-brand-lockup { display: grid; gap: 4mm; max-width: 75mm; }
    .invoice-logo-box { display: grid; width: 25mm; height: 25mm; place-items: center; overflow: hidden; background: transparent; }
    .invoice-logo-box img { width: 100%; height: 100%; object-fit: contain; background: transparent; }
    .invoice-fallback-logo { object-fit: contain; }
    .invoice-sender-name { font-size: 10pt; font-weight: 700; }
    .invoice-sender-meta { color: #6c7480; font-size: 7.5pt; line-height: 1.55; white-space: pre-line; }
    .invoice-document-label { margin: 6mm 0 0; color: var(--invoice-accent); font-size: 27pt; font-weight: 800; letter-spacing: .12em; text-align: right; }
    .invoice-recipient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; margin-top: 11mm; padding-bottom: 8mm; border-bottom: .35mm solid #d6d9de; }
    .invoice-eyebrow { margin: 0 0 2.5mm; color: #7b828e; font-size: 7pt; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
    .invoice-recipient h2 { margin: 0; color: #252c35; font-size: 16pt; line-height: 1.15; }
    .invoice-recipient p { margin: 1.5mm 0 0; color: #59616d; font-size: 8pt; line-height: 1.45; }
    .invoice-contact-list { display: grid; gap: 1.2mm; margin-top: 5mm; color: #49525e; font-size: 7.8pt; }
    .invoice-meta-list { display: grid; grid-template-columns: max-content 1fr; gap: 2mm 6mm; margin: 7mm 0 0; font-size: 8pt; }
    .invoice-meta-list dt { color: #7b828e; }
    .invoice-meta-list dd { margin: 0; color: #303842; font-weight: 700; }
    .invoice-items { width: 100%; margin-top: 8mm; border-collapse: collapse; font-size: 8pt; }
    .invoice-items th { padding: 3.3mm 3mm; color: #fff; background: var(--invoice-accent); font-size: 7pt; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
    .invoice-items th:first-child, .invoice-items td:first-child { width: 10mm; text-align: center; }
    .invoice-items th:nth-last-child(-n+3), .invoice-items td:nth-last-child(-n+3) { width: 27mm; text-align: right; }
    .invoice-items td { padding: 3.1mm 3mm; border-bottom: .25mm solid #edf0f3; color: #3c4651; }
    .invoice-item-copy { display: grid; gap: 1mm; }
    .invoice-item-copy strong { color: #29313b; font-size: 8pt; }
    .invoice-item-copy em { color: #697381; font-size: 7.1pt; font-style: italic; font-weight: 400; line-height: 1.4; }
    .invoice-items tbody tr:nth-child(even) { background: #f2f4f6; }
    .invoice-items tbody tr:last-child td { border-bottom: 0; }
    .invoice-summary-grid { display: grid; grid-template-columns: 1fr 80mm; gap: 14mm; margin-top: 10mm; }
    .invoice-balance { align-self: end; padding-top: 8mm; }
    .invoice-balance small { display: block; color: #6e7783; font-size: 7pt; }
    .invoice-balance strong { display: block; margin-top: 2mm; color: #242d37; font-size: 18pt; }
    .invoice-balance .invoice-balance-line { width: 38mm; height: .35mm; margin-top: 3mm; background: var(--invoice-accent); }
    .invoice-balance p { margin: 2mm 0 0; color: #68717d; font-size: 7.2pt; }
    .invoice-totals { display: grid; gap: 0; }
    .invoice-total-row { display: flex; align-items: center; justify-content: space-between; gap: 6mm; padding: 2.8mm 4mm; border-bottom: .25mm solid #dce0e5; color: #4d5560; font-size: 8pt; }
    .invoice-total-row strong { color: #29313b; }
    .invoice-total-row.grand { margin-top: 2mm; border: 0; color: #fff; background: var(--invoice-accent); font-size: 10pt; font-weight: 800; }
    .invoice-total-row.grand strong { color: #fff; font-size: 11pt; }
    .invoice-signature-row { display: flex; min-height: 32mm; align-items: flex-end; justify-content: flex-end; margin-top: 16mm; }
    .invoice-signature { align-self: end; text-align: right; }
    .invoice-signature-image { display: block; width: 42mm; height: 16mm; margin: 0 0 2mm auto; object-fit: contain; object-position: right bottom; }
    .invoice-signature-empty { display: block; width: 42mm; height: 16mm; border-bottom: .35mm solid #cbd2da; }
    .invoice-signature strong { display: block; margin-top: 2mm; font-size: 8pt; }
    .invoice-signature span { color: #68717d; font-size: 7pt; }
    .invoice-footer { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 12mm; padding-top: 4mm; border-top: .35mm solid var(--invoice-accent); color: #5f6874; font-size: 7pt; line-height: 1.5; }
    .invoice-footer h3 { margin: 0 0 2mm; color: #2d3540; font-size: 8pt; }
    .invoice-footer p { margin: 0; white-space: pre-line; }
    @media print { .invoice-a4 { box-shadow: none; } }
  `
}

async function exportInvoicePdf(invoiceNumber: string) {
  const preview = document.getElementById('invoice-a4-preview')
  if (!preview) return false
  await document.fonts?.ready
  await Promise.all(Array.from(preview.querySelectorAll('img')).map((image) => image.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })))
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(preview, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: 1440,
    windowHeight: 1700,
  })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const rawHeight = (canvas.height * 210) / canvas.width
  const height = Math.min(297, rawHeight)
  const width = rawHeight > 297 ? (canvas.width * 297) / canvas.height : 210
  const x = (210 - width) / 2
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x, 0, width, height, undefined, 'FAST')
  const safeName = (invoiceNumber || 'invoice').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'invoice'
  const blobUrl = URL.createObjectURL(pdf.output('blob'))
  const download = document.createElement('a')
  download.href = blobUrl
  download.download = `${safeName}.pdf`
  download.style.display = 'none'
  document.body.appendChild(download)
  download.click()
  download.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  return true
}

interface InvoiceEditorProps {
  draft: InvoiceEditorDraft
  clients: Client[]
  projects: Project[]
  loading?: boolean
  previewOnly?: boolean
  autoDownloadPdf?: boolean
  onChange: (draft: InvoiceEditorDraft) => void
  onSave: (draft: InvoiceEditorDraft, logoFile: File | null, signatureFile: File | null) => Promise<void>
  onToast: (message: string) => void
}

export function InvoiceEditor({ draft, clients, projects, loading = false, previewOnly = false, autoDownloadPdf = false, onChange, onSave, onToast }: InvoiceEditorProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [logoPreview, setLogoPreview] = useState(draft.logoUrl ?? '')
  const [signaturePreview, setSignaturePreview] = useState(draft.signatureUrl ?? '')
  const totals = useMemo(() => invoiceTotals(draft), [draft])
  const clientProjects = useMemo(() => draft.clientId ? projects.filter((project) => project.clientId === draft.clientId) : projects, [draft.clientId, projects])
  const autoDownloadedInvoice = useRef('')

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(draft.logoUrl ?? '')
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [draft.logoUrl, logoFile])

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreview(draft.signatureUrl ?? '')
      return
    }
    const url = URL.createObjectURL(signatureFile)
    setSignaturePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [draft.signatureUrl, signatureFile])

  const downloadPdf = async () => {
    try {
      setExportingPdf(true)
      if (!await exportInvoicePdf(draft.invoiceNumber)) onToast('Preview invoice belum siap untuk diunduh.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'PDF invoice tidak dapat dibuat.')
    } finally {
      setExportingPdf(false)
    }
  }

  useEffect(() => {
    if (!autoDownloadPdf || loading || !draft.id || autoDownloadedInvoice.current === draft.id) return
    autoDownloadedInvoice.current = draft.id
    const timer = window.setTimeout(() => { void downloadPdf() }, 700)
    return () => window.clearTimeout(timer)
  }, [autoDownloadPdf, draft.id, loading])

  const update = <K extends keyof InvoiceEditorDraft>(key: K, value: InvoiceEditorDraft[K]) => onChange({ ...draft, [key]: value })

  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId)
    const firstProject = projects.find((project) => project.clientId === clientId)
    onChange({
      ...draft,
      clientId,
      projectId: firstProject?.id ?? '',
      invoiceNumber: draft.id ? draft.invoiceNumber : generateInvoiceNumber(firstProject, draft.issueDate),
      recipientName: client?.name ?? '',
      recipientCompany: client?.company ?? '',
      recipientEmail: client?.email ?? '',
      recipientWhatsapp: client?.whatsapp ?? '',
    })
  }

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    const client = project?.clientId ? clients.find((item) => item.id === project.clientId) : undefined
    const items = draft.items.length === 1 && !draft.items[0].unitPrice
      ? [{ ...draft.items[0], description: project?.name || draft.items[0].description, unitPrice: project?.estimatedValue || 0 }]
      : draft.items
    onChange({
      ...draft,
      projectId,
      clientId: client?.id ?? draft.clientId,
      invoiceNumber: draft.id ? draft.invoiceNumber : generateInvoiceNumber(project, draft.issueDate),
      recipientName: client?.name ?? draft.recipientName,
      recipientCompany: client?.company ?? draft.recipientCompany,
      recipientEmail: client?.email ?? draft.recipientEmail,
      recipientWhatsapp: client?.whatsapp ?? draft.recipientWhatsapp,
      items,
    })
  }

  const updateItem = (index: number, changes: Partial<InvoiceLineItem>) => update('items', draft.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  const removeItem = (index: number) => update('items', draft.items.length > 1 ? draft.items.filter((_, itemIndex) => itemIndex !== index) : draft.items)
  const addItem = () => update('items', [...draft.items, { description: 'Layanan baru', detail: '', quantity: 1, unitPrice: 0 }])

  const selectLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onToast('Gunakan gambar JPG, PNG, atau WebP untuk logo invoice.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast('Ukuran logo invoice maksimal 5 MB.')
      return
    }
    setLogoFile(file)
  }

  const selectSignature = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (file.type !== 'image/png') {
      onToast('Gunakan file PNG transparan untuk tanda tangan invoice.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      onToast('Ukuran tanda tangan invoice maksimal 3 MB.')
      return
    }
    setSignatureFile(file)
  }

  const submit = async () => {
    try {
      setSaving(true)
      await onSave(draft, logoFile, signatureFile)
      setLogoFile(null)
      setSignatureFile(null)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Invoice tidak dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const accentStyle = { '--invoice-accent': draft.brandColor } as CSSProperties

  if (loading) return <section className="invoice-editor-loading"><ReceiptText size={24} /><strong>Memuat editor invoice…</strong><p>Menyiapkan data pelanggan, layanan, dan dokumen.</p></section>

  return (
    <section className={`invoice-editor-shell${previewOnly ? ' invoice-editor-preview-only' : ''}`}>
      {!previewOnly && <aside className="invoice-editor-controls">
        <div className="invoice-editor-controls-head"><div><p className="eyebrow">Invoice builder</p><h2>Atur dokumen</h2><p>Setiap perubahan akan langsung terlihat di pratinjau A4.</p></div><button className="primary-button" type="button" onClick={() => { void submit() }} disabled={saving}><CheckCircle2 size={17} /> {saving ? 'Menyimpan…' : 'Simpan'}</button></div>

        <details className="invoice-accordion" open><summary><span><UserRound size={16} /> Customer & proyek</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body">
          <label className="form-field"><span>Pilih customer</span><span className="select-wrap"><select value={draft.clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Customer manual</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company} · {client.name}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Pilih proyek / layanan</span><span className="select-wrap"><select value={draft.projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Tidak terhubung ke proyek</option>{clientProjects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.type}</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Nama penerima</span><input value={draft.recipientName} onChange={(event) => update('recipientName', event.target.value)} placeholder="Nama customer" /></label>
          <label className="form-field"><span>Perusahaan / brand</span><input value={draft.recipientCompany} onChange={(event) => update('recipientCompany', event.target.value)} placeholder="Nama perusahaan" /></label>
          <label className="form-field"><span><Mail size={14} /> Email</span><input type="email" value={draft.recipientEmail} onChange={(event) => update('recipientEmail', event.target.value)} placeholder="customer@email.com" /></label>
          <label className="form-field"><span><MessageCircle size={14} /> WhatsApp</span><input type="tel" value={draft.recipientWhatsapp} onChange={(event) => update('recipientWhatsapp', event.target.value)} placeholder="08xx xxxx xxxx" /></label>
        </div></details>

        <details className="invoice-accordion"><summary><span><FileText size={16} /> Informasi invoice</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body">
          <label className="form-field"><span>Judul dokumen</span><input value={draft.documentTitle} onChange={(event) => update('documentTitle', event.target.value)} placeholder="Invoice" /></label>
          <label className="form-field"><span>Nomor invoice</span><span className="invoice-number-field"><input value={draft.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} placeholder="12345/INV-SMM/VIII/2026" /><button type="button" onClick={() => update('invoiceNumber', generateInvoiceNumber(projects.find((project) => project.id === draft.projectId), draft.issueDate))}>Nomor acak</button></span></label>
          <label className="form-field"><span><CalendarDays size={14} /> Tanggal invoice</span><input type="date" value={draft.issueDate} onChange={(event) => update('issueDate', event.target.value)} /></label>
          <label className="form-field"><span><CalendarDays size={14} /> Jatuh tempo</span><input type="date" value={draft.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label>
          <label className="form-field"><span>Status</span><span className="select-wrap"><select value={draft.status} onChange={(event) => update('status', event.target.value as InvoiceEditorDraft['status'])}><option>Draft</option><option>DP</option><option>Paid</option><option>Overdue</option><option>Void</option></select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Mata uang</span><input value={draft.currency} maxLength={3} onChange={(event) => update('currency', event.target.value.toUpperCase())} placeholder="IDR" /></label>
        </div></details>

        <details className="invoice-accordion" open><summary><span><ReceiptText size={16} /> Layanan & item</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body"><div className="invoice-items-editor">{draft.items.map((item, index) => <div className="invoice-item-editor" key={item.id ?? `${index}-${item.description}`}><div className="invoice-item-editor-index">{String(index + 1).padStart(2, '0')}</div><label className="form-field invoice-item-description"><span>Deskripsi</span><input value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Nama layanan" /></label><label className="form-field"><span>Qty</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 0 })} /></label><label className="form-field"><span>Harga</span><input inputMode="numeric" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value.replace(/[^0-9]/g, '')) || 0 })} /></label><button className="invoice-item-remove" type="button" onClick={() => removeItem(index)} disabled={draft.items.length === 1} aria-label={`Hapus item ${index + 1}`}><Trash2 size={15} /></button><label className="form-field invoice-item-detail"><span>Detail layanan</span><input value={item.detail ?? ''} onChange={(event) => updateItem(index, { detail: event.target.value })} placeholder="Contoh: 12 konten, copywriting, dan jadwal publikasi." /></label></div>)}</div><button className="invoice-add-item" type="button" onClick={addItem}><Plus size={15} /> Tambah layanan</button></div></details>

        <details className="invoice-accordion"><summary><span><ReceiptText size={16} /> Pembayaran & total</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body">
          <label className="form-field"><span>Diskon</span><div className="currency-input"><span>{draft.currency || 'IDR'}</span><input inputMode="numeric" value={draft.discountAmount} onChange={(event) => update('discountAmount', Number(event.target.value.replace(/[^0-9]/g, '')) || 0)} /></div></label>
          <label className="form-field"><span>Pajak (%)</span><input type="number" min="0" max="100" value={draft.taxRate} onChange={(event) => update('taxRate', Number(event.target.value) || 0)} /></label>
          <label className="form-field form-field-full"><span>Instruksi pembayaran</span><textarea rows={3} value={draft.paymentInstructions} onChange={(event) => update('paymentInstructions', event.target.value)} placeholder="Bank, nomor rekening, dan nama pemilik rekening." /></label>
        </div></details>

        <details className="invoice-accordion"><summary><span><Palette size={16} /> Brand & warna</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body">
          <label className="form-field form-field-full"><span>Logo invoice</span><span className="invoice-logo-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectLogo} /><span><ImagePlus size={16} /> {logoFile?.name || (draft.logoUrl ? 'Ganti logo lokal' : 'Upload logo lokal')}</span></span></label>
          {(logoPreview || draft.logoPath) && <button type="button" className="invoice-logo-clear" onClick={() => { setLogoFile(null); onChange({ ...draft, logoPath: '', logoUrl: '' }) }}><X size={14} /> Hapus logo</button>}
          <label className="form-field form-field-full"><span>Tanda tangan penanggung jawab</span><span className="invoice-logo-upload"><input type="file" accept="image/png" onChange={selectSignature} /><span><ImagePlus size={16} /> {signatureFile?.name || (draft.signatureUrl ? 'Ganti tanda tangan PNG' : 'Upload tanda tangan PNG')}</span></span><small className="invoice-upload-hint">Gunakan PNG transparan, maksimal 3 MB.</small></label>
          {(signaturePreview || draft.signaturePath) && <button type="button" className="invoice-logo-clear" onClick={() => { setSignatureFile(null); onChange({ ...draft, signaturePath: '', signatureUrl: '' }) }}><X size={14} /> Hapus tanda tangan</button>}
          <div className="invoice-color-control"><span>Warna utama</span><div><input type="color" value={draft.brandColor} onChange={(event) => update('brandColor', event.target.value)} />{invoicePalette.map((color) => <button key={color} type="button" className={draft.brandColor.toLowerCase() === color ? 'active' : ''} style={{ background: color }} onClick={() => update('brandColor', color)} aria-label={`Pilih warna ${color}`} />)}</div></div>
        </div></details>

        <details className="invoice-accordion"><summary><span><UserRound size={16} /> Pengirim & ketentuan</span><ChevronDown size={16} /></summary><div className="invoice-accordion-body">
          <label className="form-field"><span>Nama studio</span><input value={draft.senderName} onChange={(event) => update('senderName', event.target.value)} placeholder="Nama studio" /></label>
          <label className="form-field form-field-full"><span>Syarat & ketentuan</span><textarea rows={4} value={draft.terms} onChange={(event) => update('terms', event.target.value)} placeholder="Tuliskan ketentuan pembayaran dan pekerjaan." /></label>
          <label className="form-field form-field-full"><span>Keterangan invoice</span><textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Catatan tambahan yang dapat dibaca customer." /></label>
        </div></details>
      </aside>}

      <section className="invoice-editor-preview-pane"><div className="invoice-preview-toolbar"><div><p className="eyebrow">A4 preview</p><h2>{draft.invoiceNumber || 'Invoice siap diunduh'}</h2></div><button className="soft-button" type="button" onClick={() => { void downloadPdf() }} disabled={exportingPdf}><Download size={16} /> {exportingPdf ? 'Membuat PDF…' : 'Download PDF'}</button></div><div className="invoice-a4-stage"><article id="invoice-a4-preview" className="invoice-a4" style={accentStyle}>
        <header className="invoice-a4-header"><div className="invoice-brand-lockup"><div className="invoice-logo-box">{logoPreview ? <img src={logoPreview} alt="Logo invoice" /> : <BrandMark className="invoice-fallback-logo" />}</div><strong className="invoice-sender-name">{draft.senderName || 'Nayagement Studio'}</strong></div><h1 className="invoice-document-label">{(draft.documentTitle || 'Invoice').toUpperCase()}</h1></header>
        <section className="invoice-recipient-grid"><div className="invoice-recipient"><p className="invoice-eyebrow">Invoice to</p><h2>{draft.recipientName || 'Nama customer'}</h2><p>{draft.recipientCompany || 'Perusahaan / brand customer'}</p><div className="invoice-contact-list">{draft.recipientWhatsapp && <span>{draft.recipientWhatsapp}</span>}{draft.recipientEmail && <span>{draft.recipientEmail}</span>}</div></div><dl className="invoice-meta-list"><dt>Invoice No</dt><dd>{draft.invoiceNumber || '—'}</dd><dt>Invoice Date</dt><dd>{invoiceDate(draft.issueDate)}</dd><dt>Due Date</dt><dd>{invoiceDate(draft.dueDate)}</dd><dt>Status</dt><dd>{draft.status}</dd></dl></section>
        <table className="invoice-items"><thead><tr><th>#</th><th>Description</th><th>Price</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>{draft.items.map((item, index) => <tr key={item.id ?? `${index}-${item.description}`}><td>{String(index + 1).padStart(2, '0')}</td><td><span className="invoice-item-copy"><strong>{item.description || 'Layanan'}</strong>{item.detail && <em>{item.detail}</em>}</span></td><td>{invoiceMoney(item.unitPrice, draft.currency)}</td><td>{item.quantity}</td><td>{invoiceMoney(item.unitPrice * item.quantity, draft.currency)}</td></tr>)}</tbody></table>
        <section className="invoice-summary-grid"><div className="invoice-balance"><small>Total due</small><strong>{invoiceMoney(totals.total, draft.currency)}</strong><div className="invoice-balance-line" />{draft.notes && <p>{draft.notes}</p>}</div><div className="invoice-totals"><div className="invoice-total-row"><span>Sub total</span><strong>{invoiceMoney(totals.subtotal, draft.currency)}</strong></div>{totals.discount > 0 && <div className="invoice-total-row"><span>Discount</span><strong>-{invoiceMoney(totals.discount, draft.currency)}</strong></div>}<div className="invoice-total-row"><span>Tax ({draft.taxRate || 0}%)</span><strong>{invoiceMoney(totals.tax, draft.currency)}</strong></div><div className="invoice-total-row grand"><span>TOTAL</span><strong>{invoiceMoney(totals.total, draft.currency)}</strong></div></div></section>
        <section className="invoice-signature-row"><div className="invoice-signature">{signaturePreview ? <img className="invoice-signature-image" src={signaturePreview} alt="Tanda tangan" /> : <span className="invoice-signature-empty" />}<strong>{draft.senderName || 'Nayagement Studio'}</strong><span>Authorized signature</span></div></section>
        <footer className="invoice-footer"><section><h3>Informasi pembayaran</h3><p>{draft.paymentInstructions || 'Belum ada instruksi pembayaran.'}</p></section><section><h3>Syarat & ketentuan</h3><p>{draft.terms || 'Belum ada syarat dan ketentuan.'}</p></section></footer>
      </article></div></section>
    </section>
  )
}
