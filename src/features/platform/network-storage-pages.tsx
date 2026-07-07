import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Spin, Tabs, Tag, Tooltip, Typography, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementState,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { ResourceMetricsPanel } from '@/components/resource-metrics-panel'
import { useResourceActions } from '@/components/resource-actions'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth/permission-snapshot'
import { encodeAIContextForElement } from '@/features/copilot/global-assistant/ai-context'
import { useAIPageContext } from '@/features/copilot/global-assistant/ai-context-provider'
import {
  CreateResourceModal,
  ResourceMetaOverview,
  useResourceYAMLState,
} from '@/features/platform/configuration-detail-pages'
import { buildClusterScopedPath } from '@/features/platform/platform-scope-query'
import { useI18n } from '@/i18n'
import { api } from '@/services/api-client'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds } from '@/utils/time'
import type {
  ApiResponse,
  PersistentVolume,
  PersistentVolumeClaim,
  PersistentVolumeClaimDetail,
  PersistentVolumeDetail,
  ResourceMetrics,
  StorageClass,
  StorageClassDetail,
} from '@/types'
import type { TableColumnsType, TabsProps } from 'antd'
import './platform-pages.css'

const { Text } = Typography

function PlatformResourceState({
  description,
  kind,
  title,
}: {
  description: React.ReactNode
  kind?: 'empty' | 'error' | 'not-found' | 'select-scope'
  title?: React.ReactNode
}) {
  return (
    <ManagementState
      bordered={false}
      compact
      description={description}
      kind={kind ?? 'empty'}
      title={title}
    />
  )
}

function resourceEmptyKind(
  clusterId: string | null | undefined,
  description: string,
): 'empty' | 'select-scope' {
  return !clusterId || description.includes('请选择') || description.includes('Select a cluster')
    ? 'select-scope'
    : 'empty'
}

const K8sYamlEditor = lazy(async () => {
  const mod = await import('@/components/k8s-yaml-editor')
  return { default: mod.K8sYamlEditor }
})

const PVC_DEFAULT_TEMPLATE = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: example-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`

const PV_DEFAULT_TEMPLATE = `apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/example-pv
`

const STORAGE_CLASS_DEFAULT_TEMPLATE = `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: example-storage-class
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
`

interface Service {
  name: string
  namespace: string
  type: string
  clusterIp: string
  ports: string[]
  selector?: Record<string, string>
  ageSeconds: number
  allowedActions?: string[]
}

interface ServiceBackendPod {
  name: string
  namespace: string
  phase: string
  readyContainers: string
  restarts: number
  nodeName?: string
  podIp?: string
  labels?: Record<string, string>
  ageSeconds: number
}

interface ServiceEvent {
  name: string
  namespace?: string
  type: string
  reason: string
  involvedKind?: string
  involvedName?: string
  message: string
  count: number
  ageSeconds: number
}

interface Ingress {
  name: string
  namespace: string
  className?: string
  hosts: string[]
  address: string
  backendServices?: string[]
  ageSeconds: number
  allowedActions?: string[]
}

interface GatewayClass {
  name: string
  controllerName: string
  accepted?: string
  parametersRef?: string
  ageSeconds: number
  allowedActions?: string[]
}

interface Gateway {
  name: string
  namespace: string
  gatewayClass?: string
  addresses?: string[]
  listenerCount: number
  ageSeconds: number
  allowedActions?: string[]
}

interface HTTPRoute {
  name: string
  namespace: string
  hostnames?: string[]
  parentRefs?: string[]
  backendServices?: string[]
  ageSeconds: number
}

interface BackendTLSPolicy {
  name: string
  namespace: string
  targetRefs?: string[]
  hostname?: string
  caCertificateRefs?: string[]
  wellKnownCACertificates?: string
  ageSeconds: number
}

interface GRPCRoute {
  name: string
  namespace: string
  hostnames?: string[]
  parentRefs?: string[]
  backendServices?: string[]
  ruleCount: number
  ageSeconds: number
}

interface ReferenceGrant {
  name: string
  namespace: string
  from?: string[]
  to?: string[]
  ageSeconds: number
}

interface EndpointSlice {
  name: string
  namespace: string
  addressType: string
  endpoints: number
  ports?: string[]
  ageSeconds: number
  allowedActions?: string[]
}

interface IngressClass {
  name: string
  controller: string
  isDefault: boolean
  parameters?: string
  ageSeconds: number
  allowedActions?: string[]
}

interface NetworkPolicy {
  name: string
  namespace: string
  policyTypes?: string[]
  ingressRules: number
  egressRules: number
  ageSeconds: number
  allowedActions?: string[]
}

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase()
}

function includesSearch(values: Array<string | undefined | null>, keyword: string) {
  if (!keyword) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(keyword))
}

function buildResourceKeywordQuery({
  localeCode,
  placeholder,
  searchKeyword,
  setSearchKeyword,
}: {
  localeCode: 'zh_CN' | 'en_US'
  placeholder: string
  searchKeyword: string
  setSearchKeyword: (value: string) => void
}) {
  return {
    onFinish: () => undefined,
    actions: (
      <ManagementQueryActions
        disabledReset={!searchKeyword.trim()}
        onReset={() => setSearchKeyword('')}
        resetLabel={localeCode === 'zh_CN' ? '重置' : 'Reset'}
        submitLabel={localeCode === 'zh_CN' ? '查询' : 'Search'}
      />
    ),
    children: (
      <ManagementKeywordField
        label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
        value={searchKeyword}
        onChange={setSearchKeyword}
        placeholder={placeholder}
        inputProps={{
          className: 'soha-platform-compact-field soha-workload-search-input',
          size: 'small',
        }}
      />
    ),
  }
}

function buildStorageNamespaceQuery(namespace: string | undefined | null) {
  if (!namespace) return ''
  return `?namespace=${encodeURIComponent(namespace)}`
}

function useResolvedNamespace() {
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  return namespace && namespace !== '' ? namespace : searchParams.get('namespace') || ''
}

function buildServiceDetailPath(
  name: string,
  selectedNamespace: string | null,
  rowNamespace: string,
) {
  const namespace = selectedNamespace && selectedNamespace !== '' ? selectedNamespace : rowNamespace
  const query = buildStorageNamespaceQuery(namespace)
  return `/network/services/${encodeURIComponent(name)}${query}`
}

function buildNetworkDetailPath(section: string, name: string, namespace?: string) {
  return `/network/${section}/${encodeURIComponent(name)}${buildStorageNamespaceQuery(namespace)}`
}

function buildGatewayAPIDetailPath(section: string, name: string, namespace?: string) {
  return `/network/gateway-api/${section}/${encodeURIComponent(name)}${buildStorageNamespaceQuery(namespace)}`
}

function buildPodDetailPath(name: string, selectedNamespace: string | null, rowNamespace: string) {
  const namespace = selectedNamespace && selectedNamespace !== '' ? selectedNamespace : rowNamespace
  const query = buildStorageNamespaceQuery(namespace)
  return `/workloads/pods/${encodeURIComponent(name)}${query}`
}

function buildPvcDetailPath(name: string, namespace: string) {
  return `/storage/persistentvolumeclaims/${encodeURIComponent(name)}${buildStorageNamespaceQuery(namespace)}`
}

function selectorMatchesLabels(selector?: Record<string, string>, labels?: Record<string, string>) {
  const entries = Object.entries(selector ?? {})
  if (entries.length === 0) return false
  return entries.every(([key, value]) => (labels ?? {})[key] === value)
}

function useScopedQuery<T>(
  resource: 'services' | 'ingresses' | 'gateways' | 'persistentvolumeclaims',
) {
  const { clusterId, namespace } = usePlatformScopeStore()
  const resourcePathMap = {
    services: 'network/services',
    ingresses: 'network/ingresses',
    gateways: 'network/gateways',
    persistentvolumeclaims: 'storage/persistentvolumeclaims',
  } as const

  return useQuery({
    queryKey: [resource, clusterId, namespace],
    queryFn: () =>
      api.get<ApiResponse<T[]>>(
        buildClusterScopedPath(clusterId!, resourcePathMap[resource], namespace),
      ),
    enabled: !!clusterId,
  })
}

function usePlatformResourceQuery<T>(resourcePath: string, clusterScoped = false) {
  const { clusterId, namespace } = usePlatformScopeStore()
  return useQuery({
    queryKey: ['platform-resource-list', resourcePath, clusterId, clusterScoped ? '' : namespace],
    queryFn: () =>
      api.get<ApiResponse<T[]>>(
        buildClusterScopedPath(clusterId!, resourcePath, clusterScoped ? undefined : namespace),
      ),
    enabled: !!clusterId,
  })
}

function renderTextList(value?: string[], empty = '-') {
  if (!value || value.length === 0) return <Text type="secondary">{empty}</Text>
  return (
    <div className="soha-rbac-subject-list">
      {value.slice(0, 3).map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
      {value.length > 3 ? (
        <Tooltip title={value.slice(3).join(', ')}>
          <Tag>{`+${value.length - 3}`}</Tag>
        </Tooltip>
      ) : null}
    </div>
  )
}

function renderConditionStatus(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  return <StatusTag value={value} />
}

function ResourceNameLink({ name, to }: { name: string; to: string }) {
  const navigate = useNavigate()
  return (
    <Button type="text" onClick={() => navigate(to)}>
      {name}
    </Button>
  )
}

function buildNetworkErrorDescription(localeCode: 'zh_CN' | 'en_US', error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return localeCode === 'zh_CN'
      ? `网络资源请求失败：${error.message}`
      : `Failed to load network resources: ${error.message}`
  }
  return localeCode === 'zh_CN' ? '网络资源请求失败。' : 'Failed to load network resources.'
}

function NetworkResourceListPage<T extends Record<string, any>>({
  clusterScoped = false,
  columns,
  emptyDescription,
  resourcePath,
  rowKey,
  searchPlaceholder,
  searchValues,
  actionConfig,
}: {
  clusterScoped?: boolean
  columns: TableColumnsType<T>
  emptyDescription: string
  resourcePath: string
  rowKey: string | ((record: T) => string)
  searchPlaceholder: string
  searchValues: (record: T) => Array<string | undefined | null>
  actionConfig?: {
    resourceKind: string
    getName: (record: T) => string
    getNamespace?: (record: T) => string | undefined
  }
}) {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeSearchKeyword(deferredSearchKeyword)
  const query = usePlatformResourceQuery<T>(resourcePath, clusterScoped)
  const { column: actionColumn, modalNode } = useResourceActions<T>({
    resourcePath,
    resourceKind: actionConfig?.resourceKind ?? 'Resource',
    getName: actionConfig?.getName ?? (() => ''),
    getNamespace: actionConfig?.getNamespace,
    canDelete: (record) => hasAllowedAction(record.allowedActions, 'delete'),
    listInvalidationKey: [
      'platform-resource-list',
      resourcePath,
      clusterId,
      clusterScoped ? '' : namespace,
    ],
  })
  const rawItems = query.data?.data ?? []
  const filteredItems = useMemo(
    () => rawItems.filter((item) => includesSearch(searchValues(item), normalizedKeyword)),
    [normalizedKeyword, rawItems, searchValues],
  )
  const effectiveColumns = actionConfig ? [...columns, actionColumn] : columns
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? '没有匹配的资源'
        : 'No matching resources'
      : emptyDescription
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        <>
          {actionConfig ? modalNode : null}
          {query.isError ? (
            <ManagementState
              className="mb-3"
              description={buildNetworkErrorDescription(localeCode, query.error)}
              kind="error"
              title={
                localeCode === 'zh_CN' ? '网络资源暂时不可用' : 'Network resources unavailable'
              }
            />
          ) : null}
        </>
      }
      query={buildResourceKeywordQuery({
        localeCode,
        placeholder: searchPlaceholder,
        searchKeyword,
        setSearchKeyword,
      })}
      table={{
        className: 'soha-platform-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns: effectiveColumns,
        dataSource: clusterId ? filteredItems : [],
        rowKey,
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) {
                  void query.refetch()
                }
              }}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <PlatformResourceState
            description={effectiveEmpty}
            kind={resourceEmptyKind(clusterId, effectiveEmpty)}
          />
        ),
      }}
    />
  )
}

function StorageDetailShell({
  children,
  kind,
  name,
}: {
  children: React.ReactNode
  kind: string
  name: string
}) {
  return (
    <div className="soha-page soha-workload-detail-page">
      <div className="soha-workload-detail-heading">
        <div className="soha-workload-detail-heading-main">
          <Text type="secondary" className="soha-workload-detail-kind">
            {kind}
          </Text>
          <Text strong className="soha-workload-detail-name">
            {name}
          </Text>
        </div>
      </div>
      {children}
    </div>
  )
}

function StorageDetailTabs({ items }: { items: TabsProps['items'] }) {
  return (
    <Tabs
      className="soha-workload-detail-tabs"
      defaultActiveKey="overview"
      indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
      items={items}
      size="small"
      tabBarGutter={18}
    />
  )
}

function StorageYamlTab({ state }: { state: ReturnType<typeof useResourceYAMLState> }) {
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
          value={state.draft}
          onChange={state.setDraft}
          onReset={() => state.setDraft(state.serverValue)}
          onSave={() => void message.info('Local draft save disabled here')}
          onApply={() => state.applyMutation.mutate()}
          saveDisabled
          applyDisabled={!state.draft.trim()}
          applying={state.applyMutation.isPending}
        />
      </div>
    </Suspense>
  )
}

function NetworkResourceDetailPage<
  T extends {
    ageSeconds: number
    annotations?: Record<string, string>
    labels?: Record<string, string>
    name: string
    namespace?: string
  },
>({
  clusterScoped = false,
  getExtra,
  kind,
  resourcePath,
}: {
  clusterScoped?: boolean
  getExtra?: (item: T) => Array<{ key: string; value: React.ReactNode }>
  kind: string
  resourcePath: string
}) {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const namespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()
  const listNamespace = clusterScoped ? undefined : namespace
  const listQuery = useQuery({
    queryKey: ['network-resource-detail-source', resourcePath, clusterId, listNamespace],
    queryFn: () =>
      api.get<ApiResponse<T[]>>(buildClusterScopedPath(clusterId!, resourcePath, listNamespace)),
    enabled: !!clusterId && (clusterScoped || !!listNamespace),
  })
  const item = (listQuery.data?.data ?? []).find((record) => record.name === name) ?? null
  const yamlPath = clusterId
    ? `/clusters/${clusterId}/${resourcePath}/${encodeURIComponent(name)}/yaml${clusterScoped ? '' : buildStorageNamespaceQuery(namespace)}`
    : null
  const yamlState = useResourceYAMLState(
    yamlPath,
    resourcePath,
    name,
    clusterScoped ? '' : namespace,
  )

  if (!clusterId || (!clusterScoped && !namespace)) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  }
  if (listQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!item) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? `${kind} 未找到` : `${kind} not found`}
        />
      </div>
    )
  }

  return (
    <StorageDetailShell kind={kind} name={item.name}>
      <StorageDetailTabs
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <ResourceMetaOverview
                name={item.name}
                namespace={item.namespace || '-'}
                ageSeconds={item.ageSeconds}
                labels={item.labels}
                annotations={item.annotations}
                extra={getExtra?.(item)}
              />
            ),
          },
          { key: 'yaml', label: 'YAML', children: <StorageYamlTab state={yamlState} /> },
        ]}
      />
    </StorageDetailShell>
  )
}

export function NetworkServicesPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeSearchKeyword(deferredSearchKeyword)
  const query = usePlatformResourceQuery<Service>('network/services')
  const rawItems = query.data?.data ?? []
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceRoute: '/network/services',
    sourceTitle: localeCode === 'zh_CN' ? 'Services 列表' : 'Services',
    entityKind: 'kubernetes.service.list',
    entityName: 'Services',
    clusterId: clusterId ?? undefined,
    namespace: namespace ?? undefined,
    timeRangeMinutes: 60,
    visibleFilters: { searchKeyword },
    pinnedData: { total: rawItems.length },
    promptHint: '分析当前 Service 列表的类型、端口、ClusterIP、后端 Pod 和事件风险。',
  })
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.type, item.clusterIp, ...(item.ports ?? [])],
          normalizedKeyword,
        ),
      ),
    [normalizedKeyword, rawItems],
  )
  const { column: actionColumn } = useResourceActions<Service>({
    resourcePath: 'network/services',
    resourceKind: 'Service',
    getName: (record) => record.name,
    getNamespace: (record) => record.namespace,
    canDelete: (record) => hasAllowedAction(record.allowedActions, 'delete'),
    listInvalidationKey: ['platform-resource-list', 'network/services', clusterId, namespace],
  })

  const columns: TableColumnsType<Service> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (value: string, record: Service) => (
        <Button
          type="text"
          onClick={() => navigate(buildServiceDetailPath(value, namespace, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace' },
    { title: '类型', dataIndex: 'type' },
    { title: 'Cluster IP', dataIndex: 'clusterIp', render: (value: string) => value || '-' },
    { title: '端口', dataIndex: 'ports', render: (value: string[]) => value?.join(', ') || '-' },
    { title: 'Age', dataIndex: 'ageSeconds', render: (value: number) => formatAgeSeconds(value) },
    actionColumn,
  ]
  const searchPlaceholder =
    localeCode === 'zh_CN'
      ? '搜索 Service / namespace / type / port'
      : 'Search service / namespace / type / port'
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? '没有匹配的 Service'
        : 'No matching services'
      : localeCode === 'zh_CN'
        ? '当前范围没有 Service'
        : 'No services in the current scope'
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        query.isError ? (
          <ManagementState
            className="mb-3"
            description={buildNetworkErrorDescription(localeCode, query.error)}
            kind="error"
            title={localeCode === 'zh_CN' ? '网络资源暂时不可用' : 'Network resources unavailable'}
          />
        ) : null
      }
      query={buildResourceKeywordQuery({
        localeCode,
        placeholder: searchPlaceholder,
        searchKeyword,
        setSearchKeyword,
      })}
      table={{
        className: 'soha-platform-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: (record) => `${record.namespace}/${record.name}`,
        onRow: (record: Service) => ({
          'data-ai-context': encodeAIContextForElement({
            sourceWorkbench: 'platform',
            sourceRoute: `/network/services/${record.name}?namespace=${encodeURIComponent(record.namespace)}`,
            sourceTitle: `Service ${record.name}`,
            entityKind: 'kubernetes.service',
            entityName: record.name,
            clusterId: clusterId ?? undefined,
            namespace: record.namespace,
            service: record.name,
            timeRangeMinutes: 60,
          }),
        }),
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) {
                  void query.refetch()
                }
              }}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <PlatformResourceState
            description={effectiveEmpty}
            kind={resourceEmptyKind(clusterId, effectiveEmpty)}
          />
        ),
      }}
    />
  )
}

export function ServiceDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const serviceName = params.serviceName as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace =
    (namespace && namespace !== '' ? namespace : searchParams.get('namespace')) || ''

  const servicesQuery = useQuery({
    queryKey: ['service-detail-source', clusterId, detailNamespace],
    queryFn: () =>
      api.get<ApiResponse<Service[]>>(
        buildClusterScopedPath(clusterId!, 'network/services', detailNamespace),
      ),
    enabled: !!clusterId && !!detailNamespace,
  })

  const service = useMemo(
    () => (servicesQuery.data?.data ?? []).find((item) => item.name === serviceName) ?? null,
    [serviceName, servicesQuery.data],
  )

  const backendPodsQuery = useQuery({
    queryKey: ['service-backend-pods', clusterId, detailNamespace, serviceName],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ServiceBackendPod[]>>(
        `/clusters/${clusterId}/workloads/pods?namespace=${encodeURIComponent(detailNamespace)}`,
      )
      return {
        data: (response.data ?? []).filter((item) =>
          selectorMatchesLabels(service?.selector, item.labels),
        ),
      } as ApiResponse<ServiceBackendPod[]>
    },
    enabled: !!clusterId && !!detailNamespace && !!service,
  })

  const metricsQuery = useQuery({
    queryKey: ['service-metrics', clusterId, detailNamespace, serviceName],
    queryFn: () =>
      api.get<ApiResponse<ResourceMetrics>>(
        `/clusters/${clusterId}/network/services/${serviceName}/metrics?namespace=${encodeURIComponent(detailNamespace)}`,
    ),
    enabled: !!clusterId && !!detailNamespace,
  })
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceRoute: `/network/services/${serviceName}${detailNamespace ? `?namespace=${encodeURIComponent(detailNamespace)}` : ''}`,
    sourceTitle: `Service ${service?.name ?? serviceName}`,
    entityKind: 'kubernetes.service',
    entityName: service?.name ?? serviceName,
    clusterId: clusterId ?? undefined,
    namespace: detailNamespace || service?.namespace,
    service: service?.name ?? serviceName,
    timeRangeMinutes: metricsQuery.data?.data?.rangeMinutes ?? 60,
    pinnedData: {
      type: service?.type,
      clusterIp: service?.clusterIp,
      ports: service?.ports,
      selector: service?.selector,
    },
    promptHint: `排查 Service ${service?.name ?? serviceName} 的访问异常、Endpoint/后端 Pod、事件、日志和指标。`,
  })

  const eventsQuery = useQuery({
    queryKey: ['service-events', clusterId, detailNamespace, serviceName],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ServiceEvent[]>>(
        buildClusterScopedPath(clusterId!, 'events', detailNamespace, { limit: 100 }),
      )
      return {
        data: (response.data ?? []).filter(
          (item) =>
            item.involvedName === serviceName &&
            (!item.involvedKind || item.involvedKind.toLowerCase() === 'service'),
        ),
      } as ApiResponse<ServiceEvent[]>
    },
    enabled: !!clusterId && !!detailNamespace,
  })

  const backendPodColumns: TableColumnsType<ServiceBackendPod> = [
    {
      title: 'Pod',
      dataIndex: 'name',
      render: (value: string, record: ServiceBackendPod) => (
        <Button
          type="text"
          onClick={() => navigate(buildPodDetailPath(value, detailNamespace, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'phase',
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: 'Ready', dataIndex: 'readyContainers' },
    { title: localeCode === 'zh_CN' ? '重启次数' : 'Restarts', dataIndex: 'restarts' },
    {
      title: localeCode === 'zh_CN' ? '节点' : 'Node',
      dataIndex: 'nodeName',
      render: (value?: string) => value || '-',
    },
    { title: 'Age', dataIndex: 'ageSeconds', render: (value: number) => formatAgeSeconds(value) },
  ]

  if (!clusterId || !detailNamespace) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  }
  if (servicesQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!service)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? '未找到服务' : 'Service not found'}
        />
      </div>
    )

  return (
    <StorageDetailShell kind="Service" name={service.name}>
      <StorageDetailTabs
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <>
                <Card className="soha-detail-card">
                  <Descriptions
                    items={[
                      {
                        key: 'name',
                        label: localeCode === 'zh_CN' ? '名称' : 'Name',
                        children: service.name,
                      },
                      {
                        key: 'namespace',
                        label: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
                        children: service.namespace,
                      },
                      { key: 'type', label: 'Type', children: service.type },
                      { key: 'clusterIp', label: 'Cluster IP', children: service.clusterIp || '-' },
                      { key: 'ports', label: 'Ports', children: service.ports?.join(', ') || '-' },
                      { key: 'age', label: 'Age', children: formatAgeSeconds(service.ageSeconds) },
                    ]}
                  />
                </Card>
                <AdminTable
                  className="soha-platform-table"
                  columnSettingIconOnly
                  columnSettingPlacement="header"
                  shellClassName="soha-management-table-shell"
                  title={localeCode === 'zh_CN' ? '后端 Pods' : 'Backend Pods'}
                  columns={backendPodColumns}
                  dataSource={backendPodsQuery.data?.data ?? []}
                  rowKey={(record) => `${record.namespace}/${record.name}`}
                  loading={backendPodsQuery.isLoading}
                  pageSize={10}
                  tableSize="small"
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
          {
            key: 'metrics',
            label: localeCode === 'zh_CN' ? '指标' : 'Metrics',
            children: (
              <ResourceMetricsPanel
                title="Service Metrics"
                data={metricsQuery.data?.data}
                loading={metricsQuery.isLoading}
              />
            ),
          },
          {
            key: 'events',
            label: localeCode === 'zh_CN' ? '事件' : 'Events',
            children: (
              <ResourceEventsTimeline
                title="Service Event Timeline"
                events={eventsQuery.data?.data ?? []}
                loading={eventsQuery.isLoading}
                emptyDescription={
                  localeCode === 'zh_CN' ? '当前 Service 暂无事件' : 'No service events'
                }
              />
            ),
          },
        ]}
      />
    </StorageDetailShell>
  )
}

export function NetworkIngressesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<Ingress> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record: Ingress) => (
        <ResourceNameLink
          name={value}
          to={buildNetworkDetailPath('ingresses', value, record.namespace)}
        />
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'IngressClass',
      dataIndex: 'className',
      width: 160,
      render: (value?: string) => value || '-',
    },
    { title: 'Hosts', dataIndex: 'hosts', render: (value?: string[]) => renderTextList(value) },
    { title: 'Address', dataIndex: 'address', render: (value?: string) => value || '-' },
    {
      title: 'Backend Services',
      dataIndex: 'backendServices',
      render: (value?: string[]) => renderTextList(value),
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<Ingress>
      resourcePath="network/ingresses"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 Ingress / namespace / host / service'
          : 'Search ingress / namespace / host / service'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.className,
        record.address,
        ...(record.hosts ?? []),
        ...(record.backendServices ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN' ? '当前范围没有 Ingress' : 'No ingresses in the current scope'
      }
      actionConfig={{
        resourceKind: 'Ingress',
        getName: (record) => record.name,
        getNamespace: (record) => record.namespace,
      }}
    />
  )
}

export function NetworkGatewayClassesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<GatewayClass> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string) => (
        <ResourceNameLink name={value} to={buildGatewayAPIDetailPath('gatewayclasses', value)} />
      ),
    },
    { title: 'Controller', dataIndex: 'controllerName', render: (value?: string) => value || '-' },
    {
      title: 'Accepted',
      dataIndex: 'accepted',
      width: 120,
      render: (value?: string) => renderConditionStatus(value),
    },
    { title: 'Parameters', dataIndex: 'parametersRef', render: (value?: string) => value || '-' },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<GatewayClass>
      clusterScoped
      resourcePath="network/gatewayclasses"
      columns={columns}
      rowKey="name"
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 GatewayClass / controller'
          : 'Search GatewayClass / controller'
      }
      searchValues={(record) => [
        record.name,
        record.controllerName,
        record.accepted,
        record.parametersRef,
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前集群没有 GatewayClass，或未安装 Gateway API CRD'
          : 'No GatewayClasses in this cluster, or Gateway API CRDs are not installed'
      }
      actionConfig={{ resourceKind: 'GatewayClass', getName: (record) => record.name }}
    />
  )
}

export function NetworkGatewaysPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<Gateway> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record: Gateway) => (
        <ResourceNameLink
          name={value}
          to={buildGatewayAPIDetailPath('gateways', value, record.namespace)}
        />
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'GatewayClass',
      dataIndex: 'gatewayClass',
      width: 160,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Addresses',
      dataIndex: 'addresses',
      render: (value?: string[]) => renderTextList(value),
    },
    { title: 'Listeners', dataIndex: 'listenerCount', width: 110 },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<Gateway>
      resourcePath="network/gateways"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 Gateway / namespace / class / address'
          : 'Search gateway / namespace / class / address'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.gatewayClass,
        ...(record.addresses ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 Gateway，或未安装 Gateway API CRD'
          : 'No Gateways in the current scope, or Gateway API CRDs are not installed'
      }
      actionConfig={{
        resourceKind: 'Gateway',
        getName: (record) => record.name,
        getNamespace: (record) => record.namespace,
      }}
    />
  )
}

export function NetworkHTTPRoutesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<HTTPRoute> = [
    { title: localeCode === 'zh_CN' ? '名称' : 'Name', dataIndex: 'name', width: 260 },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    { title: 'Hostnames', dataIndex: 'hostnames', render: (value?: string[]) => renderTextList(value) },
    { title: 'Parents', dataIndex: 'parentRefs', render: (value?: string[]) => renderTextList(value) },
    {
      title: 'Backends',
      dataIndex: 'backendServices',
      render: (value?: string[]) => renderTextList(value),
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<HTTPRoute>
      resourcePath="network/httproutes"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 HTTPRoute / namespace / host / gateway / backend'
          : 'Search HTTPRoute / namespace / host / gateway / backend'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        ...(record.hostnames ?? []),
        ...(record.parentRefs ?? []),
        ...(record.backendServices ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 HTTPRoute，或未安装 Gateway API CRD'
          : 'No HTTPRoutes in the current scope, or Gateway API CRDs are not installed'
      }
    />
  )
}

export function NetworkBackendTLSPoliciesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<BackendTLSPolicy> = [
    { title: localeCode === 'zh_CN' ? '名称' : 'Name', dataIndex: 'name', width: 260 },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    { title: 'Targets', dataIndex: 'targetRefs', render: (value?: string[]) => renderTextList(value) },
    { title: 'Hostname', dataIndex: 'hostname', render: (value?: string) => value || '-' },
    {
      title: 'CA Refs',
      dataIndex: 'caCertificateRefs',
      render: (value?: string[]) => renderTextList(value),
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<BackendTLSPolicy>
      resourcePath="network/backendtlspolicies"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 BackendTLSPolicy / namespace / target / hostname'
          : 'Search BackendTLSPolicy / namespace / target / hostname'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.hostname,
        record.wellKnownCACertificates,
        ...(record.targetRefs ?? []),
        ...(record.caCertificateRefs ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 BackendTLSPolicy，或未安装 Gateway API CRD'
          : 'No BackendTLSPolicies in the current scope, or Gateway API CRDs are not installed'
      }
    />
  )
}

export function NetworkGRPCRoutesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<GRPCRoute> = [
    { title: localeCode === 'zh_CN' ? '名称' : 'Name', dataIndex: 'name', width: 260 },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    { title: 'Hostnames', dataIndex: 'hostnames', render: (value?: string[]) => renderTextList(value) },
    { title: 'Parents', dataIndex: 'parentRefs', render: (value?: string[]) => renderTextList(value) },
    {
      title: 'Backends',
      dataIndex: 'backendServices',
      render: (value?: string[]) => renderTextList(value),
    },
    { title: 'Rules', dataIndex: 'ruleCount', width: 100 },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<GRPCRoute>
      resourcePath="network/grpcroutes"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 GRPCRoute / namespace / host / gateway / backend'
          : 'Search GRPCRoute / namespace / host / gateway / backend'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        ...(record.hostnames ?? []),
        ...(record.parentRefs ?? []),
        ...(record.backendServices ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 GRPCRoute，或未安装 Gateway API CRD'
          : 'No GRPCRoutes in the current scope, or Gateway API CRDs are not installed'
      }
    />
  )
}

export function NetworkReferenceGrantsPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<ReferenceGrant> = [
    { title: localeCode === 'zh_CN' ? '名称' : 'Name', dataIndex: 'name', width: 260 },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    { title: 'From', dataIndex: 'from', render: (value?: string[]) => renderTextList(value) },
    { title: 'To', dataIndex: 'to', render: (value?: string[]) => renderTextList(value) },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<ReferenceGrant>
      resourcePath="network/referencegrants"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 ReferenceGrant / namespace / from / to'
          : 'Search ReferenceGrant / namespace / from / to'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        ...(record.from ?? []),
        ...(record.to ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 ReferenceGrant，或未安装 Gateway API CRD'
          : 'No ReferenceGrants in the current scope, or Gateway API CRDs are not installed'
      }
    />
  )
}

export function NetworkEndpointSlicesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<EndpointSlice> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string, record: EndpointSlice) => (
        <ResourceNameLink
          name={value}
          to={buildNetworkDetailPath('endpointslices', value, record.namespace)}
        />
      ),
    },
    { title: 'Namespace', dataIndex: 'namespace', width: 160 },
    { title: 'Address Type', dataIndex: 'addressType', width: 130 },
    { title: 'Endpoints', dataIndex: 'endpoints', width: 110 },
    { title: 'Ports', dataIndex: 'ports', render: (value?: string[]) => value?.join(', ') || '-' },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<EndpointSlice>
      resourcePath="network/endpointslices"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 EndpointSlice / namespace / address type / port'
          : 'Search EndpointSlice / namespace / address type / port'
      }
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.addressType,
        ...(record.ports ?? []),
      ]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 EndpointSlice'
          : 'No EndpointSlices in the current scope'
      }
      actionConfig={{
        resourceKind: 'EndpointSlice',
        getName: (record) => record.name,
        getNamespace: (record) => record.namespace,
      }}
    />
  )
}

export function NetworkIngressClassesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<IngressClass> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string) => (
        <ResourceNameLink name={value} to={buildNetworkDetailPath('ingressclasses', value)} />
      ),
    },
    { title: 'Controller', dataIndex: 'controller' },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      width: 110,
      render: (value: boolean) => <BooleanTag value={value} trueLabel="Yes" falseLabel="No" />,
    },
    { title: 'Parameters', dataIndex: 'parameters', render: (value?: string) => value || '-' },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<IngressClass>
      clusterScoped
      resourcePath="network/ingressclasses"
      columns={columns}
      rowKey="name"
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 IngressClass / controller'
          : 'Search IngressClass / controller'
      }
      searchValues={(record) => [record.name, record.controller, record.parameters]}
      emptyDescription={
        localeCode === 'zh_CN' ? '当前集群没有 IngressClass' : 'No IngressClasses in this cluster'
      }
      actionConfig={{ resourceKind: 'IngressClass', getName: (record) => record.name }}
    />
  )
}

export function NetworkPoliciesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<NetworkPolicy> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string, record: NetworkPolicy) => (
        <ResourceNameLink
          name={value}
          to={buildNetworkDetailPath('networkpolicies', value, record.namespace)}
        />
      ),
    },
    { title: 'Namespace', dataIndex: 'namespace', width: 160 },
    {
      title: 'Policy Types',
      dataIndex: 'policyTypes',
      render: (value?: string[]) => renderTextList(value),
    },
    { title: 'Ingress Rules', dataIndex: 'ingressRules', width: 120 },
    { title: 'Egress Rules', dataIndex: 'egressRules', width: 120 },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage<NetworkPolicy>
      resourcePath="network/networkpolicies"
      columns={columns}
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={
        localeCode === 'zh_CN'
          ? '搜索 NetworkPolicy / namespace / type'
          : 'Search NetworkPolicy / namespace / type'
      }
      searchValues={(record) => [record.name, record.namespace, ...(record.policyTypes ?? [])]}
      emptyDescription={
        localeCode === 'zh_CN'
          ? '当前范围没有 NetworkPolicy'
          : 'No NetworkPolicies in the current scope'
      }
      actionConfig={{
        resourceKind: 'NetworkPolicy',
        getName: (record) => record.name,
        getNamespace: (record) => record.namespace,
      }}
    />
  )
}

export function IngressDetailPage() {
  return (
    <NetworkResourceDetailPage<Ingress>
      kind="Ingress"
      resourcePath="network/ingresses"
      getExtra={(item) => [
        { key: 'IngressClass', value: item.className || '-' },
        { key: 'Hosts', value: renderTextList(item.hosts) },
        { key: 'Address', value: item.address || '-' },
        { key: 'Backend Services', value: renderTextList(item.backendServices) },
      ]}
    />
  )
}

export function GatewayClassDetailPage() {
  return (
    <NetworkResourceDetailPage<GatewayClass>
      clusterScoped
      kind="GatewayClass"
      resourcePath="network/gatewayclasses"
      getExtra={(item) => [
        { key: 'Controller', value: item.controllerName || '-' },
        { key: 'Accepted', value: renderConditionStatus(item.accepted) },
        { key: 'Parameters', value: item.parametersRef || '-' },
      ]}
    />
  )
}

export function GatewayDetailPage() {
  return (
    <NetworkResourceDetailPage<Gateway>
      kind="Gateway"
      resourcePath="network/gateways"
      getExtra={(item) => [
        { key: 'GatewayClass', value: item.gatewayClass || '-' },
        { key: 'Addresses', value: renderTextList(item.addresses) },
        { key: 'Listeners', value: item.listenerCount },
      ]}
    />
  )
}

export function EndpointSliceDetailPage() {
  return (
    <NetworkResourceDetailPage<EndpointSlice>
      kind="EndpointSlice"
      resourcePath="network/endpointslices"
      getExtra={(item) => [
        { key: 'Address Type', value: item.addressType || '-' },
        { key: 'Endpoints', value: item.endpoints },
        { key: 'Ports', value: item.ports?.join(', ') || '-' },
      ]}
    />
  )
}

export function IngressClassDetailPage() {
  return (
    <NetworkResourceDetailPage<IngressClass>
      clusterScoped
      kind="IngressClass"
      resourcePath="network/ingressclasses"
      getExtra={(item) => [
        { key: 'Controller', value: item.controller || '-' },
        {
          key: 'Default',
          value: <BooleanTag value={item.isDefault} trueLabel="Yes" falseLabel="No" />,
        },
        { key: 'Parameters', value: item.parameters || '-' },
      ]}
    />
  )
}

export function NetworkPolicyDetailPage() {
  return (
    <NetworkResourceDetailPage<NetworkPolicy>
      kind="NetworkPolicy"
      resourcePath="network/networkpolicies"
      getExtra={(item) => [
        { key: 'Policy Types', value: renderTextList(item.policyTypes) },
        { key: 'Ingress Rules', value: item.ingressRules },
        { key: 'Egress Rules', value: item.egressRules },
      ]}
    />
  )
}

export function StoragePvcPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const [createVisible, setCreateVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeSearchKeyword(deferredSearchKeyword)
  const query = useScopedQuery<PersistentVolumeClaim>('persistentvolumeclaims')
  const rawItems = query.data?.data ?? []
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.status, item.storageClass, item.volumeName],
          normalizedKeyword,
        ),
      ),
    [normalizedKeyword, rawItems],
  )
  const { column: actionColumn } = useResourceActions<PersistentVolumeClaim>({
    resourcePath: 'storage/persistentvolumeclaims',
    resourceKind: 'PersistentVolumeClaim',
    getName: (record) => record.name,
    getNamespace: (record) => record.namespace,
    canDelete: (record) => hasAllowedAction(record.allowedActions, 'delete'),
  })
  const columns: TableColumnsType<PersistentVolumeClaim> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record: PersistentVolumeClaim) => (
        <Button type="text" onClick={() => navigate(buildPvcDetailPath(value, record.namespace))}>
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 150,
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: 'Volume',
      dataIndex: 'volumeName',
      ellipsis: { showTitle: false },
      width: 220,
      render: (value?: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '申请容量' : 'Requested',
      dataIndex: 'requested',
      width: 110,
      render: (value?: string) => value || '-',
    },
    {
      title: 'StorageClass',
      dataIndex: 'storageClass',
      ellipsis: { showTitle: false },
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      ellipsis: { showTitle: false },
      width: 160,
      render: (value?: string[]) => value?.join(', ') || '-',
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    actionColumn,
  ]
  const searchPlaceholder =
    localeCode === 'zh_CN'
      ? '搜索 PVC / namespace / storageClass'
      : 'Search PVC / namespace / storageClass'
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? '没有匹配的 PVC'
        : 'No matching PVCs'
      : localeCode === 'zh_CN'
        ? '当前范围没有 PVC'
        : 'No PVCs in the current scope'
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        <CreateResourceModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          kind="PersistentVolumeClaim"
          resourcePath="storage/persistentvolumeclaims"
          defaultTemplate={PVC_DEFAULT_TEMPLATE}
          invalidationKeys={[['platform-resource', 'storage/persistentvolumeclaims']]}
        />
      }
      query={buildResourceKeywordQuery({
        localeCode,
        placeholder: searchPlaceholder,
        searchKeyword,
        setSearchKeyword,
      })}
      table={{
        className: 'soha-platform-table soha-storage-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: (record) => `${record.namespace}/${record.name}`,
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <Tooltip
              title={
                !clusterId
                  ? localeCode === 'zh_CN'
                    ? '请先选择集群。'
                    : 'Select a cluster first.'
                  : ''
              }
            >
              <span>
                <Button
                  autoInsertSpace={false}
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!clusterId}
                  onClick={() => setCreateVisible(true)}
                >
                  {localeCode === 'zh_CN' ? '新增' : 'Create'}
                </Button>
              </span>
            </Tooltip>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) {
                  void query.refetch()
                }
              }}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <PlatformResourceState
            description={effectiveEmpty}
            kind={clusterId ? 'empty' : 'select-scope'}
          />
        ),
      }}
    />
  )
}

export function StoragePvPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const [createVisible, setCreateVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeSearchKeyword(deferredSearchKeyword)
  const query = useQuery({
    queryKey: ['platform-resource', 'storage/persistentvolumes', clusterId],
    queryFn: () =>
      api.get<ApiResponse<PersistentVolume[]>>(
        buildClusterScopedPath(clusterId!, 'storage/persistentvolumes'),
      ),
    enabled: !!clusterId,
  })
  const rawItems = query.data?.data ?? []
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) =>
        includesSearch(
          [item.name, item.status, item.storageClass, item.claimRef, item.reclaimPolicy],
          normalizedKeyword,
        ),
      ),
    [normalizedKeyword, rawItems],
  )
  const { column: actionColumn } = useResourceActions<PersistentVolume>({
    resourcePath: 'storage/persistentvolumes',
    resourceKind: 'PersistentVolume',
    getName: (record) => record.name,
    canDelete: (record) => hasAllowedAction(record.allowedActions, 'delete'),
  })
  const columns: TableColumnsType<PersistentVolume> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(`/storage/persistentvolumes/${encodeURIComponent(value)}`)}
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '容量' : 'Capacity',
      dataIndex: 'capacity',
      width: 110,
      render: (value?: string) => value || '-',
    },
    {
      title: 'StorageClass',
      dataIndex: 'storageClass',
      ellipsis: { showTitle: false },
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Claim',
      dataIndex: 'claimRef',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      ellipsis: { showTitle: false },
      width: 160,
      render: (value?: string[]) => value?.join(', ') || '-',
    },
    {
      title: 'Reclaim Policy',
      dataIndex: 'reclaimPolicy',
      width: 140,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    actionColumn,
  ]
  const searchPlaceholder =
    localeCode === 'zh_CN' ? '搜索 PV / claim / storageClass' : 'Search PV / claim / storageClass'
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? '没有匹配的 PV'
        : 'No matching PVs'
      : localeCode === 'zh_CN'
        ? '当前集群没有 PV'
        : 'No PVs in this cluster'
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        <CreateResourceModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          kind="PersistentVolume"
          resourcePath="storage/persistentvolumes"
          defaultTemplate={PV_DEFAULT_TEMPLATE}
          invalidationKeys={[['platform-resource', 'storage/persistentvolumes']]}
          namespaceScope="cluster"
        />
      }
      query={buildResourceKeywordQuery({
        localeCode,
        placeholder: searchPlaceholder,
        searchKeyword,
        setSearchKeyword,
      })}
      table={{
        className: 'soha-platform-table soha-storage-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: 'name',
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <Tooltip
              title={
                !clusterId
                  ? localeCode === 'zh_CN'
                    ? '请先选择集群。'
                    : 'Select a cluster first.'
                  : ''
              }
            >
              <span>
                <Button
                  autoInsertSpace={false}
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!clusterId}
                  onClick={() => setCreateVisible(true)}
                >
                  {localeCode === 'zh_CN' ? '新增' : 'Create'}
                </Button>
              </span>
            </Tooltip>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) {
                  void query.refetch()
                }
              }}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <PlatformResourceState
            description={effectiveEmpty}
            kind={clusterId ? 'empty' : 'select-scope'}
          />
        ),
      }}
    />
  )
}

export function StorageClassesPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const [createVisible, setCreateVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeSearchKeyword(deferredSearchKeyword)
  const query = useQuery({
    queryKey: ['platform-resource', 'storage/storageclasses', clusterId],
    queryFn: () =>
      api.get<ApiResponse<StorageClass[]>>(
        buildClusterScopedPath(clusterId!, 'storage/storageclasses'),
      ),
    enabled: !!clusterId,
  })
  const rawItems = query.data?.data ?? []
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) =>
        includesSearch(
          [item.name, item.provisioner, item.reclaimPolicy, item.volumeBindingMode],
          normalizedKeyword,
        ),
      ),
    [normalizedKeyword, rawItems],
  )
  const { column: actionColumn } = useResourceActions<StorageClass>({
    resourcePath: 'storage/storageclasses',
    resourceKind: 'StorageClass',
    getName: (record) => record.name,
    canDelete: (record) => hasAllowedAction(record.allowedActions, 'delete'),
  })
  const columns: TableColumnsType<StorageClass> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(`/storage/storageclasses/${encodeURIComponent(value)}`)}
        >
          {value}
        </Button>
      ),
    },
    { title: 'Provisioner', dataIndex: 'provisioner', ellipsis: { showTitle: false }, width: 320 },
    {
      title: 'Reclaim Policy',
      dataIndex: 'reclaimPolicy',
      width: 140,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Binding Mode',
      dataIndex: 'volumeBindingMode',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '允许扩容' : 'Expansion',
      dataIndex: 'allowVolumeExpansion',
      width: 110,
      render: (value: boolean) => <BooleanTag value={value} trueLabel="Yes" falseLabel="No" />,
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    actionColumn,
  ]
  const searchPlaceholder =
    localeCode === 'zh_CN' ? '搜索 StorageClass / provisioner' : 'Search StorageClass / provisioner'
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? '没有匹配的 StorageClass'
        : 'No matching storage classes'
      : localeCode === 'zh_CN'
        ? '当前集群没有 StorageClass'
        : 'No storage classes in this cluster'
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        <CreateResourceModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          kind="StorageClass"
          resourcePath="storage/storageclasses"
          defaultTemplate={STORAGE_CLASS_DEFAULT_TEMPLATE}
          invalidationKeys={[['platform-resource', 'storage/storageclasses']]}
          namespaceScope="cluster"
        />
      }
      query={buildResourceKeywordQuery({
        localeCode,
        placeholder: searchPlaceholder,
        searchKeyword,
        setSearchKeyword,
      })}
      table={{
        className: 'soha-platform-table soha-storage-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: 'name',
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <Tooltip
              title={
                !clusterId
                  ? localeCode === 'zh_CN'
                    ? '请先选择集群。'
                    : 'Select a cluster first.'
                  : ''
              }
            >
              <span>
                <Button
                  autoInsertSpace={false}
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!clusterId}
                  onClick={() => setCreateVisible(true)}
                >
                  {localeCode === 'zh_CN' ? '新增' : 'Create'}
                </Button>
              </span>
            </Tooltip>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) {
                  void query.refetch()
                }
              }}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <PlatformResourceState
            description={effectiveEmpty}
            kind={clusterId ? 'empty' : 'select-scope'}
          />
        ),
      }}
    />
  )
}

export function StoragePvcDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const detailNamespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()
  const detailPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/storage/persistentvolumeclaims/${encodeURIComponent(name)}/detail?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const yamlPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/storage/persistentvolumeclaims/${encodeURIComponent(name)}/yaml?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const detailQuery = useQuery({
    queryKey: ['storage-pvc', 'detail', name, detailNamespace],
    queryFn: () => api.get<ApiResponse<PersistentVolumeClaimDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const yamlState = useResourceYAMLState(yamlPath, 'storage-pvc', name, detailNamespace)
  const detail = detailQuery.data?.data
  if (!clusterId || !detailNamespace)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'PVC 未找到' : 'PVC not found'}
        />
      </div>
    )
  return (
    <StorageDetailShell kind="PVC" name={detail.name}>
      <StorageDetailTabs
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <ResourceMetaOverview
                name={detail.name}
                namespace={detail.namespace}
                createdAt={detail.createdAt}
                labels={detail.labels}
                annotations={detail.annotations}
                extra={[
                  {
                    key: localeCode === 'zh_CN' ? '状态' : 'Status',
                    value: <StatusTag value={detail.status} />,
                  },
                  { key: 'Volume', value: detail.volumeName || '-' },
                  { key: 'StorageClass', value: detail.storageClass || '-' },
                  {
                    key: localeCode === 'zh_CN' ? '申请容量' : 'Requested',
                    value: detail.requested || '-',
                  },
                  {
                    key: localeCode === 'zh_CN' ? '已分配容量' : 'Capacity',
                    value: detail.capacity || '-',
                  },
                  { key: 'VolumeMode', value: detail.volumeMode || '-' },
                  { key: 'AccessModes', value: detail.accessModes?.join(', ') || '-' },
                ]}
              />
            ),
          },
          { key: 'yaml', label: 'YAML', children: <StorageYamlTab state={yamlState} /> },
        ]}
      />
    </StorageDetailShell>
  )
}

export function StoragePvDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const { clusterId } = usePlatformScopeStore()
  const detailPath = clusterId
    ? `/clusters/${clusterId}/storage/persistentvolumes/${encodeURIComponent(name)}/detail`
    : null
  const yamlPath = clusterId
    ? `/clusters/${clusterId}/storage/persistentvolumes/${encodeURIComponent(name)}/yaml`
    : null
  const detailQuery = useQuery({
    queryKey: ['storage-pv', 'detail', name, clusterId],
    queryFn: () => api.get<ApiResponse<PersistentVolumeDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const yamlState = useResourceYAMLState(yamlPath, 'storage-pv', name, '')
  const detail = detailQuery.data?.data
  if (!clusterId)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
        />
      </div>
    )
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'PV 未找到' : 'PV not found'}
        />
      </div>
    )
  return (
    <StorageDetailShell kind="PV" name={detail.name}>
      <StorageDetailTabs
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <ResourceMetaOverview
                name={detail.name}
                namespace="-"
                createdAt={detail.createdAt}
                labels={detail.labels}
                annotations={detail.annotations}
                extra={[
                  {
                    key: localeCode === 'zh_CN' ? '状态' : 'Status',
                    value: <StatusTag value={detail.status} />,
                  },
                  {
                    key: localeCode === 'zh_CN' ? '容量' : 'Capacity',
                    value: detail.capacity || '-',
                  },
                  { key: 'StorageClass', value: detail.storageClass || '-' },
                  { key: 'Claim', value: detail.claimRef || '-' },
                  { key: 'AccessModes', value: detail.accessModes?.join(', ') || '-' },
                  { key: 'ReclaimPolicy', value: detail.reclaimPolicy || '-' },
                  { key: 'VolumeMode', value: detail.volumeMode || '-' },
                ]}
              />
            ),
          },
          { key: 'yaml', label: 'YAML', children: <StorageYamlTab state={yamlState} /> },
        ]}
      />
    </StorageDetailShell>
  )
}

export function StorageClassDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const name = params.name as string
  const { clusterId } = usePlatformScopeStore()
  const detailPath = clusterId
    ? `/clusters/${clusterId}/storage/storageclasses/${encodeURIComponent(name)}/detail`
    : null
  const yamlPath = clusterId
    ? `/clusters/${clusterId}/storage/storageclasses/${encodeURIComponent(name)}/yaml`
    : null
  const detailQuery = useQuery({
    queryKey: ['storageclass', 'detail', name, clusterId],
    queryFn: () => api.get<ApiResponse<StorageClassDetail>>(detailPath!),
    enabled: !!detailPath,
  })
  const yamlState = useResourceYAMLState(yamlPath, 'storageclass', name, '')
  const detail = detailQuery.data?.data
  if (!clusterId)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
        />
      </div>
    )
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'StorageClass 未找到' : 'StorageClass not found'}
        />
      </div>
    )
  return (
    <StorageDetailShell kind="StorageClass" name={detail.name}>
      <StorageDetailTabs
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <>
                <ResourceMetaOverview
                  name={detail.name}
                  namespace="-"
                  createdAt={detail.createdAt}
                  labels={detail.labels}
                  annotations={detail.annotations}
                  extra={[
                    { key: 'Provisioner', value: detail.provisioner },
                    { key: 'ReclaimPolicy', value: detail.reclaimPolicy || '-' },
                    { key: 'BindingMode', value: detail.volumeBindingMode || '-' },
                    {
                      key: localeCode === 'zh_CN' ? '允许扩容' : 'Expansion',
                      value: (
                        <BooleanTag
                          value={detail.allowVolumeExpansion}
                          trueLabel="Yes"
                          falseLabel="No"
                        />
                      ),
                    },
                  ]}
                />
                <Card
                  className="soha-detail-card"
                  title={localeCode === 'zh_CN' ? '参数' : 'Parameters'}
                >
                  {detail.parameters && Object.keys(detail.parameters).length > 0 ? (
                    <Descriptions
                      column={1}
                      items={Object.entries(detail.parameters).map(([key, value]) => ({
                        key,
                        label: key,
                        children: value,
                      }))}
                    />
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      description={localeCode === 'zh_CN' ? '暂无参数' : 'No parameters'}
                    />
                  )}
                </Card>
              </>
            ),
          },
          { key: 'yaml', label: 'YAML', children: <StorageYamlTab state={yamlState} /> },
        ]}
      />
    </StorageDetailShell>
  )
}
