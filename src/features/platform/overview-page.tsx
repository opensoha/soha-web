import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Space, Spin, Typography } from 'antd'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  FireOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { observabilityAlertQueries, useAlertEventStream } from '@/features/observability'
import { ResourceStreamStatus } from '@/features/platform/shared/resource-stream-status'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds, formatDateTime } from '@/utils/time'
import type { Cluster } from '@/types'
import {
  filterAlertsForCluster,
  formatPlatformOverviewAlertScope,
  formatPlatformOverviewText,
  selectActiveAlerts,
  summarizeFleetReadiness,
} from './overview/model'
import { PlatformOperationsPanel } from './overview/operations-panel'
import { platformOverviewQueries } from './overview/queries'
import { ResourceFinder, type OverviewResourceKindOption } from './overview/resource-finder'
import type { AggregatedWorkloadOverview } from './overview/types'
import './overview.css'

const { Text } = Typography

const clusterTypeLabels: Record<string, { zh: string; en: string }> = {
  standard_kubernetes: { zh: '标准 Kubernetes', en: 'Standard Kubernetes' },
  k3s: { zh: 'K3s', en: 'K3s' },
  gke: { zh: 'GKE', en: 'GKE' },
  eks: { zh: 'EKS', en: 'EKS' },
  ack: { zh: 'ACK', en: 'ACK' },
  tke: { zh: 'TKE', en: 'TKE' },
  aks: { zh: 'AKS', en: 'AKS' },
}

function clusterTypeOf(cluster: Cluster) {
  const provider = cluster.labels?.provider
  return typeof provider === 'string' && provider.trim() !== '' ? provider.trim() : cluster.region
}

function formatClusterType(cluster: Cluster, localeCode: string) {
  const value = clusterTypeOf(cluster)
  const item = clusterTypeLabels[value]
  if (!item) return value || '-'
  return localeCode === 'zh_CN' ? item.zh : item.en
}

function formatWorkloadSource(source: string | undefined, localeCode: string) {
  switch ((source || '').toLowerCase()) {
    case 'cache':
      return localeCode === 'zh_CN' ? '缓存' : 'Cache'
    case 'live':
      return localeCode === 'zh_CN' ? '实时' : 'Live'
    case 'agent':
      return 'Agent'
    default:
      return source || '-'
  }
}

export function OverviewPage() {
  const { t, localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canViewClusters = hasPermission(permissionSnapshot, 'platform.clusters.view')
  const canViewMonitoring = hasPermission(permissionSnapshot, 'observe.monitoring.view')
  const canViewAlerts = hasPermission(permissionSnapshot, 'observe.alerts.view')
  const canViewWorkloads = hasPermission(permissionSnapshot, 'platform.pods.view')

  const clustersQuery = useQuery(platformOverviewQueries.clusters(canViewClusters))

  const summaryQuery = useQuery(platformOverviewQueries.monitoringSummary(canViewMonitoring))
  const alertEventsQuery = useQuery({
    ...observabilityAlertQueries.recent(50, clusterId ?? undefined),
    enabled: canViewAlerts && Boolean(clusterId),
  })
  const refreshAlertOverview = () => {
    void alertEventsQuery.refetch?.()
    if (canViewMonitoring) void summaryQuery.refetch?.()
  }
  const alertStream = useAlertEventStream({
    clusterId,
    enabled: canViewAlerts && Boolean(clusterId),
    onSignal: refreshAlertOverview,
    onFallback: refreshAlertOverview,
  })

  const clusters = canViewClusters ? (clustersQuery.data ?? []) : []
  const summary = canViewMonitoring ? summaryQuery.data?.data : undefined
  const healthyClusters = clusters.filter((cluster) => cluster.health?.status === 'healthy').length
  const currentCluster = clusters.find((cluster) => cluster.id === clusterId) ?? null
  const fleetReadiness = summarizeFleetReadiness(clusters)
  const scopedAlertEvents = useMemo(
    () => filterAlertsForCluster(alertEventsQuery.data ?? [], clusterId),
    [alertEventsQuery.data, clusterId],
  )
  const activeAlertEvents = useMemo(
    () => selectActiveAlerts(scopedAlertEvents, 50),
    [scopedAlertEvents],
  )
  const activeAlerts = activeAlertEvents.slice(0, 2)
  const alertEventSeverityCounts = useMemo(
    () =>
      activeAlertEvents.reduce(
        (counts, alert) => {
          const severity = alert.severity.toLowerCase()
          if (severity === 'critical' || severity === 'warning' || severity === 'info') {
            counts[severity] += 1
          }
          return counts
        },
        { critical: 0, warning: 0, info: 0 },
      ),
    [activeAlertEvents],
  )
  const effectiveAlertCount = scopedAlertEvents.length
  const effectiveFiringCount = activeAlertEvents.length
  const resolvedAlertCount = scopedAlertEvents.filter(
    (alert) => (alert.currentState || alert.status).toLowerCase() === 'resolved',
  ).length
  const resourceSearchOptions = useMemo(
    () =>
      [
        {
          value: 'pods',
          label: 'Pods',
          allowed: hasPermission(permissionSnapshot, 'platform.pods.view'),
        },
        {
          value: 'deployments',
          label: 'Deployments',
          allowed: hasPermission(permissionSnapshot, 'platform.deployment.view'),
        },
        {
          value: 'services',
          label: 'Services',
          allowed: hasPermission(permissionSnapshot, 'platform.network.services.view'),
        },
        {
          value: 'configmaps',
          label: 'ConfigMaps',
          allowed: hasPermission(permissionSnapshot, 'platform.configuration.config-maps.view'),
        },
        {
          value: 'namespaces',
          label: localeCode === 'zh_CN' ? '命名空间' : 'Namespaces',
          allowed: hasPermission(permissionSnapshot, 'platform.namespaces.view'),
        },
        {
          value: 'nodes',
          label: localeCode === 'zh_CN' ? '节点' : 'Nodes',
          allowed: hasPermission(permissionSnapshot, 'platform.nodes.view'),
        },
        {
          value: 'hpas',
          label: 'HPAs',
          allowed: hasPermission(
            permissionSnapshot,
            'platform.configuration.horizontal-pod-autoscalers.view',
          ),
        },
        {
          value: 'networkpolicies',
          label: 'NetworkPolicies',
          allowed: hasPermission(permissionSnapshot, 'platform.network.network-policies.view'),
        },
      ]
        .filter((item) => item.allowed)
        .map(({ value, label }) => ({ value, label })) as OverviewResourceKindOption[],
    [localeCode, permissionSnapshot],
  )

  const workloadOverviewQuery = useQuery(
    platformOverviewQueries.workload(clusterId, canViewWorkloads),
  )

  const workloadOverviewLoading = canViewWorkloads && workloadOverviewQuery.isLoading
  const workloadOverviewData = canViewWorkloads ? (workloadOverviewQuery.data?.data ?? null) : null

  const workloadOverview = useMemo<AggregatedWorkloadOverview | null>(() => {
    if (!workloadOverviewData) return null
    const clusterName = currentCluster?.name ?? clusterId ?? '-'

    return {
      totalPods: workloadOverviewData.totalPods,
      runningPods: workloadOverviewData.runningPods,
      pendingPods: workloadOverviewData.pendingPods,
      succeededPods: workloadOverviewData.succeededPods,
      failedPods: workloadOverviewData.failedPods,
      unknownPods: workloadOverviewData.unknownPods,
      restartingPods: workloadOverviewData.restartingPods,
      atRiskPods: workloadOverviewData.atRiskPods,
      generatedAt: workloadOverviewData.generatedAt,
      source: workloadOverviewData.source,
      namespaceBreakdown: (workloadOverviewData.namespaceBreakdown ?? [])
        .map((item) => ({
          ...item,
          clusterId: workloadOverviewData.clusterId,
          clusterName,
        }))
        .sort((left, right) => {
          if (left.atRiskPods !== right.atRiskPods) return right.atRiskPods - left.atRiskPods
          if (left.restartingPods !== right.restartingPods)
            return right.restartingPods - left.restartingPods
          if (left.totalPods !== right.totalPods) return right.totalPods - left.totalPods
          return left.namespace.localeCompare(right.namespace)
        })
        .slice(0, 6),
      problematicPods: (workloadOverviewData.problematicPods ?? [])
        .map((item) => ({
          ...item,
          clusterId: workloadOverviewData.clusterId,
          clusterName,
        }))
        .sort((left, right) => {
          if (left.restarts !== right.restarts) return right.restarts - left.restarts
          return (
            left.namespace.localeCompare(right.namespace) || left.name.localeCompare(right.name)
          )
        })
        .slice(0, 8),
    }
  }, [clusterId, currentCluster?.name, workloadOverviewData])

  const namespaceBreakdown = workloadOverview?.namespaceBreakdown ?? []
  const problematicPods = workloadOverview?.problematicPods ?? []
  const updatedAt = workloadOverview?.generatedAt
    ? formatDateTime(workloadOverview.generatedAt)
    : '-'
  const isLoading =
    permissionSnapshotQuery.isLoading ||
    (canViewClusters && clustersQuery.isLoading) ||
    (canViewMonitoring && summaryQuery.isLoading)
  const latestAlertEventAt = scopedAlertEvents.reduce<string | undefined>((latest, alert) => {
    const candidate = alert.lastSeenAt || alert.updatedAt
    return !latest || Date.parse(candidate) > Date.parse(latest) ? candidate : latest
  }, undefined)
  const lastReceivedAt = formatDateTime(latestAlertEventAt)
  const lastReceivedText =
    lastReceivedAt === '-'
      ? localeCode === 'zh_CN'
        ? '暂无接收记录'
        : 'No received alerts'
      : lastReceivedAt

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (permissionSnapshotQuery.isError) {
    return (
      <div className="soha-page soha-overview-page soha-platform-overview-page">
        <ManagementState
          kind="error"
          title={localeCode === 'zh_CN' ? '权限信息加载失败' : 'Failed to load permissions'}
        />
      </div>
    )
  }

  const overviewStats = [
    {
      key: 'clusters',
      label: localeCode === 'zh_CN' ? '集群总数' : 'Clusters',
      helper: localeCode === 'zh_CN' ? '已登记到控制台的集群' : 'Registered in the console',
      value: !canViewClusters || clustersQuery.isError ? '-' : clusters.length,
      icon: <ClusterOutlined />,
      tone: 'default',
    },
    {
      key: 'healthy',
      label: localeCode === 'zh_CN' ? '健康集群' : 'Healthy',
      helper: localeCode === 'zh_CN' ? '当前健康状态正常' : 'Reporting healthy status',
      value: !canViewClusters || clustersQuery.isError ? '-' : healthyClusters,
      icon: <CheckCircleOutlined />,
      tone: 'success',
    },
    {
      key: 'alerts',
      label: localeCode === 'zh_CN' ? '活跃告警' : 'Firing Alerts',
      helper: localeCode === 'zh_CN' ? '需要值守的告警压力' : 'Current alert pressure',
      value: !clusterId || !canViewAlerts || alertEventsQuery.isError ? '-' : effectiveFiringCount,
      icon: <WarningOutlined />,
      tone: effectiveFiringCount > 0 ? 'warning' : 'default',
    },
    {
      key: 'channels',
      label: localeCode === 'zh_CN' ? '通知渠道' : 'Channels',
      helper: localeCode === 'zh_CN' ? '可用通知投递入口' : 'Delivery paths configured',
      value: !canViewMonitoring || summaryQuery.isError ? '-' : (summary?.channelCount ?? 0),
      icon: <AppstoreOutlined />,
      tone: 'default',
    },
  ] satisfies OverviewMetricItem[]

  const alertChips = [
    {
      key: 'firing',
      label: localeCode === 'zh_CN' ? '活跃' : 'Firing',
      value: effectiveFiringCount,
      tone: 'warning',
    },
    {
      key: 'resolved',
      label: localeCode === 'zh_CN' ? '已恢复' : 'Resolved',
      value: resolvedAlertCount,
      tone: 'success',
    },
    {
      key: 'critical',
      label: formatPlatformOverviewText('critical', localeCode),
      value: alertEventSeverityCounts.critical,
      tone: 'danger',
    },
    {
      key: 'warning',
      label: formatPlatformOverviewText('warning', localeCode),
      value: alertEventSeverityCounts.warning,
      tone: 'warning',
    },
    {
      key: 'info',
      label: formatPlatformOverviewText('info', localeCode),
      value: alertEventSeverityCounts.info,
      tone: 'default',
    },
  ] satisfies OverviewChipItem[]

  const podStats = [
    {
      key: 'pods',
      label: localeCode === 'zh_CN' ? 'Pod 总数' : 'Pods',
      helper: localeCode === 'zh_CN' ? '当前平台纳管 Pod 存量' : 'Total managed pods',
      value: workloadOverview?.totalPods ?? 0,
      icon: <AppstoreOutlined />,
      tone: 'default',
    },
    {
      key: 'running',
      label: formatPlatformOverviewText('running', localeCode),
      helper: localeCode === 'zh_CN' ? '正常运行中的 Pod' : 'Pods serving traffic',
      value: workloadOverview?.runningPods ?? 0,
      icon: <CheckCircleOutlined />,
      tone: 'success',
    },
    {
      key: 'pending',
      label: formatPlatformOverviewText('pending', localeCode),
      helper: localeCode === 'zh_CN' ? '等待调度或启动' : 'Waiting for scheduling or startup',
      value: workloadOverview?.pendingPods ?? 0,
      icon: <WarningOutlined />,
      tone: (workloadOverview?.pendingPods ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      key: 'completed',
      label: localeCode === 'zh_CN' ? '已完成' : 'Completed',
      helper: localeCode === 'zh_CN' ? '已结束的工作负载' : 'Completed workload runs',
      value: workloadOverview?.succeededPods ?? 0,
      icon: <CheckCircleOutlined />,
      tone: 'default',
    },
    {
      key: 'risk',
      label: localeCode === 'zh_CN' ? '需关注 Pod' : 'At-risk Pods',
      helper: localeCode === 'zh_CN' ? '需要继续排查的实例' : 'Pods needing follow-up',
      value: workloadOverview?.atRiskPods ?? 0,
      icon: <FireOutlined />,
      tone: (workloadOverview?.atRiskPods ?? 0) > 0 ? 'danger' : 'default',
    },
    {
      key: 'restart',
      label: localeCode === 'zh_CN' ? '发生重启' : 'Restarts',
      helper: localeCode === 'zh_CN' ? '近期有重启痕迹' : 'Pods with restart activity',
      value: workloadOverview?.restartingPods ?? 0,
      icon: <ReloadOutlined />,
      tone: (workloadOverview?.restartingPods ?? 0) > 0 ? 'warning' : 'default',
    },
  ] satisfies OverviewMetricItem[]

  return (
    <div className="soha-page soha-overview-page soha-platform-overview-page">
      <div className="soha-overview-metric-grid">
        {overviewStats.map((item) => (
          <OverviewMetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>

      <div className="soha-overview-summary-grid">
        <Card
          className="soha-overview-panel-card"
          title={localeCode === 'zh_CN' ? '当前集群告警' : 'Current Cluster Alerts'}
          extra={
            canViewAlerts && clusterId && !alertEventsQuery.isError ? (
              <Space size={6} wrap>
                <Text type="secondary" className="text-xs">
                  {localeCode === 'zh_CN' ? '总数' : 'Total'} {effectiveAlertCount} ·{' '}
                  {localeCode === 'zh_CN' ? '最近接收' : 'Last received'}: {lastReceivedText}
                </Text>
                <ResourceStreamStatus
                  status={alertStream.status}
                  lastEventAt={alertStream.lastEventAt}
                  localeCode={localeCode}
                />
              </Space>
            ) : null
          }
        >
          {!clusterId ? (
            <ManagementState
              bordered={false}
              compact
              kind="select-scope"
              title={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
            />
          ) : !canViewAlerts ? (
            <ManagementState
              bordered={false}
              compact
              kind="no-permission"
              title={
                localeCode === 'zh_CN'
                  ? '无权限查看告警摘要'
                  : 'No permission to view alert summary'
              }
            />
          ) : alertEventsQuery.isError ? (
            <ManagementState
              bordered={false}
              compact
              kind="error"
              title={localeCode === 'zh_CN' ? '集群告警加载失败' : 'Failed to load cluster alerts'}
            />
          ) : alertEventsQuery.isLoading ? (
            <div className="soha-platform-ops-loading">
              <Spin size="small" />
            </div>
          ) : (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title={localeCode === 'zh_CN' ? '告警分布' : 'Alert Distribution'}
                description={
                  effectiveFiringCount > 0
                    ? localeCode === 'zh_CN'
                      ? '当前仍有活跃告警，优先查看严重和警告级别。'
                      : 'Active alerts remain. Start with Critical and Warning.'
                    : localeCode === 'zh_CN'
                      ? '当前没有活跃告警，保持通道与规则可用。'
                      : 'No active alerts right now. Keep rules and channels healthy.'
                }
                extra={
                  <Button
                    type="text"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate('/monitoring-workbench/alerts')}
                  >
                    {localeCode === 'zh_CN' ? '查看全部告警' : 'Open All Alerts'}
                  </Button>
                }
              />
              <div className="soha-overview-chip-grid">
                {alertChips.map((item) => (
                  <OverviewChip
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    tone={item.tone}
                  />
                ))}
              </div>
              {activeAlerts.length > 0 ? (
                <div className="soha-platform-active-alert-list">
                  {activeAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      className="soha-platform-active-alert-row"
                      onClick={() =>
                        navigate(`/monitoring-workbench/alerts/${encodeURIComponent(alert.id)}`)
                      }
                    >
                      <span className="soha-platform-active-alert-copy">
                        <Text strong ellipsis>
                          {formatPlatformOverviewText(alert.title, localeCode)}
                        </Text>
                        <span>
                          {formatPlatformOverviewAlertScope(
                            alert,
                            currentCluster?.name,
                            localeCode,
                          )}
                        </span>
                      </span>
                      <span className="soha-platform-active-alert-meta">
                        <StatusTag
                          label={formatPlatformOverviewText(alert.severity, localeCode)}
                          value={alert.severity}
                        />
                        <span>{formatDateTime(alert.lastSeenAt || alert.updatedAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card
          className="soha-overview-panel-card"
          title={localeCode === 'zh_CN' ? '集群健康状态' : 'Cluster Health'}
          extra={
            <Text type="secondary" className="text-xs">
              {localeCode === 'zh_CN' ? '健康 / 总数' : 'Healthy / Total'}: {healthyClusters}/
              {clusters.length}
            </Text>
          }
        >
          {!canViewClusters ? (
            <ManagementState
              bordered={false}
              compact
              kind="no-permission"
              title={
                localeCode === 'zh_CN'
                  ? '无权限查看集群健康状态'
                  : 'No permission to view cluster health'
              }
            />
          ) : clustersQuery.isError ? (
            <ManagementState
              bordered={false}
              compact
              kind="error"
              title={
                localeCode === 'zh_CN' ? '集群概览加载失败' : 'Failed to load cluster overview'
              }
            />
          ) : clusters.length === 0 ? (
            <ManagementState
              bordered={false}
              compact
              title={t('page.overview.noClusters', 'No clusters')}
            />
          ) : (
            <>
              <div className="soha-platform-fleet-summary">
                <span>
                  {localeCode === 'zh_CN' ? '健康' : 'Healthy'}{' '}
                  <strong>{fleetReadiness.healthy}</strong>
                </span>
                <span>
                  {localeCode === 'zh_CN' ? '异常' : 'Unhealthy'}{' '}
                  <strong>{fleetReadiness.unhealthy}</strong>
                </span>
                <span>
                  {localeCode === 'zh_CN' ? '超时' : 'Stale'}{' '}
                  <strong>{fleetReadiness.stale}</strong>
                </span>
                <span>
                  {localeCode === 'zh_CN' ? '版本轨道' : 'Versions'}{' '}
                  <strong>{fleetReadiness.versions}</strong>
                </span>
              </div>
              <div
                className="soha-overview-cluster-list"
                role="region"
                aria-label={localeCode === 'zh_CN' ? '集群健康列表' : 'Cluster health list'}
                tabIndex={clusters.length > 3 ? 0 : undefined}
              >
                {clusters.map((cluster) => (
                  <div key={cluster.id} className="soha-overview-cluster-row">
                    <div className="soha-overview-cluster-main">
                      <div className="soha-overview-cluster-title-row">
                        <Text strong>{cluster.name}</Text>
                        <StatusTag
                          label={formatPlatformOverviewText(
                            cluster.health?.status ?? 'unknown',
                            localeCode,
                          )}
                          value={cluster.health?.status ?? 'unknown'}
                        />
                      </div>
                      <div className="soha-overview-cluster-caption">
                        {localeCode === 'zh_CN' ? '类型' : 'Type'}:{' '}
                        {formatClusterType(cluster, localeCode)}
                      </div>
                    </div>
                    <div className="soha-overview-cluster-meta">
                      <span>
                        {localeCode === 'zh_CN' ? '环境' : 'Env'}: {cluster.environment || '-'}
                      </span>
                      <span>
                        {localeCode === 'zh_CN' ? '连接方式' : 'Mode'}:{' '}
                        {formatPlatformOverviewText(cluster.connectionMode || '-', localeCode)}
                      </span>
                      <span>
                        {localeCode === 'zh_CN' ? '版本' : 'Version'}: {cluster.version || '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <PlatformOperationsPanel
        clusterId={clusterId}
        connectionMode={currentCluster?.connectionMode}
        localeCode={localeCode}
        permissions={{
          audit: hasPermission(permissionSnapshot, 'system.audit.view'),
          events: hasPermission(permissionSnapshot, 'platform.workloads.overview.view'),
          hpas: hasPermission(
            permissionSnapshot,
            'platform.configuration.horizontal-pod-autoscalers.view',
          ),
          mutatingWebhooks: hasPermission(
            permissionSnapshot,
            'platform.configuration.mutating-webhook-configurations.view',
          ),
          networkPolicies: hasPermission(
            permissionSnapshot,
            'platform.network.network-policies.view',
          ),
          nodes: hasPermission(permissionSnapshot, 'platform.nodes.view'),
          operations: hasPermission(permissionSnapshot, 'system.operations.view'),
          podDisruptionBudgets: hasPermission(
            permissionSnapshot,
            'platform.configuration.pod-disruption-budgets.view',
          ),
          validatingWebhooks: hasPermission(
            permissionSnapshot,
            'platform.configuration.validating-webhook-configurations.view',
          ),
        }}
      />

      <ResourceFinder
        clusterId={clusterId}
        clusterName={currentCluster?.name}
        localeCode={localeCode}
        options={resourceSearchOptions}
      />

      <Card
        className="soha-overview-runtime-card"
        title={localeCode === 'zh_CN' ? 'Pod 运行态势' : 'Pod Runtime'}
        extra={
          canViewWorkloads && clusterId ? (
            <div className="soha-overview-runtime-card-extra">
              <Button
                type="text"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/workloads/pods')}
              >
                {localeCode === 'zh_CN' ? '查看 Pod 列表' : 'Open Pods'}
              </Button>
            </div>
          ) : null
        }
      >
        {!canViewWorkloads ? (
          <ManagementState
            bordered={false}
            compact
            kind="no-permission"
            title={
              localeCode === 'zh_CN'
                ? '无权限查看 Pod 运行态势'
                : 'No permission to view pod runtime'
            }
          />
        ) : !clusterId ? (
          <ManagementState
            bordered={false}
            compact
            kind="select-scope"
            title={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
          />
        ) : workloadOverviewLoading ? (
          <div className="flex items-center justify-center h-56">
            <Spin size="large" />
          </div>
        ) : workloadOverviewQuery.isError ? (
          <ManagementState
            bordered={false}
            compact
            kind="error"
            title={localeCode === 'zh_CN' ? 'Pod 运行态势加载失败' : 'Failed to load pod runtime'}
          />
        ) : !workloadOverview ? (
          <ManagementState
            bordered={false}
            compact
            title={
              localeCode === 'zh_CN'
                ? '当前平台暂无运行态势摘要'
                : 'No workload runtime summary for the platform'
            }
          />
        ) : (
          <div className="soha-overview-runtime-layout">
            <div className="soha-overview-runtime-main">
              <OverviewSectionBar
                kicker={localeCode === 'zh_CN' ? '运行面信号' : 'Runtime Signal'}
                title={
                  currentCluster?.name || (localeCode === 'zh_CN' ? '当前集群' : 'Current Cluster')
                }
                extra={
                  <div className="soha-overview-meta-pills">
                    <span className="soha-overview-pill">
                      <span className="soha-overview-pill-label">
                        {localeCode === 'zh_CN' ? '数据来源' : 'Source'}
                      </span>
                      <span className="soha-overview-pill-value">
                        {formatWorkloadSource(workloadOverview.source, localeCode)}
                      </span>
                    </span>
                    <span className="soha-overview-pill">
                      <span className="soha-overview-pill-label">
                        {localeCode === 'zh_CN' ? '更新时间' : 'Updated'}
                      </span>
                      <span className="soha-overview-pill-value">{updatedAt}</span>
                    </span>
                  </div>
                }
              />

              <div className="soha-overview-pod-grid">
                {podStats.map((item) => (
                  <OverviewMetricCard
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    icon={item.icon}
                    tone={item.tone}
                    variant="pod"
                  />
                ))}
              </div>

              <div className="soha-overview-subpanel">
                <div className="soha-overview-subpanel-head">
                  <div>
                    <Text strong>
                      {localeCode === 'zh_CN' ? '需关注的 Pod' : 'Pods Requiring Attention'}
                    </Text>
                    <div className="soha-overview-inline-caption">
                      {localeCode === 'zh_CN'
                        ? '先看异常实例，再下钻到详情页定位节点、重启与就绪状态。'
                        : 'Start with the exceptions, then drill into pod details for node, restart, and readiness context.'}
                    </div>
                  </div>
                  <Text type="secondary" className="text-xs">
                    {localeCode === 'zh_CN' ? '更新时间' : 'Updated'}: {updatedAt}
                  </Text>
                </div>
                {problematicPods.length === 0 ? (
                  <ManagementState
                    bordered={false}
                    compact
                    title={
                      localeCode === 'zh_CN'
                        ? '当前平台没有需要关注的 Pod'
                        : 'No pods require attention in the platform scope'
                    }
                  />
                ) : (
                  <div
                    className="soha-overview-attention-list"
                    role="region"
                    aria-label={
                      localeCode === 'zh_CN' ? '需关注 Pod 列表' : 'Pods requiring attention list'
                    }
                    tabIndex={problematicPods.length > 3 ? 0 : undefined}
                  >
                    {problematicPods.map((item) => (
                      <div
                        key={`${item.namespace}/${item.name}`}
                        className="soha-overview-attention-row"
                      >
                        <div className="soha-overview-attention-main">
                          <Text strong>{item.name}</Text>
                          <StatusTag value={item.phase} />
                        </div>
                        <div className="soha-overview-attention-meta">
                          <span>{`${t('common.cluster', '集群')}: ${item.clusterName}`}</span>
                          <span>{`${t('common.namespace', '命名空间')}: ${item.namespace}`}</span>
                          <span>{`${t('common.node', '节点')}: ${item.nodeName || '-'}`}</span>
                          <span>{`${t('common.ready', '就绪')}: ${item.readyContainers}`}</span>
                          <span>{`${t('common.restarts', '重启次数')}: ${item.restarts}`}</span>
                          <span>{`${t('common.age', '时长')}: ${formatAgeSeconds(item.ageSeconds)}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="soha-overview-runtime-side">
              <div className="soha-overview-subpanel">
                <div className="soha-overview-subpanel-head">
                  <div>
                    <Text strong>
                      {localeCode === 'zh_CN' ? '命名空间热点' : 'Namespace Hotspots'}
                    </Text>
                    <div className="soha-overview-inline-caption">
                      {localeCode === 'zh_CN'
                        ? '先看哪些命名空间承载了更多 Pod 和风险信号。'
                        : 'Use this to spot which namespaces carry most of the pod volume and risk pressure.'}
                    </div>
                  </div>
                </div>
                {namespaceBreakdown.length === 0 ? (
                  <ManagementState
                    bordered={false}
                    compact
                    title={
                      localeCode === 'zh_CN'
                        ? '当前平台暂无 Pod 分布数据'
                        : 'No namespace distribution in the platform scope'
                    }
                  />
                ) : (
                  <div
                    className="soha-overview-namespace-list"
                    role="region"
                    aria-label={
                      localeCode === 'zh_CN' ? '命名空间热点列表' : 'Namespace hotspots list'
                    }
                    tabIndex={namespaceBreakdown.length > 3 ? 0 : undefined}
                  >
                    {namespaceBreakdown.map((item) => (
                      <div
                        key={`${item.clusterId}:${item.namespace}`}
                        className="soha-overview-namespace-row"
                      >
                        <div className="soha-overview-namespace-main">
                          <Text strong>{item.namespace}</Text>
                          <div className="soha-overview-cluster-caption">
                            {`Cluster: ${item.clusterName}`}
                          </div>
                        </div>
                        <div className="soha-overview-namespace-meta">
                          <span>{`Pods: ${item.totalPods}`}</span>
                          <span>{`Running: ${item.runningPods}`}</span>
                          <span>{`${localeCode === 'zh_CN' ? '需关注' : 'At-risk'}: ${item.atRiskPods}`}</span>
                          <span>{`${localeCode === 'zh_CN' ? '重启' : 'Restarts'}: ${item.restartingPods}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
