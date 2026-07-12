import type { ReactNode } from 'react'
import { Card, Descriptions, Tooltip, Typography } from 'antd'
import { useI18n } from '@/i18n'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import type { AccessControlDetailBase } from './types'

const { Text } = Typography

function MetadataSection({ items, title }: { items?: Record<string, string>; title: ReactNode }) {
  const entries = Object.entries(items ?? {}).filter(([key]) => key.trim())
  if (entries.length === 0) return null
  return (
    <div className="soha-workload-metadata-section">
      <Text strong className="soha-workload-metadata-title">
        {title}
      </Text>
      <div className="soha-workload-kv-grid">
        {entries.map(([key, value]) => {
          const displayValue = value || '-'
          return (
            <Tooltip
              key={key}
              title={
                <div className="soha-workload-kv-tooltip">
                  <div>{key}</div>
                  <div>{displayValue}</div>
                </div>
              }
            >
              <div className="soha-workload-kv-item" title={`${key}: ${displayValue}`}>
                <span className="soha-workload-kv-key">{`${key}:`}</span>
                <span className="soha-workload-kv-value">{displayValue}</span>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

export function AccessControlMetadataOverview({
  detail,
  extra,
  scopeLabel,
}: {
  detail: AccessControlDetailBase
  extra?: Array<{ key: string; value: ReactNode }>
  scopeLabel?: string
}) {
  const { t, localeCode } = useI18n()
  const namespace = detail.namespace || scopeLabel
  const hasLabels = Boolean(detail.labels && Object.keys(detail.labels).length > 0)
  const hasAnnotations = Boolean(detail.annotations && Object.keys(detail.annotations).length > 0)
  return (
    <Card className="soha-detail-card">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        items={[
          {
            key: 'name',
            label: t('common.name', 'Name'),
            children: detail.name,
          },
          ...(namespace
            ? [
                {
                  key: 'scope',
                  label: detail.namespace ? t('common.namespace', 'Namespace') : 'Scope',
                  children: namespace,
                },
              ]
            : []),
          {
            key: 'createdAt',
            label: t('common.createdAt', 'Created At'),
            children: detail.createdAt
              ? formatRelativeTime(detail.createdAt)
              : formatAgeSeconds(detail.ageSeconds),
          },
          ...(extra ?? []).map((item) => ({
            key: item.key,
            label: item.key,
            children: item.value,
          })),
        ]}
        size="small"
      />
      {hasLabels || hasAnnotations ? (
        <div className="soha-workload-metadata-stack">
          <MetadataSection items={detail.labels} title={t('common.labels', 'Labels')} />
          <MetadataSection
            items={detail.annotations}
            title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
          />
        </div>
      ) : null}
    </Card>
  )
}
