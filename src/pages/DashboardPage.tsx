import { Fragment } from 'react'
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
  FolderKanban,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { Client, ConsultationBooking, Invoice, Project, ProjectPayment, Task } from '../types'
import { deadlineLabel, initials, rupiah } from '../lib/format'
import { Avatar, PriorityDot, ProgressBar, ProgressRing } from '../components/ui'

interface DashboardPageProps {
  projects: Project[]
  tasks: Task[]
  payments: ProjectPayment[]
  clients: Client[]
  invoices: Invoice[]
  consultationBookings: ConsultationBooking[]
  userName: string
  onOpenProject: () => void
  onOpenProjects: () => void
  onOpenCalendar: () => void
  onOpenClients: () => void
  onOpenFinance: () => void
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
  onOpenProject,
  onOpenProjects,
  onOpenCalendar,
  onOpenClients,
  onOpenFinance,
  onToggleTask,
}: DashboardPageProps) {
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

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> {todayLabel}</p>
          <h1>Halo, {userName || 'Anda'} <span>✦</span></h1>
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
              {revenueTrendDirection === 'down' ? <ArrowDownRight size={15} /> : <TrendingUp size={15} />}{revenueTrendLabel}
            </span>
          </div>
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
