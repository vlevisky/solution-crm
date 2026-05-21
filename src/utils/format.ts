export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SC'
}

export function formatDate(value?: string) {
  if (!value) return 'N/D'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}

export function formatDateTime(value?: string) {
  if (!value) return 'N/D'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function normalizePhone(value = '') {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`
}

export function csv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(',')),
  ].join('\n')
}
