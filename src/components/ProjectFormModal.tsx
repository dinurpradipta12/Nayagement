import { useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, FileText, UserRound } from 'lucide-react'
import type { Project, ProjectFormData, ProjectPriority, ProjectStatus } from '../types'
import { sanitizeUserMessage } from '../lib/userMessage'
import { Modal } from './ui'

interface ProjectFormModalProps {
  onClose: () => void
  onSubmit: (data: ProjectFormData) => void | Promise<void>
  project?: Project | null
}

export function ProjectFormModal({ onClose, onSubmit, project }: ProjectFormModalProps) {
  const editing = Boolean(project)
  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [type, setType] = useState(project?.type ?? 'Branding')
  const [dueDate, setDueDate] = useState(project?.dueDate ?? '2026-09-05')
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority ?? 'Medium')
  const [value, setValue] = useState(String(project?.estimatedValue ?? 5000000))
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'Inquiry')
  const [progress, setProgress] = useState(String(project?.progress ?? 0))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !client.trim()) {
      setError('Nama proyek dan klien perlu diisi terlebih dahulu.')
      return
    }
    try {
      setSubmitting(true)
      setError('')
      await onSubmit({
        name: name.trim(),
        client: client.trim(),
        type,
        dueDate,
        priority,
        value: Number(value.replace(/[^0-9]/g, '')) || 0,
        description: description.trim() || 'Brief proyek baru.',
        status,
        progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      })
    } catch (createError) {
      setError(createError instanceof Error ? sanitizeUserMessage(createError.message) : editing ? 'Proyek tidak dapat diperbarui.' : 'Proyek tidak dapat dibuat.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit proyek' : 'Buat proyek baru'} onClose={onClose} wide>
      <form className="project-form" onSubmit={submit}>
        <div className="form-intro"><span className="form-intro-icon"><FileText size={19} /></span><p>{editing ? 'Perbarui detail, status, dan kemajuan proyek. Perubahan akan langsung tersimpan ke workspace.' : 'Mulai dari informasi inti. Detail, tugas, dan portal klien dapat ditambahkan setelah proyek dibuat.'}</p></div>
        <div className="form-grid">
          <label className="form-field form-field-full"><span>Nama proyek <b>*</b></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Rebranding Karya Rupa" /></label>
          <label className="form-field"><span><UserRound size={15} /> Klien <b>*</b></span><input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Nama klien atau perusahaan" /></label>
          <label className="form-field"><span>Tipe proyek</span><span className="select-wrap"><select value={type} onChange={(event) => setType(event.target.value)}><option>Branding</option><option>Social Media</option><option>Spreadsheet Custom</option><option>Website</option><option>Consulting</option><option>Presentation</option><option>Content</option></select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span><CalendarDays size={15} /> Deadline</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label className="form-field"><span>Prioritas</span><span className="select-wrap"><select value={priority} onChange={(event) => setPriority(event.target.value as ProjectPriority)}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select><ChevronDown size={16} /></span></label>
          {editing && <label className="form-field"><span>Status</span><span className="select-wrap"><select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}><option>Inquiry</option><option>Pending</option><option>Confirmed</option><option>In Progress</option><option>Review</option><option>Revision</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={16} /></span></label>}
          {editing && <label className="form-field"><span>Progress (%)</span><input inputMode="numeric" min="0" max="100" type="number" value={progress} onChange={(event) => setProgress(event.target.value)} /></label>}
          <label className="form-field form-field-full"><span><CircleDollarSign size={15} /> Nilai estimasi</span><div className="currency-input"><span>Rp</span><input inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" /></div></label>
          <label className="form-field form-field-full"><span>Ringkasan brief</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Apa hasil yang diharapkan dari proyek ini?" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Batal</button><button type="submit" className="primary-button" disabled={submitting}><CheckCircle2 size={18} /> {submitting ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Buat proyek'}</button></div>
      </form>
    </Modal>
  )
}
