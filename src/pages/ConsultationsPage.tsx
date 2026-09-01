import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, CalendarDays, Check, ChevronRight, Clock3, Copy, ExternalLink, LoaderCircle, Plus, Save, Settings2, Trash2, UserRound, X } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import type { ConsultationBooking, ConsultationBookingStatus, ConsultationSettings, ConsultationSlot, ConsultationWeeklyAvailability } from '../types'
import { deleteWorkspaceConsultationBooking, loadWorkspaceConsultationData, saveWorkspaceConsultationAvailability, saveWorkspaceConsultationSettings, updateWorkspaceConsultationBookingStatus } from '../services/workspaceData'

const dateFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
const weekdays = [{ weekday: 1, label: 'Senin' }, { weekday: 2, label: 'Selasa' }, { weekday: 3, label: 'Rabu' }, { weekday: 4, label: 'Kamis' }, { weekday: 5, label: 'Jumat' }, { weekday: 6, label: 'Sabtu' }, { weekday: 7, label: 'Minggu' }]

const fallbackSettings = (workspaceId: string): ConsultationSettings => ({ workspaceId, title: 'Booking konsultasi', subtitle: 'Pilih jadwal yang nyaman dan ceritakan hal yang ingin Anda konsultasikan.', durationMinutes: 60, timezone: 'Asia/Makassar', instructions: 'Harap hadir 10 menit sebelum jadwal. Jadwal dapat diubah satu kali setelah konfirmasi.', whatsappNumber: '', isPublic: true })
const blankAvailability = (workspaceId: string): ConsultationWeeklyAvailability[] => weekdays.map(({ weekday }) => ({ workspaceId, weekday, isEnabled: false, times: [] }))
const bookingStatus = (status: ConsultationBookingStatus) => ({ New: 'Baru', Confirmed: 'Dikonfirmasi', Completed: 'Selesai', Cancelled: 'Dibatalkan' }[status])

export function ConsultationsPage({ workspaceId, onToast, onBookingsChange }: { workspaceId: string | null; onToast: (message: string) => void; onBookingsChange?: (bookings: ConsultationBooking[]) => void }) {
  const [settings, setSettings] = useState(() => fallbackSettings(workspaceId ?? 'local'))
  const [slots, setSlots] = useState<ConsultationSlot[]>([])
  const [availability, setAvailability] = useState(() => blankAvailability(workspaceId ?? 'local'))
  const [timeDrafts, setTimeDrafts] = useState<Record<number, string>>({})
  const [bookings, setBookings] = useState<ConsultationBooking[]>([])
  const [loading, setLoading] = useState(Boolean(workspaceId && isSupabaseConfigured))
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'schedule' | 'inbox'>('schedule')
  const [selectedBooking, setSelectedBooking] = useState<ConsultationBooking | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingBooking, setDeletingBooking] = useState(false)
  const publicUrl = `${window.location.origin}${window.location.pathname}#/booking`
  const upcomingSlots = useMemo(() => slots.filter((slot) => new Date(slot.endsAt).getTime() > Date.now()).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)), [slots])
  const newBookings = bookings.filter((booking) => booking.status === 'New').length

  const reload = async () => {
    if (!workspaceId || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const data = await loadWorkspaceConsultationData(workspaceId)
      setSettings(data.settings); setSlots(data.slots); setBookings(data.bookings)
      setAvailability(data.availability.length ? data.availability : blankAvailability(workspaceId))
    } catch { onToast('Fitur booking belum disiapkan di database. Jalankan SQL pembaruan jadwal mingguan terlebih dahulu.') } finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [workspaceId])
  useEffect(() => { onBookingsChange?.(bookings) }, [bookings, onBookingsChange])

  useEffect(() => {
    if (!selectedBooking) return
    setDeleteConfirmOpen(false)
    document.body.classList.add('task-detail-open')
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedBooking(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.classList.remove('task-detail-open'); document.removeEventListener('keydown', closeOnEscape) }
  }, [selectedBooking])

  const saveSettings = async () => {
    if (!workspaceId || !isSupabaseConfigured) { onToast('Pengaturan konsultasi tersimpan di preview lokal.'); return }
    try { setSaving(true); await saveWorkspaceConsultationSettings(workspaceId, settings); onToast('Pengaturan booking konsultasi disimpan.') }
    catch { onToast('Pengaturan belum dapat disimpan. Pastikan SQL booking konsultasi sudah dijalankan.') } finally { setSaving(false) }
  }

  const saveAvailability = async () => {
    if (!availability.some((day) => day.isEnabled && day.times.length)) { onToast('Aktifkan setidaknya satu hari dan tambahkan jam ketersediaan.'); return }
    if (!workspaceId || !isSupabaseConfigured) { onToast('Jadwal mingguan tersimpan di preview lokal.'); return }
    try {
      setSaving(true)
      await saveWorkspaceConsultationSettings(workspaceId, settings)
      await saveWorkspaceConsultationAvailability(workspaceId, availability)
      await reload()
      onToast('Jadwal mingguan disimpan. Slot booking berikutnya sudah diperbarui.')
    } catch { onToast('Jadwal belum dapat disimpan. Pastikan SQL jadwal mingguan sudah dijalankan.') } finally { setSaving(false) }
  }

  const updateDay = (weekday: number, changes: Partial<ConsultationWeeklyAvailability>) => setAvailability((current) => current.map((item) => item.weekday === weekday ? { ...item, ...changes } : item))
  const addTime = (weekday: number) => {
    const time = timeDrafts[weekday] || '09:00'
    setAvailability((current) => current.map((item) => item.weekday === weekday ? { ...item, isEnabled: true, times: [...new Set([...item.times, time])].sort() } : item))
    setTimeDrafts((current) => ({ ...current, [weekday]: '' }))
  }
  const removeTime = (weekday: number, time: string) => setAvailability((current) => current.map((item) => item.weekday === weekday ? { ...item, times: item.times.filter((itemTime) => itemTime !== time) } : item))
  const updateBooking = async (booking: ConsultationBooking, status: ConsultationBookingStatus) => {
    if (!workspaceId || !isSupabaseConfigured) { setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status } : item)); return }
    try { await updateWorkspaceConsultationBookingStatus(workspaceId, booking.id, status); setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status } : item)); setSelectedBooking((current) => current?.id === booking.id ? { ...current, status } : current); onToast('Status booking diperbarui.') } catch { onToast('Status booking tidak dapat diubah.') }
  }
  const removeBooking = async (booking: ConsultationBooking) => {
    if (!workspaceId || !isSupabaseConfigured) { setBookings((current) => current.filter((item) => item.id !== booking.id)); setSelectedBooking(null); setDeleteConfirmOpen(false); return }
    try {
      setDeletingBooking(true)
      await deleteWorkspaceConsultationBooking(workspaceId, booking.id)
      setBookings((current) => current.filter((item) => item.id !== booking.id))
      setSelectedBooking(null)
      setDeleteConfirmOpen(false)
      onToast('Booking konsultasi dihapus permanen.')
    } catch { onToast('Booking tidak dapat dihapus. Jalankan SQL perbaikan penghapusan konsultasi.') }
    finally { setDeletingBooking(false) }
  }
  const copyLink = async () => { try { await navigator.clipboard.writeText(publicUrl); onToast('Tautan booking disalin.') } catch { onToast('Salin tautan: ' + publicUrl) } }

  return <div className="module-page consultations-page">
    <section className="page-title-row"><div><p className="eyebrow">Consultation desk</p><h1>Booking konsultasi</h1><p>Atur hari dan jam ketersediaan, bagikan satu tautan publik, lalu tindak lanjuti setiap reservasi.</p></div><div className="consultation-header-actions"><button className="secondary-button" onClick={copyLink}><Copy size={16} /> Salin link</button><a className="primary-button" href="#/booking" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Lihat halaman booking</a></div></section>
    <section className="consultation-metrics"><article><span><CalendarCheck2 size={19} /></span><div><small>Slot tersedia</small><strong>{upcomingSlots.length}</strong><p>Untuk 90 hari berikutnya</p></div></article><article><span><UserRound size={19} /></span><div><small>Booking baru</small><strong>{newBookings}</strong><p>Perlu ditinjau dan dikonfirmasi</p></div></article><article><span><Clock3 size={19} /></span><div><small>Durasi sesi</small><strong>{settings.durationMinutes} menit</strong><p>{settings.timezone.replace('_', '/')}</p></div></article></section>
    <div className="consultation-tabs" role="tablist" aria-label="Bagian booking konsultasi"><button type="button" role="tab" aria-selected={activeTab === 'schedule'} className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}><CalendarDays size={16} /> Pengaturan & jadwal</button><button type="button" role="tab" aria-selected={activeTab === 'inbox'} className={activeTab === 'inbox' ? 'active' : ''} onClick={() => setActiveTab('inbox')}><UserRound size={16} /> Booking masuk{newBookings > 0 && <b>{newBookings}</b>}</button></div>
    {activeTab === 'schedule' && <section className="consultation-grid">
      <article className="card consultation-settings-card"><div className="card-heading"><div><p className="eyebrow">Pengaturan publik</p><h2>Halaman booking</h2></div><Settings2 size={19} /></div><div className="consultation-link"><span>Link publik</span><strong>{publicUrl.replace(/^https?:\/\//, '')}</strong><button type="button" onClick={copyLink} aria-label="Salin tautan booking"><Copy size={15} /></button></div><div className="settings-field-grid consultation-settings-fields"><label>Judul konsultasi<input value={settings.title} onChange={(event) => setSettings((current) => ({ ...current, title: event.target.value }))} /></label><label>Durasi per sesi<select value={settings.durationMinutes} onChange={(event) => setSettings((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}>{[30, 45, 60, 90, 120].map((minute) => <option key={minute} value={minute}>{minute} menit</option>)}</select></label><label className="full-width">Deskripsi untuk pengunjung<textarea value={settings.subtitle} onChange={(event) => setSettings((current) => ({ ...current, subtitle: event.target.value }))} /></label><label>Zona waktu<input value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} /></label><label>Nomor WhatsApp follow-up<input type="tel" value={settings.whatsappNumber} onChange={(event) => setSettings((current) => ({ ...current, whatsappNumber: event.target.value }))} placeholder="Contoh: 628123456789" /></label><label className="consultation-public-toggle"><span><strong>Terima booking baru</strong><small>Halaman publik dapat diakses</small></span><input type="checkbox" checked={settings.isPublic} onChange={(event) => setSettings((current) => ({ ...current, isPublic: event.target.checked }))} /></label><label className="full-width">Catatan & ketentuan<textarea value={settings.instructions} onChange={(event) => setSettings((current) => ({ ...current, instructions: event.target.value }))} /></label></div><button className="primary-button consultation-save" onClick={() => { void saveSettings() }} disabled={saving}><Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button></article>
      <article className="card consultation-slots-card"><div className="card-heading"><div><p className="eyebrow">Ketersediaan mingguan</p><h2>Hari & jam konsultasi</h2></div><CalendarDays size={19} /></div><p className="muted-copy consultation-weekly-copy">Aktifkan hari yang tersedia, lalu tambahkan jam spesifik untuk setiap hari.</p><div className="consultation-weekly-list">{weekdays.map(({ weekday, label }) => { const day = availability.find((item) => item.weekday === weekday) ?? { workspaceId: workspaceId ?? 'local', weekday, isEnabled: false, times: [] }; return <article key={weekday} className={day.isEnabled ? 'enabled' : ''}><div className="consultation-weekday-head"><label><input type="checkbox" checked={day.isEnabled} onChange={(event) => updateDay(weekday, { isEnabled: event.target.checked })} /><span>{label}</span></label><small>{day.times.length ? `${day.times.length} jam tersedia` : 'Tidak tersedia'}</small></div>{day.isEnabled && <div className="consultation-time-editor"><div className="consultation-time-chips">{day.times.map((time) => <span key={time}>{time}<button type="button" onClick={() => removeTime(weekday, time)} aria-label={`Hapus jam ${time}`}><Trash2 size={12} /></button></span>)}{!day.times.length && <em>Tambahkan jam pertama</em>}</div><div><input type="time" value={timeDrafts[weekday] ?? ''} onChange={(event) => setTimeDrafts((current) => ({ ...current, [weekday]: event.target.value }))} /><button type="button" onClick={() => addTime(weekday)}><Plus size={15} /> Tambah jam</button></div></div>}</article>})}</div><button className="primary-button consultation-save" onClick={() => { void saveAvailability() }} disabled={saving}>{saving ? <LoaderCircle className="is-spinning" size={16} /> : <Save size={16} />} {saving ? 'Menyimpan…' : 'Simpan jadwal mingguan'}</button></article>
    </section>}
    {activeTab === 'inbox' && <section className="card consultation-bookings-card"><div className="consultation-bookings-head"><div><p className="eyebrow">Daftar konsultasi</p><h2>Booking masuk</h2><p>Setiap reservasi dari halaman publik tercatat di sini.</p></div><button className="secondary-button" onClick={() => { void reload() }}><Clock3 size={16} /> Muat ulang</button></div><div className="consultation-booking-list">{bookings.map((booking) => <button className="consultation-booking-row" key={booking.id} onClick={() => setSelectedBooking(booking)}><span className="booking-avatar">{booking.name.split(/\s+/).map((name) => name[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{booking.name}</strong><small>{booking.topic || 'Konsultasi umum'} · {dateFormatter.format(new Date(booking.startsAt))}</small></span><span className="booking-time">{timeFormatter.format(new Date(booking.startsAt))}</span><em className={'consultation-status ' + booking.status.toLowerCase()}>{bookingStatus(booking.status)}</em><ChevronRight size={17} /></button>)}{!loading && !bookings.length && <div className="consultation-empty"><UserRound size={21} /><div><strong>Belum ada booking masuk</strong><p>Bagikan link publik untuk mulai menerima reservasi.</p></div></div>}</div></section>}
    {selectedBooking && <aside className="consultation-detail-drawer" role="dialog" aria-modal="true" aria-label="Detail booking konsultasi"><header className="consultation-drawer-head"><div><p className="eyebrow">Detail booking</p><span><CalendarCheck2 size={14} /> Booking konsultasi</span></div><button className="icon-button" onClick={() => setSelectedBooking(null)} aria-label="Tutup detail booking"><X size={18} /></button></header><div className="consultation-drawer-scroll"><section className="consultation-drawer-intro"><span>{selectedBooking.name.split(/\s+/).map((name) => name[0]).slice(0, 2).join('').toUpperCase()}</span><div><h2>{selectedBooking.name}</h2><p>{selectedBooking.topic || 'Konsultasi umum'}</p></div></section><section className="consultation-detail-section"><div className="consultation-detail-time"><CalendarDays size={18} /><span><strong>{dateFormatter.format(new Date(selectedBooking.startsAt))}</strong><small>{timeFormatter.format(new Date(selectedBooking.startsAt))} – {timeFormatter.format(new Date(selectedBooking.endsAt))} · {settings.timezone}</small></span></div><div className="consultation-info-group"><p className="eyebrow">Kontak klien</p><dl className="consultation-detail-list consultation-contact-list"><div><dt>Email</dt><dd>{selectedBooking.email || 'Tidak diisi'}</dd></div><div><dt>WhatsApp</dt><dd>{selectedBooking.whatsapp || 'Tidak diisi'}</dd></div></dl></div></section><section className="consultation-detail-section"><p className="eyebrow">Kebutuhan konsultasi</p><dl className="consultation-detail-list"><div><dt>Topik konsultasi</dt><dd>{selectedBooking.topic || 'Konsultasi umum'}</dd></div><div><dt>Detail kebutuhan</dt><dd>{selectedBooking.details || 'Tidak ada keterangan tambahan.'}</dd></div></dl></section><section className="consultation-detail-section"><p className="eyebrow">Status booking</p><label>Status saat ini<select value={selectedBooking.status} onChange={(event) => { void updateBooking(selectedBooking, event.target.value as ConsultationBookingStatus) }}>{(['New','Confirmed','Completed','Cancelled'] as ConsultationBookingStatus[]).map((status) => <option key={status} value={status}>{bookingStatus(status)}</option>)}</select></label></section></div><footer className={`consultation-drawer-footer ${deleteConfirmOpen ? 'confirming-delete' : ''}`}>{deleteConfirmOpen ? <div className="consultation-delete-confirm"><span><strong>Hapus booking ini?</strong><small>Data akan dihapus permanen dari database.</small></span><button type="button" className="quiet-button" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingBooking}>Batal</button><button type="button" className="danger-button" onClick={() => { void removeBooking(selectedBooking) }} disabled={deletingBooking}>{deletingBooking ? <LoaderCircle className="is-spinning" size={15} /> : <Trash2 size={15} />} {deletingBooking ? 'Menghapus…' : 'Hapus permanen'}</button></div> : <><button className="order-detail-delete" onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={16} /> Hapus</button><button className="primary-button" onClick={() => { void updateBooking(selectedBooking, 'Confirmed') }}><Check size={16} /> Konfirmasi</button></>}</footer></aside>}
  </div>
}
