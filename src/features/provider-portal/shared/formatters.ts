import type { IdentityApplication } from '@/features/identity'

export function formatPortalDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function portalApplicationSearchText(application: IdentityApplication) {
  return [
    application.name,
    application.slug,
    application.description,
    application.category,
    application.providerType,
    ...(application.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function portalMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}
