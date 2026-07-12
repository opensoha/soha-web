import { Space, Tag, Typography } from 'antd'
import type { IdentityOIDCClientStatus, IdentityRuntimeProviderStatus } from './types'

const { Text } = Typography

const providerStatusMeta: Record<IdentityRuntimeProviderStatus, { color: string; label: string }> =
  {
    disabled: { color: 'default', label: 'Disabled' },
    enabled: { color: 'green', label: 'Enabled' },
  }

const oidcClientStatusMeta: Record<IdentityOIDCClientStatus, { color: string; label: string }> = {
  disabled: { color: 'default', label: 'Disabled' },
  enabled: { color: 'green', label: 'Enabled' },
}

export function formatIdentityProviderDateTime(value?: string) {
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

export function identityProviderStatusTag(status: IdentityRuntimeProviderStatus) {
  const meta = providerStatusMeta[status] ?? providerStatusMeta.disabled
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function identityOIDCClientStatusTag(status: IdentityOIDCClientStatus) {
  const meta = oidcClientStatusMeta[status] ?? oidcClientStatusMeta.disabled
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function identityProviderTagsSummary(values: string[], empty = '-') {
  const items = values ?? []
  if (!items.length) return <Text type="secondary">{empty}</Text>
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, 4).map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
      {items.length > 4 ? <Tag>+{items.length - 4}</Tag> : null}
    </Space>
  )
}
