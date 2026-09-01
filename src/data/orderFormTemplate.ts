import type { OrderForm, OrderFormDraft, OrderFormField } from '../types'

const defaultFields: OrderFormField[] = [
  { key: 'name', label: 'Nama lengkap', type: 'text', options: [], required: true, sortOrder: 0 },
  { key: 'email', label: 'Email', type: 'email', options: [], required: true, sortOrder: 1 },
  { key: 'whatsapp', label: 'Nomor WhatsApp', type: 'phone', options: [], required: true, sortOrder: 2 },
  { key: 'company', label: 'Nama bisnis / perusahaan', type: 'text', options: [], required: false, sortOrder: 3 },
  {
    key: 'project_type',
    label: 'Jenis kebutuhan',
    type: 'select',
    options: ['Social Media', 'Branding', 'Website', 'Custom', 'Presentation', 'Konsultasi'],
    required: true,
    sortOrder: 4,
  },
  { key: 'project_name', label: 'Nama order / proyek', type: 'text', options: [], required: true, sortOrder: 5 },
  { key: 'project_description', label: 'Kebutuhan dan permintaan', type: 'textarea', options: [], required: true, sortOrder: 6 },
  { key: 'budget', label: 'Perkiraan anggaran (Rp)', type: 'number', options: [], required: false, sortOrder: 7 },
  {
    key: 'payment_preference',
    label: 'Preferensi pembayaran',
    type: 'select',
    options: ['Diskusikan terlebih dahulu', 'DP 50%', 'Pembayaran penuh', 'Termin / bertahap'],
    required: false,
    sortOrder: 8,
  },
  { key: 'deadline_preference', label: 'Target selesai', type: 'date', options: [], required: false, sortOrder: 9 },
]

function cloneFields() {
  return defaultFields.map((field) => ({ ...field, options: [...field.options] }))
}

export function createOrderFormDraft(): OrderFormDraft {
  return {
    title: 'Form order kreatif',
    description: 'Ceritakan kebutuhan Anda. Kami akan meninjau brief ini dan menghubungi Anda untuk langkah berikutnya.',
    confirmationMessage: 'Terima kasih, order Anda sudah kami terima. Tim kami akan segera menghubungi Anda.',
    headerImageUrl: '',
    isActive: true,
    fields: cloneFields(),
  }
}

export function createDemoOrderForm(): OrderForm {
  return {
    id: 'demo-order-form',
    publicToken: 'demo-order',
    createdAt: new Date().toISOString(),
    ...createOrderFormDraft(),
  }
}
