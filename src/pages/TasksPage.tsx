import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, ListFilter, Plus, Trash2, X } from 'lucide-react'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import type { Project, ProjectPriority, Task, TaskAttachment, TaskDetailInput, TaskStatus } from '../types'

type TaskFilter = 'All' | TaskStatus

interface TaskCreateInput {
  name: string
  description?: string
  dueAt?: string
  priority: ProjectPriority
  visibleToClient: boolean
}

interface TasksPageProps {
  projects: Project[]
  tasks: Task[]
  onAddTask: (project: Project, input: TaskCreateInput) => Promise<void>
  onUpdateTask: (task: Task, status: TaskStatus) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
  onOpenProject: (projectId: string) => void
  onLoadTaskDetail: (task: Task) => Promise<Task>
  onSaveTaskDetail: (task: Task, input: TaskDetailInput) => Promise<Task>
  onAddTaskNote: (task: Task, body: string) => Promise<void>
  onUploadTaskAttachment: (task: Task, file: File) => Promise<void>
  onDeleteTaskAttachment: (task: Task, attachment: TaskAttachment) => Promise<void>
}

const taskFilters: TaskFilter[] = ['All', 'Todo', 'In Progress', 'Review', 'Completed']
const taskPriorities: ProjectPriority[] = ['Low', 'Medium', 'High', 'Urgent']
const taskStatuses: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Completed']

function statusClass(status: TaskStatus) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

function priorityClass(priority: ProjectPriority) {
  return priority.toLowerCase()
}

function taskTime(task: Task) {
  return task.dueAt ? task.due : 'Belum dijadwalkan'
}

export function TasksPage({ projects, tasks, onAddTask, onUpdateTask, onDeleteTask, onOpenProject, onLoadTaskDetail, onSaveTaskDetail, onAddTaskNote, onUploadTaskAttachment, onDeleteTaskAttachment }: TasksPageProps) {
  const [showComposer, setShowComposer] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState<ProjectPriority>('Medium')
  const [visibleToClient, setVisibleToClient] = useState(true)
  const [filter, setFilter] = useState<TaskFilter>('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [formError, setFormError] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailClosing, setDetailClosing] = useState(false)
  const detailCloseTimer = useRef<number | null>(null)

  useEffect(() => {
    setProjectId((current) => projects.some((project) => project.id === current) ? current : projects[0]?.id ?? '')
    setProjectFilter((current) => current === 'All' || projects.some((project) => project.id === current) ? current : 'All')
  }, [projects])

  const closeComposer = () => {
    setShowComposer(false)
    setFormError('')
  }

  useEffect(() => {
    if (!showComposer) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeComposer()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showComposer])

  const closeTaskDetail = () => {
    if (!selectedTaskId || detailClosing) return
    setDetailClosing(true)
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current)
    detailCloseTimer.current = window.setTimeout(() => {
      setSelectedTaskId('')
      setDetailClosing(false)
      setDetailError('')
      detailCloseTimer.current = null
    }, 200)
  }

  useEffect(() => () => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current)
  }, [])

  useEffect(() => {
    if (!selectedTaskId || detailClosing) return
    document.body.classList.add('task-detail-open')
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTaskDetail()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.classList.remove('task-detail-open')
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [detailClosing, selectedTaskId])

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) closeTaskDetail()
  }, [selectedTaskId, tasks])

  const activeTasks = tasks.filter((task) => task.status !== 'Completed')
  const clientVisibleTasks = tasks.filter((task) => task.visibleToClient)
  const listedTasks = useMemo(() => tasks
    .filter((task) => filter === 'All' || task.status === filter)
    .filter((task) => projectFilter === 'All' || task.projectId === projectFilter)
    .sort((left, right) => {
      const leftCompleted = left.status === 'Completed' ? 1 : 0
      const rightCompleted = right.status === 'Completed' ? 1 : 0
      if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      return leftDue - rightDue
    }), [filter, projectFilter, tasks])

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const selectedProject = selectedTask
    ? projects.find((project) => project.id === selectedTask.projectId) ?? projects.find((project) => project.name === selectedTask.project)
    : undefined

  const openTaskDetail = async (task: Task) => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current)
    detailCloseTimer.current = null
    setDetailClosing(false)
    setSelectedTaskId(task.id)
    setDetailError('')
    try {
      setDetailLoading(true)
      await onLoadTaskDetail(task)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Detail task tidak dapat dimuat.')
    } finally {
      setDetailLoading(false)
    }
  }

  const openComposer = () => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current)
    detailCloseTimer.current = null
    setSelectedTaskId('')
    setDetailClosing(false)
    setDetailError('')
    setShowComposer(true)
    setFormError('')
  }

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      setFormError('Pilih proyek tujuan tugas terlebih dahulu.')
      return
    }
    if (taskName.trim().length < 2) {
      setFormError('Nama tugas minimal 2 karakter.')
      return
    }
    try {
      setSaving(true)
      setFormError('')
      await onAddTask(project, {
        name: taskName.trim(),
        description: description.trim() || undefined,
        dueAt: dueAt || undefined,
        priority,
        visibleToClient,
      })
      setTaskName('')
      setDescription('')
      setDueAt('')
      setPriority('Medium')
      setVisibleToClient(true)
      setShowComposer(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Tugas tidak dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (task: Task, status: TaskStatus) => {
    try {
      setUpdatingId(task.id)
      await onUpdateTask(task, status)
    } finally {
      setUpdatingId('')
    }
  }

  const deleteTask = async (task: Task) => {
    try {
      setDeletingId(task.id)
      await onDeleteTask(task)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="module-page tasks-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Workspace tasks</p><h1>Tasks</h1><p>Kelola seluruh tugas dari setiap proyek dalam satu daftar kerja yang fokus.</p></div>
        <button className="primary-button" onClick={openComposer} disabled={!projects.length}><Plus size={18} /> Tambah task</button>
      </section>

      <section className="task-overview-grid">
        <article><small>Semua task</small><strong>{tasks.length}</strong><span>Di seluruh proyek</span></article>
        <article className="active"><small>Belum selesai</small><strong>{activeTasks.length}</strong><span>Perlu ditindaklanjuti</span></article>
        <article><small>Terlihat klien</small><strong>{clientVisibleTasks.length}</strong><span>Tampil di portal proyek</span></article>
      </section>

      {showComposer && <div className="task-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer() }}>
        <form className="task-composer task-drawer" onSubmit={submitTask} role="dialog" aria-modal="true" aria-labelledby="task-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="task-composer-head"><div><p className="eyebrow">Task baru</p><h2 id="task-drawer-title">Tambahkan ke proyek</h2><p>Task ini akan langsung muncul di detail proyek yang Anda pilih.</p></div><button type="button" className="icon-button" aria-label="Tutup form task" onClick={closeComposer}><X size={17} /></button></div>
          <div className="task-composer-grid">
            <label>Proyek<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.client}</option>)}</select></label>
            <label>Nama task<input autoFocus value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="Contoh: Kirim revisi desain" /></label>
            <label>Deadline<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <label>Prioritas<select value={priority} onChange={(event) => setPriority(event.target.value as ProjectPriority)}>{taskPriorities.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="task-composer-wide">Keterangan<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Catatan, output yang diharapkan, atau konteks pekerjaan…" /></label>
          </div>
          <footer><label className="task-visibility-toggle"><input type="checkbox" checked={visibleToClient} onChange={(event) => setVisibleToClient(event.target.checked)} /> Tampilkan task ini di portal klien</label>{formError && <p className="form-error">{formError}</p>}<div><button type="button" className="secondary-button" onClick={closeComposer}>Batal</button><button className="primary-button" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan task'}</button></div></footer>
        </form>
      </div>}

      <section className="task-list-card">
        <header className="task-list-head"><div><p className="eyebrow">Task database</p><h2>Daftar kerja</h2></div><div className="task-list-filters"><div className="task-filter-tabs" aria-label="Filter status task">{taskFilters.map((item) => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'All' ? 'Semua' : item}</button>)}</div><label className="task-project-filter"><ListFilter size={15} /><span className="visually-hidden">Filter proyek</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="All">Semua proyek</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div></header>
        <div className="task-notion-table">
          <div className="task-notion-head" aria-hidden="true"><span /><span>Task</span><span>Proyek</span><span>Deadline</span><span>Prioritas</span><span>Status</span><span>Akses</span><span>Aksi</span></div>
          {listedTasks.map((task) => {
            const linkedProject = projects.find((project) => project.id === task.projectId) ?? projects.find((project) => project.name === task.project)
            const completed = task.status === 'Completed'
            const isBusy = updatingId === task.id || deletingId === task.id
            return <article key={task.id} className={`task-notion-row task-notion-row-clickable ${completed ? 'is-complete' : ''} ${selectedTaskId === task.id ? 'is-selected' : ''}`} role="button" tabIndex={0} onClick={() => { void openTaskDetail(task) }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void openTaskDetail(task) } }}>
              <button type="button" className="task-list-check" onClick={(event) => { event.stopPropagation(); void updateStatus(task, completed ? 'Todo' : 'Completed') }} aria-label={completed ? `Tandai ${task.name} belum selesai` : `Tandai ${task.name} selesai`} disabled={isBusy}><CheckCircle2 size={18} /></button>
              <div className="task-list-title"><strong>{task.name}</strong>{task.description && <p>{task.description}</p>}</div>
              <button type="button" className="task-list-project" onClick={(event) => { event.stopPropagation(); if (linkedProject) onOpenProject(linkedProject.id) }} disabled={!linkedProject}>{linkedProject?.name ?? task.project}<ChevronRight size={14} /></button>
              <span className={`task-list-due ${task.dueAt ? '' : 'muted'}`}><CalendarDays size={14} /> {taskTime(task)}</span>
              <span className={`task-list-priority ${priorityClass(task.priority)}`}>{task.priority}</span>
              <label className="task-list-status" onClick={(event) => event.stopPropagation()}><span className="visually-hidden">Status {task.name}</span><select value={task.status} onChange={(event) => { void updateStatus(task, event.target.value as TaskStatus) }} disabled={isBusy} className={statusClass(task.status)}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <span className={task.visibleToClient ? 'task-list-visibility client' : 'task-list-visibility'}>{task.visibleToClient ? 'Klien' : 'Internal'}</span>
              <div className="task-list-actions"><button type="button" className="task-list-delete" onClick={(event) => { event.stopPropagation(); void deleteTask(task) }} disabled={isBusy} aria-label={`Hapus task ${task.name}`} title={`Hapus task ${task.name}`}><Trash2 size={15} /></button></div>
            </article>
          })}
          {!listedTasks.length && <div className="task-list-empty"><CheckCircle2 size={23} /><div><strong>{tasks.length ? 'Tidak ada task pada filter ini' : 'Belum ada task'}</strong><p>{tasks.length ? 'Ubah filter untuk melihat tugas lain.' : 'Tambahkan task pertama untuk memulai daftar kerja.'}</p></div></div>}
        </div>
      </section>

      {selectedTask && <TaskDetailDrawer key={selectedTask.id} task={selectedTask} project={selectedProject} loading={detailLoading} closing={detailClosing} error={detailError} onClose={closeTaskDetail} onOpenProject={onOpenProject} onSave={onSaveTaskDetail} onAddNote={onAddTaskNote} onUploadAttachment={onUploadTaskAttachment} onDeleteAttachment={onDeleteTaskAttachment} />}
    </div>
  )
}
