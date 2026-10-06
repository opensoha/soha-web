import { lazy, Suspense, useState, useMemo } from 'react'
import { Tag, Card, Pagination, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useAIPageContext } from '@/features/copilot'
import { deliveryQueries, type ApplicationEnvironment } from '@/features/delivery'
import { useI18n } from '@/i18n'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import {
  conditionToTimelineEvent,
  targetMatchesDeployment,
} from '@/features/platform/workloads-model'
import type { TabsProps } from 'antd'
import { WorkloadDetailShell } from '../shared/detail-shell'
import { WorkloadPodsCard, WorkloadRelationsCard } from '../shared/workload-relations'
import { useWorkloadDetailScope } from '../shared/detail-scope'
import { deploymentQueries } from './queries'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

export function DeploymentDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const deploymentName = params.deploymentName as string
  const { clusterId, namespace: detailNamespace } = useWorkloadDetailScope()
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const detailScope = { clusterId, namespace: detailNamespace }
  const deploymentDetailQuery = useQuery(deploymentQueries.detail(detailScope, deploymentName))

  const bindingsQuery = useQuery(deliveryQueries.environments.list())
  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const buildsQuery = useQuery(deliveryQueries.builds.list())
  const workflowsQuery = useQuery(deliveryQueries.workflows.list())
  const releasesQuery = useQuery(deliveryQueries.releases.list())
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
  const rolloutHistory = useMemo(
    () =>
      [...(rolloutHistoryQuery.data ?? [])].sort((a, b) =>
        b.revision.localeCompare(a.revision, undefined, { numeric: true }),
      ),
    [rolloutHistoryQuery.data],
  )
  const historyScope = JSON.stringify([clusterId, detailNamespace, deploymentName])
  const [historyPagination, setHistoryPagination] = useState({ scope: historyScope, page: 1 })
  const historyPage = Math.min(
    historyPagination.scope === historyScope ? historyPagination.page : 1,
    Math.max(1, Math.ceil(rolloutHistory.length / 3)),
  )
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
    promptHint:
      localeCode === 'zh_CN'
        ? `排查 Deployment ${deploymentName} 的副本、Pod、滚动发布、事件、日志和指标。`
        : `Investigate replicas, Pods, rollouts, events, logs, and metrics for Deployment ${deploymentName}.`,
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
      <WorkloadPodsCard pods={deploymentPods} namespace={detailNamespace ?? ''} />
      <WorkloadRelationsCard
        resources={deploymentDetailQuery.data?.relatedResources}
        namespace={detailNamespace ?? ''}
      />
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? '滚动发布' : 'Rollout'}
      >
        <div className="soha-rollout-status-section">
          {rolloutStatus ? (
            <>
              <div className="soha-rollout-current-heading">
                <Text
                  strong
                >{`${localeCode === 'zh_CN' ? '当前版本' : 'Current revision'} ${rolloutStatus.revision || '-'}`}</Text>
                <StatusTag value={rolloutStatus.status} />
              </div>
              <dl className="soha-rollout-counts">
                {[
                  [localeCode === 'zh_CN' ? '期望副本' : 'Desired', rolloutStatus.desiredReplicas],
                  [localeCode === 'zh_CN' ? '已更新' : 'Updated', rolloutStatus.updatedReplicas],
                  [localeCode === 'zh_CN' ? '已就绪' : 'Ready', rolloutStatus.readyReplicas],
                  [
                    localeCode === 'zh_CN' ? '可用副本' : 'Available',
                    rolloutStatus.availableReplicas,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value ?? '-'}</dd>
                  </div>
                ))}
              </dl>
              {rolloutStatus.message ? (
                <Text type="secondary" className="soha-rollout-status-message">
                  {rolloutStatus.message}
                </Text>
              ) : null}
            </>
          ) : (
            <ManagementState
              bordered={false}
              compact
              kind={
                rolloutStatusQuery.isPending
                  ? 'loading'
                  : rolloutStatusQuery.isError
                    ? 'error'
                    : 'empty'
              }
              title={
                localeCode === 'zh_CN'
                  ? rolloutStatusQuery.isPending
                    ? '正在加载滚动状态'
                    : rolloutStatusQuery.isError
                      ? '滚动状态加载失败'
                      : '暂无滚动状态'
                  : rolloutStatusQuery.isPending
                    ? 'Loading rollout status'
                    : rolloutStatusQuery.isError
                      ? 'Failed to load rollout status'
                      : 'No rollout status'
              }
            />
          )}
        </div>
        <section
          className="soha-rollout-history-section"
          aria-label={localeCode === 'zh_CN' ? '版本历史' : 'Revision history'}
        >
          <div className="soha-rollout-history-heading">
            <Text strong>{localeCode === 'zh_CN' ? '版本历史' : 'Revision history'}</Text>
            <Text type="secondary">
              {localeCode === 'zh_CN'
                ? `共 ${rolloutHistory.length} 个版本`
                : `${rolloutHistory.length} revisions`}
            </Text>
          </div>
          {rolloutHistory.length === 0 ? (
            <ManagementState
              bordered={false}
              compact
              kind={
                rolloutHistoryQuery.isPending
                  ? 'loading'
                  : rolloutHistoryQuery.isError
                    ? 'error'
                    : 'empty'
              }
              title={
                localeCode === 'zh_CN'
                  ? rolloutHistoryQuery.isPending
                    ? '正在加载版本历史'
                    : rolloutHistoryQuery.isError
                      ? '版本历史加载失败'
                      : '暂无滚动历史'
                  : rolloutHistoryQuery.isPending
                    ? 'Loading revision history'
                    : rolloutHistoryQuery.isError
                      ? 'Failed to load revision history'
                      : 'No rollout history'
              }
            />
          ) : (
            <>
              <div className="soha-rollout-history-list" role="list">
                {rolloutHistory.slice((historyPage - 1) * 3, historyPage * 3).map((record) => (
                  <div key={record.revision} className="soha-rollout-history-row" role="listitem">
                    <div className="soha-rollout-history-row-heading">
                      <Text
                        strong
                        className="soha-rollout-history-revision"
                      >{`${localeCode === 'zh_CN' ? '版本' : 'Revision'} ${record.revision || '-'}`}</Text>
                      {record.revision === rolloutStatus?.revision ? (
                        <MetadataTag
                          label={localeCode === 'zh_CN' ? '当前版本' : 'Current'}
                          tone="blue"
                        />
                      ) : null}
                      <Text type="secondary" className="soha-rollout-history-time">
                        {record.createdAt ? formatDateTime(record.createdAt) : '-'}
                      </Text>
                    </div>
                    <div className="soha-rollout-history-meta">
                      <span className="soha-rollout-history-name" title={record.name}>
                        {record.name}
                      </span>
                      <span>{`${localeCode === 'zh_CN' ? '副本' : 'Replicas'} ${record.replicas ?? '-'}`}</span>
                      <span>{`${localeCode === 'zh_CN' ? '就绪' : 'Ready'} ${record.readyReplicas ?? '-'}`}</span>
                    </div>
                    {record.images?.length ? (
                      <details className="soha-rollout-images">
                        <summary>
                          <span>
                            {localeCode === 'zh_CN'
                              ? `镜像 ${record.images.length}`
                              : `Images ${record.images.length}`}
                          </span>
                          <span className="soha-rollout-image-preview">{record.images[0]}</span>
                        </summary>
                        <ul>
                          {record.images.map((image, index) => (
                            <li key={`${index}:${image}`}>{image}</li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <Text type="secondary">
                        {localeCode === 'zh_CN' ? '未记录镜像' : 'No image recorded'}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
              {rolloutHistory.length > 3 ? (
                <nav
                  className="soha-rollout-history-pagination"
                  aria-label={
                    localeCode === 'zh_CN' ? '版本历史分页' : 'Revision history pagination'
                  }
                >
                  <Text type="secondary">
                    {localeCode === 'zh_CN' ? '每页 3 个版本' : '3 revisions per page'}
                  </Text>
                  <Pagination
                    current={historyPage}
                    pageSize={3}
                    total={rolloutHistory.length}
                    showSizeChanger={false}
                    simple={{ readOnly: true }}
                    onChange={(page) => setHistoryPagination({ scope: historyScope, page })}
                  />
                </nav>
              ) : null}
            </>
          )}
        </section>
      </Card>
      <Card
        className="soha-detail-card"
        size="small"
        title={localeCode === 'zh_CN' ? '交付联动' : 'Delivery integration'}
      >
        {matchedBindings.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title={
              localeCode === 'zh_CN'
                ? '当前 Deployment 尚未绑定到任何应用环境'
                : 'This Deployment is not bound to an application environment'
            }
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
                        ? `${localeCode === 'zh_CN' ? '最近发布' : 'Latest release'}: ${formatDateTime(latestRelease.createdAt)}`
                        : latestWorkflow?.updatedAt
                          ? `${localeCode === 'zh_CN' ? '最近工作流' : 'Latest workflow'}: ${formatDateTime(latestWorkflow.updatedAt)}`
                          : latestBuild?.createdAt
                            ? `${localeCode === 'zh_CN' ? '最近构建' : 'Latest build'}: ${formatDateTime(latestBuild.createdAt)}`
                            : localeCode === 'zh_CN'
                              ? '暂无执行记录'
                              : 'No execution records'}
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
        <ResourceMetricsPanel data={metricsQuery.data} loading={metricsQuery.isLoading} />
      </Suspense>
    ),
  }

  const eventsTab: NonNullable<TabsProps['items']>[number] = {
    key: 'events',
    label: localeCode === 'zh_CN' ? '事件' : 'Events',
    children: (
      <ResourceEventsTimeline
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
