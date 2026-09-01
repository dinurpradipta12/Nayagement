import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Accessibility, AlertTriangle, Bell, BellRing, Bot, Building2, CalendarClock, Check, ChevronRight, CircleDollarSign, Clock3, Copy, Eye, ImagePlus, KeyRound, Laptop, LayoutPanelLeft, LockKeyhole, MailCheck, MonitorCog, Palette, RefreshCw, Send, Settings2, ShieldCheck, Trash2, UserRound, Volume2 } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { changeWorkspacePassword, defaultWorkspaceTelegramSettings, loadWorkspaceSettings, loadWorkspaceTelegramSettings, queueWorkspaceTelegramTest, regenerateWorkspaceTelegramPairingCode, saveWorkspaceSettings, saveWorkspaceTelegramSettings, signOutOtherWorkspaceSessions, uploadWorkspaceSettingsAvatar, uploadWorkspaceSettingsLogo } from '../services/workspaceData'
import type { SettingsPreferences, SettingsProfile, SettingsSnapshot, SettingsWorkspace, TelegramSettings } from '../types'
import { initials } from '../lib/format'
import { BrandMark, Modal } from '../components/ui'

type SettingsTab = 'profile' | 'workspace' | 'appearance' | 'notifications' | 'security'

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'workspace', label: 'Workspace', icon: Settings2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
]

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const reminderChoices = ['5 minutes', '15 minutes', '30 minutes', '1 hour', '1 day', '3 days', '7 days']

function fallbackSettings(dark: boolean): SettingsSnapshot {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar'
  return {
    profile: { id: 'demo-user', fullName: 'Arunika', displayName: 'Arunika', username: 'arunika', email: '', phone: '', bio: '', roleTitle: 'Developer · Owner', accountType: 'Owner' },
    workspace: { name: 'Workspace Anda', description: 'Personal productivity workspace', ownerName: 'Arunika', defaultPriority: 'Medium', defaultStatus: 'Todo', defaultTaskView: 'List', defaultReminder: '1 day', timezone, dateFormat: 'DD/MM/YYYY', timeFormat: '24 hour', firstDayOfWeek: 'Monday', autoMarkOverdue: true, showCompletedTasks: true, autoArchiveCompleted: false, confirmBeforeDelete: true, workDayStart: '09:00', workDayEnd: '17:00', workingDays: weekdays.slice(0, 5) },
    preferences: { theme: dark ? 'dark' : 'light', accentColor: 'blue', sidebarMode: 'Expanded', density: 'Comfortable', showBreadcrumbs: true, showPageDescriptions: true, defaultLandingPage: 'Dashboard', dashboardTaskView: 'List', showOverdueTasks: true, showCompletedTasks: true, largerText: false, reduceAnimations: false, highContrast: false, inAppNotifications: true, browserNotifications: false, emailNotifications: false, taskReminder: true, taskCompleted: false, taskOverdue: true, deadlineReminder: true, reminderIntervals: ['1 day', '3 days', '7 days'], dailySummary: false, dailySummaryTime: '08:30', weeklySummary: false, weeklySummaryDay: 'Monday', weeklySummaryTime: '09:00', loginNotification: true, newDeviceNotification: true, suspiciousLoginAlert: true },
  }
}

function themeIsDark(theme: SettingsPreferences['theme']) {
  return theme === 'dark' || (theme === 'system' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false))
}

function alignSettingsTheme(settings: SettingsSnapshot, dark: boolean) {
  if (themeIsDark(settings.preferences.theme) === dark) return settings
  return { ...settings, preferences: { ...settings.preferences, theme: dark ? 'dark' as const : 'light' as const } }
}

function formatDate(value?: string) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Belum tersedia' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function SettingToggle({ checked, onChange, label, description, icon: Icon, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string; icon?: typeof Bell; disabled?: boolean }) {
  return <div className={`settings-option ${disabled ? 'is-disabled' : ''}`}><span className="option-icon">{Icon ? <Icon size={18} /> : <Check size={18} />}</span><div><strong>{label}</strong><p>{description}</p></div><button type="button" className={`theme-switch ${checked ? 'enabled' : ''}`} onClick={() => !disabled && onChange(!checked)} aria-label={label} aria-pressed={checked} disabled={disabled}><span className={checked ? 'right' : ''} /></button></div>
}

function Section({ eyebrow, title, description, children, className = '' }: { eyebrow: string; title: string; description: string; children: ReactNode; className?: string }) {
  return <section className={`settings-card ${className}`}><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{children}</section>
}

export function SettingsPage({ workspaceId, dark, initialSettings, onApplyTheme, onSettingsSaved, onToast }: { workspaceId: string | null; dark: boolean; initialSettings: SettingsSnapshot | null; onApplyTheme: (theme: SettingsPreferences['theme']) => void; onSettingsSaved: (settings: SettingsSnapshot) => void; onToast: (message: string) => void }) {
  const [active, setActive] = useState<SettingsTab>('profile')
  const [saved, setSaved] = useState<SettingsSnapshot>(() => initialSettings ?? fallbackSettings(dark))
  const [draft, setDraft] = useState<SettingsSnapshot>(() => alignSettingsTheme(initialSettings ?? fallbackSettings(dark), dark))
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured && workspaceId && !initialSettings))
  const [saving, setSaving] = useState(false)
  const [setupError, setSetupError] = useState('')
  const appBaseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '')
  const [telegramSaved, setTelegramSaved] = useState<TelegramSettings>(() => defaultWorkspaceTelegramSettings(workspaceId ?? '', appBaseUrl))
  const [telegramDraft, setTelegramDraft] = useState<TelegramSettings>(() => defaultWorkspaceTelegramSettings(workspaceId ?? '', appBaseUrl))
  const [telegramSetupError, setTelegramSetupError] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(Boolean(isSupabaseConfigured && workspaceId))
  const [telegramTesting, setTelegramTesting] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const applyPresentation = (preferences: SettingsPreferences) => {
    document.body.classList.toggle('settings-accent-purple', preferences.accentColor === 'purple')
    document.body.classList.toggle('settings-accent-green', preferences.accentColor === 'green')
    document.body.classList.toggle('settings-accent-orange', preferences.accentColor === 'orange')
    document.body.classList.toggle('settings-density-compact', preferences.density === 'Compact')
    document.body.classList.toggle('settings-large-text', preferences.largerText)
    document.body.classList.toggle('settings-reduced-motion', preferences.reduceAnimations)
    document.body.classList.toggle('settings-high-contrast', preferences.highContrast)
    document.body.classList.toggle('settings-sidebar-collapsed', preferences.sidebarMode === 'Collapsed')
    document.body.classList.toggle('settings-hide-breadcrumbs', !preferences.showBreadcrumbs)
    document.body.classList.toggle('settings-hide-page-descriptions', !preferences.showPageDescriptions)
    onApplyTheme(preferences.theme)
  }

  useEffect(() => {
    let activeRequest = true
    if (!isSupabaseConfigured || !workspaceId) {
      const local = fallbackSettings(dark)
      setSaved(local); setDraft(local); setLoading(false)
      return
    }
    if (initialSettings) {
      setSaved(initialSettings); setDraft(alignSettingsTheme(initialSettings, dark)); setLoading(false); setSetupError('')
      return
    }
    setLoading(true); setSetupError('')
    void loadWorkspaceSettings(workspaceId).then((value) => {
      if (!activeRequest) return
      setSaved(value); setDraft(alignSettingsTheme(value, dark)); onSettingsSaved(value)
    }).catch((error) => {
      if (!activeRequest) return
      setSetupError(error instanceof Error ? error.message : 'Pengaturan belum dapat dimuat.')
    }).finally(() => activeRequest && setLoading(false))
    return () => { activeRequest = false }
  // Pengaturan perlu dimuat kembali ketika sesi berpindah ke workspace lain.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, initialSettings])

  useEffect(() => {
    let activeRequest = true
    const local = defaultWorkspaceTelegramSettings(workspaceId ?? '', appBaseUrl)
    if (!isSupabaseConfigured || !workspaceId) {
      setTelegramSaved(local); setTelegramDraft(local); setTelegramSetupError(''); setTelegramLoading(false)
      return
    }
    setTelegramLoading(true); setTelegramSetupError('')
    void loadWorkspaceTelegramSettings(workspaceId).then((value) => {
      if (!activeRequest) return
      const next = { ...value, appBaseUrl: value.appBaseUrl || appBaseUrl }
      setTelegramSaved(value); setTelegramDraft(next)
    }).catch((error) => {
      if (!activeRequest) return
      setTelegramSaved(local); setTelegramDraft(local)
      setTelegramSetupError(error instanceof Error ? error.message : 'Pengaturan Telegram belum dapat dimuat.')
    }).finally(() => activeRequest && setTelegramLoading(false))
    return () => { activeRequest = false }
  }, [appBaseUrl, workspaceId])

  const telegramDirty = useMemo(() => JSON.stringify(telegramDraft) !== JSON.stringify(telegramSaved), [telegramDraft, telegramSaved])
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved) || telegramDirty || Boolean(avatarFile || logoFile), [avatarFile, draft, logoFile, saved, telegramDirty])
  const previewChanges = useMemo(() => {
    const changes: Array<{ group: string; label: string; from: string; to: string }> = []
    const add = (group: string, label: string, from: unknown, to: unknown) => {
      const before = Array.isArray(from) ? from.join(', ') : String(from || 'Belum diisi')
      const after = Array.isArray(to) ? to.join(', ') : String(to || 'Belum diisi')
      if (before !== after) changes.push({ group, label, from: before, to: after })
    }
    add('Profil', 'Nama lengkap', saved.profile.fullName, draft.profile.fullName)
    add('Profil', 'Display name', saved.profile.displayName, draft.profile.displayName)
    add('Profil', 'Username', saved.profile.username, draft.profile.username)
    add('Profil', 'Email', saved.profile.email, draft.profile.email)
    add('Profil', 'Nomor telepon', saved.profile.phone, draft.profile.phone)
    add('Profil', 'Jabatan', saved.profile.roleTitle, draft.profile.roleTitle)
    add('Profil', 'Bio', saved.profile.bio, draft.profile.bio)
    if (avatarFile) changes.push({ group: 'Profil', label: 'Foto profil', from: saved.profile.avatarUrl ? 'Foto saat ini' : 'Belum ada foto', to: avatarFile.name })
    add('Workspace', 'Nama workspace', saved.workspace.name, draft.workspace.name)
    add('Workspace', 'Deskripsi', saved.workspace.description, draft.workspace.description)
    add('Workspace', 'Prioritas default', saved.workspace.defaultPriority, draft.workspace.defaultPriority)
    add('Workspace', 'Status default', saved.workspace.defaultStatus, draft.workspace.defaultStatus)
    add('Workspace', 'Tampilan task', saved.workspace.defaultTaskView, draft.workspace.defaultTaskView)
    add('Workspace', 'Timezone', saved.workspace.timezone, draft.workspace.timezone)
    add('Workspace', 'Hari kerja', saved.workspace.workingDays, draft.workspace.workingDays)
    if (logoFile) changes.push({ group: 'Workspace', label: 'Logo workspace', from: saved.workspace.logoUrl ? 'Logo saat ini' : 'Logo bawaan', to: logoFile.name })
    add('Appearance', 'Mode tampilan', saved.preferences.theme, draft.preferences.theme)
    add('Appearance', 'Accent color', saved.preferences.accentColor, draft.preferences.accentColor)
    add('Appearance', 'Sidebar', saved.preferences.sidebarMode, draft.preferences.sidebarMode)
    add('Appearance', 'Density', saved.preferences.density, draft.preferences.density)
    add('Appearance', 'Ukuran teks', saved.preferences.largerText ? 'Lebih besar' : 'Standar', draft.preferences.largerText ? 'Lebih besar' : 'Standar')
    add('Appearance', 'Kurangi animasi', saved.preferences.reduceAnimations ? 'Aktif' : 'Nonaktif', draft.preferences.reduceAnimations ? 'Aktif' : 'Nonaktif')
    add('Notifikasi', 'Notifikasi aplikasi', saved.preferences.inAppNotifications ? 'Aktif' : 'Nonaktif', draft.preferences.inAppNotifications ? 'Aktif' : 'Nonaktif')
    add('Notifikasi', 'Pengingat deadline', saved.preferences.deadlineReminder ? 'Aktif' : 'Nonaktif', draft.preferences.deadlineReminder ? 'Aktif' : 'Nonaktif')
    add('Notifikasi', 'Interval pengingat', saved.preferences.reminderIntervals, draft.preferences.reminderIntervals)
    add('Telegram', 'Status bot', telegramSaved.isEnabled ? 'Aktif' : 'Nonaktif', telegramDraft.isEnabled ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Notifikasi order', telegramSaved.notifyOrders ? 'Aktif' : 'Nonaktif', telegramDraft.notifyOrders ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Notifikasi booking', telegramSaved.notifyBookings ? 'Aktif' : 'Nonaktif', telegramDraft.notifyBookings ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Notifikasi task', telegramSaved.notifyTasks ? 'Aktif' : 'Nonaktif', telegramDraft.notifyTasks ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Notifikasi proyek', telegramSaved.notifyProjects ? 'Aktif' : 'Nonaktif', telegramDraft.notifyProjects ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Notifikasi invoice', telegramSaved.notifyInvoices ? 'Aktif' : 'Nonaktif', telegramDraft.notifyInvoices ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Reminder otomatis', telegramSaved.reminderEnabled ? 'Aktif' : 'Nonaktif', telegramDraft.reminderEnabled ? 'Aktif' : 'Nonaktif')
    add('Telegram', 'Jadwal reminder', [telegramSaved.reminderMorning, telegramSaved.reminderNoon, telegramSaved.reminderEvening], [telegramDraft.reminderMorning, telegramDraft.reminderNoon, telegramDraft.reminderEvening])
    add('Keamanan', 'Notifikasi login', saved.preferences.loginNotification ? 'Aktif' : 'Nonaktif', draft.preferences.loginNotification ? 'Aktif' : 'Nonaktif')
    add('Keamanan', 'Peringatan perangkat baru', saved.preferences.newDeviceNotification ? 'Aktif' : 'Nonaktif', draft.preferences.newDeviceNotification ? 'Aktif' : 'Nonaktif')
    return changes
  }, [avatarFile, draft, logoFile, saved, telegramDraft, telegramSaved])
  const updateProfile = (key: keyof SettingsProfile, value: string) => setDraft((valueDraft) => ({ ...valueDraft, profile: { ...valueDraft.profile, [key]: value } }))
  const updateWorkspace = <K extends keyof SettingsWorkspace>(key: K, value: SettingsWorkspace[K]) => setDraft((valueDraft) => ({ ...valueDraft, workspace: { ...valueDraft.workspace, [key]: value } }))
  const updatePreference = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => setDraft((valueDraft) => ({ ...valueDraft, preferences: { ...valueDraft.preferences, [key]: value } }))
  const updateTelegram = <K extends keyof TelegramSettings>(key: K, value: TelegramSettings[K]) => setTelegramDraft((valueDraft) => ({ ...valueDraft, [key]: value }))

  useEffect(() => {
    applyPresentation(draft.preferences)
  // Draft appearance is intentionally rendered as a temporary preview until the user saves or cancels.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.preferences])

  useEffect(() => {
    setDraft((current) => alignSettingsTheme(current, dark))
  }, [dark])

  const chooseImage = (kind: 'avatar' | 'logo', file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { onToast('Gunakan gambar JPG, PNG, atau WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { onToast('Ukuran gambar maksimal 5 MB.'); return }
    const url = URL.createObjectURL(file)
    if (kind === 'avatar') { setAvatarFile(file); updateProfile('avatarUrl', url) } else { setLogoFile(file); updateWorkspace('logoUrl', url) }
  }

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      let next = structuredClone(draft)
      if (isSupabaseConfigured) {
        if (!workspaceId) throw new Error('Workspace belum siap. Silakan coba lagi sesaat.')
        if (avatarFile) {
          const uploaded = await uploadWorkspaceSettingsAvatar(next.profile.id, avatarFile)
          next.profile.avatarUrl = uploaded.url
        }
        if (logoFile) {
          const uploaded = await uploadWorkspaceSettingsLogo(workspaceId, logoFile)
          next.workspace.logoPath = uploaded.path; next.workspace.logoUrl = uploaded.url
        }
        next = await saveWorkspaceSettings(workspaceId, next.profile, next.workspace, next.preferences)
        if (telegramDirty) {
          const telegram = await saveWorkspaceTelegramSettings(workspaceId, telegramDraft)
          setTelegramSaved(telegram); setTelegramDraft(telegram); setTelegramSetupError('')
        }
      }
      setSaved(next); setDraft(next); setAvatarFile(null); setLogoFile(null); setPreviewOpen(false); applyPresentation(next.preferences); onSettingsSaved(next)
      if (!isSupabaseConfigured) setTelegramSaved(telegramDraft)
      onToast(isSupabaseConfigured ? 'Pengaturan berhasil disimpan.' : 'Pengaturan demo berhasil diperbarui.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Pengaturan tidak dapat disimpan.')
    } finally { setSaving(false) }
  }

  const toggleWorkingDay = (day: string) => updateWorkspace('workingDays', draft.workspace.workingDays.includes(day) ? draft.workspace.workingDays.filter((item) => item !== day) : [...draft.workspace.workingDays, day])
  const toggleReminder = (reminder: string) => updatePreference('reminderIntervals', draft.preferences.reminderIntervals.includes(reminder) ? draft.preferences.reminderIntervals.filter((item) => item !== reminder) : [...draft.preferences.reminderIntervals, reminder])
  const setBrowserNotifications = async (enabled: boolean) => {
    if (!enabled) { updatePreference('browserNotifications', false); return }
    if (!('Notification' in window)) { onToast('Notifikasi browser belum didukung pada perangkat ini.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') { onToast('Izin notifikasi browser belum diberikan.'); return }
    updatePreference('browserNotifications', true)
  }
  const copyPairingCommand = async () => {
    if (!telegramDraft.pairingCode) { onToast('Simpan pengaturan Telegram untuk membuat kode koneksi.'); return }
    const command = `/start ${telegramDraft.pairingCode}`
    try { await navigator.clipboard.writeText(command); onToast('Perintah koneksi Telegram disalin.') }
    catch { onToast(`Kirim perintah ini ke bot: ${command}`) }
  }
  const regeneratePairing = async () => {
    if (!workspaceId) return
    try {
      const code = await regenerateWorkspaceTelegramPairingCode(workspaceId)
      setTelegramSaved((value) => ({ ...value, pairingCode: code, chatId: undefined, chatUsername: undefined }))
      setTelegramDraft((value) => ({ ...value, pairingCode: code, chatId: undefined, chatUsername: undefined }))
      onToast('Kode koneksi baru dibuat. Hubungkan ulang bot melalui Telegram.')
    } catch (error) { onToast(error instanceof Error ? error.message : 'Kode koneksi tidak dapat dibuat.') }
  }
  const sendTelegramTest = async () => {
    if (!workspaceId || telegramTesting) return
    setTelegramTesting(true)
    try { await queueWorkspaceTelegramTest(workspaceId); onToast('Pesan tes masuk antrean Telegram.') }
    catch (error) { onToast(error instanceof Error ? error.message : 'Pesan tes tidak dapat dikirim.') }
    finally { setTelegramTesting(false) }
  }
  const changePassword = async () => {
    if (passwords.next.length < 8) { onToast('Password baru minimal 8 karakter.'); return }
    if (passwords.next !== passwords.confirm) { onToast('Konfirmasi password belum sama.'); return }
    setChangingPassword(true)
    try { await changeWorkspacePassword(passwords.current, passwords.next); setPasswordOpen(false); setPasswords({ current: '', next: '', confirm: '' }); onToast('Password berhasil diperbarui.') }
    catch (error) { onToast(error instanceof Error ? error.message : 'Password tidak dapat diperbarui.') }
    finally { setChangingPassword(false) }
  }

  const profile = draft.profile
  const workspace = draft.workspace
  const preferences = draft.preferences
  return <div className="module-page settings-page">
    <section className="page-title-row"><div><p className="eyebrow">Workspace preferences</p><h1>Settings</h1><p>Atur profil, workspace, notifikasi, dan pengalaman kerja Anda.</p></div><div className="settings-save-actions"><button className="secondary-button" disabled={!dirty || saving} onClick={() => setPreviewOpen(true)}><Eye size={16} /> Preview perubahan</button><button className="quiet-button" disabled={!dirty || saving} onClick={() => { setDraft(saved); setTelegramDraft(telegramSaved); setAvatarFile(null); setLogoFile(null); applyPresentation(saved.preferences) }}>Batalkan</button><button className="primary-button" disabled={!dirty || saving || loading || telegramLoading} onClick={() => { void save() }}><Check size={17} /> {saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></div></section>
    <div className="settings-layout"><aside className="settings-nav">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><Icon size={18} /> {label}<ChevronRight size={14} /></button>)}</aside>
      <main className="settings-sections">{loading && <p className="muted-copy">Memuat pengaturan Anda…</p>}{setupError && <div className="settings-setup-warning"><AlertTriangle size={17} /><span>{setupError}</span></div>}
        {!loading && active === 'profile' && <>
          <Section eyebrow="Profile" title="Profil Anda" description="Kelola informasi pribadi yang digunakan di dalam aplikasi."><div className="settings-profile-hero"><div className="settings-avatar-wrap">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Foto profil" /> : <span>{initials(profile.fullName || profile.displayName) || 'NA'}</span>}</div><div><strong>{profile.displayName || profile.fullName}</strong><p>{profile.email || 'Email belum diisi'}</p></div><div className="settings-inline-actions"><button className="soft-button" onClick={() => avatarInput.current?.click()}><ImagePlus size={15} /> Ganti foto</button>{profile.avatarUrl && <button className="quiet-button danger-text" onClick={() => { setAvatarFile(null); updateProfile('avatarUrl', '') }}>Hapus foto</button>}</div><input ref={avatarInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage('avatar', event.target.files?.[0])} /></div><div className="settings-field-grid"><label>Nama lengkap<input value={profile.fullName} onChange={(event) => updateProfile('fullName', event.target.value)} /></label><label>Display name<input value={profile.displayName} onChange={(event) => updateProfile('displayName', event.target.value)} /></label><label>Username<input value={profile.username} onChange={(event) => updateProfile('username', event.target.value.toLowerCase())} placeholder="huruf-kecil" /><small>Huruf kecil, angka, titik, garis bawah, atau strip.</small></label><label>Email<input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} /><small>Perubahan email akan mengikuti verifikasi dari layanan akun bila diperlukan.</small></label><label>Nomor telepon<input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} placeholder="+62…" /></label><label>Jabatan<input value={profile.roleTitle} onChange={(event) => updateProfile('roleTitle', event.target.value)} placeholder="Contoh: Developer · Owner" /></label><label className="settings-field-full">Bio<textarea value={profile.bio} onChange={(event) => updateProfile('bio', event.target.value)} placeholder="Ceritakan peran atau fokus kerja Anda…" /></label></div></Section>
          <Section eyebrow="Account information" title="Informasi akun" description="Informasi berikut dibuat otomatis dan tidak dapat diubah."><dl className="settings-readonly-grid"><div><dt>Tipe akun</dt><dd>{profile.accountType}</dd></div><div><dt>Tanggal akun dibuat</dt><dd>{formatDate(profile.createdAt)}</dd></div><div><dt>Aktivitas terakhir</dt><dd>{formatDate(profile.lastActive)}</dd></div></dl></Section>
        </>}
        {!loading && active === 'workspace' && <>
          <Section eyebrow="Workspace" title="Identitas workspace" description="Kelola informasi dan preferensi workspace Anda."><div className="profile-studio"><span className="workspace-logo-preview">{workspace.logoUrl ? <img src={workspace.logoUrl} alt="Logo workspace" /> : <BrandMark className="studio-monogram" />}</span><div><strong>{workspace.name}</strong><span>Owner · {workspace.ownerName}</span></div><button className="soft-button" onClick={() => logoInput.current?.click()}><ImagePlus size={15} /> Ganti logo</button><input ref={logoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage('logo', event.target.files?.[0])} /></div><div className="settings-field-grid"><label>Nama workspace<input value={workspace.name} onChange={(event) => updateWorkspace('name', event.target.value)} /></label><label>Workspace owner<input value={workspace.ownerName} disabled /></label><label className="settings-field-full">Deskripsi workspace<textarea value={workspace.description} onChange={(event) => updateWorkspace('description', event.target.value)} placeholder="Personal productivity workspace" /></label></div></Section>
          <Section eyebrow="Task defaults" title="Default task" description="Menentukan nilai awal saat membuat task baru."><div className="settings-field-grid"><label>Prioritas default<select value={workspace.defaultPriority} onChange={(event) => updateWorkspace('defaultPriority', event.target.value as SettingsWorkspace['defaultPriority'])}>{['Low', 'Medium', 'High', 'Urgent'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Status default<select value={workspace.defaultStatus} onChange={(event) => updateWorkspace('defaultStatus', event.target.value as SettingsWorkspace['defaultStatus'])}>{['Todo', 'In Progress', 'Review', 'Completed'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Tampilan task default<select value={workspace.defaultTaskView} onChange={(event) => updateWorkspace('defaultTaskView', event.target.value as SettingsWorkspace['defaultTaskView'])}>{['List', 'Board', 'Calendar'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Pengingat default<select value={workspace.defaultReminder} onChange={(event) => updateWorkspace('defaultReminder', event.target.value)}><option>None</option>{reminderChoices.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label></div></Section>
          <Section eyebrow="Date & time" title="Tanggal dan waktu" description="Menyamakan jadwal dengan cara Anda bekerja."><div className="settings-field-grid"><label>Timezone<input value={workspace.timezone} onChange={(event) => updateWorkspace('timezone', event.target.value)} list="settings-timezones" /><datalist id="settings-timezones"><option>Asia/Makassar</option><option>Asia/Jakarta</option><option>Asia/Jayapura</option></datalist></label><label>Format tanggal<select value={workspace.dateFormat} onChange={(event) => updateWorkspace('dateFormat', event.target.value as SettingsWorkspace['dateFormat'])}>{['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Format waktu<select value={workspace.timeFormat} onChange={(event) => updateWorkspace('timeFormat', event.target.value as SettingsWorkspace['timeFormat'])}><option>12 hour</option><option>24 hour</option></select></label><label>Hari pertama<select value={workspace.firstDayOfWeek} onChange={(event) => updateWorkspace('firstDayOfWeek', event.target.value as SettingsWorkspace['firstDayOfWeek'])}><option>Monday</option><option>Sunday</option></select></label></div></Section>
          <Section eyebrow="Productivity" title="Preferensi produktivitas" description="Menyesuaikan perilaku task dengan alur kerja Anda."><div className="settings-toggle-stack"><SettingToggle checked={workspace.autoMarkOverdue} onChange={(value) => updateWorkspace('autoMarkOverdue', value)} label="Tandai task terlambat otomatis" description="Task melewati deadline akan terlihat sebagai overdue." icon={CalendarClock} /><SettingToggle checked={workspace.showCompletedTasks} onChange={(value) => updateWorkspace('showCompletedTasks', value)} label="Tampilkan task selesai" description="Task selesai tetap muncul pada daftar dan proyek." icon={Eye} /><SettingToggle checked={workspace.autoArchiveCompleted} onChange={(value) => updateWorkspace('autoArchiveCompleted', value)} label="Arsipkan task selesai otomatis" description="Pindahkan task selesai dari daftar aktif." icon={Settings2} /><SettingToggle checked={workspace.confirmBeforeDelete} onChange={(value) => updateWorkspace('confirmBeforeDelete', value)} label="Konfirmasi sebelum menghapus task" description="Minta persetujuan sebelum task dihapus permanen." icon={AlertTriangle} /></div><div className="settings-field-grid"><label>Jam mulai kerja<input type="time" value={workspace.workDayStart} onChange={(event) => updateWorkspace('workDayStart', event.target.value)} /></label><label>Jam selesai kerja<input type="time" value={workspace.workDayEnd} onChange={(event) => updateWorkspace('workDayEnd', event.target.value)} /></label></div><div className="settings-choice-block"><strong>Hari kerja</strong><div className="settings-chip-list">{weekdays.map((day) => <button key={day} type="button" className={workspace.workingDays.includes(day) ? 'active' : ''} onClick={() => toggleWorkingDay(day)}>{day.slice(0, 3)}</button>)}</div></div></Section>
        </>}
        {!loading && active === 'appearance' && <>
          <Section eyebrow="Appearance" title="Tampilan aplikasi" description="Pastel yang lembut, tetap mudah dibaca pada setiap perangkat."><div className="settings-choice-block"><strong>Mode tampilan</strong><div className="settings-segmented">{(['light', 'dark', 'system'] as const).map((item) => <button key={item} className={preferences.theme === item ? 'active' : ''} onClick={() => updatePreference('theme', item)}>{item === 'light' ? 'Light' : item === 'dark' ? 'Dark' : 'System'}</button>)}</div></div><div className="settings-choice-block"><strong>Accent color</strong><div className="settings-colors">{([{ key: 'blue', label: 'Blue' }, { key: 'purple', label: 'Purple' }, { key: 'green', label: 'Green' }, { key: 'orange', label: 'Orange' }] as const).map((color) => <button key={color.key} className={`settings-color ${color.key} ${preferences.accentColor === color.key ? 'active' : ''}`} onClick={() => updatePreference('accentColor', color.key)} aria-label={color.label}><Check size={14} /></button>)}</div></div></Section>
          <Section eyebrow="Layout" title="Susunan aplikasi" description="Atur kepadatan dan informasi yang ingin selalu terlihat."><div className="settings-field-grid"><label>Sidebar<select value={preferences.sidebarMode} onChange={(event) => updatePreference('sidebarMode', event.target.value as SettingsPreferences['sidebarMode'])}><option>Expanded</option><option>Collapsed</option></select></label><label>Density<select value={preferences.density} onChange={(event) => updatePreference('density', event.target.value as SettingsPreferences['density'])}><option>Comfortable</option><option>Compact</option></select></label></div><div className="settings-toggle-stack"><SettingToggle checked={preferences.showBreadcrumbs} onChange={(value) => updatePreference('showBreadcrumbs', value)} label="Tampilkan breadcrumbs" description="Menunjukkan posisi halaman pada bagian atas aplikasi." icon={LayoutPanelLeft} /><SettingToggle checked={preferences.showPageDescriptions} onChange={(value) => updatePreference('showPageDescriptions', value)} label="Tampilkan deskripsi halaman" description="Menampilkan teks bantuan singkat pada halaman kerja." icon={Eye} /></div></Section>
          <Section eyebrow="Dashboard preferences" title="Halaman awal dan task" description="Tentukan tampilan pertama ketika membuka workspace."><div className="settings-field-grid"><label>Halaman awal<select value={preferences.defaultLandingPage} onChange={(event) => updatePreference('defaultLandingPage', event.target.value as SettingsPreferences['defaultLandingPage'])}><option>Dashboard</option><option>My Tasks</option><option>Calendar</option></select></label><label>Tampilan task<select value={preferences.dashboardTaskView} onChange={(event) => updatePreference('dashboardTaskView', event.target.value as SettingsPreferences['dashboardTaskView'])}><option>List</option><option>Board</option><option>Calendar</option></select></label></div><div className="settings-toggle-stack"><SettingToggle checked={preferences.showOverdueTasks} onChange={(value) => updatePreference('showOverdueTasks', value)} label="Tampilkan task terlambat" description="Task overdue tetap terlihat pada ringkasan." icon={CalendarClock} /><SettingToggle checked={preferences.showCompletedTasks} onChange={(value) => updatePreference('showCompletedTasks', value)} label="Tampilkan task selesai" description="Task selesai ditampilkan pada ringkasan dashboard." icon={Check} /></div></Section>
          <Section eyebrow="Accessibility" title="Aksesibilitas" description="Pilihan sederhana agar aplikasi lebih nyaman digunakan."><div className="settings-toggle-stack"><SettingToggle checked={preferences.largerText} onChange={(value) => updatePreference('largerText', value)} label="Teks lebih besar" description="Meningkatkan ukuran teks utama aplikasi." icon={Accessibility} /><SettingToggle checked={preferences.reduceAnimations} onChange={(value) => updatePreference('reduceAnimations', value)} label="Kurangi animasi" description="Mengurangi pergerakan transisi yang tidak penting." icon={MonitorCog} /><SettingToggle checked={preferences.highContrast} onChange={(value) => updatePreference('highContrast', value)} label="Kontras tinggi" description="Meningkatkan keterbacaan batas dan teks." icon={Eye} /></div></Section>
        </>}
        {!loading && active === 'notifications' && <>
          <Section eyebrow="Notification channels" title="Cara menerima notifikasi" description="Pilih bagaimana Anda ingin menerima pembaruan penting."><div className="settings-toggle-stack"><SettingToggle checked={preferences.inAppNotifications} onChange={(value) => updatePreference('inAppNotifications', value)} label="Notifikasi di aplikasi" description="Tampilkan pembaruan pada pusat notifikasi Nayagement." icon={Bell} /><SettingToggle checked={preferences.browserNotifications} onChange={(value) => { void setBrowserNotifications(value) }} label="Notifikasi browser / desktop" description={preferences.browserNotifications ? 'Izin browser sudah diberikan.' : 'Memerlukan izin dari browser perangkat ini.'} icon={Laptop} /><SettingToggle checked={preferences.emailNotifications} onChange={(value) => updatePreference('emailNotifications', value)} label="Notifikasi email" description="Disimpan sebagai preferensi untuk kanal email." icon={MailCheck} /></div></Section>
          <Section eyebrow="Telegram bot" title="Asisten Nayagement di Telegram" description="Terima pembaruan, konfirmasi order dan booking, cek pekerjaan, serta tindak lanjuti invoice dari satu chat.">
            <div className="telegram-settings">
              {telegramLoading ? <p className="muted-copy">Memuat koneksi Telegram…</p> : null}
              {telegramSetupError ? <div className="settings-setup-warning"><AlertTriangle size={17} /><span>{telegramSetupError}</span></div> : null}
              <div className="telegram-connection-card">
                <span className={`telegram-bot-icon ${telegramDraft.chatId ? 'connected' : ''}`}><Bot size={22} /></span>
                <div><strong>{telegramDraft.chatId ? `Terhubung${telegramDraft.chatUsername ? ` ke @${telegramDraft.chatUsername}` : ''}` : 'Belum terhubung ke chat'}</strong><p>{telegramDraft.botUsername ? `Bot @${telegramDraft.botUsername}` : 'Token bot disimpan aman sebagai secret pada fungsi server.'}</p></div>
                <span className={`telegram-status ${telegramDraft.chatId ? 'connected' : ''}`}>{telegramDraft.chatId ? 'Connected' : 'Menunggu koneksi'}</span>
              </div>
              <SettingToggle checked={telegramDraft.isEnabled} onChange={(value) => updateTelegram('isEnabled', value)} label="Aktifkan notifikasi Telegram" description="Matikan sementara tanpa memutuskan chat yang sudah terhubung." icon={Send} disabled={Boolean(telegramSetupError)} />
              <div className="telegram-pairing-block">
                <div><strong>Hubungkan chat pribadi</strong><p>Simpan pengaturan, lalu kirim perintah berikut ke bot Telegram Anda.</p></div>
                <code>{telegramDraft.pairingCode ? `/start ${telegramDraft.pairingCode}` : '/start KODE-KONEKSI'}</code>
                <div className="settings-inline-actions"><button className="soft-button" type="button" disabled={!telegramDraft.pairingCode} onClick={() => { void copyPairingCommand() }}><Copy size={15} /> Salin perintah</button><button className="quiet-button" type="button" disabled={!workspaceId || Boolean(telegramSetupError)} onClick={() => { void regeneratePairing() }}><RefreshCw size={15} /> Buat kode baru</button><button className="quiet-button" type="button" disabled={!telegramDraft.chatId || telegramTesting} onClick={() => { void sendTelegramTest() }}><Send size={15} /> {telegramTesting ? 'Mengantrekan…' : 'Kirim tes'}</button></div>
              </div>
              <div className="settings-choice-block"><strong>Event yang dikirim ke Telegram</strong><div className="telegram-event-grid"><SettingToggle checked={telegramDraft.notifyOrders} onChange={(value) => updateTelegram('notifyOrders', value)} label="Order masuk" description="Brief dan order baru." icon={Bell} /><SettingToggle checked={telegramDraft.notifyBookings} onChange={(value) => updateTelegram('notifyBookings', value)} label="Booking konsultasi" description="Reservasi konsultasi baru." icon={CalendarClock} /><SettingToggle checked={telegramDraft.notifyTasks} onChange={(value) => updateTelegram('notifyTasks', value)} label="Task" description="Task baru dan perubahan status." icon={Check} /><SettingToggle checked={telegramDraft.notifyProjects} onChange={(value) => updateTelegram('notifyProjects', value)} label="Project" description="Project baru dan progres penting." icon={Building2} /><SettingToggle checked={telegramDraft.notifyInvoices} onChange={(value) => updateTelegram('notifyInvoices', value)} label="Invoice" description="Invoice baru dan status pembayaran." icon={CircleDollarSign} /></div></div>
              <div className="telegram-reminder-card">
                <SettingToggle checked={telegramDraft.reminderEnabled} onChange={(value) => updateTelegram('reminderEnabled', value)} label="Greeting dan reminder otomatis" description="Bot mengirim ringkasan pekerjaan tiga kali sehari sesuai zona waktu workspace." icon={Clock3} />
                {telegramDraft.reminderEnabled ? <div className="telegram-time-grid"><label>Pagi<input type="time" value={telegramDraft.reminderMorning} onChange={(event) => updateTelegram('reminderMorning', event.target.value)} /></label><label>Siang<input type="time" value={telegramDraft.reminderNoon} onChange={(event) => updateTelegram('reminderNoon', event.target.value)} /></label><label>Malam<input type="time" value={telegramDraft.reminderEvening} onChange={(event) => updateTelegram('reminderEvening', event.target.value)} /></label><label>Zona waktu<input value={telegramDraft.timezone} onChange={(event) => updateTelegram('timezone', event.target.value)} list="settings-timezones" /></label></div> : null}
              </div>
              <label className="settings-field-full">Alamat aplikasi publik<input value={telegramDraft.appBaseUrl} onChange={(event) => updateTelegram('appBaseUrl', event.target.value)} placeholder="https://app-anda.com" /><small>Dipakai bot untuk membuat link booking, form order, proyek, task, dan invoice.</small></label>
            </div>
          </Section>
          <Section eyebrow="Task notifications" title="Notifikasi task" description="Pilih perubahan task yang layak mengganggu Anda."><div className="settings-toggle-stack"><SettingToggle checked={preferences.taskReminder} onChange={(value) => updatePreference('taskReminder', value)} label="Pengingat task" description="Peringatkan saat task mendekati jadwalnya." icon={Clock3} /><SettingToggle checked={preferences.taskCompleted} onChange={(value) => updatePreference('taskCompleted', value)} label="Task selesai" description="Tandai ketika task diselesaikan." icon={Check} /><SettingToggle checked={preferences.taskOverdue} onChange={(value) => updatePreference('taskOverdue', value)} label="Task terlambat" description="Peringatkan ketika deadline telah terlewati." icon={AlertTriangle} /><SettingToggle checked={preferences.deadlineReminder} onChange={(value) => updatePreference('deadlineReminder', value)} label="Pengingat deadline" description="Jadwalkan pengingat sebelum deadline proyek atau task." icon={BellRing} /></div><div className="settings-choice-block"><strong>Ingatkan sebelum deadline</strong><div className="settings-chip-list">{reminderChoices.map((item) => <button key={item} type="button" className={preferences.reminderIntervals.includes(item) ? 'active' : ''} onClick={() => toggleReminder(item)}>{item}</button>)}</div></div></Section>
          <Section eyebrow="Summary" title="Ringkasan rutin" description="Atur ringkasan produktivitas personal Anda."><div className="settings-toggle-stack"><SettingToggle checked={preferences.dailySummary} onChange={(value) => updatePreference('dailySummary', value)} label="Daily summary" description="Ringkasan task jatuh tempo, overdue, dan selesai hari ini." icon={CalendarClock} />{preferences.dailySummary && <label className="settings-inline-select">Waktu ringkasan<input type="time" value={preferences.dailySummaryTime} onChange={(event) => updatePreference('dailySummaryTime', event.target.value)} /></label>}<SettingToggle checked={preferences.weeklySummary} onChange={(value) => updatePreference('weeklySummary', value)} label="Weekly productivity summary" description="Ringkasan produktivitas mingguan." icon={Volume2} />{preferences.weeklySummary && <div className="settings-field-grid"><label>Hari<select value={preferences.weeklySummaryDay} onChange={(event) => updatePreference('weeklySummaryDay', event.target.value as SettingsPreferences['weeklySummaryDay'])}><option>Monday</option><option>Sunday</option></select></label><label>Waktu<input type="time" value={preferences.weeklySummaryTime} onChange={(event) => updatePreference('weeklySummaryTime', event.target.value)} /></label></div>}</div></Section>
        </>}
        {!loading && active === 'security' && <>
          <Section eyebrow="Password & authentication" title="Password dan autentikasi" description="Jaga akses akun Anda tetap aman."><div className="settings-action-row"><div><strong>Ubah password</strong><p>Gunakan password baru dengan minimal 8 karakter.</p></div><button className="soft-button" onClick={() => setPasswordOpen(true)}><KeyRound size={15} /> Ubah password</button></div></Section>
          <Section eyebrow="Two-factor authentication" title="Lapisan keamanan tambahan" description="Autentikator dua langkah belum tersedia pada backend akun saat ini."><div className="settings-unavailable"><LockKeyhole size={18} /><div><strong>2FA dalam persiapan</strong><p>Pengaturan ini akan dapat diaktifkan setelah metode authenticator dan backup code tersedia.</p></div></div></Section>
          <Section eyebrow="Active sessions" title="Sesi aktif" description="Hanya sesi yang benar-benar tersedia pada akun ditampilkan di sini."><div className="settings-session-row"><span className="option-icon"><Laptop size={18} /></span><div><strong>Perangkat ini <em>Current session</em></strong><p>{navigator.userAgent.includes('Mac') ? 'Mac' : 'Perangkat Anda'} · Browser saat ini</p></div></div><button className="soft-button" onClick={() => { void signOutOtherWorkspaceSessions().then(() => onToast('Sesi lain berhasil dikeluarkan.')).catch((error) => onToast(error instanceof Error ? error.message : 'Sesi lain tidak dapat dikeluarkan.')) }}>Keluar dari sesi lain</button></Section>
          <Section eyebrow="Login security" title="Peringatan login" description="Pilih pemberitahuan keamanan yang ingin diterima."><div className="settings-toggle-stack"><SettingToggle checked={preferences.loginNotification} onChange={(value) => updatePreference('loginNotification', value)} label="Notifikasi login" description="Beri tahu saat akun digunakan untuk masuk." icon={Bell} /><SettingToggle checked={preferences.newDeviceNotification} onChange={(value) => updatePreference('newDeviceNotification', value)} label="Perangkat baru" description="Beri tahu ketika sesi dibuka pada perangkat baru." icon={Laptop} /><SettingToggle checked={preferences.suspiciousLoginAlert} onChange={(value) => updatePreference('suspiciousLoginAlert', value)} label="Login mencurigakan" description="Simpan preferensi alert untuk aktivitas tidak biasa." icon={AlertTriangle} /></div></Section>
          <Section eyebrow="Danger zone" title="Zona berbahaya" description="Tindakan ini tidak bisa dibatalkan." className="settings-danger"><div className="settings-action-row"><div><strong>Hapus akun</strong><p>Penghapusan akun permanen memerlukan layanan backend khusus dan belum tersedia pada workspace ini.</p></div><button className="danger-button" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> Delete account</button></div></Section>
        </>}
      </main></div>
    {previewOpen && <Modal title="Preview perubahan" onClose={() => setPreviewOpen(false)} wide><div className="settings-preview-modal"><div className="settings-preview-intro"><Eye size={18} /><div><strong>Belum diterapkan</strong><p>Appearance sedang ditampilkan sementara pada halaman ini. Perubahan lain diringkas di bawah dan baru tersimpan setelah Anda menerapkan perubahan.</p></div></div>{previewChanges.length ? <div className="settings-preview-list">{previewChanges.map((change) => <article key={`${change.group}-${change.label}`}><small>{change.group}</small><strong>{change.label}</strong><div><span>{change.from}</span><ChevronRight size={15} /><b>{change.to}</b></div></article>)}</div> : <p className="muted-copy">Belum ada perubahan untuk dipreview.</p>}<footer><button className="soft-button" onClick={() => setPreviewOpen(false)}>Lanjut mengedit</button><button className="quiet-button" onClick={() => { setPreviewOpen(false); setDraft(saved); setTelegramDraft(telegramSaved); setAvatarFile(null); setLogoFile(null); applyPresentation(saved.preferences) }}>Batalkan perubahan</button><button className="primary-button" disabled={!dirty || saving} onClick={() => { void save() }}><Check size={16} /> Terapkan perubahan</button></footer></div></Modal>}
    {passwordOpen && <Modal title="Ubah password" onClose={() => setPasswordOpen(false)}><div className="settings-modal-body"><p className="muted-copy">Gunakan password baru minimal 8 karakter dan jangan gunakan password yang sama dengan sebelumnya.</p><label>Password saat ini<input type="password" value={passwords.current} onChange={(event) => setPasswords((value) => ({ ...value, current: event.target.value }))} /></label><label>Password baru<input type="password" value={passwords.next} onChange={(event) => setPasswords((value) => ({ ...value, next: event.target.value }))} /><small>Kekuatan: {passwords.next.length >= 12 ? 'kuat' : passwords.next.length >= 8 ? 'cukup' : 'perlu ditingkatkan'}</small></label><label>Konfirmasi password baru<input type="password" value={passwords.confirm} onChange={(event) => setPasswords((value) => ({ ...value, confirm: event.target.value }))} /></label><footer><button className="soft-button" onClick={() => setPasswordOpen(false)}>Batal</button><button className="primary-button" disabled={changingPassword} onClick={() => { void changePassword() }}>{changingPassword ? 'Menyimpan…' : 'Simpan password'}</button></footer></div></Modal>}
    {deleteOpen && <Modal title="Hapus akun" onClose={() => setDeleteOpen(false)}><div className="settings-modal-body"><div className="settings-unavailable"><AlertTriangle size={18} /><div><strong>Penghapusan akun belum tersedia</strong><p>Backend penghapusan akun belum dihubungkan, sehingga data Anda tidak akan dihapus dari sini.</p></div></div><footer><button className="soft-button" onClick={() => setDeleteOpen(false)}>Mengerti</button></footer></div></Modal>}
  </div>
}
