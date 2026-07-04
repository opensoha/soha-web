import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Button, Card, Descriptions, Space, Spin, Tabs, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { BooleanTag } from '@/components/status-tag'
import {
  ResourceMetaOverview,
  useResourceYAMLState,
} from '@/features/platform/configuration-detail-pages'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { api } from '@/services/api-client'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { useI18n } from '@/i18n'
import {
  buildRBACDetailPath,
  parseRBACSubject,
  type ClusterRoleBindingResource,
  type RoleBindingResource,
} from '@/features/platform/platform-management-model'
import type {
  ApiResponse,
  ClusterRoleBindingDetail,
  ClusterRoleDetail,
  RoleBindingDetail,
  RoleDetail,
  ServiceAccountDetail,
} from '@/types'
import './platform-pages.css'

const { Text, Paragraph } = Typography

const K8sYamlEditor = lazy(async () => {
  const mod = await import('@/components/k8s-yaml-editor')
  return { default: mod.K8sYamlEditor }
})

function useResolvedNamespace() {
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  return namespace && namespace !== '' ? namespace : searchParams.get('namespace') || ''
}

function renderStringList(values: string[] | undefined, emptyLabel: string) {
  if (!values || values.length === 0) {
    return <Text type="secondary">{emptyLabel}</Text>
  }
  return (
    <div className="soha-tag-list">
      {values.map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
    </div>
  )
}

function splitRBACRef(value?: string) {
  if (!value) return null
  const [kind, ...nameParts] = value.split('/')
  const name = nameParts.join('/')
  return { kind: kind || 'Role', name: name || value }
}

function buildRBACPath(kind: string, name: string, namespace?: string) {
  switch (kind) {
    case 'ServiceAccount':
      return buildRBACDetailPath('serviceaccounts', name, namespace)
    case 'Role':
      return buildRBACDetailPath('roles', name, namespace)
    case 'ClusterRole':
      return buildRBACDetailPath('clusterroles', name)
    case 'RoleBinding':
      return buildRBACDetailPath('rolebindings', name, namespace)
    case 'ClusterRoleBinding':
      return buildRBACDetailPath('clusterrolebindings', name)
    default:
      return ''
  }
}

function RelationshipLink({ kind, name, namespace }: { kind: string; name: string; namespace?: string }) {
  const navigate = useNavigate()
  const path = buildRBACPath(kind, name, namespace)
  const label = namespace ? `${kind} ${namespace}/${name}` : `${kind} ${name}`
  if (!path) return <Tag className="soha-rbac-subject-chip">{label}</Tag>
  return (
    <Tag className="soha-rbac-subject-chip">
      <Button type="text" onClick={() => navigate(path)}>
        {label}
      </Button>
    </Tag>
  )
}

function RBACRelationshipPanel({
  items,
  loading,
}: {
  items: Array<{ key: string; label: string; children: ReactNode }>
  loading?: boolean
}) {
  return (
    <Card className="soha-detail-card">
      {loading ? (
        <ManagementState compact kind="loading" />
      ) : (
        <Descriptions column={{ xs: 1, sm: 2 }} items={items} size="small" />
      )}
    </Card>
  )
}

function BindingRelationships({
  namespace,
  roleRef,
  subjects,
}: {
  namespace?: string
  roleRef?: string
  subjects?: string[]
}) {
  const { localeCode } = useI18n()
  const ref = splitRBACRef(roleRef)
  const emptyRoleRef = localeCode === 'zh_CN' ? '暂无 RoleRef' : 'No roleRef'
  const emptySubjects = localeCode === 'zh_CN' ? '暂无主体' : 'No subjects'
  return (
    <RBACRelationshipPanel
      items={[
        {
          key: 'roleRef',
          label: localeCode === 'zh_CN' ? '绑定到角色' : 'Bound Role',
          children: ref ? (
            <RelationshipLink
              kind={ref.kind}
              name={ref.name}
              namespace={ref.kind === 'Role' ? namespace : undefined}
            />
          ) : (
            <Text type="secondary">{emptyRoleRef}</Text>
          ),
        },
        {
          key: 'subjects',
          label: localeCode === 'zh_CN' ? '授权主体' : 'Subjects',
          children: subjects?.length ? (
            <div className="soha-rbac-subject-list">
              {subjects.map((value) => {
                const subject = parseRBACSubject(value)
                return (
                  <RelationshipLink
                    key={value}
                    kind={subject.kind}
                    name={subject.name}
                    namespace={subject.namespace || namespace}
                  />
                )
              })}
            </div>
          ) : (
            <Text type="secondary">{emptySubjects}</Text>
          ),
        },
      ]}
    />
  )
}

function SubjectLinks({ namespace, subjects }: { namespace?: string; subjects?: string[] }) {
  const { localeCode } = useI18n()
  if (!subjects || subjects.length === 0) {
    return <Text type="secondary">{localeCode === 'zh_CN' ? '暂无主体' : 'No subjects'}</Text>
  }
  return (
    <div className="soha-rbac-subject-list">
      {subjects.map((value) => {
        const subject = parseRBACSubject(value)
        return (
          <RelationshipLink
            key={value}
            kind={subject.kind}
            name={subject.name}
            namespace={subject.namespace || namespace}
          />
        )
      })}
    </div>
  )
}

function useRoleBindingReferences({
  clusterId,
  kind,
  name,
  namespace,
}: {
  clusterId?: string | null
  kind: 'Role' | 'ClusterRole' | 'ServiceAccount'
  name: string
  namespace?: string
}) {
  const roleBindingsQuery = useQuery({
    queryKey: ['rbac-relationship-rolebindings', clusterId, namespace],
    queryFn: () =>
      api.get<ApiResponse<RoleBindingResource[]>>(
        `/clusters/${clusterId}/access-control/rolebindings${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`,
      ),
    enabled: !!clusterId,
  })
  const clusterRoleBindingsQuery = useQuery({
    queryKey: ['rbac-relationship-clusterrolebindings', clusterId],
    queryFn: () =>
      api.get<ApiResponse<ClusterRoleBindingResource[]>>(
        `/clusters/${clusterId}/access-control/clusterrolebindings`,
      ),
    enabled: !!clusterId,
  })
  const roleBindings = (roleBindingsQuery.data?.data ?? []).filter((binding) => {
    if (kind === 'ServiceAccount') {
      return (binding.subjects ?? []).some((value) => {
        const subject = parseRBACSubject(value)
        return subject.kind === 'ServiceAccount' && subject.name === name && (subject.namespace || binding.namespace) === namespace
      })
    }
    const ref = splitRBACRef(binding.roleRef)
    return ref?.kind === kind && ref.name === name && (kind === 'ClusterRole' || binding.namespace === namespace)
  })
  const clusterRoleBindings = (clusterRoleBindingsQuery.data?.data ?? []).filter((binding) => {
    if (kind === 'ServiceAccount') {
      return (binding.subjects ?? []).some((value) => {
        const subject = parseRBACSubject(value)
        return subject.kind === 'ServiceAccount' && subject.name === name && (!namespace || subject.namespace === namespace)
      })
    }
    const ref = splitRBACRef(binding.roleRef)
    return ref?.kind === kind && ref.name === name
  })
  return {
    clusterRoleBindings,
    loading: roleBindingsQuery.isLoading || clusterRoleBindingsQuery.isLoading,
    roleBindings,
  }
}

function ReferencedByRelationships({
  kind,
  name,
  namespace,
}: {
  kind: 'Role' | 'ClusterRole' | 'ServiceAccount'
  name: string
  namespace?: string
}) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const refs = useRoleBindingReferences({ clusterId, kind, name, namespace })
  return (
    <RBACRelationshipPanel
      loading={refs.loading}
      items={[
        {
          key: 'roleBindings',
          label: localeCode === 'zh_CN' ? 'RoleBindings 引用' : 'Referenced by RoleBindings',
          children: refs.roleBindings.length ? (
            <div className="soha-rbac-subject-list">
              {refs.roleBindings.map((binding) => (
                <RelationshipLink
                  key={`${binding.namespace}/${binding.name}`}
                  kind="RoleBinding"
                  name={binding.name}
                  namespace={binding.namespace}
                />
              ))}
            </div>
          ) : (
            <Text type="secondary">
              {localeCode === 'zh_CN' ? '暂无 RoleBinding 引用' : 'No RoleBinding references'}
            </Text>
          ),
        },
        {
          key: 'clusterRoleBindings',
          label:
            localeCode === 'zh_CN'
              ? 'ClusterRoleBindings 引用'
              : 'Referenced by ClusterRoleBindings',
          children: refs.clusterRoleBindings.length ? (
            <div className="soha-rbac-subject-list">
              {refs.clusterRoleBindings.map((binding) => (
                <RelationshipLink key={binding.name} kind="ClusterRoleBinding" name={binding.name} />
              ))}
            </div>
          ) : (
            <Text type="secondary">
              {localeCode === 'zh_CN'
                ? '暂无 ClusterRoleBinding 引用'
                : 'No ClusterRoleBinding references'}
            </Text>
          ),
        },
      ]}
    />
  )
}

function renderRuleSummaries(values: string[] | undefined, emptyLabel: string) {
  if (!values || values.length === 0) {
    return <Text type="secondary">{emptyLabel}</Text>
  }
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
      {values.map((value) => (
        <Card key={value} className="soha-detail-card" styles={{ body: { padding: 12 } }}>
          <Paragraph style={{ margin: 0 }}>{value}</Paragraph>
        </Card>
      ))}
    </Space>
  )
}

function yamlUnavailableDescription(localeCode: 'zh_CN' | 'en_US') {
  return localeCode === 'zh_CN'
    ? '当前资源没有可用 YAML 路径。'
    : 'This resource does not expose a YAML path.'
}

function yamlCapabilityUnavailableDescription(
  localeCode: 'zh_CN' | 'en_US',
  reason: string | undefined,
) {
  if (reason) {
    return reason
  }
  return localeCode === 'zh_CN'
    ? '当前集群连接模式暂不支持 YAML 查看与应用。'
    : 'The current cluster connection mode does not support YAML view and apply yet.'
}

interface RBACDetailPageProps<T> {
  detail: T | undefined
  detailTitle: string
  emptyDescription: string
  localeCode: 'zh_CN' | 'en_US'
  namespace?: string
  relationshipTab?: ReactNode
  resourceName: string
  renderOverview: (detail: T) => ReactNode
  yamlPath: string | null
  yamlResourceKey: string
  yamlTitle: string
}

function RBACDetailPage<T>({
  detail,
  detailTitle,
  emptyDescription,
  localeCode,
  namespace = '',
  relationshipTab,
  resourceName,
  renderOverview,
  yamlPath,
  yamlResourceKey,
  yamlTitle,
}: RBACDetailPageProps<T>) {
  const yamlApplyCapability = useClusterCapability('resource.yaml.apply', localeCode)
  const yamlApplyDisabledReason = yamlApplyCapability.disabled
    ? yamlApplyCapability.reason
    : undefined
  const yamlEditorPath =
    yamlPath && !yamlApplyCapability.isLoading && !yamlApplyCapability.disabled ? yamlPath : null
  const yamlState = useResourceYAMLState(yamlEditorPath, yamlResourceKey, resourceName, namespace)

  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState kind="not-found" description={emptyDescription} />
      </div>
    )
  }

  return (
    <div className="soha-page soha-workload-detail-page">
      <div className="soha-workload-detail-heading">
        <div className="soha-workload-detail-heading-main">
          <Text type="secondary" className="soha-workload-detail-kind">
            {detailTitle.split(':', 1)[0]}
          </Text>
          <Text strong className="soha-workload-detail-name">
            {resourceName}
          </Text>
        </div>
      </div>
      <Tabs
        className="soha-workload-detail-tabs"
        defaultActiveKey="overview"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        size="small"
        tabBarGutter={18}
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: renderOverview(detail),
          },
          ...(relationshipTab
            ? [
                {
                  key: 'relationships',
                  label: localeCode === 'zh_CN' ? '关联关系' : 'Relationships',
                  children: relationshipTab,
                },
              ]
            : []),
          {
            key: 'yaml',
            label: yamlTitle,
            children: !yamlPath ? (
              <ManagementState
                kind="unsupported"
                description={yamlUnavailableDescription(localeCode)}
              />
            ) : yamlApplyCapability.isLoading ? (
              <ManagementState kind="loading" />
            ) : yamlApplyCapability.disabled ? (
              <ManagementState
                kind="unsupported"
                description={yamlCapabilityUnavailableDescription(
                  localeCode,
                  yamlApplyDisabledReason,
                )}
              />
            ) : (
              <Suspense
                fallback={
                  <Card className="soha-detail-card">
                    <Spin size="large" />
                  </Card>
                }
              >
                <div style={{ height: 620 }}>
                  <K8sYamlEditor
                    value={yamlState.draft}
                    onChange={yamlState.setDraft}
                    onReset={() => yamlState.setDraft(yamlState.serverValue)}
                    onSave={() => void 0}
                    onApply={() => yamlState.applyMutation.mutate()}
                    saveDisabled
                    applyDisabled={
                      !yamlEditorPath || !yamlState.draft.trim() || yamlApplyCapability.disabled
                    }
                    applyDisabledReason={yamlApplyDisabledReason}
                    applying={yamlState.applyMutation.isPending}
                  />
                </div>
              </Suspense>
            ),
          },
        ]}
      />
    </div>
  )
}

export function PlatformAccessControlServiceAccountDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const namespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()
  const detailPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/serviceaccounts/${name}/detail?namespace=${encodeURIComponent(namespace)}`
      : null
  const yamlPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/serviceaccounts/${name}/yaml?namespace=${encodeURIComponent(namespace)}`
      : null
  const detailQuery = useQuery({
    queryKey: ['serviceaccounts', 'detail', name, namespace],
    queryFn: () => api.get<ApiResponse<ServiceAccountDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <RBACDetailPage<ServiceAccountDetail>
      detail={detail}
      detailTitle={`ServiceAccount: ${name}`}
      emptyDescription={
        localeCode === 'zh_CN' ? 'ServiceAccount 未找到' : 'ServiceAccount not found'
      }
      localeCode={localeCode}
      namespace={namespace}
      relationshipTab={
        <ReferencedByRelationships kind="ServiceAccount" name={name} namespace={namespace} />
      }
      resourceName={name}
      renderOverview={(item) => (
        <>
          <ResourceMetaOverview
            name={item.name}
            namespace={item.namespace}
            createdAt={item.createdAt}
            labels={item.labels}
            annotations={item.annotations}
            extra={[
              {
                key: localeCode === 'zh_CN' ? 'Secrets' : 'Secrets',
                value: renderStringList(
                  item.secrets,
                  localeCode === 'zh_CN' ? '暂无关联 Secrets' : 'No secrets',
                ),
              },
              {
                key: localeCode === 'zh_CN' ? '镜像拉取密钥' : 'Image Pull Secrets',
                value: renderStringList(
                  item.imagePullSecrets,
                  localeCode === 'zh_CN' ? '暂无 imagePullSecrets' : 'No image pull secrets',
                ),
              },
              {
                key: localeCode === 'zh_CN' ? '自动挂载 Token' : 'Automount Token',
                value: (
                  <BooleanTag
                    value={item.automountServiceAccountToken}
                    trueLabel={localeCode === 'zh_CN' ? '是' : 'Yes'}
                    falseLabel={localeCode === 'zh_CN' ? '否' : 'No'}
                  />
                ),
              },
            ]}
          />
        </>
      )}
      yamlPath={yamlPath}
      yamlResourceKey="serviceaccounts"
      yamlTitle="YAML"
    />
  )
}

export function PlatformAccessControlRoleDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const namespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()
  const detailPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/roles/${name}/detail?namespace=${encodeURIComponent(namespace)}`
      : null
  const yamlPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/roles/${name}/yaml?namespace=${encodeURIComponent(namespace)}`
      : null
  const detailQuery = useQuery({
    queryKey: ['roles', 'detail', name, namespace],
    queryFn: () => api.get<ApiResponse<RoleDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <RBACDetailPage<RoleDetail>
      detail={detail}
      detailTitle={`Role: ${name}`}
      emptyDescription={localeCode === 'zh_CN' ? 'Role 未找到' : 'Role not found'}
      localeCode={localeCode}
      namespace={namespace}
      relationshipTab={<ReferencedByRelationships kind="Role" name={name} namespace={namespace} />}
      resourceName={name}
      renderOverview={(item) => (
        <>
          <ResourceMetaOverview
            name={item.name}
            namespace={item.namespace}
            createdAt={item.createdAt}
            labels={item.labels}
            annotations={item.annotations}
            extra={[{ key: localeCode === 'zh_CN' ? '规则数' : 'Rules', value: item.rules }]}
          />
          <Card
            className="soha-detail-card"
            title={localeCode === 'zh_CN' ? '规则摘要' : 'Rule Summaries'}
          >
            {renderRuleSummaries(
              item.ruleSummaries,
              localeCode === 'zh_CN' ? '暂无规则摘要' : 'No rule summaries',
            )}
          </Card>
        </>
      )}
      yamlPath={yamlPath}
      yamlResourceKey="roles"
      yamlTitle="YAML"
    />
  )
}

export function PlatformAccessControlRoleBindingDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const namespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()
  const detailPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/rolebindings/${name}/detail?namespace=${encodeURIComponent(namespace)}`
      : null
  const yamlPath =
    clusterId && namespace
      ? `/clusters/${clusterId}/access-control/rolebindings/${name}/yaml?namespace=${encodeURIComponent(namespace)}`
      : null
  const detailQuery = useQuery({
    queryKey: ['rolebindings', 'detail', name, namespace],
    queryFn: () => api.get<ApiResponse<RoleBindingDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <RBACDetailPage<RoleBindingDetail>
      detail={detail}
      detailTitle={`RoleBinding: ${name}`}
      emptyDescription={localeCode === 'zh_CN' ? 'RoleBinding 未找到' : 'RoleBinding not found'}
      localeCode={localeCode}
      namespace={namespace}
      relationshipTab={
        <BindingRelationships
          namespace={namespace}
          roleRef={detail?.roleRef}
          subjects={detail?.subjects}
        />
      }
      resourceName={name}
      renderOverview={(item) => (
        <ResourceMetaOverview
          name={item.name}
          namespace={item.namespace}
          createdAt={item.createdAt}
          labels={item.labels}
          annotations={item.annotations}
          extra={[
            {
              key: 'RoleRef',
              value: (() => {
                const ref = splitRBACRef(item.roleRef)
                return ref ? (
                  <RelationshipLink
                    kind={ref.kind}
                    name={ref.name}
                    namespace={ref.kind === 'Role' ? item.namespace : undefined}
                  />
                ) : (
                  item.roleRef
                )
              })(),
            },
            {
              key: localeCode === 'zh_CN' ? 'Subjects' : 'Subjects',
              value: <SubjectLinks namespace={item.namespace} subjects={item.subjects} />,
            },
          ]}
        />
      )}
      yamlPath={yamlPath}
      yamlResourceKey="rolebindings"
      yamlTitle="YAML"
    />
  )
}

export function PlatformAccessControlClusterRoleDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const { clusterId } = usePlatformScopeStore()
  const detailPath = clusterId
    ? `/clusters/${clusterId}/access-control/clusterroles/${name}/detail`
    : null
  const yamlPath = clusterId
    ? `/clusters/${clusterId}/access-control/clusterroles/${name}/yaml`
    : null
  const detailQuery = useQuery({
    queryKey: ['clusterroles', 'detail', name],
    queryFn: () => api.get<ApiResponse<ClusterRoleDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <RBACDetailPage<ClusterRoleDetail>
      detail={detail}
      detailTitle={`ClusterRole: ${name}`}
      emptyDescription={localeCode === 'zh_CN' ? 'ClusterRole 未找到' : 'ClusterRole not found'}
      localeCode={localeCode}
      relationshipTab={<ReferencedByRelationships kind="ClusterRole" name={name} />}
      resourceName={name}
      renderOverview={(item) => (
        <>
          <ResourceMetaOverview
            name={item.name}
            namespace={localeCode === 'zh_CN' ? '集群级' : 'Cluster-scoped'}
            createdAt={item.createdAt}
            labels={item.labels}
            annotations={item.annotations}
            extra={[
              { key: localeCode === 'zh_CN' ? '规则数' : 'Rules', value: item.rules },
              {
                key: localeCode === 'zh_CN' ? '聚合规则' : 'Aggregation',
                value: item.aggregationRules,
              },
            ]}
          />
          <Card
            className="soha-detail-card"
            title={localeCode === 'zh_CN' ? '规则摘要' : 'Rule Summaries'}
          >
            {renderRuleSummaries(
              item.ruleSummaries,
              localeCode === 'zh_CN' ? '暂无规则摘要' : 'No rule summaries',
            )}
          </Card>
        </>
      )}
      yamlPath={yamlPath}
      yamlResourceKey="clusterroles"
      yamlTitle="YAML"
    />
  )
}

export function PlatformAccessControlClusterRoleBindingDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const { clusterId } = usePlatformScopeStore()
  const detailPath = clusterId
    ? `/clusters/${clusterId}/access-control/clusterrolebindings/${name}/detail`
    : null
  const yamlPath = clusterId
    ? `/clusters/${clusterId}/access-control/clusterrolebindings/${name}/yaml`
    : null
  const detailQuery = useQuery({
    queryKey: ['clusterrolebindings', 'detail', name],
    queryFn: () => api.get<ApiResponse<ClusterRoleBindingDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <RBACDetailPage<ClusterRoleBindingDetail>
      detail={detail}
      detailTitle={`ClusterRoleBinding: ${name}`}
      emptyDescription={
        localeCode === 'zh_CN' ? 'ClusterRoleBinding 未找到' : 'ClusterRoleBinding not found'
      }
      localeCode={localeCode}
      relationshipTab={
        <BindingRelationships roleRef={detail?.roleRef} subjects={detail?.subjects} />
      }
      resourceName={name}
      renderOverview={(item) => (
        <ResourceMetaOverview
          name={item.name}
          namespace={localeCode === 'zh_CN' ? '集群级' : 'Cluster-scoped'}
          createdAt={item.createdAt}
          labels={item.labels}
          annotations={item.annotations}
          extra={[
            {
              key: 'RoleRef',
              value: (() => {
                const ref = splitRBACRef(item.roleRef)
                return ref ? <RelationshipLink kind={ref.kind} name={ref.name} /> : item.roleRef
              })(),
            },
            {
              key: localeCode === 'zh_CN' ? 'Subjects' : 'Subjects',
              value: <SubjectLinks subjects={item.subjects} />,
            },
          ]}
        />
      )}
      yamlPath={yamlPath}
      yamlResourceKey="clusterrolebindings"
      yamlTitle="YAML"
    />
  )
}
