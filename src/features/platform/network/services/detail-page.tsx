import { lazy, Suspense, useState } from 'react'
import { Button, Card, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { StatusTag } from '@/components/status-tag'
import { useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType, TabsProps } from 'antd'
import { NetworkDetailShell } from '../shared/detail-shell'
import { resolveNetworkNamespace } from '../shared/scope'
import { serviceQueries } from './queries'
import type { ServiceBackendPod } from './types'

const ResourceMetricsPanel = lazy(async () => {
  const module = await import('@/components/resource-metrics-panel')
  return { default: module.ResourceMetricsPanel }
})

function buildPodDetailPath(name: string, namespace: string) {
  const query = new URLSearchParams({ namespace }).toString()
  return `/workloads/pods/${encodeURIComponent(name)}?${query}`
}

export function ServiceDetailPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const serviceName = (params.serviceName as string | undefined) ?? ''
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const detailQuery = useQuery(serviceQueries.detail(scope, serviceName))
  const service = detailQuery.data

  const backendPodsOptions = serviceQueries.backendPods(scope, serviceName, service?.selector)
  const backendPodsQuery = useQuery({
    ...backendPodsOptions,
    enabled: Boolean(backendPodsOptions.enabled) && activeTabKey === 'backends' && Boolean(service),
  })
  const metricsOptions = serviceQueries.metrics(scope, serviceName)
  const metricsQuery = useQuery({
    ...metricsOptions,
    enabled: Boolean(metricsOptions.enabled) && activeTabKey === 'metrics',
  })
  const eventsOptions = serviceQueries.events(scope, serviceName)
  const eventsQuery = useQuery({
    ...eventsOptions,
    enabled: Boolean(eventsOptions.enabled) && activeTabKey === 'events',
  })

  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: `Service ${service?.name ?? serviceName}`,
    entityKind: 'kubernetes.service',
    entityName: service?.name ?? serviceName,
    clusterId: clusterId ?? undefined,
    namespace: detailNamespace || service?.namespace,
    service: service?.name ?? serviceName,
    timeRangeMinutes: metricsQuery.data?.rangeMinutes ?? 60,
    pinnedData: {
      type: service?.type,
      clusterIp: service?.clusterIp,
      ports: service?.ports,
      selector: service?.selector,
      activeTab: activeTabKey,
    },
    promptHint: `排查 Service ${service?.name ?? serviceName} 的访问异常、Endpoint/后端 Pod、事件、日志和指标。`,
  })

  const backendPodColumns: TableColumnsType<ServiceBackendPod> = [
    {
      title: 'Pod',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="text" onClick={() => navigate(buildPodDetailPath(value, record.namespace))}>
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
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!service) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? '未找到服务' : 'Service not found'}
        />
      </div>
    )
  }

  const extraTabs: NonNullable<TabsProps['items']> = [
    {
      key: 'backends',
      label: localeCode === 'zh_CN' ? '后端 Pods' : 'Backend Pods',
      children:
        activeTabKey === 'backends' ? (
          <AdminTable
            className="soha-platform-table"
            columnSettingIconOnly
            columnSettingPlacement="header"
            shellClassName="soha-management-table-shell"
            title={localeCode === 'zh_CN' ? '后端 Pods' : 'Backend Pods'}
            columns={backendPodColumns}
            dataSource={backendPodsQuery.data ?? []}
            rowKey={(record) => `${record.namespace}/${record.name}`}
            loading={backendPodsQuery.isLoading}
            pageSize={10}
            tableSize="small"
            scroll={{ x: 'max-content' }}
          />
        ) : null,
    },
    {
      key: 'metrics',
      label: localeCode === 'zh_CN' ? '指标' : 'Metrics',
      children:
        activeTabKey === 'metrics' ? (
          <Suspense
            fallback={
              <Card className="soha-detail-card">
                <Spin size="large" />
              </Card>
            }
          >
            <ResourceMetricsPanel
              title="Service Metrics"
              data={metricsQuery.data}
              loading={metricsQuery.isLoading}
            />
          </Suspense>
        ) : null,
    },
    {
      key: 'events',
      label: localeCode === 'zh_CN' ? '事件' : 'Events',
      children:
        activeTabKey === 'events' ? (
          <ResourceEventsTimeline
            title="Service Event Timeline"
            events={eventsQuery.data ?? []}
            loading={eventsQuery.isLoading}
            emptyDescription={
              localeCode === 'zh_CN' ? '当前 Service 暂无事件' : 'No service events'
            }
          />
        ) : null,
    },
  ]

  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      ageLabel="Age"
      detail={service}
      extraTabs={extraTabs}
      kind="services"
      label="Service"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Type', value: service.type },
        { key: 'Cluster IP', value: service.clusterIp || '-' },
        { key: 'Ports', value: service.ports?.join(', ') || '-' },
      ]}
      target={{ scope, name: serviceName }}
    />
  )
}
