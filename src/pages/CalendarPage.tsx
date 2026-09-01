import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ListTodo, Plus } from 'lucide-react'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import type { ConsultationBooking, Project, Task, TaskAttachment, TaskDetailInput, TimelineItem } from '../types'

type CalendarView = 'month' | 'week' | 'day'

interface CalendarTaskEvent {
  task: Task
  date: Date
  dateKey: string
  project?: Project
  consultationBooking?: ConsultationBooking
  timelineItem?: TimelineItem
}

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function dateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, amount: number) {
  const next = startOfDay(value)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function startOfWeek(value: Date) {
  return addDays(value, -(value.getDay() + 6) % 7)
}

function sameDay(left: Date, right: Date) {
  return dateKey(left) === dateKey(right)
}

function formatTime(value: Date) {
  return timeFormatter.format(value).replace('.', ':')
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function taskDate(task: Task) {
  if (!task.dueAt) return null
  const parsed = new Date(task.dueAt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function eventAccent(event: CalendarTaskEvent) {
  return event.consultationBooking ? 'violet' : event.timelineItem ? 'mint' : event.project?.accent ?? 'blue'
}

function monthCells(value: Date) {
  const firstDay = new Date(value.getFullYear(), value.getMonth(), 1)
  const leadingDays = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  return Array.from({ length: totalCells }, (_, index) => addDays(firstDay, index - leadingDays))
}

function rangeLabel(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const sameYear = start.getFullYear() === end.getFullYear()
  const startText = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: sameMonth ? undefined : 'short', year: sameYear ? undefined : 'numeric' }).format(start)
  const endText = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(end)
  return `${startText} – ${endText}`
}

interface CalendarPageProps {
  projects: Project[]
  tasks: Task[]
  timelines: Record<string, TimelineItem[]>
  consultationBookings: ConsultationBooking[]
  onCreateProject: () => void
  onOpenProject: (projectId: string) => void
  onOpenConsultations: () => void
  onLoadTaskDetail: (task: Task) => Promise<Task>
  onSaveTaskDetail: (task: Task, input: TaskDetailInput) => Promise<Task>
  onAddTaskNote: (task: Task, body: string) => Promise<void>
  onUploadTaskAttachment: (task: Task, file: File) => Promise<void>
  onDeleteTaskAttachment: (task: Task, attachment: TaskAttachment) => Promise<void>
}

export function CalendarPage({ projects, tasks, timelines, consultationBookings, onCreateProject, onOpenProject, onOpenConsultations, onLoadTaskDetail, onSaveTaskDetail, onAddTaskNote, onUploadTaskAttachment, onDeleteTaskAttachment }: CalendarPageProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [view, setView] = useState<CalendarView>('month')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailClosing, setDetailClosing] = useState(false)
  const detailCloseTimer = useRef<number | null>(null)

  const scheduledTasks = useMemo<CalendarTaskEvent[]>(() => {
    const taskEvents = tasks.flatMap((task) => {
    const date = taskDate(task)
    if (!date) return []
    const project = projects.find((item) => item.id === task.projectId) ?? projects.find((item) => item.name === task.project)
    return [{ task, date, dateKey: dateKey(date), project }]
    })
    const bookingEvents = consultationBookings.filter((booking) => booking.status !== 'Cancelled').flatMap((booking) => {
      const date = new Date(booking.startsAt)
      if (Number.isNaN(date.getTime())) return []
      const task: Task = { id: `consultation-${booking.id}`, name: `Konsultasi: ${booking.name}`, project: 'Booking konsultasi', due: booking.startsAt, dueAt: booking.startsAt, description: booking.topic, status: booking.status === 'Completed' ? 'Completed' : booking.status === 'Confirmed' ? 'In Progress' : 'Todo', priority: 'Medium', visibleToClient: false }
      return [{ task, date, dateKey: dateKey(date), consultationBooking: booking }]
    })
    const timelineEvents = Object.entries(timelines).flatMap(([projectId, items]) => {
      const project = projects.find((item) => item.id === projectId)
      return items.flatMap((item, index) => {
        if (!item.occurredAt) return []
        const date = new Date(item.occurredAt)
        if (Number.isNaN(date.getTime())) return []
        const task: Task = {
          id: `timeline-${item.id ?? `${projectId}-${index}`}`,
          projectId,
          name: `Aktivitas: ${item.title}`,
          project: project?.name ?? 'Proyek',
          due: item.occurredAt,
          dueAt: item.occurredAt,
          description: item.description,
          status: item.state === 'done' ? 'Completed' : 'In Progress',
          priority: 'Low',
          visibleToClient: item.visibleToClient,
        }
        return [{ task, date, dateKey: dateKey(date), project, timelineItem: item }]
      })
    })
    return [...taskEvents, ...bookingEvents, ...timelineEvents].sort((left, right) => left.date.getTime() - right.date.getTime())
  }, [consultationBookings, projects, tasks, timelines])

  const eventsByDate = useMemo(() => {
    const next = new Map<string, CalendarTaskEvent[]>()
    scheduledTasks.forEach((event) => next.set(event.dateKey, [...(next.get(event.dateKey) ?? []), event]))
    return next
  }, [scheduledTasks])

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

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const selectedProject = selectedTask
    ? projects.find((project) => project.id === selectedTask.projectId) ?? projects.find((project) => project.name === selectedTask.project)
    : undefined
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index)), [cursor])
  const calendarDays = useMemo(() => monthCells(cursor), [cursor])
  const todayEvents = eventsByDate.get(dateKey(today)) ?? []
  const upcomingEvents = useMemo(() => scheduledTasks.filter((event) => event.date.getTime() >= today.getTime()).slice(0, 5), [scheduledTasks, today])
  const visibleAgenda = useMemo(() => {
    if (view === 'day') return eventsByDate.get(dateKey(cursor)) ?? []
    if (view === 'week') {
      const weekStart = startOfWeek(cursor)
      const weekEnd = addDays(weekStart, 6)
      return scheduledTasks.filter((event) => event.date >= weekStart && event.date <= weekEnd)
    }
    return scheduledTasks.filter((event) => event.date.getFullYear() === cursor.getFullYear() && event.date.getMonth() === cursor.getMonth())
  }, [cursor, eventsByDate, scheduledTasks, view])

  const periodTitle = view === 'month'
    ? titleCase(monthFormatter.format(cursor))
    : view === 'week'
      ? rangeLabel(weekDays[0], weekDays[6])
      : titleCase(longDateFormatter.format(cursor))

  const movePeriod = (amount: number) => {
    setCursor((current) => view === 'month'
      ? addMonths(current, amount)
      : addDays(current, view === 'week' ? amount * 7 : amount))
  }

  const openDay = (date: Date) => {
    setCursor(startOfDay(date))
    setView('day')
  }

  const openCalendarEvent = (event: CalendarTaskEvent) => {
    if (event.consultationBooking) onOpenConsultations()
    else if (event.timelineItem && event.project) onOpenProject(event.project.id)
    else void openTaskDetail(event.task)
  }
  const renderTaskEvent = (event: CalendarTaskEvent, className = 'calendar-task-event') => (
    <button key={event.task.id} type="button" className={`${className} event-${eventAccent(event)} ${event.task.status === 'Completed' ? 'is-completed' : ''}`} onClick={() => openCalendarEvent(event)} aria-label={event.consultationBooking ? `Buka booking konsultasi ${event.consultationBooking.name}` : event.timelineItem ? `Buka aktivitas proyek ${event.timelineItem.title}` : `Buka detail task ${event.task.name}`}>
      <span>{formatTime(event.date)}</span>
      <strong>{event.task.name}</strong>
    </button>
  )

  return (
    <div className="module-page calendar-page">
      <section className="page-title-row">
        <div><p className="eyebrow">Studio schedule</p><h1>Calendar</h1><p>Task, aktivitas proyek, dan konsultasi terjadwal selalu mengikuti data workspace Anda.</p></div>
        <button className="primary-button" onClick={onCreateProject}><Plus size={18} /> Buat jadwal</button>
      </section>

      <section className="calendar-control-row">
        <div className="month-control"><button type="button" aria-label={`${view === 'month' ? 'Bulan' : view === 'week' ? 'Minggu' : 'Hari'} sebelumnya`} onClick={() => movePeriod(-1)}><ChevronLeft size={19} /></button><strong>{periodTitle}</strong><button type="button" aria-label={`${view === 'month' ? 'Bulan' : view === 'week' ? 'Minggu' : 'Hari'} berikutnya`} onClick={() => movePeriod(1)}><ChevronRight size={19} /></button></div>
        <div className="calendar-control-actions"><div className="segment-control" aria-label="Tampilan kalender">{([{ id: 'month', label: 'Bulan' }, { id: 'week', label: 'Minggu' }, { id: 'day', label: 'Hari' }] as const).map((item) => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}</div><button type="button" className="filter-button calendar-today-button" onClick={() => setCursor(today)}><CalendarDays size={17} /> Hari ini</button></div>
      </section>

      <section className="calendar-layout">
        <article className="card calendar-view-card">
          {view === 'month' && <>
            <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((date) => {
                const events = eventsByDate.get(dateKey(date)) ?? []
                const outsideMonth = date.getMonth() !== cursor.getMonth()
                return <div key={dateKey(date)} className={`calendar-day ${outsideMonth ? 'is-outside' : ''} ${sameDay(date, today) ? 'today' : ''} ${sameDay(date, cursor) ? 'is-selected' : ''}`}>
                  <button type="button" className="calendar-date-button" onClick={() => setCursor(startOfDay(date))} aria-label={`Pilih ${titleCase(longDateFormatter.format(date))}`}><span>{date.getDate()}</span></button>
                  <div className="calendar-day-events">{events.slice(0, 2).map((event) => renderTaskEvent(event))}{events.length > 2 && <button type="button" className="calendar-more-events" onClick={() => openDay(date)}>+{events.length - 2} agenda lainnya</button>}</div>
                </div>
              })}
            </div>
          </>}

          {view === 'week' && <div className="calendar-week-view">{weekDays.map((date) => {
            const events = eventsByDate.get(dateKey(date)) ?? []
            return <article key={dateKey(date)} className={`calendar-week-day ${sameDay(date, today) ? 'today' : ''}`}><button type="button" className="calendar-week-day-head" onClick={() => openDay(date)}><span>{titleCase(new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date))}</span><strong>{date.getDate()}</strong></button><div>{events.length ? events.map((event) => renderTaskEvent(event, 'calendar-week-task')) : <p>Tidak ada task</p>}</div></article>
          })}</div>}

          {view === 'day' && <div className="calendar-day-view"><header><div><p className="eyebrow">Agenda harian</p><h2>{titleCase(shortDateFormatter.format(cursor))}</h2></div><button type="button" className="soft-button" onClick={() => setCursor(today)}>Kembali ke hari ini</button></header><div className="calendar-day-agenda">{(eventsByDate.get(dateKey(cursor)) ?? []).length ? (eventsByDate.get(dateKey(cursor)) ?? []).map((event) => renderTaskEvent(event, 'calendar-day-task')) : <div className="calendar-empty"><ListTodo size={20} /><div><strong>Tidak ada task berjadwal</strong><p>Pilih task di halaman Tasks lalu tetapkan deadline untuk menampilkannya di sini.</p></div></div>}</div></div>}
        </article>

        <aside className="calendar-sidebar">
          <article className="card today-card"><div className="card-heading"><div><p className="eyebrow">Hari ini</p><h2>{titleCase(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric' }).format(today))}</h2></div><span className="today-date">{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(today)}</span></div><div className="today-events">{todayEvents.length ? todayEvents.map((event) => renderTaskEvent(event, 'today-event')) : <p className="calendar-sidebar-empty">Tidak ada task berjadwal hari ini.</p>}</div></article>
          <article className="card upcoming-card"><div className="card-heading"><div><p className="eyebrow">Berikutnya</p><h2>Agenda mendatang</h2></div><Clock3 size={18} /></div>{upcomingEvents.length ? upcomingEvents.map((event) => <button key={event.task.id} type="button" className="upcoming-deadline" onClick={() => openCalendarEvent(event)}><span className={`deadline-day day-${eventAccent(event)}`}>{event.date.getDate()}</span><span><strong>{event.task.name}</strong><small>{titleCase(shortDateFormatter.format(event.date))} · {formatTime(event.date)}</small></span><ChevronRight size={16} /></button>) : <p className="calendar-sidebar-empty">Belum ada agenda mendatang.</p>}</article>
        </aside>
      </section>

      <section className="mobile-agenda"><p className="eyebrow">Agenda {view === 'month' ? 'bulan ini' : view === 'week' ? 'minggu ini' : 'hari ini'}</p>{visibleAgenda.length ? visibleAgenda.map((event) => <button key={event.task.id} type="button" onClick={() => openCalendarEvent(event)}><span className="agenda-date">{titleCase(shortDateFormatter.format(event.date))}</span><div><strong>{event.task.name}</strong><p>{event.project?.name ?? event.task.project} · {formatTime(event.date)}</p></div><ChevronRight size={17} /></button>) : <p className="calendar-sidebar-empty">Tidak ada agenda pada periode ini.</p>}</section>

      {selectedTask && <TaskDetailDrawer key={selectedTask.id} task={selectedTask} project={selectedProject} loading={detailLoading} closing={detailClosing} error={detailError} onClose={closeTaskDetail} onOpenProject={onOpenProject} onSave={onSaveTaskDetail} onAddNote={onAddTaskNote} onUploadAttachment={onUploadTaskAttachment} onDeleteAttachment={onDeleteTaskAttachment} />}
    </div>
  )
}
