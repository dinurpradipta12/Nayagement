import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, FileText, FolderKanban, Image, Link2, LoaderCircle, Paperclip, Save, Trash2, Upload, X } from 'lucide-react'
import { ProgressBar } from './ui'
import type { Project, ProjectPriority, Task, TaskAttachment, TaskDetailInput, TaskStatus } from '../types'

interface TaskDetailDrawerProps {
  task: Task
  project?: Project
  loading: boolean
  closing?: boolean
  error: string
  onClose: () => void
  onOpenProject: (projectId: string) => void
  onSave: (task: Task, input: TaskDetailInput) => Promise<Task>
  onAddNote: (task: Task, body: string) => Promise<void>
  onUploadAttachment: (task: Task, file: File) => Promise<void>
  onDeleteAttachment: (task: Task, attachment: TaskAttachment) => Promise<void>
}

const priorities: ProjectPriority[] = ['Low', 'Medium', 'High', 'Urgent']
const statuses: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Completed']

function taskDraft(task: Task): TaskDetailInput {
  return {
    name: task.name,
    description: task.description ?? '',
    brief: task.brief ?? '',
    dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
    priority: task.priority,
    status: task.status,
    progress: task.progress ?? (task.status === 'Completed' ? 100 : 0),
    visibleToClient: task.visibleToClient,
  }
}

function attachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function noteTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Baru saja'
  const elapsed = Date.now() - date.getTime()
  if (elapsed < 60_000) return 'Baru saja'
  if (elapsed < 3_600_000) return `${Math.max(1, Math.round(elapsed / 60_000))} menit lalu`
  if (elapsed < 86_400_000) return `${Math.max(1, Math.round(elapsed / 3_600_000))} jam lalu`
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function statusClass(status: TaskStatus) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function TaskDetailDrawer({ task, project, loading, closing = false, error, onClose, onOpenProject, onSave, onAddNote, onUploadAttachment, onDeleteAttachment }: TaskDetailDrawerProps) {
  const [draft, setDraft] = useState(() => taskDraft(task))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!loading) setDraft(taskDraft(task))
  }, [loading, task.id])

  const save = async () => {
    if (draft.name.trim().length < 2) {
      setLocalError('Nama task minimal 2 karakter.')
      return
    }
    try {
      setSaving(true)
      setLocalError('')
      setSavedMessage('')
      await onSave(task, draft)
      setSavedMessage('Perubahan tersimpan.')
    } catch (saveError) {
      setLocalError(saveError instanceof Error ? saveError.message : 'Detail task tidak dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!note.trim()) {
      setLocalError('Tulis catatan terlebih dahulu.')
      return
    }
    try {
      setAddingNote(true)
      setLocalError('')
      await onAddNote(task, note)
      setNote('')
    } catch (noteError) {
      setLocalError(noteError instanceof Error ? noteError.message : 'Catatan tidak dapat ditambahkan.')
    } finally {
      setAddingNote(false)
    }
  }

  const selectAttachment = async (file: File | null) => {
    if (!file) return
    try {
      setUploading(true)
      setLocalError('')
      await onUploadAttachment(task, file)
    } catch (uploadError) {
      setLocalError(uploadError instanceof Error ? uploadError.message : 'Lampiran tidak dapat diunggah.')
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = async (attachment: TaskAttachment) => {
    try {
      setLocalError('')
      await onDeleteAttachment(task, attachment)
    } catch (deleteError) {
      setLocalError(deleteError instanceof Error ? deleteError.message : 'Lampiran tidak dapat dihapus.')
    }
  }

  const notes = task.notes ?? []
  const attachments = task.attachments ?? []
  const taskProjectName = project?.name ?? task.project

  return (
    <aside className={`task-detail-drawer ${closing ? 'is-closing' : ''}`} role="dialog" aria-labelledby={`task-detail-${task.id}`}>
      <header className="task-detail-drawer-head">
        <div><p className="eyebrow">Detail task</p><button type="button" className="task-detail-project-link" onClick={() => project && onOpenProject(project.id)} disabled={!project}><FolderKanban size={14} /> {taskProjectName}<ChevronRight size={14} /></button></div>
        <button type="button" className="icon-button" aria-label="Tutup detail task" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="task-detail-scroll">
        <section className="task-detail-intro">
          <div className={`task-detail-status-icon ${statusClass(draft.status)}`}><CheckCircle2 size={20} /></div>
          <input id={`task-detail-${task.id}`} className="task-detail-title-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} aria-label="Nama task" />
          <p>{project?.client ? `Untuk ${project.client}` : 'Atur konteks, progres, dan semua bahan kerja task ini.'}</p>
        </section>

        {loading && <div className="task-detail-loading"><LoaderCircle size={16} className="is-spinning" /> Memuat detail task…</div>}
        {(error || localError) && <p className="task-detail-error" role="alert">{localError || error}</p>}

        <section className="task-detail-section task-detail-properties">
          <div className="task-detail-section-head"><div><p className="eyebrow">Properti</p><h3>Atur jalannya pekerjaan</h3></div></div>
          <div className="task-detail-property-grid">
            <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>Prioritas<select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as ProjectPriority }))}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label>Deadline<span className="task-detail-date-input"><CalendarDays size={15} /><input type="date" value={draft.dueAt ?? ''} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} /></span></label>
            <label className="task-detail-project-readonly">Project<span><FolderKanban size={15} /> {taskProjectName}</span></label>
          </div>
          <div className="task-detail-progress-editor"><div><span>Progress kerja</span><strong>{draft.progress}%</strong></div><ProgressBar value={draft.progress} compact /><input type="range" min="0" max="100" step="5" value={draft.progress} onChange={(event) => setDraft((current) => ({ ...current, progress: Number(event.target.value) }))} aria-label="Progress task" /></div>
          <label className="task-detail-client-toggle"><input type="checkbox" checked={draft.visibleToClient} onChange={(event) => setDraft((current) => ({ ...current, visibleToClient: event.target.checked }))} /><span><strong>Tampilkan di portal klien</strong><small>Task ini dapat dipantau pada portal proyek.</small></span></label>
        </section>

        <section className="task-detail-section">
          <div className="task-detail-section-head"><div><p className="eyebrow">Ringkasan</p><h3>Deskripsi task</h3></div></div>
          <textarea className="task-detail-textarea" rows={3} value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Jelaskan hasil yang ingin dicapai dari task ini…" />
        </section>

        <section className="task-detail-section">
          <div className="task-detail-section-head"><div><p className="eyebrow">Brief & referensi</p><h3>Ruang kerja task</h3><p>Simpan brief, tautan, arahan, atau informasi penting di satu tempat.</p></div><Link2 size={17} /></div>
          <textarea className="task-detail-textarea task-detail-brief" rows={7} value={draft.brief ?? ''} onChange={(event) => setDraft((current) => ({ ...current, brief: event.target.value }))} placeholder={'Contoh:\n• Goal dan output yang diharapkan\n• Tautan Figma / Drive / referensi\n• Catatan dari klien'} />
        </section>

        <section className="task-detail-section">
          <div className="task-detail-section-head"><div><p className="eyebrow">Catatan kerja</p><h3>Catatan & pembaruan</h3></div><span className="task-detail-count">{notes.length}</span></div>
          <div className="task-detail-note-composer"><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tulis update, keputusan, checklist, atau catatan bebas…" /><button type="button" className="secondary-button" onClick={() => { void addNote() }} disabled={addingNote || loading}>{addingNote ? <LoaderCircle size={15} className="is-spinning" /> : <Save size={15} />} {addingNote ? 'Menyimpan…' : 'Tambahkan catatan'}</button></div>
          <div className="task-detail-notes">{notes.length ? notes.map((item) => <article key={item.id}><span><CheckCircle2 size={14} /></span><div><p>{item.body}</p><small>{noteTime(item.createdAt)}</small></div></article>) : <p className="task-detail-empty">Belum ada catatan. Gunakan ruang ini untuk mencatat progres kerja dan keputusan penting.</p>}</div>
        </section>

        <section className="task-detail-section">
          <div className="task-detail-section-head"><div><p className="eyebrow">Lampiran</p><h3>Gambar, brief, dan file</h3><p>JPG, PNG, WebP, GIF, PDF, Office, TXT, atau ZIP hingga 15 MB.</p></div><span className="task-detail-count">{attachments.length}</span></div>
          <label className="task-detail-upload" htmlFor={`task-attachment-${task.id}`}><Upload size={17} /><span><strong>{uploading ? 'Mengunggah lampiran…' : 'Unggah lampiran'}</strong><small>Simpan file langsung pada task ini.</small></span><input id={`task-attachment-${task.id}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/zip,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx" disabled={uploading || loading} onChange={(event) => { void selectAttachment(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} /></label>
          <div className="task-detail-attachments">{attachments.length ? attachments.map((attachment) => {
            const image = attachment.mimeType.startsWith('image/')
            return <article key={attachment.id} className={image ? 'is-image' : ''}>{image && attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer" className="task-attachment-preview"><img src={attachment.url} alt={attachment.fileName} /></a> : <span className="task-attachment-icon">{image ? <Image size={18} /> : <FileText size={18} />}</span>}<div><a href={attachment.url} target="_blank" rel="noreferrer" title={attachment.fileName}>{attachment.fileName}</a><small>{attachmentSize(attachment.fileSize)} · {noteTime(attachment.createdAt)}</small></div><button type="button" aria-label={`Hapus lampiran ${attachment.fileName}`} title="Hapus lampiran" onClick={() => { void removeAttachment(attachment) }}><Trash2 size={15} /></button></article>
          }) : <p className="task-detail-empty"><Paperclip size={16} /> Belum ada lampiran untuk task ini.</p>}</div>
        </section>
      </div>

      <footer className="task-detail-footer"><span aria-live="polite">{savedMessage}</span><button type="button" className="primary-button" onClick={() => { void save() }} disabled={saving || loading}>{saving ? <LoaderCircle size={16} className="is-spinning" /> : <Save size={16} />} {saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></footer>
    </aside>
  )
}
