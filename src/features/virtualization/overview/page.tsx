import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Progress,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { DrawerProps } from 'antd'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { getAIWorkbenchPathForMode, useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
} from '@/components/management-list'
import { virtualizationKeys } from '@/features/virtualization/keys'
import {
  invalidateVirtualizationQueries,
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import {
  STATUS_COLORS,
  badgeStatusForTone,
  clusterRiskScore,
  isAbnormalOperation,
  latestNonEmptyOperationMessage,
  operationKind,
  operationTime,
  riskReasons,
} from '@/features/virtualization/virtualization-model'
import type { OverviewTone } from '@/features/virtualization/virtualization-model'
import { useTaskStream } from '@/features/virtualization/use-task-stream'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationCluster,
  VirtualizationOperation,
  VirtualizationOverview,
} from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const stableDrawerMotion = null as unknown as DrawerProps['motion']

const tableEllipsis = { showTitle: false } as const

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  const key = value.toLowerCase()
  return <Tag color={STATUS_COLORS[key] ?? 'default'}>{value}</Tag>
}

function tableTooltipText(value: unknown) {
  const text = String(value ?? '').trim() || '-'
  const content = <span className="soha-vrt-table-tooltip-text">{text}</span>
  if (text === '-') return content
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      {content}
    </Tooltip>
  )
}

function OperationStatusChips({
  counts,
  compact = false,
}: {
  counts: Array<{ key: string; label: string; value: number; tone?: OverviewTone }>
  compact?: boolean
}) {
  return (
    <div className={`soha-vrt-chip-grid${compact ? ' is-compact' : ''}`}>
      {counts.map((item) => (
        <div key={item.key} className={`soha-vrt-chip is-${item.tone ?? 'default'}`}>
          <span className="soha-vrt-chip-label">{item.label}</span>
          <span className="soha-vrt-chip-value">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function AttentionList({
  title,
  description,
  emptyText,
  action,
  items,
  renderMeta,
  renderActions,
  tone = 'default',
}: {
  title: string
  description: string
  emptyText: string
  action?: React.ReactNode
  items: Array<{ id: string; title: string; status?: string; message?: string }>
  renderMeta?: (item: {
    id: string
    title: string
    status?: string
    message?: string
  }) => React.ReactNode
  renderActions?: (item: {
    id: string
    title: string
    status?: string
    message?: string
  }) => React.ReactNode
  tone?: OverviewTone
}) {
  return (
    <section className={`soha-vrt-lane is-${tone}`}>
      <div className="soha-vrt-lane-head">
        <div>
          <div className="soha-vrt-lane-title">{title}</div>
          <div className="soha-vrt-lane-description">{description}</div>
        </div>
        {action ? <div className="soha-vrt-lane-action">{action}</div> : null}
      </div>
      {items.length === 0 ? (
        <div className="soha-vrt-empty">
          <ManagementState bordered={false} compact title={emptyText} description={description} />
        </div>
      ) : (
        <div className="soha-vrt-lane-items">
          {items.map((item) => (
            <div key={item.id} className="soha-vrt-attention-row">
              <div className="soha-vrt-attention-row-head">
                <Space wrap>
                  <Text strong>{item.title}</Text>
                  {statusTag(item.status)}
                </Space>
                {renderActions ? (
                  <Space wrap className="soha-vrt-row-actions">
                    {renderActions(item)}
                  </Space>
                ) : null}
              </div>
              <div className="soha-vrt-attention-message">{item.message || '-'}</div>
              {renderMeta ? (
                <div className="soha-vrt-attention-meta">{renderMeta(item)}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface TaskProgressBannerProps {
  task: VirtualizationOperation | null
  status: 'idle' | 'streaming' | 'done' | 'error'
  title: string
  onCancel?: () => void
  cancelling?: boolean
}

function TaskProgressBanner({
  task,
  status,
  title,
  onCancel,
  cancelling,
}: TaskProgressBannerProps) {
  if (status === 'idle' || status === 'done') return null
  const isError = status === 'error'
  const description =
    task?.message || (isError ? '与服务器的实时连接已断开' : '正在等待任务完成...')
  const taskStatus = task?.status ? (
    <Tag color={STATUS_COLORS[task.status] ?? 'blue'}>{task.status}</Tag>
  ) : null
  return (
    <Alert
      className="soha-vrt-task-banner"
      type={isError ? 'warning' : 'info'}
      showIcon
      icon={isError ? undefined : <Spin size="small" />}
      title={
        <Space>
          <span>{title}</span>
          {taskStatus}
        </Space>
      }
      description={description}
      action={
        onCancel && task?.id ? (
          <Button size="small" danger onClick={onCancel} loading={cancelling}>
            取消任务
          </Button>
        ) : null
      }
    />
  )
}

function buildInvestigationPath(params: {
  clusterId?: string
  namespace?: string
  workload?: string
  connectionId?: string
  vmId?: string
  provider?: string
  timeRangeMinutes?: number
}) {
  const search = new URLSearchParams()
  search.set('mode', 'root_cause')
  search.set('timeRangeMinutes', String(params.timeRangeMinutes ?? 60))
  if (params.clusterId) search.set('clusterId', params.clusterId)
  if (params.namespace) search.set('namespace', params.namespace)
  if (params.workload) search.set('workload', params.workload)
  if (params.connectionId) search.set('connectionId', params.connectionId)
  if (params.vmId) search.set('vmId', params.vmId)
  if (params.provider) search.set('provider', params.provider)
  return getAIWorkbenchPathForMode('root_cause', search)
}

export function VirtualizationOverviewPage() {
  const { virtualizationModuleEnabled, canManageClusters, canManageOperations, canSync } =
    useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [syncTaskId, setSyncTaskId] = useState<string | null>(null)
  const [selectedOperation, setSelectedOperation] = useState<VirtualizationOperation | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<VirtualizationCluster | null>(null)
  const { task: syncTask, status: syncStreamStatus } = useTaskStream(
    syncTaskId,
    virtualizationModuleEnabled,
  )

  useEffect(() => {
    if (syncStreamStatus === 'done') {
      const success = syncTask?.status === 'completed'
      message[success ? 'success' : 'error'](
        success ? '同步完成' : `同步失败: ${syncTask?.message ?? '未知错误'}`,
      )
      setSyncTaskId(null)
      void invalidateVirtualizationQueries(queryClient, [virtualizationKeys.all])
    }
  }, [syncStreamStatus, syncTask, message, queryClient])

  const cancelSyncMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.cancelOperation(queryClient), () =>
      message.info('已请求取消同步任务'),
    ),
  )

  const overviewQuery = useQuery(virtualizationQueries.overview(virtualizationModuleEnabled))
  const logsQuery = useQuery(
    virtualizationQueries.operationLogs(
      selectedOperation?.id ?? '',
      virtualizationModuleEnabled && Boolean(selectedOperation?.id),
    ),
  )
  const syncMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.syncAll(queryClient), (operation) => {
      const taskId = operation.id
      if (taskId) {
        message.info('同步任务已提交，正在跟踪进度...')
        setSyncTaskId(taskId)
      } else {
        message.success('同步任务已提交')
      }
    }),
  )
  const retryMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.retryOperation(queryClient), () =>
      message.success('重试任务已提交'),
    ),
  )
  const testMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.testCluster(queryClient), () =>
      message.success('测试任务已提交'),
    ),
  )
  const syncClusterMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.syncCluster(queryClient), () =>
      message.success('同步任务已提交'),
    ),
  )

  const overview: VirtualizationOverview = overviewQuery.data ?? {}
  const stats = overview.stats ?? {}
  const health = stats.connections
  const operations = overview.recentOperations ?? []
  const attention = overview.attention
  const connectionSummary = overview.connectionSummary
  const taskSummary = overview.taskSummary
  const providerSummary = overview.providerSummary ?? []
  const abnormalClusters = useMemo(
    () =>
      [...(attention?.riskyConnections ?? [])]
        .sort((left, right) => clusterRiskScore(left) - clusterRiskScore(right))
        .slice(0, 5),
    [attention?.riskyConnections],
  )
  const failedSyncOperations = useMemo(
    () => attention?.failedSyncTasks ?? [],
    [attention?.failedSyncTasks],
  )
  const failedOperations = useMemo(
    () => attention?.failedOperations ?? [],
    [attention?.failedOperations],
  )
  const recentAbnormal = useMemo(
    () =>
      (failedOperations.length
        ? failedOperations
        : operations.filter((record) => isAbnormalOperation(record.status))
      ).slice(0, 8),
    [failedOperations, operations],
  )
  const logs = logsQuery.data ?? []
  const totalConnections = connectionSummary?.total ?? health?.total ?? 0
  const healthyConnections = connectionSummary?.healthy ?? health?.healthy ?? 0
  const degradedConnections = connectionSummary?.degraded ?? health?.degraded ?? 0
  const unavailableConnections = connectionSummary?.unavailable ?? health?.unavailable ?? 0
  const unhealthyConnections = degradedConnections + unavailableConnections
  const pendingTasks =
    stats.pendingTaskCount ?? (taskSummary?.queued ?? 0) + (taskSummary?.running ?? 0)
  const failedTaskTotal =
    stats.failedTaskCount ??
    ((taskSummary?.failed ?? 0) + (taskSummary?.timeout ?? 0) || failedOperations.length)
  const runningVmCount = stats.runningVmCount ?? 0
  const vmCount = stats.vmCount ?? 0
  const hasInventory = totalConnections > 0 || vmCount > 0 || providerSummary.length > 0
  const lastSyncTone: OverviewTone = !overview.lastSyncTask
    ? hasInventory
      ? 'warning'
      : 'default'
    : overview.lastSyncTask.status === 'completed'
      ? 'success'
      : isAbnormalOperation(overview.lastSyncTask.status)
        ? 'danger'
        : 'warning'
  const overviewTone: OverviewTone = !hasInventory
    ? 'default'
    : unhealthyConnections > 0 || failedTaskTotal > 0
      ? 'danger'
      : pendingTasks > 0 || lastSyncTone === 'warning'
        ? 'warning'
        : 'success'
  const overviewStatusLabel =
    overviewTone === 'danger'
      ? '存在风险'
      : overviewTone === 'warning'
        ? '需要关注'
        : overviewTone === 'success'
          ? '运行正常'
          : '待接入'
  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: '虚拟化工作台',
    entityKind: 'virtualization.overview',
    entityName: '虚拟化工作台',
    visibleFilters: {
      tone: overviewTone,
      status: overviewStatusLabel,
    },
    pinnedData: {
      totalConnections,
      healthyConnections,
      unhealthyConnections,
      vmCount,
      runningVmCount,
      pendingTasks,
      failedTaskTotal,
    },
  })
  const providerRows = useMemo(
    () =>
      providerSummary.map((item) => {
        const connections = item.connections ?? 0
        const healthy = item.healthy ?? 0
        const degraded = item.degraded ?? 0
        const unavailable = item.unavailable ?? 0
        const healthPercent = connections > 0 ? Math.round((healthy / connections) * 100) : 0
        const tone: OverviewTone = unavailable > 0 ? 'danger' : degraded > 0 ? 'warning' : 'success'
        return { ...item, connections, healthy, degraded, unavailable, healthPercent, tone }
      }),
    [providerSummary],
  )
  const operationStats: Array<{ key: string; label: string; value: number; tone?: OverviewTone }> =
    [
      {
        key: 'credentialMissing',
        label: '凭证缺失',
        value: connectionSummary?.credentialMissing ?? 0,
        tone: (connectionSummary?.credentialMissing ?? 0) > 0 ? 'warning' : 'default',
      },
      {
        key: 'neverSynced',
        label: '从未同步',
        value: connectionSummary?.neverSynced ?? 0,
        tone: (connectionSummary?.neverSynced ?? 0) > 0 ? 'warning' : 'default',
      },
      { key: 'completed', label: '已完成任务', value: taskSummary?.completed ?? 0 },
      { key: 'providers', label: 'Provider 数', value: providerSummary.length },
    ]
  const metricStats: Array<{
    key: string
    label: string
    value: React.ReactNode
    helper: React.ReactNode
    tone: OverviewTone
    icon: React.ReactNode
    action: () => void
  }> = [
    {
      key: 'connections',
      label: '异常连接',
      value: unhealthyConnections,
      helper: `健康 ${healthyConnections} / 总计 ${totalConnections}`,
      tone: unhealthyConnections > 0 ? 'danger' : totalConnections > 0 ? 'success' : 'default',
      icon: unhealthyConnections > 0 ? <WarningOutlined /> : <CheckCircleOutlined />,
      action: () => navigate('/compute/virtualization/clusters'),
    },
    {
      key: 'pending',
      label: '待处理任务',
      value: pendingTasks,
      helper: '排队与执行中任务',
      tone: pendingTasks > 0 ? 'warning' : 'default',
      icon: <CloudSyncOutlined />,
      action: () => navigate('/compute/tasks/operations?domain=virtualization&status=running'),
    },
    {
      key: 'failed',
      label: '失败任务',
      value: failedTaskTotal,
      helper: '失败与回调超时',
      tone: failedTaskTotal > 0 ? 'danger' : 'default',
      icon: failedTaskTotal > 0 ? <CloseCircleOutlined /> : <CheckCircleOutlined />,
      action: () => navigate('/compute/tasks/operations?domain=virtualization&status=failed'),
    },
    {
      key: 'sync',
      label: '最近同步状态',
      value:
        overview.lastSyncTask?.status === 'completed'
          ? '正常'
          : overview.lastSyncTask?.status
            ? '异常'
            : '未同步',
      helper: overview.lastSyncTask
        ? `${operationKind(overview.lastSyncTask)} · ${formatDateTime(operationTime(overview.lastSyncTask))}`
        : '尚无同步记录',
      tone: lastSyncTone,
      icon: <ReloadOutlined />,
      action: () => navigate('/compute/tasks/sync?domain=virtualization'),
    },
    {
      key: 'vm',
      label: '运行中 VM',
      value: `${runningVmCount} / ${vmCount}`,
      helper: `停机 ${stats.stoppedVmCount ?? 0}`,
      tone: 'default',
      icon: <PlayCircleOutlined />,
      action: () => navigate('/compute/virtualization/vms'),
    },
  ]

  return (
    <div className="soha-page soha-virtualization-overview">
      <ManagementDetailHeader
        title={
          <Space size={8} wrap>
            <span>虚拟化总览</span>
            <Badge status={badgeStatusForTone(overviewTone)} text={overviewStatusLabel} />
          </Space>
        }
        meta={
          <>
            <span>
              连接 {healthyConnections}/{totalConnections}
            </span>
            <span>Provider {providerSummary.length}</span>
            <span>
              VM {runningVmCount}/{vmCount}
            </span>
            <span>
              最近同步{' '}
              {overview.lastSyncTask
                ? formatDateTime(operationTime(overview.lastSyncTask))
                : '未同步'}
            </span>
          </>
        }
        actions={
          canSync ? (
            <>
              <Link to="/compute/tasks/sync?domain=virtualization">
                <Button icon={<CloudSyncOutlined />}>同步任务</Button>
              </Link>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                立即同步
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="soha-overview-metric-grid soha-vrt-metric-grid" aria-label="虚拟化运行指标">
        {metricStats.map((item) => (
          <Card
            key={item.key}
            size="small"
            variant="outlined"
            className={`soha-overview-metric-card soha-vrt-metric-card is-${item.tone}`}
          >
            <button type="button" className="soha-vrt-metric-card-button" onClick={item.action}>
              <div className="soha-overview-metric-card-head">
                <div className="soha-overview-metric-copy">
                  <Text className="soha-overview-metric-label">{item.label}</Text>
                  <span className="soha-vrt-stat-value">{item.value}</span>
                </div>
                <span className="soha-overview-metric-icon">{item.icon}</span>
              </div>
              <Text className="soha-overview-metric-helper">{item.helper}</Text>
            </button>
          </Card>
        ))}
      </div>
      <TaskProgressBanner
        task={syncTask}
        status={syncStreamStatus}
        title="正在同步虚拟化资源"
        onCancel={syncTask?.id ? () => cancelSyncMutation.mutate(syncTask.id) : undefined}
        cancelling={cancelSyncMutation.isPending}
      />

      <div className="soha-vrt-workbench-grid">
        <div className="soha-vrt-workbench-main">
          <div className="soha-vrt-lane-grid">
            <AttentionList
              title="高风险连接"
              description="不可用、降级、凭证缺失、未同步"
              emptyText="暂无高风险连接"
              tone={abnormalClusters.length > 0 ? 'danger' : 'default'}
              action={
                <ManagementIconButton
                  aria-label="查看全部连接"
                  tooltip="查看全部"
                  icon={<EyeOutlined />}
                  size="small"
                  onClick={() => navigate('/compute/virtualization/clusters')}
                />
              }
              items={abnormalClusters.map((item) => ({
                id: item.id,
                title: item.name,
                status: item.health || item.status,
                message: riskReasons(item).join(' / '),
              }))}
              renderMeta={(item) => {
                const cluster = abnormalClusters.find((record) => record.id === item.id)
                return cluster
                  ? `Provider: ${cluster.provider || '-'} · 最近同步: ${formatDateTime(cluster.lastSyncedAt)}`
                  : null
              }}
              renderActions={(item) => {
                const cluster = abnormalClusters.find((record) => record.id === item.id)
                if (!cluster) return null
                return (
                  <>
                    <ManagementIconButton
                      aria-label="查看连接详情"
                      tooltip="详情"
                      icon={<EyeOutlined />}
                      size="small"
                      onClick={() => setSelectedCluster(cluster)}
                    />
                    <ManagementIconButton
                      aria-label="发起 AI 调查"
                      tooltip="AI调查"
                      icon={<PlayCircleOutlined />}
                      size="small"
                      onClick={() =>
                        navigate(
                          buildInvestigationPath({
                            connectionId: cluster.id,
                            provider: cluster.provider,
                            clusterId: cluster.kubernetesClusterId,
                            namespace: cluster.defaultNamespace,
                            workload: cluster.name,
                            timeRangeMinutes: 60,
                          }),
                        )
                      }
                    />
                    {canManageClusters ? (
                      <ManagementIconButton
                        aria-label="测试连接"
                        tooltip="测试"
                        icon={<ThunderboltOutlined />}
                        size="small"
                        onClick={() => testMutation.mutate(cluster.id)}
                        loading={testMutation.isPending}
                      />
                    ) : null}
                    {canSync ? (
                      <ManagementIconButton
                        aria-label="同步连接"
                        tooltip="同步"
                        icon={<CloudSyncOutlined />}
                        size="small"
                        onClick={() => syncClusterMutation.mutate(cluster.id)}
                        loading={syncClusterMutation.isPending}
                      />
                    ) : null}
                  </>
                )
              }}
            />
            <AttentionList
              title="最近失败同步"
              description="asset_sync 失败或超时"
              emptyText="暂无失败同步"
              tone={failedSyncOperations.length > 0 ? 'danger' : 'default'}
              action={
                <ManagementIconButton
                  aria-label="进入同步任务"
                  tooltip="进入同步任务"
                  icon={<CloudSyncOutlined />}
                  size="small"
                  onClick={() => navigate('/compute/tasks/sync?domain=virtualization')}
                />
              }
              items={failedSyncOperations.map((item) => ({
                id: item.id,
                title: item.targetName || item.connectionId || item.id,
                status: item.status,
                message: latestNonEmptyOperationMessage(item),
              }))}
              renderMeta={(item) => {
                const operation = failedSyncOperations.find((record) => record.id === item.id)
                return operation ? `开始时间: ${formatDateTime(operationTime(operation))}` : null
              }}
              renderActions={(item) => {
                const operation = failedSyncOperations.find((record) => record.id === item.id)
                return operation ? (
                  <>
                    <ManagementIconButton
                      aria-label="查看同步日志"
                      tooltip="日志"
                      icon={<FileTextOutlined />}
                      size="small"
                      onClick={() => setSelectedOperation(operation)}
                    />
                    <ManagementIconButton
                      aria-label="发起 AI 调查"
                      tooltip="AI调查"
                      icon={<PlayCircleOutlined />}
                      size="small"
                      onClick={() =>
                        navigate(
                          buildInvestigationPath({
                            connectionId: operation.connectionId,
                            vmId: operation.vmId,
                            workload:
                              operation.targetName || operation.vmId || operation.connectionId,
                            timeRangeMinutes: 60,
                          }),
                        )
                      }
                    />
                    {canManageOperations && hasAllowedAction(operation.allowedActions, 'retry') ? (
                      <ManagementIconButton
                        aria-label="重试同步任务"
                        tooltip="重试"
                        icon={<ReloadOutlined />}
                        size="small"
                        onClick={() => retryMutation.mutate(operation.id)}
                        loading={retryMutation.isPending}
                      />
                    ) : null}
                  </>
                ) : null
              }}
            />
            <AttentionList
              title="失败与超时任务"
              description="生命周期任务失败或超时"
              emptyText="暂无失败任务"
              tone={failedOperations.length > 0 ? 'danger' : 'default'}
              action={
                <ManagementIconButton
                  aria-label="进入任务中心"
                  tooltip="任务中心"
                  icon={<FileTextOutlined />}
                  size="small"
                  onClick={() => navigate('/compute/tasks/operations?domain=virtualization')}
                />
              }
              items={failedOperations.map((item) => ({
                id: item.id,
                title: item.targetName || item.vmId || item.id,
                status: item.status,
                message: latestNonEmptyOperationMessage(item),
              }))}
              renderMeta={(item) => {
                const operation = failedOperations.find((record) => record.id === item.id)
                return operation
                  ? `类型: ${operationKind(operation)} · 连接: ${operation.connectionId || '-'}`
                  : null
              }}
              renderActions={(item) => {
                const operation = failedOperations.find((record) => record.id === item.id)
                return operation ? (
                  <>
                    <ManagementIconButton
                      aria-label="查看任务日志"
                      tooltip="日志"
                      icon={<FileTextOutlined />}
                      size="small"
                      onClick={() => setSelectedOperation(operation)}
                    />
                    <ManagementIconButton
                      aria-label="发起 AI 调查"
                      tooltip="AI调查"
                      icon={<PlayCircleOutlined />}
                      size="small"
                      onClick={() =>
                        navigate(
                          buildInvestigationPath({
                            connectionId: operation.connectionId,
                            vmId: operation.vmId,
                            workload:
                              operation.targetName || operation.vmId || operation.connectionId,
                            timeRangeMinutes: 60,
                          }),
                        )
                      }
                    />
                    {operation.vmId ? (
                      <ManagementIconButton
                        aria-label="查看 VM"
                        tooltip="VM"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() =>
                          navigate(
                            `/compute/virtualization/vms/${encodeURIComponent(operation.vmId || '')}?focus=operations`,
                          )
                        }
                      />
                    ) : null}
                  </>
                ) : null
              }}
            />
          </div>

          <section className="soha-vrt-panel soha-vrt-table-panel">
            <div className="soha-vrt-panel-head">
              <div>
                <div className="soha-vrt-panel-title">任务流水</div>
                <div className="soha-vrt-panel-caption">最近操作与异常快照</div>
              </div>
              <ManagementIconButton
                aria-label="查看全部任务"
                tooltip="查看全部"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => navigate('/compute/tasks/operations?domain=virtualization')}
              />
            </div>
            <div className="soha-vrt-panel-body">
              <AdminTable
                rowKey="id"
                tableSize="small"
                pagination={false}
                loading={overviewQuery.isLoading}
                dataSource={operations.length > 0 ? operations.slice(0, 8) : recentAbnormal}
                className="soha-vrt-overview-table"
                empty="暂无任务记录"
                enableColumnSelection={false}
                scroll={{ x: 980 }}
                columns={[
                  {
                    title: '类型',
                    render: (_value: unknown, record: VirtualizationOperation) =>
                      tableTooltipText(operationKind(record)),
                    ellipsis: tableEllipsis,
                    width: 120,
                  },
                  {
                    title: '资源',
                    dataIndex: 'targetName',
                    render: (value: string, record: VirtualizationOperation) =>
                      tableTooltipText(value || record.targetType || '-'),
                    ellipsis: tableEllipsis,
                    width: 160,
                  },
                  {
                    title: '连接',
                    dataIndex: 'connectionId',
                    render: (value: string) => tableTooltipText(value || '-'),
                    ellipsis: tableEllipsis,
                    width: 160,
                  },
                  { title: '状态', dataIndex: 'status', render: statusTag, width: 110 },
                  {
                    title: '摘要',
                    render: (_value: unknown, record: VirtualizationOperation) =>
                      tableTooltipText(latestNonEmptyOperationMessage(record)),
                    ellipsis: tableEllipsis,
                    width: 230,
                  },
                  {
                    title: '时间',
                    render: (_value: unknown, record: VirtualizationOperation) =>
                      tableTooltipText(formatDateTime(operationTime(record))),
                    ellipsis: tableEllipsis,
                    width: 140,
                  },
                  {
                    ...tableColumnPresets.action,
                    title: '操作',
                    render: (_value: unknown, record: VirtualizationOperation) => (
                      <ManagementIconButton
                        aria-label="查看任务日志"
                        tooltip="日志"
                        icon={<FileTextOutlined />}
                        size="small"
                        onClick={() => setSelectedOperation(record)}
                      />
                    ),
                    width: 60,
                  },
                ]}
              />
            </div>
          </section>
        </div>

        <aside className="soha-vrt-side-stack">
          <section className="soha-vrt-panel">
            <div className="soha-vrt-panel-head">
              <div>
                <div className="soha-vrt-panel-title">连接健康态势</div>
                <div className="soha-vrt-panel-caption">纳管连接状态</div>
              </div>
              <ManagementIconButton
                aria-label="打开连接页"
                tooltip="连接页"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => navigate('/compute/virtualization/clusters')}
              />
            </div>
            <div className="soha-vrt-panel-body">
              <OperationStatusChips
                compact
                counts={[
                  {
                    key: 'healthy',
                    label: '健康连接',
                    value: healthyConnections,
                    tone: healthyConnections > 0 ? 'success' : 'default',
                  },
                  {
                    key: 'degraded',
                    label: '降级连接',
                    value: degradedConnections,
                    tone: degradedConnections > 0 ? 'warning' : 'default',
                  },
                  {
                    key: 'unavailable',
                    label: '不可用连接',
                    value: unavailableConnections,
                    tone: unavailableConnections > 0 ? 'danger' : 'default',
                  },
                  {
                    key: 'neverSynced',
                    label: '未同步连接',
                    value: connectionSummary?.neverSynced ?? 0,
                    tone: (connectionSummary?.neverSynced ?? 0) > 0 ? 'warning' : 'default',
                  },
                ]}
              />
            </div>
          </section>

          <section className="soha-vrt-panel">
            <div className="soha-vrt-panel-head">
              <div>
                <div className="soha-vrt-panel-title">任务处置态势</div>
                <div className="soha-vrt-panel-caption">队列、执行、失败</div>
              </div>
              <ManagementIconButton
                aria-label="打开任务中心"
                tooltip="任务中心"
                icon={<FileTextOutlined />}
                size="small"
                onClick={() => navigate('/compute/tasks/operations?domain=virtualization')}
              />
            </div>
            <div className="soha-vrt-panel-body">
              <OperationStatusChips
                compact
                counts={[
                  {
                    key: 'queued',
                    label: '排队中',
                    value: taskSummary?.queued ?? 0,
                    tone: (taskSummary?.queued ?? 0) > 0 ? 'warning' : 'default',
                  },
                  {
                    key: 'running',
                    label: '执行中',
                    value: taskSummary?.running ?? 0,
                    tone: (taskSummary?.running ?? 0) > 0 ? 'warning' : 'default',
                  },
                  {
                    key: 'failed',
                    label: '失败/超时',
                    value: (taskSummary?.failed ?? 0) + (taskSummary?.timeout ?? 0),
                    tone:
                      (taskSummary?.failed ?? 0) + (taskSummary?.timeout ?? 0) > 0
                        ? 'danger'
                        : 'default',
                  },
                  {
                    key: 'sync',
                    label: '最近同步任务',
                    value: overview.lastSyncTask ? 1 : 0,
                    tone: overview.lastSyncTask ? lastSyncTone : 'default',
                  },
                ]}
              />
            </div>
          </section>

          <section className="soha-vrt-panel">
            <div className="soha-vrt-panel-head">
              <div>
                <div className="soha-vrt-panel-title">Provider 分布</div>
                <div className="soha-vrt-panel-caption">连接健康与 VM 覆盖</div>
              </div>
            </div>
            <div className="soha-vrt-panel-body">
              {providerRows.length > 0 ? (
                <div className="soha-vrt-provider-list">
                  {providerRows.map((item) => (
                    <div key={item.provider} className={`soha-vrt-provider-row is-${item.tone}`}>
                      <div className="soha-vrt-provider-row-head">
                        <Text strong>{item.provider.toUpperCase()}</Text>
                        <Text type="secondary">
                          {item.runningVms ?? 0}/{item.vms ?? 0} VM
                        </Text>
                      </div>
                      <Progress
                        percent={item.healthPercent}
                        showInfo={false}
                        size="small"
                        status={
                          item.tone === 'danger'
                            ? 'exception'
                            : item.tone === 'success'
                              ? 'success'
                              : 'normal'
                        }
                        strokeColor={item.tone === 'warning' ? 'var(--soha-warning)' : undefined}
                      />
                      <div className="soha-vrt-provider-meta">
                        <span>健康 {item.healthy}</span>
                        <span>降级 {item.degraded}</span>
                        <span>不可用 {item.unavailable}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="soha-vrt-empty">
                  <ManagementState
                    bordered={false}
                    compact
                    title="暂无 Provider 数据"
                    description="虚拟化连接同步完成后会在这里展示 Provider 分布。"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="soha-vrt-panel">
            <div className="soha-vrt-panel-head">
              <div>
                <div className="soha-vrt-panel-title">运维统计摘要</div>
                <div className="soha-vrt-panel-caption">凭证、同步、Provider</div>
              </div>
            </div>
            <div className="soha-vrt-panel-body">
              <OperationStatusChips compact counts={operationStats} />
            </div>
          </section>
        </aside>
      </div>
      <Drawer
        title="异常任务详情"
        size="large"
        motion={stableDrawerMotion}
        open={Boolean(selectedOperation)}
        onClose={() => setSelectedOperation(null)}
      >
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="任务 ID">{selectedOperation?.id}</Descriptions.Item>
          <Descriptions.Item label="类型">
            {selectedOperation ? operationKind(selectedOperation) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">{statusTag(selectedOperation?.status)}</Descriptions.Item>
          <Descriptions.Item label="资源">
            {selectedOperation?.targetName || selectedOperation?.targetType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="连接">
            {selectedOperation?.connectionId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="VM">{selectedOperation?.vmId || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {formatDateTime(selectedOperation?.startedAt || selectedOperation?.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最近心跳">
            {formatDateTime(selectedOperation?.lastHeartbeatAt)}
          </Descriptions.Item>
        </Descriptions>
        {selectedOperation?.message ? (
          <Alert
            className="mt-4"
            type={isAbnormalOperation(selectedOperation.status) ? 'error' : 'info'}
            title={selectedOperation.message}
          />
        ) : null}
        <pre className="mt-4 max-h-[520px] overflow-auto rounded border border-[var(--soha-border-color)] bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
          {(logs.length
            ? logs
                .map(
                  (item) =>
                    `[${formatDateTime(item.createdAt)}] ${item.logLevel ?? 'info'} ${item.message}`,
                )
                .join('\n')
            : selectedOperation?.message) || (logsQuery.isLoading ? '日志加载中' : '暂无日志')}
        </pre>
      </Drawer>
      <Drawer
        title="连接风险详情"
        size="large"
        motion={stableDrawerMotion}
        open={Boolean(selectedCluster)}
        onClose={() => setSelectedCluster(null)}
      >
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="连接名称">{selectedCluster?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Provider">{selectedCluster?.provider || '-'}</Descriptions.Item>
          <Descriptions.Item label="健康状态">
            {statusTag(selectedCluster?.health || selectedCluster?.status)}
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            {selectedCluster?.riskLevel || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="风险原因">
            {selectedCluster ? riskReasons(selectedCluster).join(' / ') || '正常' : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="接入目标">
            {selectedCluster?.provider === 'kubevirt'
              ? selectedCluster?.kubernetesClusterId || '-'
              : selectedCluster?.endpoint || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="默认命名空间">
            {selectedCluster?.defaultNamespace || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最近同步">
            {formatDateTime(selectedCluster?.lastSyncedAt)}
          </Descriptions.Item>
        </Descriptions>
        <Space className="mt-4">
          {selectedCluster && canManageClusters ? (
            <Button
              onClick={() => testMutation.mutate(selectedCluster.id)}
              loading={testMutation.isPending}
            >
              测试连接
            </Button>
          ) : null}
          {selectedCluster && canSync ? (
            <Button
              onClick={() => syncClusterMutation.mutate(selectedCluster.id)}
              loading={syncClusterMutation.isPending}
            >
              重新同步
            </Button>
          ) : null}
          {selectedCluster ? (
            <Button
              onClick={() =>
                navigate(
                  buildInvestigationPath({
                    connectionId: selectedCluster.id,
                    provider: selectedCluster.provider,
                    clusterId: selectedCluster.kubernetesClusterId,
                    namespace: selectedCluster.defaultNamespace,
                    workload: selectedCluster.name,
                    timeRangeMinutes: 60,
                  }),
                )
              }
            >
              AI调查
            </Button>
          ) : null}
          {selectedCluster ? (
            <Button onClick={() => navigate('/compute/virtualization/clusters')}>前往连接页</Button>
          ) : null}
        </Space>
      </Drawer>
    </div>
  )
}
