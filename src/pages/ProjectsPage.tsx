import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, Clock3, FileText, Filter, FolderPlus, Grid2X2, ListFilter, Pencil, Search, Share2, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Project, ProjectStatus } from '../types'
import { deadlineLabel, rupiah } from '../lib/format'
import { Avatar, PriorityDot, ProgressBar, StatusChip } from '../components/ui'

const statusOptions: Array<'All' | ProjectStatus> = ['All', 'Inquiry', 'Confirmed', 'In Progress', 'Review', 'Completed']

interface ProjectsPageProps {
  projects: Project[]
  onOpenProject: () => void
  onOpenOrderForms: () => void
  onViewProject: (project: Project) => void
  onOpenClientPortal: (project: Project) => void
  onEditProject: (project: Project) => void
  onDeleteProject: (project: Project) => void
}

export function ProjectsPage({ projects, onOpenProject, onOpenOrderForms, onViewProject, onOpenClientPortal, onEditProject, onDeleteProject }: ProjectsPageProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | ProjectStatus>('All')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => projects.filter((project) => {
    const queryMatches = `${project.name} ${project.client} ${project.type}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return queryMatches && (status === 'All' || project.status === status)
  }), [projects, query, status])

  return (
    <div className="module-page projects-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Project studio</p><h1>Projects</h1><p>Kelola alur kerja, deadline, dan hubungan klien dalam satu tempat.</p></div>
        <div className="page-title-actions"><button className="secondary-button" onClick={onOpenOrderForms}><FileText size={17} /> Form order</button><button className="primary-button" onClick={onOpenProject}><FolderPlus size={18} /> Proyek baru</button></div>
      </section>

      <section className="project-summary-strip">
        <div><span>Semua proyek</span><strong>{projects.length}</strong></div>
        <div><span>Berjalan</span><strong>{projects.filter((project) => ['In Progress', 'Review', 'Confirmed'].includes(project.status)).length}</strong></div>
        <div><span>Butuh perhatian</span><strong className="warning-text">2</strong></div>
        <div><span>Nilai pipeline</span><strong>{rupiah(projects.filter((project) => project.status !== 'Completed').reduce((total, project) => total + project.estimatedValue, 0), true)}</strong></div>
      </section>

      <section className="toolbar-card project-toolbar">
        <label className="input-with-icon"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari proyek atau klien..." /></label>
        <div className="toolbar-actions">
          <div className="segment-control" aria-label="Filter status proyek">
            <button className={status === 'All' ? 'active' : ''} onClick={() => setStatus('All')}>Semua</button>
            <button className={status === 'In Progress' ? 'active' : ''} onClick={() => setStatus('In Progress')}>Aktif</button>
            <button className={status === 'Review' ? 'active' : ''} onClick={() => setStatus('Review')}>Review</button>
          </div>
          <button className={`filter-button ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal size={17} /> Filter <ChevronDown size={15} /></button>
          <button className="view-toggle" aria-label="Tampilan kartu aktif"><Grid2X2 size={18} /><ListFilter size={18} /></button>
        </div>
      </section>

      {showFilters && (
        <section className="filter-panel">
          <span>Filter cepat</span>
          {statusOptions.map((option) => <button key={option} className={status === option ? 'active' : ''} onClick={() => setStatus(option)}>{option === 'All' ? 'Semua status' : option}</button>)}
          <button className="clear-filter" onClick={() => { setStatus('All'); setQuery('') }}>Bersihkan</button>
        </section>
      )}

      <section className="project-grid">
        {filtered.map((project) => {
          const hasPublicPortal = Boolean(project.publicSlug || project.publicCode || project.publicToken)
          return (
            <article key={project.id} className={`project-card project-card-${project.accent}`}>
              <div className="project-card-top">
                <span className={`project-type-icon project-type-${project.accent}`}>{project.type.slice(0, 1)}</span>
                <div className="project-card-actions">
                  <PriorityDot priority={project.priority} />
                  <button className="card-action-button" onClick={() => onEditProject(project)} aria-label={`Edit ${project.name}`} title="Edit proyek"><Pencil size={14} /></button>
                  <button className="card-action-button card-action-danger" onClick={() => onDeleteProject(project)} aria-label={`Hapus ${project.name}`} title="Hapus proyek"><Trash2 size={14} /></button>
                  <button className="more-card-button" onClick={() => onViewProject(project)} aria-label={`Buka ${project.name}`} title="Buka detail"><ArrowUpRight size={17} /></button>
                </div>
              </div>
              <div className="project-card-heading"><div><p>{project.code} · {project.type}</p><h2>{project.name}</h2></div><StatusChip status={project.status} /></div>
              <div className="project-card-client"><Avatar initials={project.client.split(' ').map((word) => word[0]).join('').slice(0, 2)} variant={project.accent} size="sm" /><span>{project.client}</span></div>
              <ProgressBar value={project.progress} label="Progress" />
              <div className="project-card-meta"><span><Clock3 size={15} /> {deadlineLabel(project.dueDate)}</span><strong>{rupiah(project.estimatedValue, true)}</strong></div>
              <div className="project-card-footer">
                <button onClick={() => onViewProject(project)}>Lihat detail</button>
                {hasPublicPortal ? <button className="share-link" onClick={() => onOpenClientPortal(project)}><Share2 size={15} /> Preview</button> : <span className="private-label"><Filter size={14} /> Privat</span>}
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && (
          <div className="empty-state"><span className="empty-icon"><Search size={24} /></span><strong>Tidak ada proyek yang cocok</strong><p>Ubah kata kunci atau filter untuk melihat proyek lain.</p><button className="soft-button" onClick={() => { setStatus('All'); setQuery('') }}>Bersihkan pencarian</button></div>
        )}
        <button className="new-project-card" onClick={onOpenProject}><span><FolderPlus size={22} /></span><strong>Mulai proyek baru</strong><p>Simpan brief, deadline, dan nilai proyek dalam satu alur.</p></button>
      </section>
    </div>
  )
}
