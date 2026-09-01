import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, Clock3, FileText, Filter, FolderPlus, Grid2X2, ListFilter, Pencil, Search, Share2, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Project, ProjectStatus } from '../types'
import { deadlineLabel, rupiah } from '../lib/format'
import { Avatar, PriorityDot, ProgressBar, StatusChip } from '../components/ui'
import brandingIcon from '../projects-icon/branding.png'
import consultingIcon from '../projects-icon/consulting.png'
import contentIcon from '../projects-icon/content.png'
import customSheetsIcon from '../projects-icon/custom-sheets.png'
import socialMediaIcon from '../projects-icon/social-media.png'
import websiteIcon from '../projects-icon/website.png'

const statusOptions: Array<'All' | ProjectStatus> = ['All', 'Inquiry', 'Confirmed', 'In Progress', 'Review', 'Completed']

function projectIcon(type: string) {
  const normalizedType = type.trim().toLocaleLowerCase()

  if (normalizedType.includes('spreadsheet') || normalizedType.includes('sheet')) return customSheetsIcon
  if (normalizedType.includes('social')) return socialMediaIcon
  if (normalizedType.includes('website') || normalizedType === 'web') return websiteIcon
  if (normalizedType.includes('consult')) return consultingIcon
  if (normalizedType.includes('brand')) return brandingIcon
  if (normalizedType.includes('content') || normalizedType.includes('presentation')) return contentIcon

  return contentIcon
}

function ProjectTypeIcon({ type }: { type: string }) {
  return <span className="project-type-icon project-type-image" aria-hidden="true"><img src={projectIcon(type)} alt="" /></span>
}

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
  const [view, setView] = useState<'card' | 'list'>('card')

  const filtered = useMemo(() => projects.filter((project) => {
    const queryMatches = `${project.name} ${project.client} ${project.type}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return queryMatches && (status === 'All' || project.status === status)
  }), [projects, query, status])
  const attentionCount = projects.filter((project) => ['Inquiry', 'Pending', 'Review', 'Revision'].includes(project.status)
    || (!['Completed', 'Cancelled'].includes(project.status) && new Date(`${project.dueDate}T23:59:59`).getTime() < Date.now())).length

  return (
    <div className="module-page projects-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Project studio</p><h1>Projects</h1><p>Kelola alur kerja, deadline, dan hubungan klien dalam satu tempat.</p></div>
        <div className="page-title-actions"><button className="secondary-button" onClick={onOpenOrderForms}><FileText size={17} /> Form order</button><button className="primary-button" onClick={onOpenProject}><FolderPlus size={18} /> Proyek baru</button></div>
      </section>

      <section className="project-summary-strip">
        <div><span>Semua proyek</span><strong>{projects.length}</strong></div>
        <div><span>Berjalan</span><strong>{projects.filter((project) => ['In Progress', 'Review', 'Confirmed'].includes(project.status)).length}</strong></div>
        <div><span>Butuh perhatian</span><strong className="warning-text">{attentionCount}</strong></div>
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
          <div className="view-toggle" role="group" aria-label="Ubah tampilan proyek"><button type="button" className={view === 'card' ? 'active' : ''} onClick={() => setView('card')} aria-label="Tampilan kartu" aria-pressed={view === 'card'} title="Tampilan kartu"><Grid2X2 size={18} /></button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Tampilan daftar" aria-pressed={view === 'list'} title="Tampilan daftar"><ListFilter size={18} /></button></div>
        </div>
      </section>

      {showFilters && (
        <section className="filter-panel">
          <span>Filter cepat</span>
          {statusOptions.map((option) => <button key={option} className={status === option ? 'active' : ''} onClick={() => setStatus(option)}>{option === 'All' ? 'Semua status' : option}</button>)}
          <button className="clear-filter" onClick={() => { setStatus('All'); setQuery('') }}>Bersihkan</button>
        </section>
      )}

      <section className={`project-grid ${view === 'list' ? 'project-grid-list' : ''}`}>
        {filtered.map((project) => {
          const hasPublicPortal = Boolean(project.publicSlug || project.publicCode || project.publicToken)
          if (view === 'list') return (
            <article key={project.id} className="project-list-item">
              <ProjectTypeIcon type={project.type} />
              <button className="project-list-main" onClick={() => onViewProject(project)}>
                <span><small>{project.code} · {project.type}</small><strong>{project.name}</strong></span>
                <span className="project-list-client"><Avatar initials={project.client.split(' ').map((word) => word[0]).join('').slice(0, 2)} variant={project.accent} size="sm" /> {project.client}</span>
                <span className="project-list-progress"><ProgressBar value={project.progress} /><small>{project.progress}%</small></span>
                <span className="project-list-meta"><StatusChip status={project.status} /><small><Clock3 size={14} /> {deadlineLabel(project.dueDate)}</small><strong>{rupiah(project.estimatedValue, true)}</strong></span>
              </button>
              <span className="project-list-actions"><PriorityDot priority={project.priority} /><button onClick={() => onEditProject(project)} aria-label={`Edit ${project.name}`} title="Edit proyek"><Pencil size={15} /></button><button className="danger" onClick={() => onDeleteProject(project)} aria-label={`Hapus ${project.name}`} title="Hapus proyek"><Trash2 size={15} /></button>{hasPublicPortal && <button onClick={() => onOpenClientPortal(project)} aria-label={`Preview ${project.name}`} title="Preview portal"><Share2 size={15} /></button>}<button onClick={() => onViewProject(project)} aria-label={`Buka ${project.name}`} title="Buka detail"><ArrowUpRight size={16} /></button></span>
            </article>
          )
          return (
            <article key={project.id} className={`project-card project-card-${project.accent}`}>
              <div className="project-card-top">
                <ProjectTypeIcon type={project.type} />
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
      </section>
    </div>
  )
}
