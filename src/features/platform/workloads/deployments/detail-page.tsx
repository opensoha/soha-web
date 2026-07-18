import { lazy, Suspense, useState, useMemo } from 'react'
import { Tag, Card, Spin, Tooltip, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { StatusTag } from '@/components/status-tag'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import {
  conditionToTimelineEvent,
  resolveWorkloadNamespace,
  targetMatchesDeployment,
} from '@/features/platform/workloads-model'
import { toScopeKey } from '@/types'
import type { TabsProps } from 'antd'
import { WorkloadDetailShell } from '../shared/detail-shell'
import { WorkloadPodsCard, WorkloadRelationsCard } from '../shared/workload-relations'
import { deploymentQueries } from './queries'
import { deploymentLinkageQueries } from './linkage-queries'
import type { ApplicationEnvironment } from './types'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

export function DeploymentDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const deploymentName = params.deploymentName as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = resolveWorkloadNamespace(namespace, searchParams.get('namespace'))
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const detailScope = toScopeKey(clusterId, detailNamespace)
  const deploymentDetailQuery = useQuery(deploymentQueries.detail(detailScope, deploymentName))

  const bindingsQuery = useQuery(deploymentLinkageQueries.applicationEnvironments())
  const applicationsQuery = useQuery(deploymentLinkageQueries.applications())
  const buildsQuery = useQuery(deploymentLinkageQueries.builds())
  const workflowsQuery = useQuery(deploymentLinkageQueries.workflows())
  const releasesQuery = useQuery(deploymentLinkageQueries.releases())
  const metricsQueryOptions = deploymentQueries.metrics(detailScope, deploymentName)
  const metricsQuery = useQuery({
    ...metricsQueryOptions,
    enabled: Boolean(metricsQueryOptions.enabled) && activeTabKey === 'metrics',
  })
  const rolloutStatusQuery = useQuery(deploymentQueries.rolloutStatus(detailScope, deploymentName))
  const rolloutHistoryQuery = useQuery(deploymentQueries.rollouts(detailScope, deploymentName))
  const deploymentEventsQueryOptions = deploymentQueries.events(detailScope, deploymentName)
  const deploymentEventsQuery = useQuery({
    ...deploymentEventsQueryOptions,
    enabled: Boolean(deploymentEventsQueryOptions.enabled) && activeTabKey === 'events',
  })
  const matchedBindings = useMemo<ApplicationEnvironment[]>(() => {
    if (!clusterId || !detailNamespace) return []
    return (bindingsQuery.data ?? []).filter((binding) =>
      (binding.targets ?? []).some((target) =>
        targetMatchesDeployment(target, clusterId, detailNamespace, deploymentName),
      ),
    )
  }, [bindingsQuery.data, clusterId, detailNamespace, deploymentName])

  const applicationMap = useMemo(
    () => Object.fromEntries((applicationsQuery.data ?? []).map((item) => [item.id, item])),
    [applicationsQuery.data],
  )
  const latestBuildByApplication = useMemo(
    () => Object.fromEntries((buildsQuery.data ?? []).map((item) => [item.applicationId, item])),
    [buildsQuery.data],
  )

  const rolloutStatus = rolloutStatusQuery.data
  const rolloutHistory = rolloutHistoryQuery.data ?? []
  const deploymentPods = deploymentDetailQuery.data?.pods ?? []
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: `Deployment ${deploymentName}`,
    entityKind: 'kubernetes.deployment',
    entityName: deploymentName,
    clusterId: clusterId ?? undefined,
    namespace: detailNamespace ?? undefined,
    workload: deploymentName,
    timeRangeMinutes: metricsQuery.data?.rangeMinutes ?? 60,
    pinnedData: {
      pods: deploymentPods.length,
      rolloutStatus: rolloutStatus?.status,
      desiredReplicas: rolloutStatus?.desiredReplicas,
    },
    promptHint: `排查 Deployment ${deploymentName} 的副本、Pod、滚动发布、事件、日志和指标。`,
  })
  const deploymentTimelineEvents = useMemo(
    () =>
      deploymentEventsQuery.data?.length
        ? deploymentEventsQuery.data
        : (rolloutStatus?.conditions ?? []).map(conditionToTimelineEvent),
    [deploymentEventsQuery.data, rolloutStatus],
  )
  const linkageOverview = (
    <div className="soha-detail-stack">
      <WorkloadPodsCard pods={deploymentPods} namespace={detailNamespace} />
      <WorkloadRelationsCard
        resources={deploymentDetailQuery.data?.relatedResources}
        namespace={detailNamespace}
      />
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? '滚动发布' : 'Rollout'}
      >
        <div className="soha-rollout-status-section">
          {rolloutStatus ? (
            <div className="soha-rollout-status-compact">
              <span className="soha-rollout-status-chip">
                <Text type="secondary">Revision</Text>
                <Text strong>{rolloutStatus.revision || '-'}</Text>
              </span>
              <span className="soha-rollout-status-chip">
                <Text type="secondary">{localeCode === 'zh_CN' ? '状态' : 'Status'}</Text>
                <StatusTag value={rolloutStatus.status} />
              </span>
              <Tooltip title={rolloutStatus.message || '-'}>
                <span className="soha-rollout-status-chip soha-rollout-status-chip-message">
                  <Text type="secondary">{localeCode === 'zh_CN' ? '消息' : 'Message'}</Text>
                  <Text className="soha-rollout-status-message">
                    {rolloutStatus.message || '-'}
                  </Text>
                </span>
              </Tooltip>
              <span className="soha-rollout-status-chip">
                <Text type="secondary">{localeCode === 'zh_CN' ? '副本' : 'Desired'}</Text>
                <Text>{rolloutStatus.desiredReplicas}</Text>
              </span>
              <span className="soha-rollout-status-chip">
                <Text type="secondary">{localeCode === 'zh_CN' ? '更新' : 'Updated'}</Text>
                <Text>{rolloutStatus.updatedReplicas}</Text>
              </span>
              <span className="soha-rollout-status-chip">
                <Text type="secondary">{localeCode === 'zh_CN' ? '就绪' : 'Ready'}</Text>
                <Text>{rolloutStatus.readyReplicas}</Text>
              </span>
              <span className="soha-rollout-status-chip">
                <Text type="secondary">{localeCode === 'zh_CN' ? '可用' : 'Available'}</Text>
                <Text>{rolloutStatus.availableReplicas}</Text>
              </span>
            </div>
          ) : (
            <ManagementState
              bordered={false}
              compact
              title={localeCode === 'zh_CN' ? '暂无滚动状态' : 'No rollout status'}
            />
          )}
        </div>
        <div className="soha-rollout-history-section">
          {rolloutHistory.length === 0 ? (
            <ManagementState
              bordered={false}
              compact
              title={localeCode === 'zh_CN' ? '暂无滚动历史' : 'No rollout history'}
            />
          ) : (
            <div className="soha-rollout-history-list">
              {rolloutHistory.map((record) => (
                <div key={record.revision} className="soha-rollout-history-row">
                  <Text type="secondary" className="soha-rollout-history-time">
                    {record.createdAt ? formatDateTime(record.createdAt) : '-'}
                  </Text>
                  <Text
                    strong
                    className="soha-rollout-history-revision"
                  >{`Revision ${record.revision || '-'}`}</Text>
                  <Tag className="soha-rollout-history-tag">{`${localeCode === 'zh_CN' ? '副本' : 'Replicas'} ${record.replicas ?? '-'}`}</Tag>
                  <Tag className="soha-rollout-history-tag">{`${localeCode === 'zh_CN' ? '就绪' : 'Ready'} ${record.readyReplicas ?? '-'}`}</Tag>
                  <Text type="secondary" className="soha-rollout-history-image">
                    {record.images?.length
                      ? record.images.join(', ')
                      : localeCode === 'zh_CN'
                        ? '未记录镜像'
                        : 'No image recorded'}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      <Card className="soha-detail-card" size="small" title="交付联动">
        {matchedBindings.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title="当前 Deployment 尚未绑定到任何应用环境"
          />
        ) : (
          <div className="soha-list-panel">
            {matchedBindings.map((binding) => {
              const application = applicationMap[binding.applicationId]
              const latestBuild = latestBuildByApplication[binding.applicationId]
              const latestWorkflow = (workflowsQuery.data ?? []).find(
                (item) =>
                  item.applicationId === binding.applicationId &&
                  item.clusterId === clusterId &&
                  item.namespace === detailNamespace &&
                  item.deploymentName === deploymentName,
              )
              const latestRelease = (releasesQuery.data ?? []).find(
                (item) =>
                  item.applicationId === binding.applicationId &&
                  item.clusterId === clusterId &&
                  item.namespace === detailNamespace &&
                  item.deploymentName === deploymentName,
              )

              return (
                <div key={binding.id} className="soha-list-row">
                  <div className="soha-list-row-meta">
                    <Text strong>{application?.name || binding.applicationId}</Text>
                    <Tag color="blue">{binding.environmentKey || binding.environmentId}</Tag>
                    {binding.workflowTemplate?.name ? (
                      <Tag color="cyan">{binding.workflowTemplate.name}</Tag>
                    ) : null}
                  </div>
                  <div className="soha-list-row-extra">
                    <StatusTag value={latestBuild?.status || 'unknown'} />
                    <StatusTag value={latestWorkflow?.status || 'unknown'} />
                    <StatusTag value={latestRelease?.status || 'unknown'} />
                    <Text type="secondary" className="text-xs">
                      {latestRelease?.createdAt
                        ? `最近发布: ${formatDateTime(latestRelease.createdAt)}`
                        : latestWorkflow?.updatedAt
                          ? `最近工作流: ${formatDateTime(latestWorkflow.updatedAt)}`
                          : latestBuild?.createdAt
                            ? `最近构建: ${formatDateTime(latestBuild.createdAt)}`
                            : '暂无执行记录'}
                    </Text>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )

  const metricsTab: NonNullable<TabsProps['items']>[number] = {
    key: 'metrics',
    label: localeCode === 'zh_CN' ? '指标' : 'Metrics',
    children: (
      <Suspense
        fallback={
          <Card className="soha-detail-card">
            <Spin size="large" />
          </Card>
        }
      >
        <ResourceMetricsPanel
          title={localeCode === 'zh_CN' ? 'Deployment 指标' : 'Deployment Metrics'}
          data={metricsQuery.data}
          loading={metricsQuery.isLoading}
        />
      </Suspense>
    ),
  }

  const eventsTab: NonNullable<TabsProps['items']>[number] = {
    key: 'events',
    label: localeCode === 'zh_CN' ? '事件' : 'Events',
    children: (
      <ResourceEventsTimeline
        title={localeCode === 'zh_CN' ? 'Deployment 事件时间线' : 'Deployment Event Timeline'}
        events={deploymentTimelineEvents}
        loading={deploymentEventsQuery.isLoading}
        emptyDescription={
          localeCode === 'zh_CN'
            ? '当前 Deployment 暂无事件和状态变化'
            : 'No deployment events or rollout condition transitions'
        }
      />
    ),
  }

  return (
    <WorkloadDetailShell
      title="Deployment"
      resource="deployments"
      paramKey="deploymentName"
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      extraOverview={linkageOverview}
      extraTabPanes={[metricsTab, eventsTab]}
      yamlLast
    />
  )
}
