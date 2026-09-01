export function sanitizeUserMessage(value: string, fallback = 'Terjadi kendala. Silakan coba lagi.') {
  if (/permission denied for table telegram_outbox/i.test(value)) {
    return 'Integrasi notifikasi Telegram perlu diperbarui. Jalankan SQL perbaikan Telegram, lalu coba simpan kembali.'
  }
  const cleaned = value
    .replace(/\s+(?:ke|di|dari)\s+supabase\b\.?/gi, '.')
    .replace(/\bsupabase\b/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return cleaned || fallback
}
