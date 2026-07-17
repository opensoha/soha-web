import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { App, Tabs, Card, Spin, Descriptions, Tooltip, Typography } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatRelativeTime } from '@/utils/time'
import { resolveWorkloadNamespace } from '@/features/platform/workloads-model'
import { toScopeKey } from '@/types'
import type { TabsProps } from 'antd'
import { updateWorkloadYAML } from '@/features/platform/workloads/shared/api'
import { workloadQueries } from '@/features/platform/workloads/shared/queries'
import type { WorkloadKind } from '@/features/platform/workloads/shared/types'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography

const K8sYamlEditor = lazy(async () => {
  const mod = await import('@/components/k8s-yaml-editor')
  return { default: mod.K8sYamlEditor }
})

/* ─── generic workload detail ─── */

export interface WorkloadMeta {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  createdAt: string
  yaml?: string
  [key: string]: unknown
}

export type WorkloadDetailExtraOverview = ReactNode | ((detail: WorkloadMeta) => ReactNode)

export type WorkloadDetailExtraTabPanes =
  | NonNullable<TabsProps['items']>
  | ((detail: WorkloadMeta) => NonNullable<TabsProps['items']>)

function WorkloadMetadataSection({
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

export function WorkloadDetailShell({
  title,
  resource,
  paramKey,
  extraTabPanes,
  extraOverview,
  activeTabKey,
  onTabChange,
  yamlLast = false,
}: {
  title: string
  resource: WorkloadKind
  paramKey: string
  extraTabPanes?: WorkloadDetailExtraTabPanes
  extraOverview?: WorkloadDetailExtraOverview
  activeTabKey?: string
  onTabChange?: (activeKey: string) => void
  yamlLast?: boolean
}) {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const name = params[paramKey] as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = resolveWorkloadNamespace(namespace, searchParams.get('namespace'))
  const [internalActiveTabKey, setInternalActiveTabKey] = useState('overview')
  const resolvedActiveTabKey = activeTabKey ?? internalActiveTabKey

  const detailScope = toScopeKey(clusterId, detailNamespace)
  const detailQuery = useQuery(workloadQueries.detail<WorkloadMeta>(resource, detailScope, name))
  const yamlQueryOptions = workloadQueries.yaml(resource, detailScope, name)
  const yamlQuery = useQuery({
    ...yamlQueryOptions,
    enabled: Boolean(yamlQueryOptions.enabled) && resolvedActiveTabKey === 'yaml',
  })
  const yamlServerValue = yamlQuery.data?.content ?? ''
  const yamlDraftStorageKey = useMemo(
    () =>
      clusterId
        ? `kc:yaml-draft:${clusterId}:${resource}:${detailNamespace || 'default'}:${name}`
        : '',
    [clusterId, detailNamespace, name, resource],
  )
  const [yamlDraft, setYamlDraft] = useState('')
  const yamlApplyCapability = useClusterCapability('resource.yaml.apply', localeCode)
  const yamlApplyDisabledReason = yamlApplyCapability.disabled
    ? yamlApplyCapability.reason
    : undefined

  const applyYamlMutation = useMutation({
    mutationFn: () =>
      updateWorkloadYAML(resource, detailScope, name, {
        content: yamlDraft,
      }),
    onSuccess: (resourceYAML) => {
      if (yamlDraftStorageKey) {
        window.localStorage.removeItem(yamlDraftStorageKey)
      }
      setYamlDraft(resourceYAML.content ?? yamlDraft)
      void message.success(t('yamlEditor.applySuccess', 'YAML applied'))
      yamlQuery.refetch()
      detailQuery.refetch()
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const detail = detailQuery.data

  useEffect(() => {
    if (!yamlDraftStorageKey) return
    const draft = yamlDraftStorageKey ? window.localStorage.getItem(yamlDraftStorageKey) : null
    setYamlDraft(draft ?? yamlServerValue)
  }, [yamlDraftStorageKey, yamlServerValue])

  if (detailQuery.isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  if (!detail)
    return (
      <ManagementState
        compact
        kind="not-found"
        title={localeCode === 'zh_CN' ? `${title}未找到` : `${title} not found`}
      />
    )

  const resolvedExtraOverview =
    typeof extraOverview === 'function' ? extraOverview(detail) : extraOverview
  const resolvedExtraTabPanes =
    typeof extraTabPanes === 'function' ? extraTabPanes(detail) : (extraTabPanes ?? [])

  return (
    <div className="soha-page soha-workload-detail-page">
      <Tabs
        activeKey={resolvedActiveTabKey}
        className="soha-resource-tabs soha-workload-detail-tabs"
        onChange={(nextActiveKey) => {
          setInternalActiveTabKey(nextActiveKey)
          onTabChange?.(nextActiveKey)
        }}
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        size="small"
        tabBarGutter={18}
        items={[
          {
            key: 'overview',
            label: t('common.overview', 'Overview'),
            children: (
              <>
                <Card className="soha-detail-card">
                  <Descriptions
                    column={{ xs: 1, sm: 2, md: 3 }}
                    size="small"
                    items={[
                      {
                        key: t('common.name', 'Name'),
                        label: t('common.name', 'Name'),
                        children: detail.name,
                      },
                      {
                        key: t('common.namespace', 'Namespace'),
                        label: t('common.namespace', 'Namespace'),
                        children: detail.namespace,
                      },
                      {
                        key: t('common.createdAt', 'Created At'),
                        label: t('common.createdAt', 'Created At'),
                        children: detail.createdAt ? formatRelativeTime(detail.createdAt) : '-',
                      },
                    ]}
                  />
                  <div className="soha-workload-metadata-stack">
                    <WorkloadMetadataSection
                      items={detail.labels}
                      title={t('common.labels', 'Labels')}
                    />
                    <WorkloadMetadataSection
                      items={detail.annotations}
                      title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
                    />
                  </div>
                </Card>
                {resolvedExtraOverview}
              </>
            ),
          },
          ...(yamlLast ? resolvedExtraTabPanes : []),
          {
            key: 'yaml',
            label: t('common.yaml', 'YAML'),
            children: (
              <Suspense
                fallback={
                  <Card className="soha-detail-card">
                    <Spin size="large" />
                  </Card>
                }
              >
                <K8sYamlEditor
                  value={yamlDraft}
                  onChange={setYamlDraft}
                  onReset={() => {
                    if (yamlDraftStorageKey) {
                      window.localStorage.removeItem(yamlDraftStorageKey)
                    }
                    setYamlDraft(yamlServerValue)
                    void message.success(t('yamlEditor.resetSuccess', 'YAML draft reset'))
                  }}
                  onSave={() => {
                    if (!yamlDraftStorageKey) return
                    window.localStorage.setItem(yamlDraftStorageKey, yamlDraft)
                    void message.success(t('yamlEditor.saveSuccess', 'YAML draft saved locally'))
                  }}
                  onApply={() => applyYamlMutation.mutate()}
                  saveDisabled={!yamlDraftStorageKey}
                  applyDisabled={
                    !yamlQueryOptions.enabled || !yamlDraft.trim() || yamlApplyCapability.disabled
                  }
                  applyDisabledReason={yamlApplyDisabledReason}
                  applying={applyYamlMutation.isPending}
                />
              </Suspense>
            ),
          },
          ...(yamlLast ? [] : resolvedExtraTabPanes),
        ]}
      />
    </div>
  )
}
