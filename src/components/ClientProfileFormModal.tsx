import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Building2, CheckCircle2, ChevronDown, FileText, ImageUp, Mail, MessageCircle, PencilLine, StickyNote, UserRound } from 'lucide-react'
import type { Client, ClientProfileFormData } from '../types'
import { sanitizeUserMessage } from '../lib/userMessage'
import { Avatar, Modal } from './ui'

interface ClientProfileFormModalProps {
  client: Client
  onClose: () => void
  onSubmit: (data: ClientProfileFormData, logoFile?: File | null) => void | Promise<void>
}

const acceptedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxLogoBytes = 5 * 1024 * 1024

export function ClientProfileFormModal({ client, onClose, onSubmit }: ClientProfileFormModalProps) {
  const [name, setName] = useState(client.name)
  const [company, setCompany] = useState(client.company)
  const [email, setEmail] = useState(client.email ?? '')
  const [whatsapp, setWhatsapp] = useState(client.whatsapp ?? '')
  const [status, setStatus] = useState<ClientProfileFormData['status']>(client.status)
  const [description, setDescription] = useState(client.description ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(client.logoUrl ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  const selectLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!acceptedLogoTypes.has(file.type)) {
      setError('Gunakan gambar JPG, PNG, atau WebP untuk logo klien.')
      event.target.value = ''
      return
    }
    if (file.size > maxLogoBytes) {
      setError('Ukuran logo klien maksimal 5 MB.')
      event.target.value = ''
      return
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    setPreviewUrl(objectUrl.current)
    setLogoFile(file)
    setError('')
  }

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
        description: description.trim(),
        notes: notes.trim(),
      }, logoFile)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? sanitizeUserMessage(saveError.message) : 'Profil klien tidak dapat disimpan.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Edit profil klien" onClose={onClose} wide>
      <form className="project-form client-profile-form" onSubmit={submit}>
        <div className="form-intro"><span className="form-intro-icon"><PencilLine size={19} /></span><p>Lengkapi kontak, informasi brand, dan catatan internal. Perubahan langsung terhubung ke profil dan proyek klien.</p></div>
        <section className="client-logo-editor">
          <span className="client-logo-editor-preview">{previewUrl ? <img src={previewUrl} alt="Pratinjau logo klien" /> : <Avatar initials={client.initials} variant={client.accent} size="lg" />}</span>
          <div><strong>Logo klien</strong><p>Opsional untuk brand. Tanpa logo, profil tetap memakai inisial seperti sekarang.</p><label className="soft-button client-logo-upload"><ImageUp size={16} /> Upload logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectLogo} aria-label="Upload logo klien" /></label><small>{logoFile ? logoFile.name : 'JPG, PNG, atau WebP · maksimal 5 MB'}</small></div>
        </section>
        <div className="form-grid">
          <label className="form-field"><span><UserRound size={15} /> Nama lengkap <b>*</b></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Salsa Rahmi" /></label>
          <label className="form-field"><span><Building2 size={15} /> Perusahaan / brand</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Contoh: Kala Ventures" /></label>
          <label className="form-field"><span><Mail size={15} /> Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" /></label>
          <label className="form-field"><span><MessageCircle size={15} /> WhatsApp</span><input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xx xxxx xxxx" /></label>
          <label className="form-field"><span>Status</span><span className="select-wrap"><select value={status} onChange={(event) => setStatus(event.target.value as ClientProfileFormData['status'])}><option>Lead</option><option>Active</option><option>Returning</option><option>Inactive</option></select><ChevronDown size={16} /></span></label>
          <label className="form-field form-field-full"><span><FileText size={15} /> Keterangan klien</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Ringkasan bisnis, layanan, atau konteks kerja sama klien." /></label>
          <label className="form-field form-field-full"><span><StickyNote size={15} /> Catatan internal</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Preferensi komunikasi, detail penting, atau catatan tim." /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Batal</button><button type="submit" className="primary-button" disabled={submitting}><CheckCircle2 size={18} /> {submitting ? 'Menyimpan…' : 'Simpan profil'}</button></div>
      </form>
    </Modal>
  )
}
