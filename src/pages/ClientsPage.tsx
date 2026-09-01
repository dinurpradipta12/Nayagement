import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, CircleDollarSign, Filter, Pencil, Plus, Search, Trash2, UsersRound } from 'lucide-react'
import type { Client, ClientFormData, ClientProfileFormData } from '../types'
import { rupiah } from '../lib/format'
import { ClientFormModal } from '../components/ClientFormModal'
import { ClientProfileFormModal } from '../components/ClientProfileFormModal'
import { Avatar } from '../components/ui'

interface ClientsPageProps {
  clients: Client[]
  onOpenClient: (client: Client) => void
  onCreateClient: (data: ClientFormData) => void | Promise<void>
  onUpdateClient: (client: Client, data: ClientProfileFormData, logoFile?: File | null) => void | Promise<void>
  onDeleteClient: (client: Client) => void
}

export function ClientsPage({ clients, onOpenClient, onCreateClient, onUpdateClient, onDeleteClient }: ClientsPageProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | Client['status']>('All')
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const filtered = useMemo(() => clients.filter((client) => (`${client.name} ${client.company}`).toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || client.status === filter)), [clients, filter, query])
  return (
    <div className="module-page clients-page">
      <section className="page-title-row"><div><p className="eyebrow">Relationship hub</p><h1>Clients</h1><p>Bangun gambaran lengkap dari setiap hubungan dan nilai kerja sama.</p></div><button className="primary-button" onClick={() => setClientFormOpen(true)}><Plus size={18} /> Tambah klien</button></section>
      <section className="client-stat-grid"><article><span className="client-stat-icon"><UsersRound size={20} /></span><div><small>Total klien</small><strong>{clients.length}</strong><p>{clients.filter((client) => client.status === 'Lead').length} perlu ditinjau</p></div></article><article><span className="client-stat-icon icon-mint"><ArrowUpRight size={20} /></span><div><small>Klien aktif</small><strong>{clients.filter((client) => client.status === 'Active').length}</strong><p>{clients.reduce((total, client) => total + client.projects, 0)} proyek terhubung</p></div></article><article><span className="client-stat-icon icon-peach"><CircleDollarSign size={20} /></span><div><small>Nilai klien</small><strong>{rupiah(clients.reduce((total, client) => total + client.revenue, 0), true)}</strong><p>Revenue tercatat</p></div></article></section>
      <section className="toolbar-card client-toolbar"><label className="input-with-icon"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau perusahaan..." /></label><div className="client-filter-tabs">{(['All', 'Active', 'Returning', 'Lead'] as const).map((option) => <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option === 'All' ? 'Semua' : option}</button>)}</div><button className="filter-button"><Filter size={17} /> Urutkan <ChevronDown size={15} /></button></section>
      <section className="clients-list-card">
        <div className="clients-list-header"><span>Klien</span><span>Status</span><span>Proyek</span><span>Revenue</span><span>Order terakhir</span><span>Aksi</span></div>
        <div className="clients-list-body">{filtered.map((client) => <article key={client.id} className="client-list-row"><button className="client-list-main" onClick={() => onOpenClient(client)} aria-label={`Buka profil ${client.company}`}><span className="client-identity"><Avatar initials={client.initials} variant={client.accent} /><span><strong>{client.company}</strong><small>{client.name}</small></span></span><span className={`client-status client-status-${client.status.toLowerCase()}`}>{client.status}</span><span>{client.projects} proyek</span><strong>{rupiah(client.revenue, true)}</strong><span>{client.lastOrder}</span></button><span className="client-row-actions"><button type="button" onClick={() => setEditingClient(client)} aria-label={`Edit ${client.company}`} title="Edit klien"><Pencil size={15} /></button><button type="button" className="danger" onClick={() => onDeleteClient(client)} aria-label={`Hapus ${client.company}`} title="Hapus klien"><Trash2 size={15} /></button></span></article>)}</div>
        {!filtered.length && <div className="empty-state"><span className="empty-icon"><Search size={24} /></span><strong>Klien tidak ditemukan</strong><p>Coba kata kunci atau status lain.</p></div>}
      </section>
      {clientFormOpen && <ClientFormModal onClose={() => setClientFormOpen(false)} onSubmit={onCreateClient} />}
      {editingClient && <ClientProfileFormModal client={editingClient} onClose={() => setEditingClient(null)} onSubmit={(data, logoFile) => onUpdateClient(editingClient, data, logoFile)} />}
    </div>
  )
}
