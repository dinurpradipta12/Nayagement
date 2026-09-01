import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, FileText, Link2, Pencil, Plus, Send, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import type { Project, ProjectPriority, ProjectStatus, Task, TaskStatus, TimelineItem } from '../types'
import { deadlineLabel, rupiah } from '../lib/format'
import { sanitizeUserMessage } from '../lib/userMessage'
import { Avatar, ProgressBar, StatusChip } from '../components/ui'

interface ProjectDetailPageProps {
  project: Project
  tasks: Task[]
  timeline: TimelineItem[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onCopyLink: () => void
  onOpenPortal: () => void
  onEnablePortal: () => Promise<void>
  onOpenClient: () => void
  onSaveProgress: (progress: number, status: ProjectStatus) => Promise<void>
  onSavePayment: (paidAmount: number) => Promise<void>
  onAddTask: (input: { name: string; description?: string; dueAt?: string; priority: ProjectPriority; visibleToClient: boolean }) => Promise<void>
  onToggleTask: (task: Task, status: TaskStatus) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
  onAddActivity: (input: { title: string; description?: string; visibleToClient: boolean; occurredAt?: string }) => Promise<void>
  onUpdateActivity: (item: TimelineItem, input: { title: string; description?: string; visibleToClient: boolean; occurredAt?: string }) => Promise<void>
  onDeleteActivity: (item: TimelineItem) => Promise<void>
}

const statuses: ProjectStatus[] = ['Inquiry', 'Pending', 'Confirmed', 'In Progress', 'Review', 'Revision', 'Completed', 'Cancelled']
const priorities: ProjectPriority[] = ['Low', 'Medium', 'High', 'Urgent']

export function ProjectDetailPage({
  project,
  tasks,
  timeline,
  onBack,
  onEdit,
  onDelete,
  onCopyLink,
  onOpenPortal,
  onEnablePortal,
  onOpenClient,
  onSaveProgress,
  onSavePayment,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
}: ProjectDetailPageProps) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id || (!task.projectId && task.project === project.name))
  const [progress, setProgress] = useState(project.progress)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [savingProgress, setSavingProgress] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(String(Math.round(project.paid)))
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDueAt, setTaskDueAt] = useState('')
  const [taskPriority, setTaskPriority] = useState<ProjectPriority>('Medium')
  const [taskVisible, setTaskVisible] = useState(true)
  const [activityTitle, setActivityTitle] = useState('')
  const [activityDescription, setActivityDescription] = useState('')
  const [activityVisible, setActivityVisible] = useState(true)
  const [activityOccurredAt, setActivityOccurredAt] = useState('')
  const [editingActivity, setEditingActivity] = useState<TimelineItem | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setProgress(project.progress)
    setStatus(project.status)
    setPaymentAmount(String(Math.round(project.paid)))
    setPaymentError('')
  }, [project.id, project.paid, project.progress, project.status])

  const saveProgress = async () => {
    try {
      setSavingProgress(true)
      setFormError('')
      await onSaveProgress(progress, status)
    } catch (error) {
      setFormError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Kemajuan proyek tidak dapat disimpan.')
    } finally {
      setSavingProgress(false)
    }
  }

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const digits = paymentAmount.replace(/[^0-9]/g, '')
    const paidAmount = digits ? Number(digits) : 0
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      setPaymentError('Masukkan nominal pembayaran yang valid.')
      return
    }
    if (paidAmount > project.estimatedValue) {
      setPaymentError('Nominal tidak boleh melebihi nilai proyek.')
      return
    }
    try {
      setSavingPayment(true)
      setPaymentError('')
      await onSavePayment(paidAmount)
      setShowPaymentForm(false)
    } catch (error) {
      setPaymentError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Pembayaran proyek tidak dapat diperbarui.')
    } finally {
      setSavingPayment(false)
    }
  }

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!taskName.trim()) {
      setFormError('Nama tugas perlu diisi.')
      return
    }
    try {
      setSubmitting(true)
      setFormError('')
      await onAddTask({ name: taskName.trim(), description: taskDescription.trim() || undefined, dueAt: taskDueAt || undefined, priority: taskPriority, visibleToClient: taskVisible })
      setTaskName('')
      setTaskDescription('')
      setTaskDueAt('')
      setTaskPriority('Medium')
      setTaskVisible(true)
      setShowTaskForm(false)
    } catch (error) {
      setFormError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Tugas tidak dapat disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activityTitle.trim()) {
      setFormError('Judul aktivitas perlu diisi.')
      return
    }
    try {
      setSubmitting(true)
      setFormError('')
      const input = { title: activityTitle.trim(), description: activityDescription.trim() || undefined, visibleToClient: activityVisible, occurredAt: activityOccurredAt || undefined }
      if (editingActivity) await onUpdateActivity(editingActivity, input)
      else await onAddActivity(input)
      setActivityTitle('')
      setActivityDescription('')
      setActivityVisible(true)
      setActivityOccurredAt('')
      setEditingActivity(null)
      setShowActivityForm(false)
    } catch (error) {
      setFormError(error instanceof Error ? sanitizeUserMessage(error.message) : 'Aktivitas tidak dapat disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const openActivityEditor = (item?: TimelineItem) => {
    setEditingActivity(item ?? null)
    setActivityTitle(item?.title ?? '')
    setActivityDescription(item?.description ?? '')
    setActivityVisible(item?.visibleToClient ?? true)
    const sourceDate = item?.occurredAt ? new Date(item.occurredAt) : new Date()
    const timezoneOffset = sourceDate.getTimezoneOffset() * 60_000
    setActivityOccurredAt(new Date(sourceDate.getTime() - timezoneOffset).toISOString().slice(0, 16))
    setFormError('')
    setShowActivityForm(true)
  }

  const closeActivityEditor = () => {
    setShowActivityForm(false)
    setEditingActivity(null)
    setFormError('')
  }

  const portalActive = Boolean(project.publicSlug || project.publicCode || project.publicToken)
  const portalPath = project.publicSlug
    ? '/client/' + project.publicSlug
    : project.publicCode
      ? '/p/' + project.publicCode
      : 'Tautan portal aktif'
  const outstandingPayment = Math.max(0, project.estimatedValue - project.paid)

  return (
    <div className="module-page project-detail-page">
      <section className="project-detail-titlebar">
        <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Semua proyek</button>
        <div className="project-detail-title-actions">
          <button className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit proyek</button>
          <button className="danger-button" onClick={onDelete}><Trash2 size={16} /> Hapus</button>
        </div>
      </section>

      <section className="detail-hero detail-hero-fixed">
        <div className="detail-hero-main">
          <span className="detail-code">{project.code} · {project.type}</span>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
          <div className="detail-meta"><span><UserRound size={15} /> {project.client}</span><span><CalendarDays size={15} /> {deadlineLabel(project.dueDate)}</span></div>
        </div>
        <div className="detail-hero-side"><StatusChip status={project.status} /><strong>{rupiah(project.estimatedValue)}</strong><span>Nilai proyek</span></div>
      </section>

      <div className="detail-content-grid">
        <div className="detail-main-column">
          <section className="detail-section">
            <div className="detail-section-heading"><div><p className="eyebrow">Kemajuan</p><h2>Proyek sudah {progress}%</h2></div><span>{progress}%</span></div>
            <ProgressBar value={progress} />
            <div className="project-progress-editor">
              <label><span>Progress</span><input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
              <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
              <button className="primary-button" onClick={() => { void saveProgress() }} disabled={savingProgress}>{savingProgress ? 'Menyimpan…' : 'Simpan kemajuan'}</button>
            </div>
            <p className="detail-helper">Deadline {project.dueDate} · {deadlineLabel(project.dueDate)}. Status yang berubah juga tercatat pada timeline internal.</p>
            {formError && !showTaskForm && !showActivityForm && <p className="form-error">{formError}</p>}
          </section>

          <section className="detail-section">
            <div className="detail-section-heading">
              <div><p className="eyebrow">Timeline</p><h2>Aktivitas proyek</h2></div>
              <button className="soft-button" onClick={() => showActivityForm ? closeActivityEditor() : openActivityEditor()}><Plus size={15} /> Update</button>
            </div>
            {showActivityForm && (
              <form className="project-inline-form" onSubmit={submitActivity}>
                <div className="project-inline-form-heading"><strong>{editingActivity ? 'Edit aktivitas' : 'Tambah aktivitas'}</strong><button type="button" className="icon-button" aria-label="Tutup form aktivitas" onClick={closeActivityEditor}><X size={16} /></button></div>
                <label>Judul aktivitas<input autoFocus value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Contoh: Konsep awal dikirim" /></label>
                <label>Keterangan<textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} rows={3} placeholder="Ringkasan pembaruan untuk tim atau klien..." /></label>
                <label>Jadwal aktivitas<input type="datetime-local" value={activityOccurredAt} onChange={(event) => setActivityOccurredAt(event.target.value)} /><small>Aktivitas ini otomatis muncul di Calendar pada waktu tersebut.</small></label>
                <label className="visibility-toggle"><input type="checkbox" checked={activityVisible} onChange={(event) => setActivityVisible(event.target.checked)} /> Tampilkan aktivitas ini di portal klien</label>
                {formError && <p className="form-error">{formError}</p>}
                <div><button type="button" className="secondary-button" onClick={closeActivityEditor}>Batal</button><button className="primary-button" disabled={submitting}>{submitting ? 'Menyimpan…' : editingActivity ? 'Simpan perubahan' : 'Simpan aktivitas'}</button></div>
              </form>
            )}
            <div className="timeline-list">
              {timeline.length ? timeline.map((item) => (
                <div key={item.id ?? item.title + item.date + item.time} className={'timeline-item timeline-' + item.state}>
                  <span className="timeline-marker" />
                  <div><strong>{item.title}</strong><p>{item.description}</p><small>{item.date} · {item.time} {item.visibleToClient ? '· Terlihat oleh klien' : '· Internal'}</small></div>
                  {item.id && <span className="timeline-item-actions"><button className="timeline-edit-button" onClick={() => openActivityEditor(item)} aria-label={'Edit aktivitas ' + item.title} title="Edit aktivitas"><Pencil size={14} /></button><button className="timeline-delete-button" onClick={() => { void onDeleteActivity(item) }} aria-label={'Hapus aktivitas ' + item.title} title="Hapus aktivitas"><Trash2 size={14} /></button></span>}
                </div>
              )) : <p className="muted-copy">Belum ada aktivitas. Tambahkan update pertama untuk memulai timeline.</p>}
            </div>
          </section>
        </div>

        <aside className="detail-side-column">
          <section className="detail-side-card">
            <p className="eyebrow">Client</p>
            <div className="detail-client"><Avatar initials={project.client.split(' ').map((word) => word[0]).join('').slice(0, 2)} variant={project.accent} size="lg" /><div><strong>{project.client}</strong><span>Klien proyek</span></div></div>
            <button className="soft-button" onClick={onOpenClient}>Buka profil klien <ExternalLink size={15} /></button>
          </section>

          <section className="detail-side-card">
            <div className="detail-section-heading"><div><p className="eyebrow">Tugas</p><h2>{projectTasks.length} tugas</h2></div><button className="icon-button" aria-label="Tambah tugas" onClick={() => { setShowTaskForm((current) => !current); setFormError('') }}><Plus size={17} /></button></div>
            {showTaskForm && (
              <form className="project-inline-form compact" onSubmit={submitTask}>
                <div className="project-inline-form-heading"><strong>Tugas baru</strong><button type="button" className="icon-button" aria-label="Tutup form tugas" onClick={() => setShowTaskForm(false)}><X size={16} /></button></div>
                <label>Nama tugas<input autoFocus value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="Contoh: Kirim revisi desain" /></label>
                <label>Catatan<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={2} placeholder="Opsional" /></label>
                <div className="project-inline-split"><label>Jatuh tempo<input type="date" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /></label><label>Prioritas<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as ProjectPriority)}>{priorities.map((option) => <option key={option}>{option}</option>)}</select></label></div>
                <label className="visibility-toggle"><input type="checkbox" checked={taskVisible} onChange={(event) => setTaskVisible(event.target.checked)} /> Tampilkan di portal klien</label>
                {formError && <p className="form-error">{formError}</p>}
                <div><button type="button" className="secondary-button" onClick={() => setShowTaskForm(false)}>Batal</button><button className="primary-button" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Tambah tugas'}</button></div>
              </form>
            )}
            <div className="detail-task-list">
              {projectTasks.length ? projectTasks.map((task) => {
                const completed = task.status === 'Completed'
                return (
                  <div key={task.id} className={completed ? 'is-complete' : ''}>
                    <button className="task-toggle-button" onClick={() => { void onToggleTask(task, completed ? 'Todo' : 'Completed') }} aria-label={completed ? 'Tandai belum selesai' : 'Tandai selesai'}><CheckCircle2 size={17} /></button>
                    <span><strong>{task.name}</strong><small>{task.status} · {task.due}{task.visibleToClient ? ' · Terlihat oleh klien' : ' · Internal'}</small></span>
                    <button className="task-delete-button" onClick={() => { void onDeleteTask(task) }} aria-label={'Hapus tugas ' + task.name} title="Hapus tugas"><Trash2 size={14} /></button>
                  </div>
                )
              }) : <p className="muted-copy">Belum ada tugas untuk proyek ini.</p>}
            </div>
          </section>

          <section className="detail-side-card public-access-card">
            <span className="public-access-icon"><ShieldCheck size={18} /></span>
            <p className="eyebrow">Client portal</p>
            <strong>{portalActive ? 'Akses klien aktif' : 'Akses privat'}</strong>
            <p>{portalActive ? 'Portal selalu memuat progres, tugas, dan update terbaru yang Anda publikasikan.' : 'Aktifkan portal ketika klien siap memantau pekerjaan.'}</p>
            {portalActive ? <><span className="portal-short-path"><Link2 size={14} /> {portalPath}</span><div className="public-actions"><button className="soft-button" onClick={onCopyLink}><Copy size={15} /> Salin</button><button className="soft-button" onClick={onOpenPortal}><ExternalLink size={15} /> Preview</button></div></> : <button className="soft-button" onClick={() => { void onEnablePortal() }}><Send size={15} /> Aktifkan akses</button>}
          </section>

          <section className="detail-side-card payment-card">
            <div className="detail-section-heading"><div><p className="eyebrow">Pembayaran</p><h2>Ringkasan pembayaran</h2></div><button className="soft-button payment-update-button" onClick={() => { setShowPaymentForm((current) => !current); setPaymentAmount(String(Math.round(project.paid))); setPaymentError('') }}><Pencil size={14} /> Update pembayaran</button></div>
            {showPaymentForm && (
              <form className="project-inline-form compact payment-inline-form" onSubmit={submitPayment}>
                <div className="project-inline-form-heading"><strong>Pembayaran kustom</strong><button type="button" className="icon-button" aria-label="Tutup form pembayaran" onClick={() => setShowPaymentForm(false)}><X size={16} /></button></div>
                <label>Nominal yang sudah diterima<input inputMode="numeric" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value.replace(/[^0-9]/g, ''))} placeholder="0" /></label>
                <p className="payment-form-note">Nilai proyek {rupiah(project.estimatedValue)}. Biarkan Rp0 bila belum ada pembayaran.</p>
                <div className="payment-quick-actions"><button type="button" className="text-button" onClick={() => setPaymentAmount('0')}>Set Rp0</button><button type="button" className="text-button" onClick={() => setPaymentAmount(String(Math.round(project.estimatedValue)))}>Set lunas</button></div>
                {paymentError && <p className="form-error">{paymentError}</p>}
                <div><button type="button" className="secondary-button" onClick={() => setShowPaymentForm(false)}>Batal</button><button className="primary-button" disabled={savingPayment}>{savingPayment ? 'Menyimpan…' : 'Simpan pembayaran'}</button></div>
              </form>
            )}
            <div className="payment-summary"><span><FileText size={16} /> {project.paid > 0 ? 'Dibayar' : 'Belum ada pembayaran'}</span><strong>{rupiah(project.paid)}</strong></div>
            <div className="payment-summary"><span>Sisa</span><strong>{rupiah(outstandingPayment)}</strong></div>
          </section>
        </aside>
      </div>
    </div>
  )
}
