import { Link } from 'react-router-dom'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  ApartmentOutlined,
  FieldTimeOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from 'antd'
import { StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { ManagementState } from '@/components/management-list'
import {
  OverviewChip,
  OverviewMetricCard,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  releaseBoardQualitySignal,
  summarizeExecutionTaskStatus,
  summarizeReleaseBoard,
  summarizeReleaseBundleStatus,
} from '../delivery-status'
import { deliveryQueries } from '../queries'
import { executionTaskUpdatedAt, releaseBundleUpdatedAt, sortByLatest } from './shared'
import './overview.css'

export function DeliveryOverviewPage() {
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canViewApplications = hasPermission(snapshot, 'delivery.applications.view')
  const canViewEnvironments = hasPermission(snapshot, 'delivery.application-environments.view')
  const canViewBoard = hasPermission(snapshot, 'delivery.release-board.view')
  const canViewBundles = hasPermission(snapshot, 'delivery.release-bundles.view')
  const canViewTasks = hasPermission(snapshot, 'delivery.execution-tasks.view')

  const applicationsQuery = useQuery(deliveryQueries.applications.list(canViewApplications))
  const environmentsQuery = useQuery(deliveryQueries.environments.list(canViewEnvironments))
  const boardQuery = useQuery(deliveryQueries.releaseBoard.list({ enabled: canViewBoard }))
  const bundlesQuery = useQuery(deliveryQueries.releaseBundles.list({ enabled: canViewBundles }))
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list({ enabled: canViewTasks }))

  const applications = applicationsQuery.data ?? []
  const environments = environmentsQuery.data ?? []
  const board = boardQuery.data ?? []
  const bundles = bundlesQuery.data ?? []
  const tasks = tasksQuery.data ?? []
  const boardSummary = summarizeReleaseBoard(board)
  const bundleSummary = summarizeReleaseBundleStatus(bundles)
  const taskSummary = summarizeExecutionTaskStatus(tasks)
  const hasAnyPermission =
    canViewApplications || canViewEnvironments || canViewBoard || canViewBundles || canViewTasks
  const contentQueries = [
    applicationsQuery,
    environmentsQuery,
    boardQuery,
    bundlesQuery,
    tasksQuery,
  ]
  const hasContentQueryError = contentQueries.some((query) => query.isError)
  const retryFailedContentQueries = () => {
    contentQueries.forEach((query) => {
      if (query.isError) void query.refetch()
    })
  }
  const applicationBindingError =
    (canViewApplications && applicationsQuery.isError) ||
    (canViewEnvironments && environmentsQuery.isError)

  const overviewStats = [
    ...(canViewApplications || canViewEnvironments
      ? [
          {
            key: 'applications',
            label: '应用 / 环境绑定',
            value: `${canViewApplications && !applicationsQuery.isError ? applications.length : '-'} / ${canViewEnvironments && !environmentsQuery.isError ? environments.length : '-'}`,
            helper: applicationBindingError
              ? '应用或环境数据加载失败'
              : '当前可见应用与运行环境绑定',
            icon: <AppstoreOutlined />,
            tone: applicationBindingError ? ('danger' as const) : ('default' as const),
            path: canViewApplications ? '/applications' : '/application-environments',
            loading:
              (canViewApplications && applicationsQuery.isLoading) ||
              (canViewEnvironments && environmentsQuery.isLoading),
          },
        ]
      : []),
    ...(canViewBoard
      ? [
          {
            key: 'release-board',
            label: '发布态势',
            value: boardQuery.isError ? '-' : boardSummary.total,
            helper: boardQuery.isError
              ? '发布态势加载失败'
              : `目标 ${boardSummary.targets} · 可推广 ${boardSummary.ready}`,
            icon: <ApartmentOutlined />,
            tone: boardQuery.isError
              ? ('danger' as const)
              : boardSummary.blocked > 0
                ? ('danger' as const)
                : boardSummary.running + boardSummary.approval > 0
                  ? ('warning' as const)
                  : boardSummary.ready > 0
                    ? ('success' as const)
                    : ('default' as const),
            path: '/release-board',
            loading: boardQuery.isLoading,
          },
        ]
      : []),
    ...(canViewBundles
      ? [
          {
            key: 'release-bundles',
            label: '版本包',
            value: bundlesQuery.isError ? '-' : bundleSummary.total,
            helper: bundlesQuery.isError
              ? '版本包加载失败'
              : `可验证 ${bundleSummary.ready} · 制品 ${bundleSummary.artifacts}`,
            icon: <InboxOutlined />,
            tone: bundlesQuery.isError
              ? ('danger' as const)
              : bundleSummary.blocked > 0
                ? ('danger' as const)
                : bundleSummary.ready > 0
                  ? ('success' as const)
                  : ('default' as const),
            path: '/delivery/release-bundles',
            loading: bundlesQuery.isLoading,
          },
        ]
      : []),
    ...(canViewTasks
      ? [
          {
            key: 'execution-tasks',
            label: '执行任务',
            value: tasksQuery.isError ? '-' : taskSummary.total,
            helper: tasksQuery.isError
              ? '执行任务加载失败'
              : `运行中 ${taskSummary.active} · 失败 ${taskSummary.blocked}`,
            icon: <FieldTimeOutlined />,
            tone: tasksQuery.isError
              ? ('danger' as const)
              : taskSummary.blocked > 0
                ? ('danger' as const)
                : taskSummary.active > 0
                  ? ('warning' as const)
                  : ('default' as const),
            path: '/delivery/execution-tasks',
            loading: tasksQuery.isLoading,
          },
        ]
      : []),
  ] satisfies Array<OverviewMetricItem & { loading: boolean; path: string }>

  const releaseFlow = [
    { key: 'ready', label: '可推广', value: boardSummary.ready, tone: 'success' as const },
    { key: 'running', label: '执行中', value: boardSummary.running, tone: 'warning' as const },
    { key: 'approval', label: '待审批', value: boardSummary.approval, tone: 'warning' as const },
    { key: 'blocked', label: '阻塞', value: boardSummary.blocked, tone: 'danger' as const },
    { key: 'targets', label: '发布目标', value: boardSummary.targets, tone: 'default' as const },
  ] satisfies OverviewChipItem[]
  const attentionPriority: Record<string, number> = {
    blocked: 0,
    approval: 1,
    target: 2,
    validation: 3,
    pending: 4,
  }
  const attention = board
    .map((entry) => ({ entry, signal: releaseBoardQualitySignal(entry) }))
    .filter(({ signal }) => signal.value in attentionPriority)
    .sort((a, b) => attentionPriority[a.signal.value] - attentionPriority[b.signal.value])
  const recentTasks = sortByLatest(tasks, executionTaskUpdatedAt).slice(0, 4)
  const recentBundles = sortByLatest(bundles, releaseBundleUpdatedAt).slice(0, 4)
  const applicationNames = new Map(
    (canViewApplications && !applicationsQuery.isError ? applications : []).map((application) => [
      application.id,
      application.name,
    ]),
  )

  if (permissionQuery.isError) {
    return (
      <div className="soha-page soha-overview-page soha-delivery-overview-page">
        <ManagementState
          kind="error"
          actions={
            <Button
              onClick={() => {
                void permissionQuery.refetch()
              }}
            >
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (permissionQuery.isLoading) {
    return (
      <div className="soha-page soha-overview-page soha-delivery-overview-page">
        <ManagementState kind="loading" />
      </div>
    )
  }

  if (!hasAnyPermission) {
    return (
      <div className="soha-page soha-overview-page soha-delivery-overview-page">
        <ManagementState kind="no-permission" />
      </div>
    )
  }

  return (
    <div className="soha-page soha-overview-page soha-delivery-overview-page">
      <h1 className="soha-delivery-overview-heading">持续交付总览</h1>
      {hasContentQueryError ? (
        <ManagementState
          bordered={false}
          compact
          kind="error"
          title="部分交付数据加载失败"
          actions={<Button onClick={retryFailedContentQueries}>重试失败项</Button>}
        />
      ) : null}
      <div className="soha-overview-metric-grid">
        {overviewStats.map(({ key, path, ...item }) => (
          <Link
            aria-label={`查看${String(item.label)}`}
            className="soha-overview-card-link"
            key={key}
            to={path}
          >
            <OverviewMetricCard {...item} />
          </Link>
        ))}
      </div>

      <div className="soha-delivery-overview-panels">
        {canViewBoard ? (
          <Card
            className="soha-overview-panel-card"
            title="发布态势"
            extra={
              <Link to="/release-board">
                工作流中心 <ArrowRightOutlined />
              </Link>
            }
            loading={boardQuery.isLoading}
          >
            {boardQuery.isError ? (
              <ManagementState
                bordered={false}
                compact
                kind="error"
                title="发布态势加载失败"
                actions={<Button onClick={() => void boardQuery.refetch()}>重试</Button>}
              />
            ) : board.length ? (
              <>
                <div className="soha-overview-chip-grid soha-delivery-release-states">
                  {releaseFlow.map(({ key, ...item }) => (
                    <OverviewChip key={key} {...item} />
                  ))}
                </div>
                <div className="soha-delivery-overview-section-heading">
                  <h3>需要跟进的发布</h3>
                  <span>{attention.length} 个应用环境</span>
                </div>
                {attention.length ? (
                  <div className="soha-delivery-overview-records">
                    {attention.slice(0, 5).map(({ entry, signal }) => (
                      <div
                        className="soha-delivery-overview-record"
                        key={entry.applicationEnvironmentId}
                      >
                        <div className="soha-delivery-overview-record-main">
                          {canViewApplications ? (
                            <Link to={`/applications/${encodeURIComponent(entry.applicationId)}`}>
                              {entry.applicationName}
                            </Link>
                          ) : (
                            <strong>{entry.applicationName}</strong>
                          )}
                          <small>
                            {entry.environmentName || entry.environmentKey || entry.environmentId}
                          </small>
                        </div>
                        <StatusTag value={signal.value} label={signal.label} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ManagementState
                    bordered={false}
                    compact
                    kind="empty"
                    title="当前暂无需跟进的发布"
                    description="已读取的应用环境没有阻塞、待审批或待配置项。"
                  />
                )}
              </>
            ) : (
              <ManagementState
                bordered={false}
                compact
                kind="empty"
                title="暂无发布记录"
                description="应用绑定运行环境后，可在这里查看发布状态。"
                actions={
                  canViewApplications ? (
                    <Link to="/applications">
                      查看应用 <ArrowRightOutlined />
                    </Link>
                  ) : undefined
                }
              />
            )}
          </Card>
        ) : null}
        {canViewTasks || canViewBundles ? (
          <Card className="soha-overview-panel-card" title="交付记录">
            {canViewTasks ? (
              <section className="soha-delivery-overview-record-section" aria-label="最近执行">
                <div className="soha-delivery-overview-section-heading">
                  <h3>最近执行</h3>
                  <Link to="/delivery/execution-tasks">
                    全部任务 <ArrowRightOutlined />
                  </Link>
                </div>
                {tasksQuery.isLoading ? (
                  <ManagementState bordered={false} compact kind="loading" />
                ) : tasksQuery.isError ? (
                  <ManagementState
                    bordered={false}
                    compact
                    kind="error"
                    title="执行任务加载失败"
                    actions={<Button onClick={() => void tasksQuery.refetch()}>重试</Button>}
                  />
                ) : recentTasks.length ? (
                  <div className="soha-delivery-overview-records">
                    {recentTasks.map((task) => (
                      <Link
                        className="soha-delivery-overview-record"
                        key={task.id}
                        to={`/delivery/execution-tasks/${encodeURIComponent(task.id)}`}
                      >
                        <div className="soha-delivery-overview-record-main">
                          <strong>
                            {applicationNames.get(task.applicationId) || task.applicationId} ·{' '}
                            {task.taskKind}
                          </strong>
                          <small>
                            {task.providerKind} · {formatDateTime(executionTaskUpdatedAt(task))}
                          </small>
                        </div>
                        <StatusTag value={task.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <ManagementState
                    bordered={false}
                    compact
                    kind="empty"
                    title="暂无执行任务"
                    description="执行构建、部署或验证后，这里显示最近的任务。"
                  />
                )}
              </section>
            ) : null}
            {canViewBundles ? (
              <section className="soha-delivery-overview-record-section" aria-label="最新版本">
                <div className="soha-delivery-overview-section-heading">
                  <h3>最新版本</h3>
                  <Link to="/delivery/release-bundles">
                    全部版本 <ArrowRightOutlined />
                  </Link>
                </div>
                {bundlesQuery.isLoading ? (
                  <ManagementState bordered={false} compact kind="loading" />
                ) : bundlesQuery.isError ? (
                  <ManagementState
                    bordered={false}
                    compact
                    kind="error"
                    title="版本包加载失败"
                    actions={<Button onClick={() => void bundlesQuery.refetch()}>重试</Button>}
                  />
                ) : recentBundles.length ? (
                  <div className="soha-delivery-overview-records">
                    {recentBundles.map((bundle) => (
                      <Link
                        className="soha-delivery-overview-record"
                        key={bundle.id}
                        to={`/delivery/release-bundles/${encodeURIComponent(bundle.id)}`}
                      >
                        <div className="soha-delivery-overview-record-main">
                          <strong>{bundle.version}</strong>
                          <small>
                            {applicationNames.get(bundle.applicationId) || bundle.applicationId} ·{' '}
                            {formatDateTime(releaseBundleUpdatedAt(bundle))}
                          </small>
                        </div>
                        <StatusTag value={bundle.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <ManagementState
                    bordered={false}
                    compact
                    kind="empty"
                    title="暂无版本包"
                    description="构建产出的版本包会在这里展示。"
                  />
                )}
              </section>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  )
}
