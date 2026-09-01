import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import brandLogo from '../logo.png'
import type { ProjectPriority, ProjectStatus } from '../types'
import { sanitizeUserMessage } from '../lib/userMessage'

export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <img className={className} src={brandLogo} alt="" aria-hidden="true" />
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Nayagement">
      <BrandMark />
      {!compact && <span className="brand-word">nayagement</span>}
    </div>
  )
}

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function Avatar({ initials, variant = 'blue', size = 'md', imageUrl }: { initials: string; variant?: string; size?: 'sm' | 'md' | 'lg'; imageUrl?: string }) {
  return <span className={`avatar avatar-${variant} avatar-${size}`}>{imageUrl ? <img src={imageUrl} alt="" /> : initials}</span>
}

export function StatusChip({ status }: { status: ProjectStatus | 'Paid' | 'Unpaid' | 'Partial' }) {
  const statusClass = status.toLowerCase().replace(/ /g, '-')
  return <span className={`status-chip status-${statusClass}`}>{status}</span>
}

export function PriorityDot({ priority }: { priority: ProjectPriority }) {
  return <span className={`priority-dot priority-${priority.toLowerCase()}`} aria-label={`Prioritas ${priority}`} />
}

export function ProgressBar({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  return (
    <div className={`progress-block ${compact ? 'progress-compact' : ''}`}>
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <strong>{value}%</strong>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  )
}

export function ProgressRing({ value, label, caption, size = 132 }: { value: number; label: string; caption: string; size?: number }) {
  const stroke = 9
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-background" strokeWidth={stroke} r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className="ring-value"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="ring-label">
        <strong>{label}</strong>
        <span>{caption}</span>
      </div>
    </div>
  )
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <section className={`modal-panel ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Nayagement</p>
            <h2 id="modal-title">{title}</h2>
          </div>
          <IconButton label="Tutup dialog" onClick={onClose}><X size={19} /></IconButton>
        </header>
        {children}
      </section>
    </div>
  )
}

export function Toast({ message, action, onDismiss }: { message: string; action?: string; onDismiss: () => void }) {
  const displayMessage = sanitizeUserMessage(message)
  const displayAction = action ? sanitizeUserMessage(action, '') : ''
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4200)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])
  return (
    <div className="toast" role="status">
      <span className="toast-icon"><Check size={16} /></span>
      <span>{displayMessage}</span>
      {displayAction && <button className="text-button">{displayAction}</button>}
      <button className="toast-close" aria-label="Tutup pesan" onClick={onDismiss}><X size={16} /></button>
    </div>
  )
}
