import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Space, Spin, Tabs, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TabsProps } from 'antd'
import { accessControlMutations } from './mutations'
import { accessControlQueries } from './queries'
import {
  accessControlScopeFromSelection,
  accessControlScopeMode,
  resolveAccessControlNamespace,
} from './scope'
import type { AccessControlDetailBase, AccessControlKind, AccessControlTarget } from './types'
import '../styles.css'

const { Paragraph, Text } = Typography

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

function AccessControlYAMLTab({
  kind,
  target,
}: {
  kind: AccessControlKind
  target: AccessControlTarget
}) {
  const { t, localeCode } = useI18n()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery(accessControlQueries.yaml(kind, target.scope, target.name))
  const updateMutation = useMutation(accessControlMutations.updateYAML(kind, queryClient))
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
          onChange={setDraft}
          onReset={() => setDraft(serverValue)}
          onSave={() =>
            void message.info(
              localeCode === 'zh_CN' ? '暂不支持本地草稿' : 'Local draft save disabled here',
            )
          }
          applyDisabled={!draft.trim() || updateMutation.isPending}
          applying={updateMutation.isPending}
          saveDisabled
        />
      </div>
    </Suspense>
  )
}

export function renderAccessControlRuleSummaries(values: string[] | undefined, emptyLabel: string) {
  if (!values?.length) return <Text type="secondary">{emptyLabel}</Text>
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {values.map((value) => (
        <Card key={value} className="soha-detail-card" styles={{ body: { padding: 12 } }}>
          <Paragraph style={{ margin: 0 }}>{value}</Paragraph>
        </Card>
      ))}
    </Space>
  )
}

export function AccessControlResourceDetailPage<TDetail extends AccessControlDetailBase>({
  kind,
  label,
  renderOverview,
  renderRelationships,
}: {
  kind: AccessControlKind
  label: string
  renderOverview: (detail: TDetail) => ReactNode
  renderRelationships?: (detail: TDetail) => ReactNode
}) {
  const { localeCode } = useI18n()
  const { name = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scopeMode = accessControlScopeMode(kind)
  const detailNamespace =
    scopeMode === 'namespace'
      ? resolveAccessControlNamespace(namespace, searchParams.get('namespace'))
      : null
  const scope = accessControlScopeFromSelection(kind, clusterId, detailNamespace)
  const target = { scope, name }
  const detailQuery = useQuery(accessControlQueries.detail<TDetail>(kind, scope, name))
  const yamlCapability = useClusterCapability('resource.yaml.apply', localeCode)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const detail = detailQuery.data

  if (!clusterId || (scopeMode === 'namespace' && !detailNamespace)) {
    return (
      <div className="soha-page">
        <ManagementState
          description={
            localeCode === 'zh_CN'
              ? '请选择集群和命名空间查看 RBAC 资源。'
              : 'Select a cluster and namespace to inspect this RBAC resource.'
          }
          kind="select-scope"
        />
      </div>
    )
  }
  if (detailQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }
  if (detailQuery.isError) {
    return (
      <div className="soha-page">
        <ManagementState
          description={detailQuery.error.message}
          kind="error"
          title={localeCode === 'zh_CN' ? 'RBAC 资源暂时不可用' : 'RBAC resource unavailable'}
        />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          description={localeCode === 'zh_CN' ? `${label} 未找到` : `${label} not found`}
          kind="not-found"
        />
      </div>
    )
  }

  const items: NonNullable<TabsProps['items']> = [
    {
      key: 'overview',
      label: localeCode === 'zh_CN' ? '概览' : 'Overview',
      children: renderOverview(detail),
    },
    ...(renderRelationships
      ? [
          {
            key: 'relationships',
            label: localeCode === 'zh_CN' ? '关联关系' : 'Relationships',
            children: activeTabKey === 'relationships' ? renderRelationships(detail) : null,
          },
        ]
      : []),
    {
      key: 'yaml',
      label: 'YAML',
      children:
        activeTabKey !== 'yaml' ? null : yamlCapability.isLoading ? (
          <ManagementState kind="loading" />
        ) : yamlCapability.disabled ? (
          <ManagementState
            description={
              yamlCapability.reason ||
              (localeCode === 'zh_CN'
                ? '当前集群连接模式暂不支持 YAML 查看与应用。'
                : 'The current cluster connection mode does not support YAML view and apply yet.')
            }
            kind="unsupported"
          />
        ) : (
          <AccessControlYAMLTab kind={kind} target={target} />
        ),
    },
  ]

  return (
    <div className="soha-page soha-workload-detail-page">
      <div className="soha-workload-detail-heading">
        <div className="soha-workload-detail-heading-main">
          <Text className="soha-workload-detail-kind" type="secondary">
            {label}
          </Text>
          <Text strong className="soha-workload-detail-name">
            {name}
          </Text>
        </div>
      </div>
      <Tabs
        activeKey={activeTabKey}
        className="soha-workload-detail-tabs"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        items={items}
        onChange={setActiveTabKey}
        size="small"
        tabBarGutter={18}
      />
    </div>
  )
}
