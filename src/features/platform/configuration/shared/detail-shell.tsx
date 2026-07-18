import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { PlatformResourceOverview } from '@/features/platform/shared/resource-overview'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
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

export function ConfigurationResourceOverview({
  detail,
  extra,
}: {
  detail: ConfigurationDetailBase
  extra?: Array<{ key: string; value: ReactNode }>
}) {
  return (
    <PlatformResourceOverview
      ageSeconds={detail.ageSeconds}
      annotations={detail.annotations}
      createdAt={detail.createdAt}
      facts={(extra ?? []).map((item) => ({ ...item, label: item.key }))}
      labels={detail.labels}
      name={detail.name}
      namespace={detail.namespace || undefined}
    />
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
  overviewContent,
  scopeMode = 'namespace',
  showReferences = true,
  target,
}: {
  dataTab?: ReactNode
  detail: TDetail
  kind: ConfigurationKind
  label: string
  overviewExtra?: Array<{ key: string; value: ReactNode }>
  overviewContent?: ReactNode
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
      children: (
        <div className="soha-detail-stack">
          <ConfigurationResourceOverview detail={detail} extra={overviewExtra} />
          {overviewContent}
        </div>
      ),
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

export function ConfigurationQueryDetailPage<TDetail extends ConfigurationDetailBase>({
  kind,
  label,
  name,
  namespace,
  overviewExtra,
  renderOverview,
  scopeMode = 'namespace',
}: {
  kind: ConfigurationKind
  label: string
  name: string
  namespace?: string
  overviewExtra?: (detail: TDetail) => Array<{ key: string; value: ReactNode }>
  renderOverview?: (detail: TDetail) => ReactNode
  scopeMode?: ConfigurationScopeMode
}) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, scopeMode === 'namespace' ? namespace : null)
  const detailQuery = useQuery(configurationQueries.detail<TDetail>(kind, scope, name, scopeMode))
  const detail = detailQuery.data
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

  if (detailQuery.isLoading) {
    return (
      <ManagementState
        compact
        kind="loading"
        description={localeCode === 'zh_CN' ? '加载中' : 'Loading'}
      />
    )
  }
  if (detailQuery.isError) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          description={
            detailQuery.error instanceof Error
              ? detailQuery.error.message
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
      overviewContent={renderOverview?.(detail)}
      scopeMode={scopeMode}
      showReferences={false}
      target={target}
    />
  )
}
