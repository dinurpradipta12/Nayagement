import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Command, FileText, FolderKanban, Search, UsersRound } from 'lucide-react'
import type { Client, Project } from '../types'
import { Modal } from './ui'

interface SearchModalProps {
  projects: Project[]
  clients: Client[]
  onClose: () => void
  onOpenProject: (project: Project) => void
  onOpenRoute: (route: 'projects' | 'clients' | 'invoices') => void
}

export function SearchModal({ projects, clients, onClose, onOpenProject, onOpenRoute }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const normalized = query.toLowerCase()
    return {
      projects: projects.filter((project) => `${project.name} ${project.client}`.toLowerCase().includes(normalized)).slice(0, 3),
      clients: clients.filter((client) => `${client.name} ${client.company}`.toLowerCase().includes(normalized)).slice(0, 2),
    }
  }, [clients, projects, query])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => document.getElementById('global-search')?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <Modal title="Cari di Nayagement" onClose={onClose}>
      <div className="command-modal">
        <label className="command-search"><Search size={20} /><input id="global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari proyek, klien, atau invoice..." /><kbd>esc</kbd></label>
        <p className="command-label">Akses cepat</p>
        <div className="command-quick-actions"><button onClick={() => onOpenRoute('projects')}><FolderKanban size={18} /> Semua proyek <ArrowRight size={15} /></button><button onClick={() => onOpenRoute('clients')}><UsersRound size={18} /> Database klien <ArrowRight size={15} /></button><button onClick={() => onOpenRoute('invoices')}><FileText size={18} /> Invoice terbuka <ArrowRight size={15} /></button></div>
        <p className="command-label">Hasil pencarian</p>
        <div className="command-results">
          {results.projects.map((project) => <button key={project.id} onClick={() => onOpenProject(project)}><span className="command-result-icon icon-project"><FolderKanban size={17} /></span><span><strong>{project.name}</strong><small>{project.client} · {project.status}</small></span><ArrowRight size={15} /></button>)}
          {results.clients.map((client) => <button key={client.id} onClick={() => onOpenRoute('clients')}><span className="command-result-icon icon-client"><UsersRound size={17} /></span><span><strong>{client.company}</strong><small>{client.name} · {client.status}</small></span><ArrowRight size={15} /></button>)}
          {!results.projects.length && !results.clients.length && <div className="command-empty"><Command size={23} /><strong>Tidak ada hasil untuk “{query}”</strong><p>Coba nama proyek atau perusahaan lain.</p></div>}
        </div>
      </div>
    </Modal>
  )
}
