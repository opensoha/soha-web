import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Descriptions, Spin, Tabs, Tooltip, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import type { TabsProps } from 'antd'
import { networkMutations } from './mutations'
import { networkQueries } from './queries'
import type { NetworkKind, NetworkResourceRecord, NetworkTarget } from './types'
import '../styles.css'

const { Text } = Typography

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

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
            <Tooltip key={key} title={`${key}: ${displayValue}`}>
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

export function NetworkResourceOverview({
  ageLabel,
  detail,
  extra,
}: {
  ageLabel?: ReactNode
  detail: NetworkResourceRecord
  extra?: Array<{ key: string; value: ReactNode }>
}) {
  const { t, localeCode } = useI18n()
  const hasLabels = Boolean(detail.labels && Object.keys(detail.labels).length > 0)
  const hasAnnotations = Boolean(detail.annotations && Object.keys(detail.annotations).length > 0)
  return (
    <Card className="soha-detail-card">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        size="small"
        items={[
          { key: 'name', label: t('common.name', 'Name'), children: detail.name },
          {
            key: 'namespace',
            label: t('common.namespace', 'Namespace'),
            children: detail.namespace || '-',
          },
          {
            key: 'age',
            label: ageLabel ?? t('common.createdAt', 'Created At'),
            children: formatAgeSeconds(detail.ageSeconds),
          },
          ...(extra ?? []).map((item) => ({
            key: item.key,
            label: item.key,
            children: item.value,
          })),
        ]}
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

function NetworkYAMLTab({
  clusterScoped,
  kind,
  target,
}: {
  clusterScoped: boolean
  kind: NetworkKind
  target: NetworkTarget
}) {
  const { localeCode } = useI18n()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery(networkQueries.yaml(kind, target.scope, target.name, clusterScoped))
  const updateMutation = useMutation(networkMutations.updateYAML(kind, queryClient))
  const serverValue = yamlQuery.data?.content ?? ''
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(serverValue)
  }, [serverValue])

  if (yamlQuery.isLoading) {
    return (
      <Card className="soha-detail-card">
        <Spin size="large" />
      </Card>
    )
  }

  return (
    <Suspense
      fallback={
        <Card className="soha-detail-card">
          <Spin size="large" />
        </Card>
      }
    >
      <div style={{ height: 620 }}>
        <K8sYamlEditor
          value={draft}
          onChange={setDraft}
          onReset={() => setDraft(serverValue)}
          onSave={() =>
            void message.info(
              localeCode === 'zh_CN' ? '暂不支持本地草稿' : 'Local draft save disabled here',
            )
          }
          onApply={() =>
            updateMutation.mutate(
              { ...target, content: draft },
              {
                onSuccess: (yaml) => {
                  setDraft(yaml.content ?? draft)
                  void message.success(localeCode === 'zh_CN' ? 'YAML 已应用' : 'YAML applied')
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }
          saveDisabled
          applyDisabled={!draft.trim() || updateMutation.isPending}
          applying={updateMutation.isPending}
        />
      </div>
    </Suspense>
  )
}

export function NetworkDetailShell({
  activeTabKey,
  ageLabel,
  clusterScoped = false,
  detail,
  extraTabs = [],
  kind,
  onTabChange,
  overviewExtra,
  target,
}: {
  activeTabKey: string
  ageLabel?: ReactNode
  clusterScoped?: boolean
  detail: NetworkResourceRecord
  extraTabs?: NonNullable<TabsProps['items']>
  kind: NetworkKind
  label: string
  onTabChange: (key: string) => void
  overviewExtra?: Array<{ key: string; value: ReactNode }>
  target: NetworkTarget
}) {
  const { t } = useI18n()
  const items: NonNullable<TabsProps['items']> = [
    {
      key: 'overview',
      label: t('common.overview', 'Overview'),
      children: (
        <NetworkResourceOverview ageLabel={ageLabel} detail={detail} extra={overviewExtra} />
      ),
    },
    ...extraTabs,
    {
      key: 'yaml',
      label: t('common.yaml', 'YAML'),
      children:
        activeTabKey === 'yaml' ? (
          <NetworkYAMLTab clusterScoped={clusterScoped} kind={kind} target={target} />
        ) : null,
    },
  ]

  return (
    <div className="soha-page soha-workload-detail-page">
      <Tabs
        activeKey={activeTabKey}
        className="soha-resource-tabs soha-workload-detail-tabs"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        items={items}
        onChange={onTabChange}
        size="small"
        tabBarGutter={18}
      />
    </div>
  )
}
