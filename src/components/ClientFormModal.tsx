import { useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, ChevronDown, Mail, MessageCircle, StickyNote, UserRound } from 'lucide-react'
import type { ClientFormData } from '../types'
import { sanitizeUserMessage } from '../lib/userMessage'
import { Modal } from './ui'

interface ClientFormModalProps {
  onClose: () => void
  onSubmit: (data: ClientFormData) => void | Promise<void>
}

export function ClientFormModal({ onClose, onSubmit }: ClientFormModalProps) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [status, setStatus] = useState<ClientFormData['status']>('Lead')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Nama klien perlu diisi minimal 2 karakter.')
      return
    }
    try {
      setSubmitting(true)
      setError('')
      await onSubmit({
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        status,
        notes: notes.trim(),
      })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? sanitizeUserMessage(submitError.message) : 'Klien tidak dapat disimpan.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Tambah klien" onClose={onClose}>
      <form className="project-form client-form" onSubmit={submit}>
        <div className="form-intro"><span className="form-intro-icon"><UserRound size={19} /></span><p>Tambahkan kontak klien secara manual. Klien akan langsung tersedia saat membuat proyek dan di halaman Clients.</p></div>
        <div className="form-grid">
          <label className="form-field"><span><UserRound size={15} /> Nama lengkap <b>*</b></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Aulia Rahma" /></label>
          <label className="form-field"><span><Building2 size={15} /> Perusahaan / brand</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Contoh: Aurora Studio" /></label>
          <label className="form-field"><span><Mail size={15} /> Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" /></label>
          <label className="form-field"><span><MessageCircle size={15} /> WhatsApp</span><input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xx xxxx xxxx" /></label>
          <label className="form-field"><span>Status</span><span className="select-wrap"><select value={status} onChange={(event) => setStatus(event.target.value as ClientFormData['status'])}><option>Lead</option><option>Active</option><option>Returning</option><option>Inactive</option></select><ChevronDown size={16} /></span></label>
          <label className="form-field form-field-full"><span><StickyNote size={15} /> Catatan internal</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Tambahkan konteks awal, kebutuhan, atau preferensi komunikasi klien." /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Batal</button><button type="submit" className="primary-button" disabled={submitting}><CheckCircle2 size={18} /> {submitting ? 'Menyimpan…' : 'Simpan klien'}</button></div>
      </form>
    </Modal>
  )
}
