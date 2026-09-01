import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CircleDollarSign, FileText, Mail, MessageCircle, Pencil, StickyNote } from 'lucide-react'
import type { Client, ClientProfileFormData, Project } from '../types'
import { rupiah } from '../lib/format'
import { Avatar, ProgressBar, StatusChip } from '../components/ui'
import { ClientProfileFormModal } from '../components/ClientProfileFormModal'

interface ClientProfilePageProps {
  client: Client
  projects: Project[]
  onBack: () => void
  onOpenProject: (project: Project) => void
  onSaveProfile: (data: ClientProfileFormData, logoFile?: File | null) => void | Promise<void>
}

function clientWhatsappLink(whatsapp?: string) {
  const digits = whatsapp?.replace(/\D/g, '') ?? ''
  if (digits.length < 7) return null
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

export function ClientProfilePage({ client, projects, onBack, onOpenProject, onSaveProfile }: ClientProfilePageProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [logoAvailable, setLogoAvailable] = useState(Boolean(client.logoUrl))
  const clientProjects = projects.filter((project) => project.clientId === client.id || (!project.clientId && project.client === client.company))
  const whatsappLink = clientWhatsappLink(client.whatsapp)

  useEffect(() => {
    setLogoAvailable(Boolean(client.logoUrl))
  }, [client.logoUrl])

  return (
    <div className="module-page client-profile-page">
      <section className="project-detail-titlebar"><button type="button" className="back-button" onClick={onBack}><ArrowLeft size={17} /> Semua klien</button></section>
      <section className="client-profile-card">
        {logoAvailable && client.logoUrl ? <img className="client-profile-logo" src={client.logoUrl} alt={`Logo ${client.company}`} onError={() => setLogoAvailable(false)} /> : <Avatar initials={client.initials} variant={client.accent} size="lg" />}
        <div className="client-profile-summary"><p className="eyebrow">Profil klien</p><h1>{client.company}</h1><p>{client.name} · {client.status}</p></div>
        <div className="client-profile-actions">
          <button type="button" className="secondary-button" onClick={() => setEditorOpen(true)}><Pencil size={16} /> Edit profil</button>
          {whatsappLink
            ? <a className="secondary-button client-contact-button" href={whatsappLink} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
            : <button type="button" className="secondary-button client-contact-button" disabled title="Nomor WhatsApp klien belum tersedia."><MessageCircle size={16} /> WhatsApp belum diisi</button>}
        </div>
      </section>
      <section className="client-profile-stats">
        <article><span><BriefcaseBusiness size={19} /></span><div><small>Proyek</small><strong>{clientProjects.length}</strong></div></article>
        <article><span><CircleDollarSign size={19} /></span><div><small>Revenue tercatat</small><strong>{rupiah(client.revenue, true)}</strong></div></article>
        <article><span><ArrowUpRight size={19} /></span><div><small>Order terakhir</small><strong>{client.lastOrder}</strong></div></article>
      </section>
      <section className="detail-section client-information-section">
        <div className="detail-section-heading"><div><p className="eyebrow">Informasi</p><h2>Kontak & keterangan</h2></div><button type="button" className="soft-button" onClick={() => setEditorOpen(true)}><Pencil size={15} /> Edit</button></div>
        <div className="client-information-grid">
          <article><span><Mail size={17} /></span><div><small>Email</small>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <p>Belum diisi</p>}</div></article>
          <article><span><MessageCircle size={17} /></span><div><small>WhatsApp</small>{whatsappLink ? <a href={whatsappLink} target="_blank" rel="noreferrer">{client.whatsapp}</a> : <p>Belum diisi</p>}</div></article>
        </div>
        <div className="client-information-copy"><span><FileText size={17} /></span><div><small>Keterangan klien</small><p>{client.description || 'Belum ada keterangan. Tambahkan ringkasan bisnis atau konteks kerja sama.'}</p></div></div>
        <div className="client-information-copy notes"><span><StickyNote size={17} /></span><div><small>Catatan internal</small><p>{client.notes || 'Belum ada catatan internal untuk klien ini.'}</p></div></div>
      </section>
      <section className="detail-section client-projects-section">
        <div className="detail-section-heading"><div><p className="eyebrow">Proyek</p><h2>Riwayat kerja sama</h2></div><span>{clientProjects.length}</span></div>
        <div className="client-profile-projects">
          {clientProjects.length ? clientProjects.map((project) => (
            <button key={project.id} onClick={() => onOpenProject(project)}>
              <span className={'project-type-icon project-type-' + project.accent}>{project.type.slice(0, 1)}</span>
              <span><strong>{project.name}</strong><small>{project.code} · {project.type}</small></span>
              <span className="client-project-progress"><StatusChip status={project.status} /><ProgressBar value={project.progress} compact /></span>
              <ArrowUpRight size={17} />
            </button>
          )) : <p className="muted-copy">Belum ada proyek yang terhubung ke klien ini.</p>}
        </div>
      </section>
      {editorOpen && <ClientProfileFormModal client={client} onClose={() => setEditorOpen(false)} onSubmit={onSaveProfile} />}
    </div>
  )
}
