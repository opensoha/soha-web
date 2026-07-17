import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Descriptions, Spin, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import type { TabsProps, TableColumnsType } from 'antd'
import { configurationMutations } from './mutations'
import { configurationQueries } from './queries'
import type {
  ConfigurationDetailBase,
  ConfigurationKind,
  ConfigurationReference,
  ConfigurationScopeMode,
  ConfigurationTarget,
} from './types'
import '../styles.css'

const { Text } = Typography

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

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

export function ConfigurationResourceOverview({
  detail,
  extra,
}: {
  detail: ConfigurationDetailBase
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
          {
            key: t('common.name', 'Name'),
            label: t('common.name', 'Name'),
            children: detail.name,
          },
          ...(detail.namespace
            ? [
                {
                  key: t('common.namespace', 'Namespace'),
                  label: t('common.namespace', 'Namespace'),
                  children: detail.namespace,
                },
              ]
            : []),
          {
            key: t('common.createdAt', 'Created At'),
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
      />
      {hasLabels || hasAnnotations ? (
        <div className="soha-workload-metadata-stack">
          <ResourceMetadataSection items={detail.labels} title={t('common.labels', 'Labels')} />
          <ResourceMetadataSection
            items={detail.annotations}
            title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
          />
        </div>
      ) : null}
    </Card>
  )
}

function ConfigurationReferencesTab({
  kind,
  target,
}: {
  kind: ConfigurationKind
  target: ConfigurationTarget
}) {
  const { localeCode } = useI18n()
  const referencesQuery = useQuery(configurationQueries.references(kind, target.scope, target.name))
  const columns: TableColumnsType<ConfigurationReference> = [
    {
      title: localeCode === 'zh_CN' ? '资源类型' : 'Kind',
      dataIndex: 'kind',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      render: (value: string) => (
        <Text className="soha-config-reference-name" title={value}>
          {value}
        </Text>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 180,
    },
    {
      title: localeCode === 'zh_CN' ? '引用位置' : 'Reference',
      dataIndex: 'path',
      ellipsis: { showTitle: false },
      render: (value: string) => (
        <Text className="soha-config-reference-path" title={value}>
          {value}
        </Text>
      ),
    },
  ]
  return (
    <Card className="soha-detail-card">
      <Table<ConfigurationReference>
        className="soha-platform-table soha-config-reference-table"
        columns={columns}
        dataSource={referencesQuery.data ?? []}
        loading={referencesQuery.isLoading}
        locale={{
          emptyText: (
            <ManagementState
              bordered={false}
              compact
              description={localeCode === 'zh_CN' ? '暂无关联资源' : 'No referencing resources'}
            />
          ),
        }}
        pagination={false}
        rowKey={(record) => `${record.kind}/${record.namespace}/${record.name}/${record.path}`}
        size="small"
        tableLayout="fixed"
      />
    </Card>
  )
}

function ConfigurationYAMLTab({
  kind,
  scopeMode,
  target,
}: {
  kind: ConfigurationKind
  scopeMode: ConfigurationScopeMode
  target: ConfigurationTarget
}) {
  const { t, localeCode } = useI18n()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery(configurationQueries.yaml(kind, target.scope, target.name, scopeMode))
  const updateMutation = useMutation(configurationMutations.updateYAML(kind, queryClient))
  const serverValue = yamlQuery.data?.content ?? ''
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(serverValue)
  }, [serverValue])

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
                  void message.success(t('yamlEditor.applySuccess', 'YAML applied'))
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

export function ConfigurationDetailShell<TDetail extends ConfigurationDetailBase>({
  dataTab,
  detail,
  kind,
  overviewExtra,
  scopeMode = 'namespace',
  showReferences = true,
  target,
}: {
  dataTab?: ReactNode
  detail: TDetail
  kind: ConfigurationKind
  label: string
  overviewExtra?: Array<{ key: string; value: ReactNode }>
  scopeMode?: ConfigurationScopeMode
  showReferences?: boolean
  target: ConfigurationTarget
}) {
  const { t, localeCode } = useI18n()
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const items: NonNullable<TabsProps['items']> = [
    {
      key: 'overview',
      label: t('common.overview', 'Overview'),
      children: <ConfigurationResourceOverview detail={detail} extra={overviewExtra} />,
    },
    ...(dataTab === undefined
      ? []
      : [
          {
            key: 'data',
            label: localeCode === 'zh_CN' ? '数据' : 'Data',
            children: dataTab,
          },
        ]),
    ...(showReferences
      ? [
          {
            key: 'relationships',
            label: localeCode === 'zh_CN' ? '关联关系' : 'Relationships',
            children:
              activeTabKey === 'relationships' ? (
                <ConfigurationReferencesTab kind={kind} target={target} />
              ) : null,
          },
        ]
      : []),
    {
      key: 'yaml',
      label: t('common.yaml', 'YAML'),
      children:
        activeTabKey === 'yaml' ? (
          <ConfigurationYAMLTab kind={kind} scopeMode={scopeMode} target={target} />
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
        onChange={setActiveTabKey}
        size="small"
        tabBarGutter={18}
      />
    </div>
  )
}

export function ConfigurationListDetailPage<TDetail extends ConfigurationDetailBase>({
  kind,
  label,
  name,
  namespace,
  overviewExtra,
  scopeMode = 'namespace',
}: {
  kind: ConfigurationKind
  label: string
  name: string
  namespace?: string
  overviewExtra?: (detail: TDetail) => Array<{ key: string; value: ReactNode }>
  scopeMode?: ConfigurationScopeMode
}) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, scopeMode === 'namespace' ? namespace : null)
  const listQuery = useQuery(configurationQueries.list<TDetail>(kind, scope))
  const detail = listQuery.data?.find(
    (record) =>
      record.name === name &&
      (scopeMode === 'cluster' || !namespace || record.namespace === namespace),
  )
  const scopeMissing = !clusterId || (scopeMode === 'namespace' && !namespace)

  if (scopeMissing) {
    return (
      <div className="soha-page">
        <ManagementState
          compact
          kind="select-scope"
          description={
            localeCode === 'zh_CN'
              ? scopeMode === 'namespace'
                ? '请选择集群和命名空间'
                : '请选择集群'
              : scopeMode === 'namespace'
                ? 'Select a cluster and namespace'
                : 'Select a cluster'
          }
        />
      </div>
    )
  }

  if (listQuery.isLoading) {
    return (
      <ManagementState
        compact
        kind="loading"
        description={localeCode === 'zh_CN' ? '加载中' : 'Loading'}
      />
    )
  }
  if (listQuery.isError) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          description={
            listQuery.error instanceof Error
              ? listQuery.error.message
              : localeCode === 'zh_CN'
                ? '加载失败'
                : 'Load failed'
          }
        />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? `${label} 未找到` : `${label} not found`}
        />
      </div>
    )
  }

  const target = {
    scope: toScopeKey(clusterId, scopeMode === 'namespace' ? detail.namespace : null),
    name: detail.name,
  }
  return (
    <ConfigurationDetailShell
      detail={detail}
      kind={kind}
      label={label}
      overviewExtra={overviewExtra?.(detail)}
      scopeMode={scopeMode}
      showReferences={false}
      target={target}
    />
  )
}
