import type { ReactNode } from 'react'
import { Card, Descriptions, Tabs, Tooltip, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { useI18n } from '@/i18n'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import '../styles.css'

const { Text } = Typography

export function StorageDetailShell({
  children,
}: {
  children: ReactNode
  kind: string
  name: string
}) {
  return <div className="soha-page soha-workload-detail-page">{children}</div>
}

export function StorageDetailTabs({
  activeKey,
  items,
  onChange,
}: {
  activeKey: string
  items: TabsProps['items']
  onChange: (key: string) => void
}) {
  return (
    <Tabs
      activeKey={activeKey}
      className="soha-resource-tabs soha-workload-detail-tabs"
      indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
      items={items}
      onChange={onChange}
      size="small"
      tabBarGutter={18}
    />
  )
}

function MetadataSection({ items, title }: { items?: Record<string, string>; title: string }) {
  const entries = Object.entries(items ?? {}).filter(([key]) => key.trim())
  if (entries.length === 0) return null
  return (
    <div className="soha-workload-metadata-section">
      <Text strong className="soha-workload-metadata-title">
        {title}
      </Text>
      <div className="soha-workload-kv-grid">
        {entries.map(([key, value]) => (
          <Tooltip key={key} title={`${key}: ${value || '-'}`}>
            <div className="soha-workload-kv-item" title={`${key}: ${value || '-'}`}>
              <span className="soha-workload-kv-key">{`${key}:`}</span>
              <span className="soha-workload-kv-value">{value || '-'}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export function StorageResourceOverview({
  ageSeconds,
  annotations,
  createdAt,
  extra,
  labels,
  name,
  namespace,
}: {
  ageSeconds?: number
  annotations?: Record<string, string>
  createdAt?: string
  extra: Array<{ key: string; value: ReactNode }>
  labels?: Record<string, string>
  name: string
  namespace: string
}) {
  const { t, localeCode } = useI18n()
  return (
    <Card className="soha-detail-card">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        size="small"
        items={[
          {
            key: t('common.name', 'Name'),
            label: t('common.name', 'Name'),
            children: name,
          },
          {
            key: t('common.namespace', 'Namespace'),
            label: t('common.namespace', 'Namespace'),
            children: namespace,
          },
          {
            key: t('common.createdAt', 'Created At'),
            label: t('common.createdAt', 'Created At'),
            children: createdAt
              ? formatRelativeTime(createdAt)
              : typeof ageSeconds === 'number'
                ? formatAgeSeconds(ageSeconds)
                : '-',
          },
          ...extra.map((item) => ({ key: item.key, label: item.key, children: item.value })),
        ]}
      />
      <div className="soha-workload-metadata-stack">
        <MetadataSection items={labels} title={t('common.labels', 'Labels')} />
        <MetadataSection
          items={annotations}
          title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
        />
      </div>
    </Card>
  )
}
