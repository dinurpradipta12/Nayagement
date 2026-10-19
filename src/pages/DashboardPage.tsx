import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Expand,
  FolderKanban,
  ListChecks,
  LocateFixed,
  Plus,
  RotateCcw,
  Target,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import type { Client, ConsultationBooking, Invoice, Project, ProjectPayment, Task } from '../types'
import { deadlineLabel, initials, rupiah } from '../lib/format'
import { Avatar, PriorityDot, ProgressBar, ProgressRing } from '../components/ui'
import { WorkCenterScene } from '../features/dashboard3d/WorkCenterScene'
import '../styles/dashboard3d.css'

interface DashboardPageProps {
  projects: Project[]
  tasks: Task[]
  payments: ProjectPayment[]
  clients: Client[]
  invoices: Invoice[]
  consultationBookings: ConsultationBooking[]
  userName: string
  dark: boolean
  onOpenProject: () => void
  onOpenProjects: () => void
  onOpenCalendar: () => void
  onOpenClients: () => void
  onOpenFinance: () => void
  onOpenTasks: () => void
  onToggleTask: (id: string) => void
}

type TrendDirection = 'up' | 'down' | 'neutral'

function MiniStat({ icon, label, value, change, direction = 'neutral', tint }: { icon: React.ReactNode; label: string; value: string; change: string; direction?: TrendDirection; tint: string }) {
  return (
    <article className={`mini-stat mini-stat-${tint}`}>
      <span className="mini-stat-icon">{icon}</span>
      <div className="mini-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={direction === 'down' ? 'negative' : direction === 'neutral' ? 'neutral' : ''}>
          {direction === 'up' ? <ArrowUpRight size={13} /> : direction === 'down' ? <ArrowDownRight size={13} /> : null}
          {change}
        </small>
      </div>
    </article>
  )
}

const safeDate = (value?: string | null) => {
  if (!value) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const sameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()

const formatTime = (date: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace('.', ':')

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export function DashboardPage({
  projects,
  tasks,
  payments,
  clients,
  invoices,
  consultationBookings,
  userName,
  dark,
  onOpenProject,
  onOpenProjects,
  onOpenCalendar,
  onOpenClients,
  onOpenFinance,
  onOpenTasks,
  onToggleTask,
}: DashboardPageProps) {
  const [workCenterTab, setWorkCenterTab] = useState<'today' | 'projects' | 'review'>('today')
  const [taskStatusFilter, setTaskStatusFilter] = useState<Task['status'] | 'All'>('All')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sceneResetKey, setSceneResetKey] = useState(0)
  const [sceneExpanded, setSceneExpanded] = useState(false)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const activeProjects = projects.filter((project) => ['In Progress', 'Review', 'Confirmed'].includes(project.status))
  const completedProjects = projects.filter((project) => project.status === 'Completed')
  const averageProgress = activeProjects.length
    ? Math.round(activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length)
    : 0

  const openInvoices = invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.documentStatus !== 'Void')
  const projectOutstanding = projects.reduce((sum, project) => sum + Math.max(project.estimatedValue - project.paid, 0), 0)
  const invoiceOutstanding = openInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const outstanding = invoices.length ? invoiceOutstanding : projectOutstanding

  const revenueMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(date).replace('.', ''),
      value: 0,
    }
  })
  const revenueByMonth = new Map(revenueMonths.map((month) => [month.key, 0]))
  if (payments.length) {
    payments.forEach((payment) => {
      const paidAt = safeDate(payment.paidAt)
      if (!paidAt) return
      const key = getMonthKey(paidAt)
      if (revenueByMonth.has(key)) revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + payment.amount)
    })
  } else {
    invoices.filter((invoice) => invoice.status === 'Paid').forEach((invoice) => {
      const issuedAt = safeDate(invoice.issuedDate)
      if (!issuedAt) return
      const key = getMonthKey(issuedAt)
      if (revenueByMonth.has(key)) revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + invoice.amount)
    })
  }
  revenueMonths.forEach((month) => { month.value = revenueByMonth.get(month.key) ?? 0 })
  const hasRevenueData = revenueMonths.some((month) => month.value > 0)
  const currentRevenue = revenueMonths[revenueMonths.length - 1]?.value ?? 0
  const previousRevenue = revenueMonths[revenueMonths.length - 2]?.value ?? 0
  const revenueChange = previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : null
  const revenueMax = Math.max(...revenueMonths.map((month) => month.value), 1)
  const chartPoints = revenueMonths.map((month, index) => ({
    x: 18 + (index * 564) / Math.max(revenueMonths.length - 1, 1),
    y: 143 - (month.value / revenueMax) * 112,
  }))
  const chartLine = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const chartArea = `${chartLine} L${chartPoints[chartPoints.length - 1]?.x ?? 582},180 L${chartPoints[0]?.x ?? 18},180 Z`
  const latestChartPoint = chartPoints[chartPoints.length - 1] ?? { x: 582, y: 143 }

  const activeByDeadline = [...activeProjects]
    .map((project) => ({ project, due: safeDate(project.dueDate) }))
    .filter((item): item is { project: Project; due: Date } => Boolean(item.due))
    .sort((left, right) => left.due.getTime() - right.due.getTime())
  const nearestProject = activeByDeadline.find((item) => item.due >= todayStart) ?? activeByDeadline[0]
  const dueTodayTasks = tasks.filter((task) => {
    const due = safeDate(task.dueAt)
    return due ? sameLocalDay(due, now) : false
  })
  const incompleteToday = dueTodayTasks.filter((task) => task.status !== 'Completed')
  const attentionCount = incompleteToday.length + activeByDeadline.filter(({ due }) => due >= todayStart && due < new Date(todayStart.getTime() + 3 * 86_400_000)).length

  const focusTasks = [...dueTodayTasks]
    .sort((left, right) => Number(left.status === 'Completed') - Number(right.status === 'Completed'))
    .slice(0, 3)
  const completedFocusTasks = focusTasks.filter((task) => task.status === 'Completed').length
  const focusProgress = focusTasks.length ? Math.round((completedFocusTasks / focusTasks.length) * 100) : 0
  const recentlyUpdated = activeByDeadline.slice(0, 3).map(({ project }) => project)

  const agenda = [
    ...tasks.flatMap((task) => {
      const date = safeDate(task.dueAt)
      if (!date || !sameLocalDay(date, now)) return []
      return [{ id: `task-${task.id}`, date, title: task.name, detail: `${task.project || 'Task'} · ${task.status}`, type: 'task' as const }]
    }),
    ...consultationBookings.flatMap((booking) => {
      const date = safeDate(booking.startsAt)
      if (!date || !sameLocalDay(date, now) || booking.status === 'Cancelled') return []
      return [{ id: `booking-${booking.id}`, date, title: booking.topic || 'Konsultasi', detail: `${booking.name} · ${booking.status}`, type: 'booking' as const }]
    }),
  ].sort((left, right) => left.date.getTime() - right.date.getTime()).slice(0, 4)

  const activeClients = clients.filter((client) => client.status === 'Active' || client.status === 'Returning')
  const topClient = [...activeClients].sort((left, right) => right.revenue - left.revenue)[0]
  const topClientProjects = topClient
    ? projects.filter((project) => project.clientId === topClient.id || project.client === topClient.company || project.client === topClient.name)
    : []
  const approachingDeadlines = activeByDeadline.filter(({ due }) => due >= todayStart && due < new Date(todayStart.getTime() + 7 * 86_400_000)).length
  const leadClients = clients.filter((client) => client.status === 'Lead').length

  const dayOffset = (now.getDay() + 6) % 7
  const weekStart = new Date(todayStart.getTime() - dayOffset * 86_400_000)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)
  const weekTasks = tasks.filter((task) => {
    const due = safeDate(task.dueAt)
    return due ? due >= weekStart && due < weekEnd : false
  })
  const completedWeekTasks = weekTasks.filter((task) => task.status === 'Completed').length
  const weekdayLabels = ['S', 'S', 'R', 'K', 'J', 'S', 'M']
  const weekBars = weekdayLabels.map((label, index) => {
    const date = new Date(weekStart.getTime() + index * 86_400_000)
    const dailyTasks = weekTasks.filter((task) => {
      const due = safeDate(task.dueAt)
      return due ? sameLocalDay(due, date) : false
    })
    const completed = dailyTasks.filter((task) => task.status === 'Completed').length
    return { label, date, value: dailyTasks.length ? Math.round((completed / dailyTasks.length) * 100) : 0 }
  })

  const todayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const revenueTrendDirection: TrendDirection = revenueChange === null ? 'neutral' : revenueChange >= 0 ? 'up' : 'down'
  const revenueTrendLabel = revenueChange === null
    ? 'Belum ada pembanding bulan lalu'
    : `${Math.abs(revenueChange)}% dari bulan lalu`

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const liveTasks = useMemo(() => tasks.filter((task) => task.status !== 'Completed'), [tasks])
  const statusCounts = useMemo(() => ({
    Todo: tasks.filter((task) => task.status === 'Todo').length,
    'In Progress': tasks.filter((task) => task.status === 'In Progress').length,
    Review: tasks.filter((task) => task.status === 'Review').length,
    Completed: tasks.filter((task) => task.status === 'Completed').length,
  }), [tasks])
  const overdueTasks = tasks.filter((task) => {
    const due = safeDate(task.dueAt)
    return task.status !== 'Completed' && due !== null && due < todayStart
  })
  const workCenterTasks = (workCenterTab === 'review'
    ? tasks.filter((task) => task.status === 'Review')
    : workCenterTab === 'projects'
      ? tasks.filter((task) => task.status !== 'Completed' && activeProjects.some((project) => project.id === task.projectId || project.name === task.project))
      : [...liveTasks].sort((left, right) => {
        const leftDate = safeDate(left.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY
        const rightDate = safeDate(right.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY
        return leftDate - rightDate
      })).slice(0, 5)
  const visibleSceneTasks = tasks.filter((task) => taskStatusFilter === 'All' || task.status === taskStatusFilter)
  const workCenterDate = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  return (
    <div className="dashboard-page">
      <section className={`work-center-dashboard ${sceneExpanded ? 'is-expanded' : ''}`} aria-labelledby="work-center-title">
        <header className="work-center-header">
          <div className="work-center-brand">
            <span className="work-center-mark"><span /><span /><span /></span>
            <div><h1 id="work-center-title">Nayagement Work Center</h1><p>Workspace hidup · {liveTasks.length} task aktif · {activeProjects.length} proyek berjalan</p></div>
          </div>
          <div className="work-center-header-tools">
            <span className="work-center-clock"><Clock3 size={17} /><span><strong>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(now).replace('.', ':')}</strong><small>{workCenterDate}</small></span></span>
            <button type="button" onClick={() => setSceneResetKey((value) => value + 1)} title="Reset kamera" aria-label="Reset kamera 3D"><RotateCcw size={17} /></button>
            <button type="button" onClick={() => setSceneExpanded((value) => !value)} title={sceneExpanded ? 'Keluar layar penuh' : 'Perbesar Work Center'} aria-label={sceneExpanded ? 'Keluar dari tampilan besar' : 'Perbesar Work Center'}><Expand size={17} /></button>
          </div>
        </header>

        <div className="work-center-body">
          <div className="work-center-scene">
            <div className="work-center-scene-badge"><span /> LIVE WORKSPACE</div>
            <WorkCenterScene tasks={visibleSceneTasks} dark={dark} selectedTaskId={selectedTaskId} statusFilter={taskStatusFilter} onSelectTask={(task) => setSelectedTaskId(task.id)} resetKey={sceneResetKey} />
            {!tasks.length ? <div className="work-center-scene-empty"><UsersRound size={25} /><strong>Kantor masih tenang</strong><span>Karakter akan hadir otomatis saat task dibuat.</span><button type="button" onClick={onOpenTasks}>Buat task pertama</button></div> : null}
            <div className="work-center-scene-help">Drag untuk memutar · scroll untuk zoom · klik karakter untuk detail task</div>
          </div>

          <aside className="work-center-panel" aria-label="Ringkasan Work Center">
            <div className="work-center-panel-heading"><div><p><span /> Work center</p><strong>Aktivitas workspace</strong><small>{liveTasks.length} aktif · {statusCounts.Review} perlu review</small></div><button type="button" onClick={onOpenCalendar} aria-label="Buka kalender"><CalendarClock size={18} /></button></div>
            <div className="work-center-tabs" role="tablist" aria-label="Kategori Work Center">
              <button type="button" role="tab" aria-selected={workCenterTab === 'today'} className={workCenterTab === 'today' ? 'active' : ''} onClick={() => setWorkCenterTab('today')}>Hari ini</button>
              <button type="button" role="tab" aria-selected={workCenterTab === 'projects'} className={workCenterTab === 'projects' ? 'active' : ''} onClick={() => setWorkCenterTab('projects')}>Projects</button>
              <button type="button" role="tab" aria-selected={workCenterTab === 'review'} className={workCenterTab === 'review' ? 'active' : ''} onClick={() => setWorkCenterTab('review')}>Review</button>
            </div>

            {selectedTask ? <div className="work-center-selected">
              <button type="button" className="work-center-selected-close" aria-label="Tutup detail task" onClick={() => setSelectedTaskId(null)}>×</button>
              <span className={`work-center-status status-${selectedTask.status.toLowerCase().replace(' ', '-')}`}>{selectedTask.status}</span>
              <strong>{selectedTask.name}</strong><p>{selectedTask.project || 'Task workspace'}</p>
              <div><span>Deadline</span><b>{selectedTask.dueAt ? deadlineLabel(selectedTask.dueAt) : selectedTask.due || 'Belum dijadwalkan'}</b></div>
              <button type="button" onClick={() => onToggleTask(selectedTask.id)}>{selectedTask.status === 'Completed' ? 'Aktifkan kembali' : 'Tandai selesai'} <CheckCircle2 size={15} /></button>
            </div> : <>
              <div className="work-center-summary-card"><p>Ringkasan tim digital</p><strong>{liveTasks.length ? `${liveTasks.length} aktivitas sedang bergerak` : 'Semua task sudah tenang'}</strong><span>{overdueTasks.length ? `${overdueTasks.length} task melewati deadline dan perlu perhatian.` : 'Tidak ada task terlambat saat ini.'}</span></div>
              <div className="work-center-metrics">
                <button type="button" onClick={() => setTaskStatusFilter('In Progress')}><UsersRound size={17} /><strong>{statusCounts['In Progress']}</strong><span>Dikerjakan</span></button>
                <button type="button" onClick={() => onOpenTasks()}><ListChecks size={17} /><strong>{liveTasks.length}</strong><span>Task aktif</span></button>
                <button type="button" onClick={() => setTaskStatusFilter('Review')}><CircleAlert size={17} /><strong>{statusCounts.Review}</strong><span>Review</span></button>
                <button type="button" onClick={() => setTaskStatusFilter('Completed')}><CheckCircle2 size={17} /><strong>{statusCounts.Completed}</strong><span>Selesai</span></button>
              </div>
              <div className="work-center-priority-heading"><strong>{workCenterTab === 'review' ? 'Menunggu review' : workCenterTab === 'projects' ? 'Task proyek aktif' : 'Prioritas aktif'}</strong><button type="button" onClick={onOpenTasks}>Lihat semua</button></div>
              <div className="work-center-priorities">
                {workCenterTasks.length ? workCenterTasks.map((task, index) => <button type="button" key={task.id} onClick={() => setSelectedTaskId(task.id)}><span>{index + 1}</span><span><strong>{task.name}</strong><small>{task.project || 'Task workspace'}</small></span><em>{task.status}</em></button>) : <p>Tidak ada task pada kategori ini.</p>}
              </div>
              <div className="work-center-quick-links"><button type="button" onClick={onOpenCalendar}><CalendarClock size={16} /><span>Timeline<strong>Lihat agenda</strong></span><ChevronRight size={14} /></button><button type="button" onClick={onOpenProjects}><FolderKanban size={16} /><span>Projects<strong>{activeProjects.length} berjalan</strong></span><ChevronRight size={14} /></button></div>
            </>}
          </aside>
        </div>

        <footer className="work-center-dock" aria-label="Filter karakter berdasarkan status task">
          <button type="button" className={taskStatusFilter === 'All' ? 'active' : ''} onClick={() => setTaskStatusFilter('All')}><span className="dock-avatar dock-all"><LocateFixed size={17} /></span><span><strong>Semua karakter</strong><small>{tasks.length} task</small></span></button>
          {(['Todo', 'In Progress', 'Review', 'Completed'] as const).map((status) => <button type="button" key={status} className={taskStatusFilter === status ? 'active' : ''} onClick={() => setTaskStatusFilter(status)}><span className={`dock-avatar dock-${status.toLowerCase().replace(' ', '-')}`}>{statusCounts[status]}</span><span><strong>{status === 'Todo' ? 'Planning' : status === 'In Progress' ? 'Workspace' : status === 'Review' ? 'Review room' : 'Completed garden'}</strong><small>{status}</small></span></button>)}
        </footer>
      </section>

      <div className="dashboard-insights-divider"><span>Workspace insights</span><i /></div>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Halo, {userName || 'Anda'}</h1>
          <p className="hero-description">{attentionCount ? `${attentionCount} hal perlu perhatian hari ini.` : 'Tidak ada hal mendesak hari ini.'} Mari selesaikan dengan tenang.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button hero-calendar" onClick={onOpenCalendar}><CalendarClock size={18} /> Lihat kalender</button>
          <button className="primary-button" onClick={onOpenProject}><Plus size={18} /> Proyek baru</button>
        </div>
      </section>

      <section className="attention-strip" aria-label="Ringkasan yang perlu diperhatikan">
        <div className="attention-icon"><CircleAlert size={18} /></div>
        <div>
          <strong>{nearestProject ? `Deadline terdekat: ${nearestProject.project.name}` : 'Tidak ada deadline proyek aktif'}</strong>
          <span>{nearestProject ? `${nearestProject.project.client} · ${deadlineLabel(nearestProject.project.dueDate)}` : 'Proyek baru yang dibuat akan muncul otomatis di sini.'}</span>
        </div>
        <button onClick={onOpenProjects}>Buka proyek <ChevronRight size={16} /></button>
      </section>

      <section className="stats-grid">
        <MiniStat icon={<FolderKanban size={19} />} label="Proyek aktif" value={String(activeProjects.length)} change={`${completedProjects.length} proyek selesai`} tint="blue" />
        <MiniStat icon={<Target size={19} />} label="Progress rata-rata" value={`${averageProgress}%`} change={activeProjects.length ? `Dari ${activeProjects.length} proyek aktif` : 'Belum ada proyek aktif'} tint="violet" />
        <MiniStat icon={<CircleDollarSign size={19} />} label="Revenue bulan ini" value={rupiah(currentRevenue, true)} change={revenueTrendLabel} direction={revenueTrendDirection} tint="mint" />
        <MiniStat icon={<Clock3 size={19} />} label="Outstanding" value={rupiah(outstanding, true)} change={`${openInvoices.length} invoice terbuka`} direction={outstanding > 0 ? 'down' : 'neutral'} tint="peach" />
      </section>

      <section className="dashboard-main-grid">
        <article className="card revenue-card">
          <div className="card-heading">
            <div><p className="eyebrow">Financial pulse</p><h2>Revenue overview</h2></div>
            <button className="quiet-button" onClick={onOpenFinance}>Lihat finance <ChevronRight size={16} /></button>
          </div>
          <div className="revenue-main-value">
            <strong>{rupiah(currentRevenue)}</strong>
            <span className={revenueTrendDirection === 'down' ? 'trend-down' : revenueTrendDirection === 'neutral' ? 'trend-neutral' : ''}>
              {revenueTrendDirection === 'down' ? <ArrowDownRight size={15} /> : revenueTrendDirection === 'up' ? <TrendingUp size={15} /> : null}{revenueTrendLabel}
            </span>
          </div>
          {hasRevenueData ? (
            <div className="revenue-chart" aria-label="Grafik pendapatan enam bulan terakhir dari pembayaran tersimpan">
              <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img">
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#286ee8" stopOpacity=".27" />
                    <stop offset="100%" stopColor="#286ee8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="chart-grid" d="M0 31H600 M0 87H600 M0 143H600" />
                <path className="chart-area" d={chartArea} />
                <path className="chart-line" d={chartLine} />
                <circle cx={latestChartPoint.x} cy={latestChartPoint.y} r="6" className="chart-point" />
              </svg>
              <div className="chart-labels">{revenueMonths.map((month) => <span key={month.key}>{month.label}</span>)}</div>
            </div>
          ) : (
            <div className="revenue-chart-empty" role="status">
              <span><CircleDollarSign size={21} /></span>
              <div><strong>Belum ada pemasukan tercatat</strong><p>Catat pembayaran pertama agar grafik pendapatan mulai terbentuk.</p></div>
            </div>
          )}
        </article>

        <article className="card focus-card">
          <div className="card-heading">
            <div><p className="eyebrow">Focus today</p><h2>Prioritas Anda</h2></div>
            <span className="count-badge">{focusTasks.length}</span>
          </div>
          <div className="focus-progress">
            <ProgressRing value={focusProgress} label={`${completedFocusTasks}/${focusTasks.length}`} caption="selesai" size={112} />
            <div><strong>{focusTasks.length ? (completedFocusTasks === focusTasks.length ? 'Semua selesai' : 'Tetap fokus') : 'Agenda task kosong'}</strong><p>{focusTasks.length ? `${focusTasks.length - completedFocusTasks} tugas hari ini belum selesai.` : 'Tidak ada task dengan deadline hari ini.'}</p></div>
          </div>
          <div className="task-check-list">
            {focusTasks.map((task) => (
              <button key={task.id} className={`task-check ${task.status === 'Completed' ? 'checked' : ''}`} onClick={() => onToggleTask(task.id)}>
                <span className="check-circle"><CheckCircle2 size={15} /></span>
                <span><strong>{task.name}</strong><small>{task.dueAt ? formatTime(safeDate(task.dueAt) ?? now) : task.due}</small></span>
                <PriorityDot priority={task.priority} />
              </button>
            ))}
          </div>
        </article>

        <article className="card projects-snapshot">
          <div className="card-heading"><div><p className="eyebrow">Pipeline</p><h2>Proyek berjalan</h2></div><button className="text-button" onClick={onOpenProjects}>Semua</button></div>
          <div className="project-snapshot-list">
            {recentlyUpdated.length ? recentlyUpdated.map((project) => (
              <button key={project.id} className="project-snapshot-row" onClick={onOpenProjects}>
                <span className={`project-color project-color-${project.accent}`} />
                <span className="project-snapshot-title"><strong>{project.name}</strong><small>{project.client} · {deadlineLabel(project.dueDate)}</small></span>
                <span className="snapshot-progress"><b>{project.progress}%</b><ProgressBar value={project.progress} compact /></span>
              </button>
            )) : <p className="dashboard-empty-state">Belum ada proyek yang sedang berjalan.</p>}
          </div>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="card schedule-card">
          <div className="card-heading"><div><p className="eyebrow">Schedule</p><h2>Agenda hari ini</h2></div><span className="count-badge">{agenda.length}</span></div>
          {agenda.length ? (
            <div className="schedule-list">
              {agenda.map((item, index) => (
                <Fragment key={item.id}>
                  <div className="schedule-time">{formatTime(item.date)}</div>
                  <div className={`schedule-event ${index % 3 === 0 ? 'color-violet' : index % 3 === 1 ? 'color-blue' : 'color-peach'}`}>
                    <span className="schedule-dot" />
                    <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                    {item.type === 'booking' ? <div className="attendees"><Avatar initials={initials(item.detail)} variant="blue" size="sm" /></div> : null}
                  </div>
                </Fragment>
              ))}
            </div>
          ) : <p className="dashboard-empty-state schedule-empty-state">Belum ada task atau konsultasi untuk hari ini.</p>}
          <button className="full-text-button" onClick={onOpenCalendar}>Buka kalender lengkap <ChevronRight size={16} /></button>
        </article>

        <article className="card client-pulse-card">
          <div className="card-heading"><div><p className="eyebrow">Client pulse</p><h2>Klien aktif</h2></div><span className="count-badge success">{activeClients.length}</span></div>
          {topClient ? (
            <div className="client-highlight">
              <div className="client-highlight-main"><Avatar initials={topClient.initials || initials(topClient.company || topClient.name)} variant="violet" size="lg" /><div><strong>{topClient.company || topClient.name}</strong><small>{topClient.status === 'Returning' ? 'Klien berulang' : 'Klien aktif'} · {topClientProjects.length} proyek</small></div></div>
              <span className="client-value">{rupiah(topClient.revenue, true)}</span>
            </div>
          ) : <p className="dashboard-empty-state">Belum ada klien aktif.</p>}
          <div className="client-pulse-items"><span><i className="dot-mint" />{approachingDeadlines} proyek mendekati deadline</span><span><i className="dot-violet" />{leadClients} calon klien perlu ditinjau</span></div>
          <button className="full-text-button" onClick={onOpenClients}>Lihat hubungan klien <ChevronRight size={16} /></button>
        </article>

        <article className="card completion-card">
          <p className="eyebrow">Weekly rhythm</p>
          <h2>Ruang untuk fokus.</h2>
          <p>Anda menyelesaikan {completedWeekTasks} dari {weekTasks.length} tugas minggu ini.</p>
          <div className="week-bars" aria-label="Progres tugas harian minggu ini">
            {weekBars.map((day) => <span key={day.date.toISOString()} className={sameLocalDay(day.date, now) ? 'today' : ''} style={{ '--bar': `${day.value}%` } as CSSProperties}><i /><em>{day.label}</em></span>)}
          </div>
          <button className="soft-button" onClick={onOpenCalendar}>Buka jadwal mingguan <ChevronRight size={16} /></button>
        </article>
      </section>

      <div className="dashboard-footer-note"><span>Data diperbarui otomatis di latar belakang</span><span><i /> Terhubung ke data workspace</span></div>
    </div>
  )
}
