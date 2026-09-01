import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  deleteContentPlanSheet,
  isGoogleSheetUrl,
  loadContentPlanSheets,
  saveContentPlanSheet,
  uploadContentPlanLogo,
} from '../services/contentPlan'
import type { Client, ContentPlanPlatform, ContentPlanSheet, ContentPlanSheetInput } from '../types'
import { Avatar, BrandMark, IconButton } from '../components/ui'

const platforms: ContentPlanPlatform[] = [
  'Instagram & TikTok',
  'Instagram Reels',
  'LinkedIn & Article',
  'All Social Channels',
]
const viewportOptions = [500, 720, 900] as const
const zoomMin = 60
const zoomMax = 200
const zoomStep = 15

type SheetDraft = ContentPlanSheetInput

const emptyDraft: SheetDraft = {
  clientName: '',
  title: '',
  sheetUrl: '',
  platform: 'Instagram & TikTok',
  logoUrl: '',
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CP'
}

function modalFocusable(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
}

function ContentPlanDialog({ title, eyebrow, onClose, children, compact = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; compact?: boolean }) {
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    modalFocusable(panel ?? document.body)[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = modalFocusable(panel)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="content-plan-modal-scrim" role="presentation" onMouseDown={onClose}>
      <section ref={panelRef} className={`content-plan-modal ${compact ? 'content-plan-modal-compact' : ''}`} role="dialog" aria-modal="true" aria-labelledby="content-plan-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="content-plan-modal-head">
          <div><p className="eyebrow">{eyebrow}</p><h2 id="content-plan-modal-title">{title}</h2></div>
          <IconButton label="Tutup dialog" onClick={onClose}><X size={19} /></IconButton>
        </header>
        {children}
      </section>
    </div>,
    document.querySelector('.nayagement-root') ?? document.body,
  )
}

function SheetLogo({ sheet, size = 'md' }: { sheet: Pick<ContentPlanSheet, 'clientName' | 'logoUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  return <Avatar initials={initials(sheet.clientName)} size={size} variant="blue" imageUrl={sheet.logoUrl} />
}

function SpreadsheetViewer({ sheet, zoom, height, focus = false, onOpenExternal }: { sheet: ContentPlanSheet; zoom: number; height: number; focus?: boolean; onOpenExternal: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    const timeout = window.setTimeout(() => setFailed(true), 12_000)
    return () => window.clearTimeout(timeout)
  }, [sheet.embedUrl])

  const scale = zoom / 100
  const viewerHeight = focus ? undefined : height
  const iframeStyle = {
    width: `${100 / scale}%`,
    height: focus ? `${100 / scale}%` : `${height / scale}px`,
    transform: `scale(${scale})`,
  } as CSSProperties

  return (
    <div className={`content-plan-viewer ${focus ? 'focus' : ''}`} style={viewerHeight ? { height: viewerHeight } : undefined}>
      {!loaded && !failed && <div className="content-plan-frame-state"><LoaderCircle className="spin" size={25} /><strong>Memuat Google Sheets…</strong><span>Menyiapkan spreadsheet untuk workspace Anda.</span></div>}
      {failed && !loaded && (
        <div className="content-plan-frame-state error" role="alert">
          <AlertTriangle size={28} />
          <strong>Spreadsheet tidak dapat ditampilkan di dalam aplikasi</strong>
          <span>Pastikan file memiliki akses “Anyone with the link can view/edit”, lalu coba lagi atau buka langsung di Google Sheets.</span>
          <button type="button" className="primary-button" onClick={onOpenExternal}><ExternalLink size={16} /> Buka di Google Sheets</button>
        </div>
      )}
      <iframe
        key={sheet.embedUrl}
        className={loaded ? 'loaded' : ''}
        src={sheet.embedUrl}
        title={`${sheet.title} — ${sheet.clientName}`}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-read; clipboard-write"
        style={iframeStyle}
        onLoad={() => { setLoaded(true); setFailed(false) }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function ZoomControls({ zoom, onChange }: { zoom: number; onChange: (value: number) => void }) {
  return (
    <div className="content-plan-zoom" aria-label="Kontrol zoom spreadsheet">
      <IconButton label="Zoom out" disabled={zoom <= zoomMin} onClick={() => onChange(Math.max(zoomMin, zoom - zoomStep))}><Minus size={16} /></IconButton>
      <button type="button" className="content-plan-zoom-reset" title="Reset zoom" aria-label={`Reset zoom, saat ini ${zoom}%`} onClick={() => onChange(100)}><RotateCcw size={14} /><span>{zoom}%</span></button>
      <IconButton label="Zoom in" disabled={zoom >= zoomMax} onClick={() => onChange(Math.min(zoomMax, zoom + zoomStep))}><Plus size={16} /></IconButton>
    </div>
  )
}

function SheetForm({ workspaceId, clients, initial, submitLabel, onCancel, onSaved, onToast }: { workspaceId: string; clients: Client[]; initial?: ContentPlanSheet; submitLabel: string; onCancel: () => void; onSaved: (sheet: ContentPlanSheet) => void; onToast: (message: string) => void }) {
  const [draft, setDraft] = useState<SheetDraft>(initial ? {
    clientId: initial.clientId,
    clientName: initial.clientName,
    title: initial.title,
    sheetUrl: initial.sheetUrl,
    platform: initial.platform,
    logoUrl: initial.logoUrl ?? '',
  } : emptyDraft)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(initial?.logoUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  const setClientName = (value: string) => {
    const match = clients.find((client) => client.company.toLowerCase() === value.toLowerCase() || client.name.toLowerCase() === value.toLowerCase())
    setDraft((current) => ({ ...current, clientName: value, clientId: match?.id }))
  }

  const chooseLogo = (file?: File) => {
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Logo harus berupa JPG, PNG, atau WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran logo maksimal 2 MB.')
      return
    }
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clientName = draft.clientName.trim()
    const sheetUrl = draft.sheetUrl.trim()
    if (!clientName) return setError('Nama klien atau brand wajib diisi.')
    if (!sheetUrl) return setError('URL Google Sheets wajib diisi.')
    if (!isGoogleSheetUrl(sheetUrl)) return setError('Gunakan URL Google Sheets yang valid dari docs.google.com/spreadsheets.')
    setSaving(true)
    setError('')
    try {
      let logoUrl = draft.logoUrl?.trim() || undefined
      if (logoFile) logoUrl = await uploadContentPlanLogo(workspaceId, logoFile)
      const saved = await saveContentPlanSheet(workspaceId, {
        ...draft,
        clientName,
        title: draft.title.trim() || `Content Plan ${clientName}`,
        sheetUrl,
        logoUrl,
      }, initial?.id)
      onSaved(saved)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Content plan tidak dapat disimpan.'
      setError(message)
      onToast(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="content-plan-form" onSubmit={submit}>
      <div className="content-plan-logo-editor">
        <span className="content-plan-logo-preview">{logoPreview ? <img src={logoPreview} alt="Preview logo klien" /> : initials(draft.clientName)}</span>
        <div>
          <strong>Logo klien</strong>
          <p>JPG, PNG, atau WebP. Maksimal 2 MB. Jika kosong, avatar inisial digunakan.</p>
          <label className="soft-button content-plan-upload"><UploadCloud size={15} /> Unggah logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLogo(event.target.files?.[0])} /></label>
        </div>
      </div>
      <div className="form-grid content-plan-form-grid">
        <label className="form-field"><span>Nama klien / brand <b>*</b></span><input autoFocus list="content-plan-clients" value={draft.clientName} placeholder="Contoh: Bilik Strategi" onChange={(event) => setClientName(event.target.value)} required /></label>
        <datalist id="content-plan-clients">{clients.map((client) => <option key={client.id} value={client.company || client.name} />)}</datalist>
        <label className="form-field"><span>Judul spreadsheet</span><input value={draft.title} placeholder={draft.clientName ? `Content Plan ${draft.clientName}` : 'Otomatis dari nama klien'} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <label className="form-field form-field-full"><span>URL Google Sheets <b>*</b></span><input type="url" value={draft.sheetUrl} placeholder="https://docs.google.com/spreadsheets/d/..." onChange={(event) => setDraft((current) => ({ ...current, sheetUrl: event.target.value }))} required /><small className="field-helper">Pastikan akses file diatur ke “Anyone with the link can view/edit”.</small></label>
        <label className="form-field"><span>Platform</span><select value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value as ContentPlanPlatform }))}>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
        <label className="form-field"><span>URL logo alternatif</span><input type="url" value={draft.logoUrl ?? ''} placeholder="https://.../logo.png" onChange={(event) => { setDraft((current) => ({ ...current, logoUrl: event.target.value })); if (!logoFile) setLogoPreview(event.target.value) }} /><small className="field-helper">Upload lokal diprioritaskan jika keduanya diisi.</small></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-footer"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? 'Menyimpan…' : submitLabel}</button></footer>
    </form>
  )
}

export function ContentPlanPage({ workspaceId, clients, onToast }: { workspaceId: string | null; clients: Client[]; onToast: (message: string) => void }) {
  const [sheets, setSheets] = useState<ContentPlanSheet[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(100)
  const [viewportHeight, setViewportHeight] = useState<(typeof viewportOptions)[number]>(720)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ContentPlanSheet | null>(null)
  const [deleting, setDeleting] = useState<ContentPlanSheet | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const requestRef = useRef(0)
  const focusPanelRef = useRef<HTMLElement>(null)

  const load = useCallback(async (silent = false) => {
    if (!workspaceId) {
      setLoading(false)
      setError('Workspace belum siap. Silakan coba lagi sesaat.')
      return
    }
    const request = ++requestRef.current
    if (!silent) setLoading(true)
    try {
      const rows = await loadContentPlanSheets(workspaceId)
      if (request !== requestRef.current) return
      setSheets(rows)
      setSelectedId((current) => rows.some((sheet) => sheet.id === current) ? current : rows[0]?.id ?? '')
      setError('')
    } catch (cause) {
      if (request !== requestRef.current) return
      setError(cause instanceof Error ? cause.message : 'Content plan tidak dapat dimuat.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!workspaceId || !supabase) return
    const supabaseClient = supabase
    let refreshRunning = false
    const refresh = () => {
      if (refreshRunning || document.visibilityState !== 'visible') return
      refreshRunning = true
      void load(true).finally(() => { refreshRunning = false })
    }
    const channel = supabaseClient.channel(`content-plan-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_plan_sheets', filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .subscribe()
    const timer = window.setInterval(refresh, 20_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      void supabaseClient.removeChannel(channel)
    }
  }, [load, workspaceId])

  useEffect(() => {
    if (!focusMode) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = focusPanelRef.current
    const initialFocusable = modalFocusable(panel ?? document.body)
    initialFocusable[initialFocusable.length - 1]?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setFocusMode(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = modalFocusable(panel)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', close)
      previousFocus?.focus?.()
    }
  }, [focusMode])

  const selected = sheets.find((sheet) => sheet.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return sheets
    return sheets.filter((sheet) => [sheet.clientName, sheet.title, sheet.platform].some((value) => value.toLocaleLowerCase('id-ID').includes(query)))
  }, [search, sheets])

  const openExternal = (sheet = selected) => {
    if (!sheet) return
    const popup = window.open(sheet.sheetUrl, '_blank', 'noopener,noreferrer')
    if (popup) popup.opener = null
  }

  const copyLink = async () => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.sheetUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      onToast('Link Google Sheets tersalin.')
    } catch {
      onToast('Browser menolak menyalin link. Buka Google Sheets lalu salin URL dari browser.')
    }
  }

  const created = (sheet: ContentPlanSheet) => {
    setSheets((current) => [sheet, ...current.filter((item) => item.id !== sheet.id)])
    setSelectedId(sheet.id)
    setCreating(false)
    onToast('Content plan berhasil dihubungkan.')
  }

  const updated = (sheet: ContentPlanSheet) => {
    const previous = sheets
    setSheets((current) => current.map((item) => item.id === sheet.id ? sheet : item))
    setSelectedId(sheet.id)
    setEditing(null)
    onToast('Content plan berhasil diperbarui.')
    void load(true).catch(() => setSheets(previous))
  }

  const remove = async () => {
    if (!workspaceId || !deleting) return
    const target = deleting
    const previous = sheets
    const targetIndex = previous.findIndex((item) => item.id === target.id)
    const remaining = previous.filter((item) => item.id !== target.id)
    setDeletingBusy(true)
    setSheets(remaining)
    setSelectedId((current) => current === target.id ? remaining[Math.min(targetIndex, remaining.length - 1)]?.id ?? '' : current)
    try {
      await deleteContentPlanSheet(workspaceId, target.id)
      setDeleting(null)
      onToast('Koneksi content plan berhasil dihapus.')
    } catch (cause) {
      setSheets(previous)
      setSelectedId(target.id)
      onToast(cause instanceof Error ? cause.message : 'Content plan tidak dapat dihapus.')
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <section className="content-plan-page">
      <div className="page-title-row content-plan-title-row">
        <div>
          <p className="eyebrow"><FileSpreadsheet size={14} /> Content workspace</p>
          <h1>Content Plan &amp; Spreadsheets Hub</h1>
          <p>Kelola jadwal tayang konten, pengisian copywriting, dan editorial plan Google Sheets langsung dari workspace.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setCreating(true)} disabled={!workspaceId}><Plus size={17} /> Hubungkan Sheet Baru</button>
      </div>

      <section className="content-plan-picker card" aria-labelledby="content-plan-picker-title">
        <div className="content-plan-picker-head">
          <div><p className="eyebrow">Spreadsheet aktif</p><h2 id="content-plan-picker-title">Pilih Content Plan Klien / Brand</h2></div>
          <label className="content-plan-search"><Search size={16} /><span className="sr-only">Cari content plan</span><input value={search} placeholder="Cari klien, judul spreadsheet, atau platform…" onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Hapus pencarian" title="Hapus pencarian" onClick={() => setSearch('')}><X size={15} /></button>}</label>
        </div>
        {loading ? (
          <div className="content-plan-chip-skeleton" aria-label="Memuat content plan">{[1, 2, 3, 4].map((item) => <span key={item} />)}</div>
        ) : error ? (
          <div className="content-plan-inline-state error" role="alert"><AlertTriangle size={18} /><div><strong>Data belum dapat dimuat</strong><p>{error}</p></div><button type="button" className="soft-button" onClick={() => void load()}><RefreshCw size={15} /> Coba lagi</button></div>
        ) : filtered.length ? (
          <div className="content-plan-chips" role="tablist" aria-label="Daftar content plan">
            {filtered.map((sheet) => <button key={sheet.id} type="button" role="tab" aria-selected={sheet.id === selectedId} className={sheet.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(sheet.id)}><SheetLogo sheet={sheet} size="sm" /><span><strong>{sheet.clientName}</strong><small>{sheet.title}</small></span><em>{sheet.platform}</em></button>)}
          </div>
        ) : (
          <div className="content-plan-empty compact"><FileSpreadsheet size={25} /><strong>{sheets.length ? 'Content plan tidak ditemukan' : 'Belum ada Google Sheet terhubung'}</strong><p>{sheets.length ? 'Coba kata kunci lain atau hapus pencarian.' : 'Hubungkan content plan pertama agar tim dapat membukanya dari workspace.'}</p>{!sheets.length && <button type="button" className="soft-button" onClick={() => setCreating(true)}><Plus size={15} /> Hubungkan Sheet</button>}</div>
        )}
      </section>

      {selected ? (
        <section className="content-plan-sheet-panel card">
          <header className="content-plan-sheet-head">
            <div className="content-plan-sheet-identity"><SheetLogo sheet={selected} size="lg" /><div><div><span className="content-plan-client-badge">{selected.clientName}</span><span className="content-plan-platform-badge">{selected.platform}</span></div><h2>{selected.title}</h2></div></div>
            <div className="content-plan-toolbar">
              <ZoomControls zoom={zoom} onChange={setZoom} />
              <label className="content-plan-height-select"><span>Tinggi</span><select aria-label="Tinggi viewport spreadsheet" value={viewportHeight} onChange={(event) => setViewportHeight(Number(event.target.value) as typeof viewportHeight)}>{viewportOptions.map((height) => <option key={height} value={height}>{height}px</option>)}</select></label>
              <button type="button" className="soft-button" onClick={() => void copyLink()} aria-label="Salin link Google Sheets" title="Salin link Google Sheets">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Tersalin' : 'Copy Link'}</button>
              <button type="button" className="soft-button" onClick={() => openExternal()} aria-label="Buka di Google Sheets" title="Buka di Google Sheets"><ExternalLink size={15} /> Buka</button>
              <IconButton label="Edit link" onClick={() => setEditing(selected)}><Pencil size={16} /></IconButton>
              <IconButton label="Hapus link" className="content-plan-danger-icon" onClick={() => setDeleting(selected)}><Trash2 size={16} /></IconButton>
              <button type="button" className="primary-button content-plan-focus-button" onClick={() => setFocusMode(true)}><Maximize2 size={16} /> Focus Mode</button>
            </div>
          </header>
          <div className="content-plan-access-note"><Clipboard size={15} /><span>Pastikan file memiliki akses <strong>“Anyone with the link can view/edit”</strong> agar seluruh anggota workspace dapat membukanya.</span></div>
          <SpreadsheetViewer sheet={selected} zoom={zoom} height={viewportHeight} onOpenExternal={() => openExternal(selected)} />
        </section>
      ) : !loading && !error ? (
        <div className="content-plan-empty"><ImageIcon size={34} /><strong>Pilih atau hubungkan content plan</strong><p>Spreadsheet yang dipilih akan tampil dan dapat dikelola dari area ini.</p></div>
      ) : null}

      {creating && workspaceId && <ContentPlanDialog title="Hubungkan Sheet Baru" eyebrow="Content Plan Hub" onClose={() => setCreating(false)}><SheetForm workspaceId={workspaceId} clients={clients} submitLabel="Hubungkan Sheet" onCancel={() => setCreating(false)} onSaved={created} onToast={onToast} /></ContentPlanDialog>}
      {editing && workspaceId && <ContentPlanDialog title="Edit Koneksi Sheet" eyebrow="Content Plan Hub" onClose={() => setEditing(null)}><SheetForm workspaceId={workspaceId} clients={clients} initial={editing} submitLabel="Simpan Perubahan" onCancel={() => setEditing(null)} onSaved={updated} onToast={onToast} /></ContentPlanDialog>}
      {deleting && <ContentPlanDialog title="Hapus Koneksi Sheet?" eyebrow="Konfirmasi" compact onClose={() => { if (!deletingBusy) setDeleting(null) }}><div className="content-plan-delete"><span><Trash2 size={21} /></span><p>Link <strong>{deleting.title}</strong> milik <strong>{deleting.clientName}</strong> akan hilang untuk seluruh anggota workspace.</p><small>File Google Sheets asli tidak akan dihapus.</small><footer><button type="button" className="secondary-button" disabled={deletingBusy} onClick={() => setDeleting(null)}>Batal</button><button type="button" className="danger-button" disabled={deletingBusy} onClick={() => void remove()}>{deletingBusy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Hapus Link</button></footer></div></ContentPlanDialog>}

      {focusMode && selected && createPortal(
        <section ref={focusPanelRef} className="content-plan-focus" role="dialog" aria-modal="true" aria-label={`Focus Mode ${selected.title}`}>
          <header><div className="content-plan-focus-identity"><BrandMark /><SheetLogo sheet={selected} size="sm" /><span><strong>{selected.clientName}</strong><small>{selected.title}</small></span></div><div className="content-plan-focus-actions"><ZoomControls zoom={zoom} onChange={setZoom} /><button type="button" className="soft-button" onClick={() => openExternal(selected)}><ExternalLink size={15} /> Google Sheets</button><button type="button" className="primary-button" onClick={() => setFocusMode(false)}><X size={16} /> Keluar Focus Mode</button></div></header>
          <SpreadsheetViewer sheet={selected} zoom={zoom} height={900} focus onOpenExternal={() => openExternal(selected)} />
        </section>,
        document.querySelector('.nayagement-root') ?? document.body,
      )}
    </section>
  )
}
