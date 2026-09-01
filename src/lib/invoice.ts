import type { Project } from '../types'

const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export function invoiceServiceCode(project?: Pick<Project, 'name' | 'type'>) {
  const source = `${project?.type ?? ''} ${project?.name ?? ''}`.trim().toLowerCase()
  if (/social|socmed|smm|content/.test(source)) return 'SMM'
  if (/brand/.test(source)) return 'BRD'
  if (/website|web\b/.test(source)) return 'WEB'
  if (/presentation|pitch/.test(source)) return 'PPT'
  if (/dashboard|spreadsheet|system/.test(source)) return 'DSH'
  if (/photo|video|visual/.test(source)) return 'VIS'

  const initials = source
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return initials || 'GEN'
}

function randomInvoiceNumber() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return 10_000 + (values[0] % 90_000)
  }
  return 10_000 + Math.floor(Math.random() * 90_000)
}

export function generateInvoiceNumber(project?: Pick<Project, 'name' | 'type'>, issueDate?: string) {
  const date = issueDate ? new Date(`${issueDate}T12:00:00`) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  return `${randomInvoiceNumber()}/INV-${invoiceServiceCode(project)}/${romanMonths[safeDate.getMonth()]}/${safeDate.getFullYear()}`
}
