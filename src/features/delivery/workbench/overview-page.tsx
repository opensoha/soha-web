import { Link } from 'react-router-dom'
import {
  AppstoreOutlined,
  ApartmentOutlined,
  FieldTimeOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from 'antd'
import { ManagementState } from '@/components/management-list'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  summarizeExecutionTaskStatus,
  summarizeReleaseBoard,
  summarizeReleaseBundleStatus,
} from '../delivery-status'
import { deliveryQueries } from '../queries'

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
  const deliveryEvidence = [
    ...(canViewBundles && !bundlesQuery.isError
      ? [
          {
            key: 'bundle-ready',
            label: '就绪版本',
            value: bundleSummary.ready,
            tone: 'success' as const,
          },
          {
            key: 'bundle-blocked',
            label: '阻塞版本',
            value: bundleSummary.blocked,
            tone: 'danger' as const,
          },
        ]
      : []),
    ...(canViewTasks && !tasksQuery.isError
      ? [
          {
            key: 'task-active',
            label: '运行任务',
            value: taskSummary.active,
            tone: 'warning' as const,
          },
          {
            key: 'task-blocked',
            label: '失败任务',
            value: taskSummary.blocked,
            tone: 'danger' as const,
          },
          {
            key: 'artifacts',
            label: '任务制品',
            value: taskSummary.artifacts,
            tone: 'default' as const,
          },
        ]
      : []),
  ] satisfies OverviewChipItem[]

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

      {canViewBoard || canViewBundles || canViewTasks ? (
        <div className="soha-overview-summary-grid">
          {canViewBoard ? (
            <Card
              className="soha-overview-panel-card"
              title="发布流转"
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
                <div className="soha-overview-alert-stack">
                  <OverviewSectionBar
                    title="发布状态"
                    description="按应用环境汇总发布目标、执行、审批与阻塞状态。"
                  />
                  <div className="soha-overview-chip-grid">
                    {releaseFlow.map(({ key, ...item }) => (
                      <OverviewChip key={key} {...item} />
                    ))}
                  </div>
                </div>
              ) : (
                <ManagementState bordered={false} compact kind="empty" title="暂无发布记录" />
              )}
            </Card>
          ) : null}

          {canViewBundles || canViewTasks ? (
            <Card
              className="soha-overview-panel-card"
              title="交付证据"
              loading={bundlesQuery.isLoading || tasksQuery.isLoading}
            >
              {bundlesQuery.isError || tasksQuery.isError ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="error"
                  title="部分交付证据加载失败"
                  actions={
                    <Button
                      onClick={() => {
                        if (bundlesQuery.isError) void bundlesQuery.refetch()
                        if (tasksQuery.isError) void tasksQuery.refetch()
                      }}
                    >
                      重试失败项
                    </Button>
                  }
                />
              ) : null}
              {bundles.length || tasks.length ? (
                <div className="soha-overview-alert-stack">
                  <OverviewSectionBar
                    title="版本与任务"
                    description="汇总不可变版本、执行状态和任务制品。"
                  />
                  <div className="soha-overview-chip-grid">
                    {deliveryEvidence.map(({ key, ...item }) => (
                      <OverviewChip key={key} {...item} />
                    ))}
                  </div>
                </div>
              ) : !bundlesQuery.isError && !tasksQuery.isError ? (
                <ManagementState bordered={false} compact kind="empty" title="暂无交付证据" />
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
