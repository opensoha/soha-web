import { lazy, Suspense, useState } from 'react'
import '../applications/styles.css'
import './workload-detail-page.css'
import { App, Button, Card, Descriptions, Select, Space, Tabs, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementSearchableListPane,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { isApiError } from '@/services/api-error'
import { APPLICATION_WORKSPACE_NAV_ITEMS } from '../applications/workspace-navigation'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { DeploymentDetail, Pod } from '../types'

const { Text } = Typography

const PodLogViewer = lazy(async () => {
  const module = await import('@/components/pod-log-viewer')
  return { default: module.PodLogViewer }
})

const PodTerminal = lazy(async () => {
  const module = await import('@/components/pod-terminal')
  return { default: module.PodTerminal }
})

const ResourceMetricsPanel = lazy(async () => {
  const module = await import('@/components/resource-metrics-panel')
  return { default: module.ResourceMetricsPanel }
})

function podSearchValues(pod: Pod) {
  return [pod.name, pod.phase, pod.nodeName, pod.podIp]
}

function WorkloadAccessValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="soha-workload-access-overview__value">
      <Text type="secondary">{label}</Text>
      <Text code copyable={{ text: value }}>
        {value}
      </Text>
    </div>
  )
}

function deploymentHealth(
  deployment: DeploymentDetail,
  t: (key: string, fallback?: string) => string,
) {
  if (deployment.desiredReplicas <= 0) {
    return {
      label: t('page.applicationWorkload.health.onDemand', '按需运行'),
      value: 'default',
    }
  }
  if (
    deployment.readyReplicas >= deployment.desiredReplicas &&
    deployment.availableReplicas >= deployment.desiredReplicas
  ) {
    return {
      label: t('page.applicationWorkload.health.healthy', '运行正常'),
      value: 'healthy',
    }
  }
  if (deployment.readyReplicas === 0) {
    return {
      label: t('page.applicationWorkload.health.unavailable', '运行异常'),
      value: 'unavailable',
    }
  }
  return {
    label: t('page.applicationWorkload.health.degraded', '部分就绪'),
    value: 'degraded',
  }
}

export function ApplicationWorkloadDetailPage() {
  const { t } = useI18n()
  const { applicationId, applicationEnvironmentId, workloadName } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const requestedTab = searchParams.get('tab')
  const activeTab = ['pods', 'related-resources', 'logs', 'terminal', 'metrics'].includes(
    requestedTab ?? '',
  )
    ? requestedTab!
    : 'pods'
  const [podSearch, setPodSearch] = useState('')
  const [selectedContainerName, setSelectedContainerName] = useState('')
  const [terminalShell, setTerminalShell] = useState('/bin/sh')
  const [metricsRangeMinutes, setMetricsRangeMinutes] = useState(60)
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canManage = hasPermission(permissionSnapshot, 'delivery.application.update')
  const canViewPodLogs = hasPermission(permissionSnapshot, 'platform.pods.logs')
  const canExecPod = hasPermission(permissionSnapshot, 'platform.pods.exec')

  const workloadRef = {
    applicationId: applicationId ?? '',
    applicationEnvironmentId: applicationEnvironmentId ?? '',
    workloadName: workloadName ?? '',
  }
  const applicationPath = `/applications/${encodeURIComponent(applicationId ?? '')}`
  const detailQuery = useQuery(
    deliveryQueries.workloads.runtime(
      workloadRef,
      Boolean(applicationId && applicationEnvironmentId && workloadName),
    ),
  )

  const detail = detailQuery.data
  const podList = detail?.pods ?? []
  const serviceList = detail?.services ?? []
  const ingressList = detail?.ingresses ?? []
  const deployment = detail?.deployment
  const relatedResources = deployment?.relatedResources ?? []
  const gatewayRoutes = relatedResources.filter(({ kind }) =>
    ['HTTPRoute', 'GRPCRoute'].includes(kind),
  )
  const mountedResources = relatedResources.filter(({ kind }) =>
    ['ConfigMap', 'Secret', 'PersistentVolumeClaim'].includes(kind),
  )
  const accessOverviewItems = [
    ...(serviceList.length === 0
      ? [
          {
            key: 'service:empty',
            label: <MetadataTag label="Service" tone="blue" />,
            children: (
              <Text type="secondary">
                {t('page.applicationWorkload.noService', '暂无关联 Service')}
              </Text>
            ),
          },
        ]
      : []),
    ...serviceList.map((service) => ({
      key: `service:${service.namespace}:${service.name}`,
      label: (
        <Space size={6} wrap>
          <MetadataTag label="Service" tone="blue" />
          <Text>{service.name}</Text>
        </Space>
      ),
      children: (
        <div className="soha-workload-access-overview__values">
          <WorkloadAccessValue
            label={t('page.applicationWorkload.sameNamespaceAccess', '同命名空间')}
            value={service.name}
          />
          <WorkloadAccessValue
            label={t('page.applicationWorkload.crossNamespaceAccess', '跨命名空间')}
            value={`${service.name}.${service.namespace}`}
          />
          {service.clusterIp ? (
            <WorkloadAccessValue label="Cluster IP" value={service.clusterIp} />
          ) : null}
          {(service.ports ?? []).length > 0 ? (
            <WorkloadAccessValue
              label={t('common.ports', '端口')}
              value={(service.ports ?? []).join(', ')}
            />
          ) : null}
        </div>
      ),
    })),
    ...(ingressList.length === 0
      ? [
          {
            key: 'ingress:empty',
            label: <MetadataTag label="Ingress" tone="cyan" />,
            children: (
              <Text type="secondary">
                {t('page.applicationWorkload.noIngress', '暂无关联 Ingress')}
              </Text>
            ),
          },
        ]
      : []),
    ...ingressList.map((ingress) => ({
      key: `ingress:${ingress.namespace}:${ingress.name}`,
      label: (
        <Space size={6} wrap>
          <MetadataTag label="Ingress" tone="cyan" />
          <Text>{ingress.name}</Text>
        </Space>
      ),
      children: (
        <div className="soha-workload-access-overview__values">
          {(ingress.hosts ?? []).length > 0 ? (
            <WorkloadAccessValue
              label={t('page.applicationWorkload.hosts', '访问域名')}
              value={(ingress.hosts ?? []).join(', ')}
            />
          ) : null}
          {ingress.address ? (
            <WorkloadAccessValue label={t('common.address', '地址')} value={ingress.address} />
          ) : null}
          {(ingress.hosts ?? []).length === 0 && !ingress.address ? (
            <Text type="secondary">-</Text>
          ) : null}
        </div>
      ),
    })),
    ...(gatewayRoutes.length === 0
      ? [
          {
            key: 'gateway:empty',
            label: <MetadataTag label="Gateway API" tone="purple" />,
            children: (
              <Text type="secondary">
                {t('page.applicationWorkload.noGatewayRoute', '暂无关联 Gateway API Route')}
              </Text>
            ),
          },
        ]
      : []),
    ...gatewayRoutes.map((route) => ({
      key: `${route.kind}:${route.namespace ?? ''}:${route.name}`,
      label: (
        <Space size={6} wrap>
          <MetadataTag label={route.kind} tone="purple" />
          <Text>{route.name}</Text>
        </Space>
      ),
      children: (
        <Text type="secondary">
          {t('page.applicationWorkload.gatewayAddressHint', '未返回 Gateway 监听地址')}
        </Text>
      ),
    })),
  ]
  const workloadContainers = deployment?.containers ?? []
  const containerOptions = workloadContainers.map((container) => ({
    label: container.name,
    value: container.name,
  }))
  const selectedContainer =
    workloadContainers.find((container) => container.name === selectedContainerName)?.name ??
    workloadContainers[0]?.name ??
    ''
  const isDeployment = detail?.workload.workloadKind.toLowerCase() === 'deployment'
  const selectedPodName = searchParams.get('pod')?.trim() ?? ''
  const selectedPod = podList.find((item) => item.name === selectedPodName) ?? podList[0]
  const visiblePods = useManagementTextFilter(podList, podSearch, podSearchValues)
  const resolvedActiveTab =
    (activeTab === 'metrics' && !isDeployment) ||
    (activeTab === 'logs' && !canViewPodLogs) ||
    (activeTab === 'terminal' && !canExecPod)
      ? 'pods'
      : activeTab

  useAIPageContext({
    sourceWorkbench: 'delivery',
    sourceTitle: detail?.workload?.workloadName
      ? `${t('page.applicationWorkload.aiTitle', '应用工作负载')} ${detail.workload.workloadName}`
      : t('page.applicationWorkload.aiDetailTitle', '应用工作负载详情'),
    entityKind: 'delivery.application-workload',
    entityName: detail?.workload.workloadName ?? workloadName,
    applicationId,
    clusterId: detail?.workload?.clusterId,
    namespace: detail?.workload?.namespace,
    workload: detail?.workload?.workloadName ?? workloadName,
    pod: selectedPod?.name,
    visibleFilters: {
      tab: resolvedActiveTab,
      applicationEnvironmentId,
      selectedPodName: selectedPod?.name,
    },
    pinnedData: {
      podCount: podList.length,
      serviceCount: serviceList.length,
      ingressCount: ingressList.length,
      readyReplicas: deployment?.readyReplicas,
      desiredReplicas: deployment?.desiredReplicas,
    },
  })

  const metricsQuery = useQuery(
    deliveryQueries.workloads.metrics(
      {
        clusterId: detail?.workload.clusterId ?? '',
        namespace: detail?.workload.namespace ?? '',
        workloadName: detail?.workload.workloadName ?? '',
        rangeMinutes: metricsRangeMinutes,
      },
      Boolean(detail && resolvedActiveTab === 'metrics'),
    ),
  )

  const restartOptions = deliveryMutations.workloads.restart(queryClient)
  const restartMutation = useMutation({
    ...restartOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void restartOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(t('page.applicationWorkload.restartTriggered', '已触发重启'))
    },
    onError: (err: Error) => message.error(err.message),
  })

  if (detailQuery.isLoading) {
    return (
      <div className="soha-page soha-workload-detail-page">
        <Tabs
          className="soha-resource-tabs is-header-only soha-application-context-tabs"
          items={APPLICATION_WORKSPACE_NAV_ITEMS}
          activeKey="services"
          onChange={(tab) => navigate(`${applicationPath}?tab=${tab}`)}
        />
        <ManagementDetailHeader
          title={workloadName || 'Workload'}
          description={t('page.applicationWorkload.loadingDescription', '正在读取运行详情')}
        />
        <ManagementState
          kind="loading"
          title={t('page.applicationWorkload.loadingTitle', '正在加载 Workload')}
        />
      </div>
    )
  }
  if (detailQuery.isError) {
    const notFound = isApiError(detailQuery.error) && detailQuery.error.status === 404
    return (
      <div className="soha-page">
        <ManagementState
          kind={notFound ? 'not-found' : 'error'}
          title={
            notFound ? undefined : t('page.applicationWorkload.loadFailed', '运行详情加载失败')
          }
          description={
            notFound
              ? t('page.applicationWorkload.notFound', '未找到运行详情')
              : detailQuery.error instanceof Error
                ? detailQuery.error.message
                : t('page.applicationWorkload.loadFailed', '运行详情加载失败')
          }
          actions={
            notFound ? undefined : (
              <Button icon={<ReloadOutlined />} onClick={() => void detailQuery.refetch()}>
                {t('common.retry', '重试')}
              </Button>
            )
          }
        />
      </div>
    )
  }
  if (!detail || !deployment) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={t('page.applicationWorkload.notFound', '未找到运行详情')}
        />
      </div>
    )
  }

  const tabItems = [
    {
      key: 'pods',
      label: `Pods ${podList.length}`,
      children: selectedPod ? (
        <Card
          className="soha-detail-card soha-workload-pod-detail-card"
          title={
            <Space size={8} wrap>
              <Text strong>{selectedPod.name}</Text>
              <StatusTag value={selectedPod.phase} />
            </Space>
          }
          extra={
            canViewPodLogs || canExecPod ? (
              <Space wrap>
                {canViewPodLogs ? (
                  <Button
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set('tab', 'logs')
                      setSearchParams(next, { replace: true })
                    }}
                  >
                    {t('page.applicationWorkload.viewLogs', '查看日志')}
                  </Button>
                ) : null}
                {canExecPod ? (
                  <Button
                    type="primary"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set('tab', 'terminal')
                      setSearchParams(next, { replace: true })
                    }}
                  >
                    {t('page.applicationWorkload.openTerminal', '打开终端')}
                  </Button>
                ) : null}
              </Space>
            ) : undefined
          }
        >
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            items={[
              {
                key: 'namespace',
                label: t('common.namespace', '命名空间'),
                children: selectedPod.namespace,
              },
              { key: 'podIp', label: 'Pod IP', children: selectedPod.podIp || '-' },
              {
                key: 'node',
                label: t('common.node', '节点'),
                children: selectedPod.nodeName || '-',
              },
              {
                key: 'ready',
                label: t('page.applicationWorkload.containersReady', '容器就绪'),
                children: selectedPod.readyContainers || '-',
              },
              {
                key: 'restarts',
                label: t('common.restarts', '重启次数'),
                children: selectedPod.restarts,
              },
              {
                key: 'age',
                label: t('common.age', '运行时长'),
                children: formatAgeSeconds(selectedPod.ageSeconds),
              },
            ]}
          />
          <div className="soha-workload-pod-containers">
            <Space className="soha-workload-pod-containers__header" size={6} wrap>
              <Text strong>{t('page.applicationWorkload.containers', '容器')}</Text>
              <Text type="secondary">
                {t('page.applicationWorkload.fromTemplateReady', '来自 Workload 模板 · 就绪')}{' '}
                {selectedPod.readyContainers || '-'}
              </Text>
            </Space>
            {workloadContainers.length > 0 ? (
              <div className="soha-workload-pod-container-list" role="list">
                {workloadContainers.map((container) => (
                  <div
                    className="soha-workload-pod-container-item"
                    key={container.name}
                    role="listitem"
                  >
                    <Space size={6} wrap>
                      <Text strong>{container.name}</Text>
                      {container.role ? <MetadataTag label={container.role} /> : null}
                    </Space>
                    <Text className="soha-workload-pod-container-image" type="secondary">
                      {container.image || '-'}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">
                {t('page.applicationWorkload.noContainerConfig', '未返回容器配置')}
              </Text>
            )}
          </div>
        </Card>
      ) : (
        <ManagementState
          kind="empty"
          description={t('page.applicationWorkload.noPods', '当前 Workload 暂无 Pod')}
        />
      ),
    },
    {
      key: 'related-resources',
      label: `${t('page.applicationWorkload.relatedResources', '关联资源')} ${mountedResources.length}`,
      children:
        mountedResources.length > 0 ? (
          <div className="soha-application-long-card-list" role="list">
            {mountedResources.map((resource) => (
              <Card
                key={`${resource.kind}:${resource.namespace ?? ''}:${resource.name}`}
                size="small"
                role="listitem"
                className="soha-application-long-card soha-workload-related-resource-card"
                title={
                  <Space size={6} wrap>
                    <Text strong>{resource.name}</Text>
                    <MetadataTag
                      label={resource.kind === 'PersistentVolumeClaim' ? 'PVC' : resource.kind}
                      tone="blue"
                    />
                  </Space>
                }
              >
                <Descriptions
                  size="small"
                  column={{ xs: 1, sm: 2 }}
                  items={[
                    {
                      key: 'namespace',
                      label: t('common.namespace', '命名空间'),
                      children: resource.namespace || '-',
                    },
                    {
                      key: 'relation',
                      label: t('page.applicationWorkload.relation', '关联方式'),
                      children:
                        resource.kind === 'ConfigMap'
                          ? t('page.applicationWorkload.configReference', '配置引用')
                          : resource.kind === 'Secret'
                            ? t('page.applicationWorkload.secretReference', '密钥引用')
                            : t('page.applicationWorkload.volumeMount', '卷挂载'),
                    },
                  ]}
                />
              </Card>
            ))}
          </div>
        ) : (
          <ManagementState
            compact
            kind="empty"
            description={t(
              'page.applicationWorkload.noRelatedResources',
              '暂无关联 ConfigMap、Secret 或 PVC',
            )}
          />
        ),
    },
    ...(canViewPodLogs
      ? [
          {
            key: 'logs',
            label: t('page.applicationWorkload.logs', '日志'),
            children:
              resolvedActiveTab === 'logs' ? (
                selectedPod ? (
                  <Suspense fallback={<ManagementState bordered={false} compact kind="loading" />}>
                    <PodLogViewer
                      active
                      clusterId={detail.workload.clusterId}
                      namespace={detail.workload.namespace}
                      podName={selectedPod.name}
                      container={selectedContainer || undefined}
                      containerOptions={containerOptions}
                      onContainerChange={setSelectedContainerName}
                    />
                  </Suspense>
                ) : (
                  <ManagementState
                    kind="empty"
                    description={t('page.applicationWorkload.noPods', '当前 Workload 暂无 Pod')}
                  />
                )
              ) : null,
          },
        ]
      : []),
    ...(canExecPod
      ? [
          {
            key: 'terminal',
            label: t('page.applicationWorkload.terminal', '终端'),
            children:
              resolvedActiveTab === 'terminal' ? (
                selectedPod ? (
                  <div className="soha-pod-terminal-tab-card">
                    <Suspense
                      fallback={<ManagementState bordered={false} compact kind="loading" />}
                    >
                      <PodTerminal
                        clusterId={detail.workload.clusterId}
                        namespace={detail.workload.namespace}
                        podName={selectedPod.name}
                        container={selectedContainer || undefined}
                        shell={terminalShell}
                        toolbarContent={
                          <div className="soha-terminal-controls">
                            <div className="soha-terminal-control-group">
                              <Text strong>{t('common.container', '容器')}</Text>
                              <Select
                                disabled={containerOptions.length === 0}
                                options={containerOptions}
                                placeholder={t(
                                  'page.applicationWorkload.selectContainer',
                                  '选择容器',
                                )}
                                value={selectedContainer || undefined}
                                onChange={setSelectedContainerName}
                                style={{ width: 220 }}
                              />
                            </div>
                            <div className="soha-terminal-control-group">
                              <Text strong>
                                {t('page.applicationWorkload.shell', '命令解释器')}
                              </Text>
                              <Select
                                options={[
                                  { value: '/bin/sh', label: '/bin/sh' },
                                  { value: '/bin/bash', label: '/bin/bash' },
                                  { value: '/bin/ash', label: '/bin/ash' },
                                ]}
                                value={terminalShell}
                                onChange={setTerminalShell}
                                style={{ width: 180 }}
                              />
                            </div>
                          </div>
                        }
                      />
                    </Suspense>
                  </div>
                ) : (
                  <ManagementState
                    kind="empty"
                    description={t('page.applicationWorkload.noPods', '当前 Workload 暂无 Pod')}
                  />
                )
              ) : null,
          },
        ]
      : []),
    ...(isDeployment
      ? [
          {
            key: 'metrics',
            label: t('page.applicationWorkload.metrics', '监控'),
            children:
              resolvedActiveTab === 'metrics' ? (
                <Suspense fallback={<ManagementState bordered={false} compact kind="loading" />}>
                  <ResourceMetricsPanel
                    title={t('page.applicationWorkload.metricsTitle', 'Workload 指标')}
                    data={metricsQuery.data}
                    loading={metricsQuery.isLoading}
                    rangeMinutes={metricsRangeMinutes}
                    onRangeChange={setMetricsRangeMinutes}
                    errorMessage={
                      metricsQuery.error instanceof Error ? metricsQuery.error.message : undefined
                    }
                    compact
                  />
                </Suspense>
              ) : null,
          },
        ]
      : []),
  ]
  const health = deploymentHealth(deployment, t)

  return (
    <div className="soha-page soha-workload-detail-page">
      <Tabs
        className="soha-resource-tabs is-header-only soha-application-context-tabs"
        items={APPLICATION_WORKSPACE_NAV_ITEMS}
        activeKey="services"
        onChange={(tab) => navigate(`${applicationPath}?tab=${tab}`)}
      />
      <ManagementDetailHeader
        className="soha-workload-detail-header"
        title={detail.workload.workloadName}
        description={`${detail.application.name} · ${detail.environment?.name || detail.binding.environmentKey}`}
        meta={
          <div className="soha-workload-detail-header__meta">
            <Space size={[6, 6]} wrap>
              <MetadataTag label={detail.workload.workloadKind} tone="blue" />
              <StatusTag value={health.value} label={health.label} />
              <MetadataTag
                label={`${t('common.namespace', '命名空间')} ${detail.workload.namespace}`}
              />
            </Space>
            <section
              aria-label={t('page.applicationWorkload.accessAddresses', '访问地址')}
              className="soha-workload-access-overview"
            >
              <Descriptions
                colon={false}
                column={{ xs: 1, sm: 2, md: 3 }}
                items={accessOverviewItems}
                layout="vertical"
                size="small"
              />
            </section>
          </div>
        }
        actions={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`${applicationPath}?tab=services`)}
            >
              {t('page.applicationWorkload.backServices', '返回服务')}
            </Button>
            {canManage && isDeployment ? (
              <ManagementIconButton
                aria-label={t('page.applicationWorkload.restartWorkload', '重启工作负载')}
                icon={<ReloadOutlined />}
                loading={restartMutation.isPending}
                tooltip={t('page.applicationWorkload.restart', '重启')}
                onClick={() =>
                  restartMutation.mutate({
                    clusterId: detail.workload.clusterId,
                    namespace: detail.workload.namespace,
                    workloadName: detail.workload.workloadName,
                  })
                }
              />
            ) : null}
          </Space>
        }
      />
      <div className="soha-workload-runtime-workspace">
        <ManagementSearchableListPane
          activeKey={selectedPod?.name}
          emptyDescription={t('page.applicationWorkload.noPods', '当前 Workload 暂无 Pod')}
          getItemKey={(pod) => pod.name}
          items={visiblePods}
          renderItem={(pod) => (
            <>
              <div className="soha-workload-pod-list-item__header">
                <Text strong>{pod.name}</Text>
                <StatusTag value={pod.phase} />
              </div>
              <div className="soha-workload-pod-list-item__meta">
                <Text type="secondary">{pod.nodeName || '-'}</Text>
                <Text type="secondary">
                  {pod.readyContainers || '-'} ·{' '}
                  {t('page.applicationWorkload.restartCount', '重启')} {pod.restarts}
                </Text>
              </div>
            </>
          )}
          searchPlaceholder={t('page.applicationWorkload.searchPod', '搜索 Pod')}
          searchValue={podSearch}
          onItemSelect={(pod) => {
            const next = new URLSearchParams(searchParams)
            next.set('pod', pod.name)
            setSearchParams(next, { replace: true })
          }}
          onSearchChange={setPodSearch}
        />
        <Tabs
          activeKey={resolvedActiveTab}
          className="soha-resource-tabs soha-workload-detail-tabs"
          destroyOnHidden
          indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
          items={tabItems}
          onChange={(tab) => {
            const next = new URLSearchParams(searchParams)
            next.set('tab', tab)
            setSearchParams(next, { replace: true })
          }}
          size="small"
          tabBarGutter={18}
        />
      </div>
    </div>
  )
}
