import { useState, type ReactNode } from 'react'
import {
  Bell,
  CalendarDays,
  CalendarCheck2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Command,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  PiggyBank,
  Search,
  Settings,
  Sun,
  UsersRound,
  X,
} from 'lucide-react'
import type { RouteName, SettingsProfile } from '../types'
import { Avatar, IconButton, Logo } from './ui'

const navigation: Array<{ id: RouteName; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'clients', label: 'Clients', icon: UsersRound },
  { id: 'finance', label: 'Finance', icon: CircleDollarSign },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'forms', label: 'Order Forms', icon: ClipboardList },
  { id: 'orders', label: 'Order masuk', icon: Inbox },
  { id: 'bookings', label: 'Konsultasi', icon: CalendarCheck2 },
  { id: 'personal-finance', label: 'Keuangan pribadi', icon: PiggyBank },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const mobileNavigation = navigation.slice(0, 4)
const workspaceNavigation = navigation.slice(0, 5)
const businessNavigation = navigation.slice(5, 10)
const personalNavigation = navigation.slice(10, 11)
const utilityNavigation = navigation.slice(11)

interface WorkspaceLayoutProps {
  route: RouteName
  children: ReactNode
  dark: boolean
  unreadCount: number
  newOrderCount: number
  newBookingCount: number
  userProfile: SettingsProfile
  onRouteChange: (route: RouteName) => void
  onOpenProject: () => void
  onOpenSearch: () => void
  onToggleDark: () => void
  onSignOut: () => void
}

export function WorkspaceLayout({
  route,
  children,
  dark,
  unreadCount,
  newOrderCount,
  newBookingCount,
  userProfile,
  onRouteChange,
  onOpenProject,
  onOpenSearch,
  onToggleDark,
  onSignOut,
}: WorkspaceLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const current = navigation.find((item) => item.id === route)
  const navigate = (next: RouteName) => {
    onRouteChange(next)
    setMobileMenuOpen(false)
  }
  const countFor = (id: RouteName) => id === 'orders' ? newOrderCount : id === 'bookings' ? newBookingCount : id === 'notifications' ? unreadCount : 0
  const countLabel = (count: number) => count > 99 ? '99+' : count

  return (
    <div className="app-canvas">
      <main className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-logo"><Logo /></div>
          <button className="create-project-button" onClick={onOpenProject}>
            <Plus size={18} strokeWidth={2.5} />
            <span>Proyek baru</span>
          </button>
          <nav className="side-nav" aria-label="Navigasi utama">
            <p className="nav-section-title">Ruang kerja</p>
            {workspaceNavigation.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${route === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={18} strokeWidth={route === id ? 2.4 : 2} />
                <span>{label}</span>
              </button>
            ))}
            <p className="nav-section-title nav-section-spaced">Bisnis</p>
            {businessNavigation.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${route === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={18} strokeWidth={route === id ? 2.4 : 2} />
                <span>{label}</span>
                {countFor(id) > 0 && <em className="nav-count">{countLabel(countFor(id))}</em>}
              </button>
            ))}
            <p className="nav-section-title nav-section-spaced">Pribadi</p>
            {personalNavigation.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${route === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={18} strokeWidth={route === id ? 2.4 : 2} />
                <span>{label}</span>
              </button>
            ))}
            <p className="nav-section-title nav-section-spaced">Lainnya</p>
            {utilityNavigation.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${route === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={18} strokeWidth={route === id ? 2.4 : 2} />
                <span>{label}</span>
                {countFor(id) > 0 && <em className="nav-count">{countLabel(countFor(id))}</em>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button className="user-card" onClick={() => navigate('settings')}>
              <Avatar initials={(userProfile.displayName || userProfile.fullName).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'NA'} variant="violet" size="sm" imageUrl={userProfile.avatarUrl} />
              <span><strong>{userProfile.displayName || userProfile.fullName || 'Pengguna Nayagement'}</strong><small>{userProfile.roleTitle || userProfile.accountType}</small></span>
              <ChevronDown size={16} />
            </button>
          </div>
        </aside>

        <section className="workspace-content">
          <header className="desktop-topbar">
            <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-dot">/</span><strong>{current?.label}</strong></div>
            <div className="topbar-actions">
              <button className="search-trigger" onClick={onOpenSearch} aria-label="Buka pencarian">
                <Search size={17} />
                <span>Cari di Nayagement</span>
                <kbd>⌘ K</kbd>
              </button>
              <IconButton label={dark ? 'Gunakan mode terang' : 'Gunakan mode gelap'} onClick={onToggleDark}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
              <IconButton label="Buka notifikasi" className="notification-button" onClick={() => navigate('notifications')}>
                <Bell size={18} />
                {unreadCount > 0 && <b />}
              </IconButton>
            </div>
          </header>
          <header className="mobile-topbar">
            <Logo compact />
            <div>
              <IconButton label="Cari" onClick={onOpenSearch}><Search size={19} /></IconButton>
              <IconButton label="Notifikasi" onClick={() => navigate('notifications')}><Bell size={19} /></IconButton>
            </div>
          </header>
          <div className="page-content">{children}</div>
        </section>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navigasi seluler">
        {mobileNavigation.map(({ id, label, icon: Icon }) => (
          <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={20} strokeWidth={route === id ? 2.5 : 2} />
            <span>{label}</span>
          </button>
        ))}
        <button className={mobileMenuOpen ? 'active' : ''} onClick={() => setMobileMenuOpen((value) => !value)}>
          {mobileMenuOpen ? <X size={20} /> : <MoreHorizontal size={21} />}
          <span>Lainnya</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-layer">
          <div className="mobile-menu-head">
            <div><p className="eyebrow">Nayagement</p><strong>Menu lainnya</strong></div>
            <IconButton label="Tutup menu" onClick={() => setMobileMenuOpen(false)}><X size={18} /></IconButton>
          </div>
          <div className="mobile-menu-list">
            {navigation.slice(4).map(({ id, label, icon: Icon }) => (
              <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
                <span className="mobile-menu-icon"><Icon size={19} /></span>{label}
                {countFor(id) > 0 && <em>{countLabel(countFor(id))}</em>}
              </button>
            ))}
          </div>
          <div className="mobile-menu-footer">
            <button onClick={onToggleDark}>{dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? 'Mode terang' : 'Mode gelap'}</button>
            <button onClick={onSignOut}><LogOut size={18} /> Keluar demo</button>
          </div>
        </div>
      )}

      <button className="mobile-fab" onClick={onOpenProject} aria-label="Buat proyek baru"><Plus size={24} /></button>
    </div>
  )
}
