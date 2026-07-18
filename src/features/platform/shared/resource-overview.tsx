import type { ReactNode } from 'react'
import { Card, Descriptions, Tooltip, Typography } from 'antd'
import { useI18n } from '@/i18n'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'

const { Text } = Typography

export interface PlatformResourceOverviewFact {
  readonly key: string
  readonly label: ReactNode
  readonly value: ReactNode
}

function ResourceMetadataSection({
  items,
  title,
}: {
  items?: Record<string, string>
  title: ReactNode
}) {
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

export function PlatformResourceOverview({
  ageSeconds,
  annotations,
  createdAt,
  createdAtLabel,
  facts = [],
  labels,
  name,
  namespace,
  namespaceLabel,
}: {
  readonly ageSeconds?: number
  readonly annotations?: Record<string, string>
  readonly createdAt?: string
  readonly createdAtLabel?: ReactNode
  readonly facts?: readonly PlatformResourceOverviewFact[]
  readonly labels?: Record<string, string>
  readonly name: ReactNode
  readonly namespace?: ReactNode
  readonly namespaceLabel?: ReactNode
}) {
  const { t, localeCode } = useI18n()
  const hasMetadata = Boolean(
    (labels && Object.keys(labels).length > 0) ||
    (annotations && Object.keys(annotations).length > 0),
  )

  return (
    <Card className="soha-detail-card">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        size="small"
        items={[
          { key: 'name', label: t('common.name', 'Name'), children: name },
          ...(namespace === undefined
            ? []
            : [
                {
                  key: 'namespace',
                  label: namespaceLabel ?? t('common.namespace', 'Namespace'),
                  children: namespace,
                },
              ]),
          {
            key: 'createdAt',
            label: createdAtLabel ?? t('common.createdAt', 'Created At'),
            children: createdAt ? formatRelativeTime(createdAt) : formatAgeSeconds(ageSeconds),
          },
          ...facts.map((fact) => ({
            key: fact.key,
            label: fact.label,
            children: fact.value,
          })),
        ]}
      />
      {hasMetadata ? (
        <div className="soha-workload-metadata-stack">
          <ResourceMetadataSection items={labels} title={t('common.labels', 'Labels')} />
          <ResourceMetadataSection
            items={annotations}
            title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
          />
        </div>
      ) : null}
    </Card>
  )
}
