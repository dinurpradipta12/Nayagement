export function sanitizeUserMessage(value: string, fallback = 'Terjadi kendala. Silakan coba lagi.') {
  const cleaned = value
    .replace(/\s+(?:ke|di|dari)\s+supabase\b\.?/gi, '.')
    .replace(/\bsupabase\b/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return cleaned || fallback
}
