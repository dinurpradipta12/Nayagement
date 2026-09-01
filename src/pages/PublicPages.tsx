import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, LockKeyhole, Mail, MessageCircle, RefreshCw, Send, Sparkles } from 'lucide-react'
import { createDemoOrderForm } from '../data/orderFormTemplate'
import type { InvoiceEditorDraft, Project, TimelineItem } from '../types'
import { daysUntil } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'
import { sanitizeUserMessage } from '../lib/userMessage'
import { loadPublicConsultationBooking, loadPublicInvoice, loadPublicOrderForm, loadPublicProject, submitPublicConsultationBooking, submitPublicOrder, type PublicConsultationBooking, type PublicOrderForm, type PublicOrderFormField, type PublicProjectLookup, type PublicProjectSnapshot, type PublicProjectTask } from '../services/publicData'
import { InvoiceEditor } from '../components/InvoiceEditor'
import { Logo, ProgressBar, Toast } from '../components/ui'

const publicProjectRefreshMs = 10_000

function formatPublicTaskDue(value: string | null) {
  if (!value) return 'Belum dijadwalkan'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum dijadwalkan'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date)
}

export function PublicProjectPage({
  project: initialProject,
  timeline: initialTimeline,
  tasks: initialTasks = [],
  portalKey,
  lookup,
  onBack,
}: {
  project?: Project
  timeline: TimelineItem[]
  tasks?: PublicProjectTask[]
  portalKey: string
  lookup: PublicProjectLookup
  onBack: () => void
}) {
  const [remote, setRemote] = useState<PublicProjectSnapshot | null>(null)
  const [loading, setLoading] = useState(Boolean(!initialProject && isSupabaseConfigured))
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async (showRefreshing = false) => {
    if (!isSupabaseConfigured) return
    if (showRefreshing) setRefreshing(true)
    try {
      const result = await loadPublicProject(portalKey, lookup)
      setRemote(result)
    } catch {
      if (!initialProject) setRemote(null)
    } finally {
      if (showRefreshing) setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(!initialProject)
    setRemote(null)
    const load = async () => {
      try {
        const result = await loadPublicProject(portalKey, lookup)
        if (active) setRemote(result)
      } catch {
        if (active && !initialProject) setRemote(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    void load()
    const timer = window.setInterval(refreshWhenVisible, publicProjectRefreshMs)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [initialProject, lookup, portalKey])

  const project = remote?.project ?? initialProject
  const timeline = remote?.timeline ?? initialTimeline
  const tasks = remote?.tasks ?? initialTasks
  if (loading) return <main className="public-page public-unavailable"><Logo /><p>Memuat portal proyek…</p></main>
  if (!project) return <PublicProjectUnavailablePage onBack={onBack} />
  const days = daysUntil(project.dueDate)
  const visibleTimeline = timeline.filter((item) => item.visibleToClient)
  const latestUpdate = visibleTimeline[visibleTimeline.length - 1]
  const nextTask = tasks.find((task) => task.status !== 'Completed')
  return (
    <main className="public-page">
      <header className="public-header"><Logo /><div><span className="public-header-note"><LockKeyhole size={14} /> Portal proyek pribadi</span><button className="portal-refresh-button" onClick={() => { void refresh(true) }} disabled={refreshing} title="Muat pembaruan terbaru"><RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /> {refreshing ? 'Memuat' : 'Terbaru'}</button></div></header>
      <section className={'public-hero public-hero-' + project.accent}><div className="public-hero-label"><Sparkles size={15} /> Project update</div><p>{project.type} · {project.code}</p><h1>{project.name}</h1><span className="public-client-name">Untuk {project.client}</span><div className="public-status-row"><span className="public-status">{project.status}</span><span><CalendarDays size={15} /> Estimasi selesai {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(project.dueDate + 'T12:00:00'))}</span></div></section>
      <section className="public-overview-grid"><article className="public-progress-card"><div><p className="eyebrow">Progress proyek</p><h2>Perjalanan sudah <em>{project.progress}%</em></h2></div><ProgressBar value={project.progress} /><p>{project.description}</p></article><article className={'public-deadline-card ' + (days <= 3 ? 'urgent' : '')}><span className="deadline-clock"><Clock3 size={19} /></span><div><p className="eyebrow">Deadline</p><h2>{days < 0 ? 'Terlambat ' + Math.abs(days) + ' hari' : days === 0 ? 'Hari ini' : days + ' hari lagi'}</h2><p>{project.dueDate} · Jadwal terakhir yang disepakati</p></div></article><article className="public-next-card"><span><ChevronRight size={19} /></span><div><p className="eyebrow">Sedang dikerjakan</p><h2>{nextTask?.name ?? 'Menunggu pembaruan'}</h2><p>{nextTask ? nextTask.status + ' · ' + formatPublicTaskDue(nextTask.dueAt) : 'Tim akan membagikan pembaruan berikutnya di portal ini.'}</p></div></article></section>
      <section className="public-content-grid"><article className="public-timeline-card"><div className="public-section-heading"><div><p className="eyebrow">Project timeline</p><h2>Perjalanan proyek</h2></div><span>Pembaruan otomatis aktif</span></div><div className="public-timeline">{visibleTimeline.length ? visibleTimeline.map((item) => <div key={item.id ?? item.title + item.date + item.time} className={'public-timeline-item ' + item.state}><span className="public-timeline-dot" /><span className="public-timeline-date">{item.date}</span><div><strong>{item.title}</strong><p>{item.description}</p>{item.state === 'current' && <em>Sedang berlangsung</em>}</div></div>) : <p className="muted-copy">Belum ada pembaruan yang dibagikan kepada klien.</p>}</div></article><aside className="public-aside"><article className="public-update-card"><p className="eyebrow">Latest update</p><h3>{latestUpdate?.title ?? 'Belum ada update publik'}</h3><p>{latestUpdate?.description ?? 'Tim akan membagikan perkembangan proyek melalui portal ini.'}</p><small>{latestUpdate ? latestUpdate.date + ' · ' + latestUpdate.time : 'Pembaruan akan muncul otomatis'}</small></article><article className="public-tasks-card"><p className="eyebrow">Tugas yang dipantau</p>{tasks.length ? tasks.map((task) => <div key={task.name + task.dueAt}><span className={task.status === 'Completed' ? 'is-complete' : ''}><CheckCircle2 size={15} /></span><div><strong>{task.name}</strong><small>{task.status} · {formatPublicTaskDue(task.dueAt)}</small></div></div>) : <p>Belum ada tugas yang dibagikan.</p>}</article><article className="public-contact-card"><span><MessageCircle size={19} /></span><h3>Butuh bantuan?</h3><p>Untuk pertanyaan tentang proyek ini, silakan hubungi project lead Anda.</p><button><Mail size={15} /> Kirim pesan</button></article></aside></section>
      <footer className="public-footer"><Logo compact /><span>Portal aman Nayagement · Hanya untuk proyek ini</span></footer>
    </main>
  )
}

export function PublicProjectUnavailablePage({ onBack }: { onBack: () => void }) {
  return <main className="public-page public-unavailable"><Logo /><span className="unavailable-icon"><LockKeyhole size={28} /></span><h1>Portal tidak tersedia</h1><p>Tautan ini tidak lengkap, salah, sudah dinonaktifkan, atau tidak lagi berlaku.</p><button className="secondary-button" onClick={onBack}><ArrowLeft size={17} /> Kembali</button></main>
}

export function PublicInvoicePage({ publicCode, autoDownloadPdf = false }: { publicCode: string; autoDownloadPdf?: boolean }) {
  const [invoice, setInvoice] = useState<InvoiceEditorDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setInvoice(null)
    void loadPublicInvoice(publicCode)
      .then((result) => { if (active) setInvoice(result) })
      .catch(() => { if (active) setInvoice(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [publicCode])

  if (loading) return <main className="public-page public-unavailable"><Logo /><p>Memuat invoice…</p></main>
  if (!invoice) return <main className="public-page public-unavailable"><Logo /><span className="unavailable-icon"><LockKeyhole size={28} /></span><h1>Invoice tidak tersedia</h1><p>Tautan invoice salah, sudah dinonaktifkan, atau tidak lagi berlaku.</p></main>

  return <main className="public-invoice-page">
    <header className="public-invoice-header"><Logo /><span><LockKeyhole size={14} /> Invoice publik aman</span></header>
    <InvoiceEditor
      draft={invoice}
      clients={[]}
      projects={[]}
      previewOnly
      autoDownloadPdf={autoDownloadPdf}
      onChange={setInvoice}
      onSave={async () => undefined}
      onToast={setToast}
    />
    {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
  </main>
}

function fallbackPublicOrderForm(): PublicOrderForm {
  const form = createDemoOrderForm()
  return {
    title: form.title,
    description: form.description,
    confirmationMessage: form.confirmationMessage,
    headerImageUrl: form.headerImageUrl,
    fields: form.fields.map(({ key, label, type, options, required }) => ({ key, label, type, options, required })),
  }
}

function fieldPlaceholder(field: PublicOrderFormField) {
  if (field.type === 'email') return 'nama@perusahaan.com'
  if (field.type === 'phone') return '08xx xxxx xxxx'
  if (field.type === 'url') return 'https://'
  if (field.type === 'number') return 'Masukkan angka'
  if (field.type === 'textarea') return 'Tulis detail yang ingin Anda sampaikan…'
  return `Isi ${field.label.toLowerCase()}`
}

export function PublicOrderFormPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false)
  const [data, setData] = useState<Record<string, string>>({})
  const [remoteForm, setRemoteForm] = useState<PublicOrderForm | null>(null)
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('Kami sudah menerima order Anda. Tim kami akan meninjau brief ini dan menghubungi Anda melalui WhatsApp.')

  useEffect(() => {
    setSubmitted(false)
    setData({})
    setSubmitError('')
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void loadPublicOrderForm(token)
      .then((form) => { if (active) setRemoteForm(form) })
      .catch(() => { if (active) setRemoteForm(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const fallbackForm = !isSupabaseConfigured && token === 'demo-order' ? fallbackPublicOrderForm() : null
  const form = remoteForm ?? fallbackForm
  const update = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    const payload = Object.entries(data).reduce<Record<string, string>>((output, [key, value]) => {
      output[key] = value.trim()
      return output
    }, {})
    const missing = form.fields.find((field) => field.required && !payload[field.key])
    if (missing) {
      setSubmitError(`“${missing.label}” wajib diisi.`)
      return
    }
    if (!payload.name || payload.name.length < 2) {
      setSubmitError('Nama lengkap perlu diisi agar order dapat diproses.')
      return
    }
    if (!payload.project_name) payload.project_name = payload.project_type ? `${payload.project_type} request` : `Order dari ${payload.name}`
    if (!payload.project_description) {
      const detailField = form.fields.find((field) => field.type === 'textarea')
      payload.project_description = detailField ? payload[detailField.key] || '' : ''
    }
    try {
      setSubmitting(true)
      setSubmitError('')
      if (!isSupabaseConfigured) {
        setConfirmationMessage(form.confirmationMessage)
        setSubmitted(true)
        return
      }
      const message = await submitPublicOrder(token, payload)
      setConfirmationMessage(message ?? form.confirmationMessage)
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Order tidak dapat dikirim. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="public-page public-unavailable"><Logo /><p>Memuat form…</p></main>
  if (!form || !form.fields.length) return <main className="public-page public-unavailable"><Logo /><span className="unavailable-icon"><LockKeyhole size={28} /></span><h1>Form tidak tersedia</h1><p>Tautan ini mungkin tidak aktif, belum selesai diatur, atau tidak lagi berlaku.</p><button className="secondary-button" onClick={onBack}><ArrowLeft size={17} /> Kembali</button></main>
  if (submitted) return <main className="public-order-page"><header className="public-order-header"><Logo /><button onClick={onBack}>← Kembali</button></header><section className="order-success"><span><CheckCircle2 size={31} /></span><p className="eyebrow">Order terkirim</p><h1>Terima kasih, {data.name || 'teman'}!</h1><p>{confirmationMessage}</p><button className="primary-button" onClick={onBack}>Selesai</button></section></main>

  return (
    <main className="public-order-page">
      <header className="public-order-header"><Logo /></header>
      <section className="order-form-shell">
        <section className={`order-form-banner ${form.headerImageUrl ? 'has-image' : ''}`}>
          {form.headerImageUrl && <img src={form.headerImageUrl} alt="Header form order" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
          <div className="order-form-banner-overlay" />
          <div className="order-form-banner-copy"><p className="eyebrow">Form order</p><h1>{form.title}</h1><p>{form.description || 'Isi detail kebutuhan Anda. Kami akan meninjau order ini dan menghubungi Anda untuk langkah berikutnya.'}</p></div>
        </section>
        <form className="public-order-form" onSubmit={submit}><div className="order-step-head"><span>{form.fields.length} pertanyaan · isi sesuai kebutuhan Anda</span><ProgressBar value={100} compact /></div><h2>Mulai order Anda</h2><p>Informasi yang diisi hanya digunakan untuk menyiapkan penawaran dan komunikasi proyek.</p>{form.fields.map((field) => <label key={field.key}>{field.label}{field.required && <em className="field-required">Wajib</em>}{field.type === 'textarea' ? <textarea value={data[field.key] ?? ''} onChange={(event) => update(field.key, event.target.value)} placeholder={fieldPlaceholder(field)} rows={5} required={field.required} /> : field.type === 'select' ? <select value={data[field.key] ?? ''} onChange={(event) => update(field.key, event.target.value)} required={field.required}><option value="">Pilih jawaban</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input type={field.type === 'phone' ? 'tel' : field.type} value={data[field.key] ?? ''} onChange={(event) => update(field.key, event.target.value)} placeholder={fieldPlaceholder(field)} required={field.required} />}</label>)}<div className="order-review"><FileText size={19} /><div><strong>Order siap dikirim</strong><p>Tim akan menerima seluruh jawaban Anda sebagai order masuk.</p></div></div>{submitError && <p className="form-error">{submitError}</p>}<div className="order-form-actions"><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Mengirim…' : 'Kirim order'} <ArrowRight size={17} /></button></div></form>
      </section>
      <footer className="public-order-footer">Butuh bantuan? hello@nayagement.studio</footer>
    </main>
  )
}

function consultationFallback(): PublicConsultationBooking {
  const today = new Date()
  today.setHours(10, 0, 0, 0)
  const slots = [1, 2, 3].flatMap((offset) => [0, 1, 2].map((hour) => {
    const startsAt = new Date(today)
    startsAt.setDate(today.getDate() + offset)
    startsAt.setHours(10 + hour * 2)
    return { id: `demo-${offset}-${hour}`, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 60 * 60_000).toISOString() }
  }))
  return { title: 'Booking konsultasi', subtitle: 'Pilih jadwal yang nyaman, lalu ceritakan hal yang ingin Anda konsultasikan.', durationMinutes: 60, timezone: 'Asia/Makassar', instructions: 'Harap hadir 10 menit sebelum jadwal. Jadwal dapat diubah satu kali setelah konfirmasi.', whatsappNumber: '', slots }
}

const consultationDateFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const consultationTimeFormatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
const consultationMonthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const consultationWeekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function consultationDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function consultationMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export function PublicConsultationBookingPage() {
  const [remote, setRemote] = useState<PublicConsultationBooking | null>(null)
  const [fallbackBooking] = useState(consultationFallback)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [selectedDateKey, setSelectedDateKey] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => consultationMonthStart(new Date()))
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', topic: '', details: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    let active = true
    void loadPublicConsultationBooking().then((data) => { if (active) setRemote(data) }).catch(() => { if (active) setRemote(null) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const booking = remote ?? (!isSupabaseConfigured ? fallbackBooking : null)
  const slotsByDate = (booking?.slots ?? []).reduce<Record<string, PublicConsultationBooking['slots']>>((groups, slot) => {
    const key = consultationDateKey(slot.startsAt)
    groups[key] = [...(groups[key] ?? []), slot]
    return groups
  }, {})
  const availableDateKeys = Object.keys(slotsByDate).sort()
  const bookingSignature = (booking?.slots ?? []).map((slot) => `${slot.id}:${slot.startsAt}`).join('|')
  const activeDateKey = selectedDateKey && slotsByDate[selectedDateKey] ? selectedDateKey : availableDateKeys[0] ?? ''
  const selectedDateSlots = (slotsByDate[activeDateKey] ?? []).sort((left, right) => +new Date(left.startsAt) - +new Date(right.startsAt))
  const selectedSlot = selectedDateSlots.find((slot) => slot.id === selectedSlotId)
  const lastAvailableDate = availableDateKeys.length ? new Date(availableDateKeys[availableDateKeys.length - 1] + 'T12:00:00') : null
  const todayMonth = consultationMonthStart(new Date())
  const calendarMonthEnd = lastAvailableDate ? consultationMonthStart(lastAvailableDate) : todayMonth
  const firstDayOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7
  const calendarDayCount = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
  const trailingDays = (7 - ((firstDayOffset + calendarDayCount) % 7)) % 7
  const calendarCells = [...Array(firstDayOffset).fill(null), ...Array.from({ length: calendarDayCount }, (_, index) => index + 1), ...Array(trailingDays).fill(null)]

  useEffect(() => {
    if (!availableDateKeys.length) return
    const firstAvailable = new Date(availableDateKeys[0] + 'T12:00:00')
    setCalendarMonth(consultationMonthStart(firstAvailable))
    setSelectedDateKey(availableDateKeys[0])
    setSelectedSlotId('')
  }, [bookingSignature])

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedSlot) { setError('Pilih salah satu jam konsultasi yang tersedia.'); return }
    if (form.name.trim().length < 2 || !form.whatsapp.trim() || !form.topic.trim()) { setError('Nama, WhatsApp, dan topik konsultasi wajib diisi.'); return }
    try {
      setSubmitting(true); setError('')
      if (isSupabaseConfigured) await submitPublicConsultationBooking({ slotId: selectedSlot.id, ...form })
      setSubmitted(true)
    } catch (submitError) { setError(submitError instanceof Error ? sanitizeUserMessage(submitError.message) : 'Booking tidak dapat dikirim. Silakan coba lagi.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <main className="public-page public-unavailable"><Logo /><p>Memuat jadwal konsultasi…</p></main>
  if (!booking) return <main className="public-page public-unavailable"><Logo /><span className="unavailable-icon"><LockKeyhole size={28} /></span><h1>Booking belum tersedia</h1><p>Jadwal konsultasi belum dibuka atau tautan ini sedang tidak aktif.</p></main>
  const followUpLink = booking.whatsappNumber ? `https://wa.me/${booking.whatsappNumber}?text=${encodeURIComponent(`Halo, saya ${form.name}. Saya baru mengirim booking konsultasi dan ingin melakukan follow up.`)}` : ''
  if (submitted) return <main className="public-booking-page"><header className="public-booking-header"><Logo /></header><section className="booking-success"><span><CheckCircle2 size={34} /></span><p className="eyebrow">Reservasi terkirim</p><h1>Sampai jumpa, {form.name}!</h1><p>Booking Anda untuk {selectedSlot && consultationDateFormatter.format(new Date(selectedSlot.startsAt))} pukul {selectedSlot && consultationTimeFormatter.format(new Date(selectedSlot.startsAt))} sudah kami terima. Kami akan menghubungi Anda melalui WhatsApp untuk konfirmasi.</p>{followUpLink && <a className="booking-followup-button" href={followUpLink} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Follow up via WhatsApp</a>}</section></main>

  return <main className="public-booking-page"><header className="public-booking-header"><Logo /><span><CalendarCheck2 size={15} /> Booking konsultasi</span></header><section className="public-booking-shell"><form className="public-booking-form" onSubmit={submit}><p className="eyebrow">Konsultasi personal</p><h1>{booking.title}</h1><p>{booking.subtitle}</p><div className="public-booking-fields"><label>Nama lengkap <em>*</em><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nama lengkap" /></label><label>Email aktif<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="nama@email.com" /></label><label>Nomor WhatsApp <em>*</em><input type="tel" value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} placeholder="08xx xxxx xxxx" /></label><label>Topik konsultasi <em>*</em><input value={form.topic} onChange={(event) => update('topic', event.target.value)} placeholder="Contoh: Strategi social media" /></label><label>Hal yang ingin dibahas<textarea value={form.details} onChange={(event) => update('details', event.target.value)} placeholder="Ceritakan singkat konteks, tujuan, atau pertanyaan Anda…" rows={5} /></label></div><div className="booking-selection-summary"><span><CalendarDays size={17} /></span><div><strong>{selectedSlot ? consultationDateFormatter.format(new Date(selectedSlot.startsAt)) : activeDateKey ? consultationDateFormatter.format(new Date(activeDateKey + 'T12:00:00')) : 'Pilih tanggal dan jam'}</strong><small>{selectedSlot ? `${consultationTimeFormatter.format(new Date(selectedSlot.startsAt))} · ${booking.timezone}` : activeDateKey ? 'Pilih salah satu jam yang tersedia.' : 'Pilih tanggal yang menyala pada kalender.'}</small></div></div>{error && <p className="form-error">{error}</p>}<button className="primary-button booking-submit" disabled={submitting}>{submitting ? 'Mengirim reservasi…' : 'Kirim reservasi'} <ArrowRight size={17} /></button><aside className="booking-instructions"><strong>Catatan & ketentuan</strong><p>{booking.instructions}</p></aside></form><section className="public-booking-schedule"><div className="booking-schedule-heading"><div><p className="eyebrow">Pilih jadwal</p><h2>Tanggal & jam konsultasi</h2></div><span><Clock3 size={15} /> {booking.durationMinutes} menit</span></div>{booking.slots.length ? <><section className="booking-calendar" aria-label="Kalender ketersediaan konsultasi"><div className="booking-calendar-toolbar"><button type="button" className="booking-calendar-nav" aria-label="Bulan sebelumnya" disabled={calendarMonth <= todayMonth} onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><strong>{consultationMonthFormatter.format(calendarMonth)}</strong><button type="button" className="booking-calendar-nav" aria-label="Bulan berikutnya" disabled={calendarMonth >= calendarMonthEnd} onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div><div className="booking-calendar-weekdays">{consultationWeekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="booking-calendar-grid">{calendarCells.map((day, index) => { if (!day) return <span key={`empty-${index}`} aria-hidden="true" />; const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day); const key = consultationDateKey(date); const available = Boolean(slotsByDate[key]?.length); return <button key={key} type="button" disabled={!available} aria-pressed={activeDateKey === key} className={`${available ? 'available' : ''} ${activeDateKey === key ? 'selected' : ''}`} onClick={() => { setSelectedDateKey(key); setSelectedSlotId(''); setError('') }}><span>{day}</span></button> })}</div><p className="booking-calendar-help">Tanggal berwarna biru memiliki jadwal tersedia.</p></section><section className="booking-time-picker"><div><p className="eyebrow">Pilih jam</p><h3>{activeDateKey ? consultationDateFormatter.format(new Date(activeDateKey + 'T12:00:00')) : 'Pilih tanggal terlebih dahulu'}</h3></div>{selectedDateSlots.length ? <div className="booking-time-grid">{selectedDateSlots.map((slot) => <button key={slot.id} type="button" className={selectedSlotId === slot.id ? 'active' : ''} onClick={() => { setSelectedSlotId(slot.id); setError('') }}><strong>{consultationTimeFormatter.format(new Date(slot.startsAt))}</strong><small>Tersedia</small></button>)}</div> : <p className="booking-time-empty">Pilih tanggal yang tersedia untuk melihat jam konsultasi.</p>}</section></> : <div className="public-booking-empty"><CalendarDays size={22} /><strong>Belum ada jadwal tersedia</strong><p>Silakan cek kembali di waktu lain.</p></div>}</section></section></main>
}
