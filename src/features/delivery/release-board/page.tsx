import { useMemo, useState } from 'react'
import { App, Button, Card, Pagination, Popconfirm, Progress, Space, Typography } from 'antd'
import { ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementQueryScope,
  ManagementState,
  ManagementToolbarSearch,
  useManagementTextFilter,
} from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import {
  isDeliveryActiveStatus,
  isDeliveryFailureStatus,
  isDeliveryReadyStatus,
  normalizeDeliveryStatus,
} from '../delivery-status'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { WorkflowRun } from '../types'
import './styles.css'

const { Text } = Typography
const WORKFLOW_REFRESH_INTERVAL_MS = 5_000
// ponytail: the legacy endpoint has no cursor; replace this window with server pagination when 200 runs is insufficient.
const WORKFLOW_HISTORY_LIMIT = 200
const WORKFLOW_PAGE_SIZE = 12
type WorkflowStatusFilter = 'all' | 'running' | 'approval' | 'succeeded' | 'failed'

function workflowMetadataText(run: WorkflowRun, key: string) {
  const value = run.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function workflowApplicationName(run: WorkflowRun) {
  return workflowMetadataText(run, 'applicationName') || run.applicationId
}

function workflowTarget(run: WorkflowRun) {
  return [run.clusterId, run.namespace, run.deploymentName].filter(Boolean).join(' / ')
}

function workflowSearchValues(run: WorkflowRun) {
  return [
    run.workflowName,
    run.id,
    workflowApplicationName(run),
    run.applicationId,
    run.clusterId,
    run.namespace,
    run.deploymentName,
    run.status,
  ]
}

function isWorkflowApproval(run: WorkflowRun) {
  return normalizeDeliveryStatus(run.status).includes('approval')
}

function workflowMatchesStatus(run: WorkflowRun, filter: WorkflowStatusFilter) {
  if (filter === 'running') return isDeliveryActiveStatus(run.status) && !isWorkflowApproval(run)
  if (filter === 'approval') return isWorkflowApproval(run)
  if (filter === 'succeeded') return isDeliveryReadyStatus(run.status)
  if (filter === 'failed') return isDeliveryFailureStatus(run.status)
  return true
}

function workflowNodes(run: WorkflowRun) {
  return run.nodeRuns?.length ? run.nodeRuns : run.steps
}

function workflowProgress(run: WorkflowRun) {
  const nodes = workflowNodes(run)
  const progressed = nodes.filter(
    (node) => normalizeDeliveryStatus(node.status) !== 'pending',
  ).length
  return {
    progressed,
    total: nodes.length,
    percent: nodes.length ? Math.round((progressed / nodes.length) * 100) : 0,
  }
}

function workflowCurrentNode(run: WorkflowRun) {
  const nodes = workflowNodes(run)
  return (
    nodes.find((node) => isDeliveryActiveStatus(node.status)) ??
    nodes.find((node) => isDeliveryFailureStatus(node.status)) ??
    nodes[nodes.length - 1]
  )
}

function summarizeWorkflowRuns(runs: WorkflowRun[]) {
  return runs.reduce(
    (summary, run) => {
      if (isWorkflowApproval(run)) summary.approval += 1
      else if (isDeliveryActiveStatus(run.status)) summary.running += 1
      if (isDeliveryReadyStatus(run.status)) summary.succeeded += 1
      if (isDeliveryFailureStatus(run.status)) summary.failed += 1
      return summary
    },
    { approval: 0, failed: 0, running: 0, succeeded: 0 },
  )
}

function WorkflowRunCard({
  run,
  pendingDecision,
  onApprove,
  onReject,
}: {
  run: WorkflowRun
  pendingDecision?: 'approve' | 'reject'
  onApprove?: () => void
  onReject?: () => void
}) {
  const { localeCode } = useI18n()
  const progress = workflowProgress(run)
  const currentNode = workflowCurrentNode(run)
  const applicationName = workflowApplicationName(run)
  const target = workflowTarget(run)
  const active = isDeliveryActiveStatus(run.status)
  const nodeLabel = active
    ? localeCode === 'zh_CN'
      ? '当前节点'
      : 'Current node'
    : isDeliveryFailureStatus(run.status)
      ? localeCode === 'zh_CN'
        ? '失败节点'
        : 'Failed node'
      : localeCode === 'zh_CN'
        ? '最后节点'
        : 'Last node'

  return (
    <Card className="soha-release-run-card" role="listitem" size="small">
      <div className="soha-release-run-card__header">
        <div className="soha-release-run-card__identity">
          <Link
            aria-label={`${localeCode === 'zh_CN' ? '查看工作流' : 'View workflow'} ${run.workflowName}`}
            className="soha-release-run-card__link"
            to={`/workflows/${run.id}`}
          >
            <Text strong ellipsis title={run.workflowName}>
              {run.workflowName}
            </Text>
            <RightOutlined aria-hidden="true" />
          </Link>
          <Text type="secondary" ellipsis title={run.id}>
            {run.id}
          </Text>
        </div>
        <StatusTag value={run.status} />
      </div>

      <div className="soha-release-run-card__details">
        <div>
          <Text type="secondary">{localeCode === 'zh_CN' ? '应用' : 'Application'}</Text>
          <Text strong ellipsis title={applicationName}>
            {applicationName}
          </Text>
          {applicationName !== run.applicationId ? (
            <Text type="secondary" ellipsis title={run.applicationId}>
              {run.applicationId}
            </Text>
          ) : null}
        </div>
        <div>
          <Text type="secondary">{localeCode === 'zh_CN' ? '目标' : 'Target'}</Text>
          <Text ellipsis title={target || '-'}>
            {target || '-'}
          </Text>
        </div>
      </div>

      <div className="soha-release-run-card__progress">
        <div className="soha-release-run-card__progress-label">
          <Text type="secondary">{localeCode === 'zh_CN' ? '节点进度' : 'Node progress'}</Text>
          <Text>
            {progress.progressed}/{progress.total} {localeCode === 'zh_CN' ? '节点' : 'nodes'}
          </Text>
        </div>
        <Progress
          aria-label={localeCode === 'zh_CN' ? '工作流节点进度' : 'Workflow node progress'}
          percent={progress.percent}
          showInfo={false}
          size="small"
          status={isDeliveryFailureStatus(run.status) ? 'exception' : undefined}
        />
      </div>

      <div className="soha-release-run-card__footer">
        <Text ellipsis title={`${nodeLabel}：${currentNode?.name || '-'}`}>
          {nodeLabel}：{currentNode?.name || '-'}
        </Text>
        <Space size={8} wrap>
          {onApprove ? (
            <Popconfirm
              cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
              okText={localeCode === 'zh_CN' ? '批准' : 'Approve'}
              title={localeCode === 'zh_CN' ? '确认批准这个工作流？' : 'Approve this workflow?'}
              onConfirm={onApprove}
            >
              <Button
                aria-label={`${localeCode === 'zh_CN' ? '批准工作流' : 'Approve workflow'} ${run.workflowName}`}
                disabled={Boolean(pendingDecision)}
                loading={pendingDecision === 'approve'}
                size="small"
                type="primary"
              >
                {localeCode === 'zh_CN' ? '批准' : 'Approve'}
              </Button>
            </Popconfirm>
          ) : null}
          {onReject ? (
            <Popconfirm
              cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
              okButtonProps={{ danger: true }}
              okText={localeCode === 'zh_CN' ? '拒绝' : 'Reject'}
              title={localeCode === 'zh_CN' ? '确认拒绝这个工作流？' : 'Reject this workflow?'}
              onConfirm={onReject}
            >
              <Button
                aria-label={`${localeCode === 'zh_CN' ? '拒绝工作流' : 'Reject workflow'} ${run.workflowName}`}
                danger
                disabled={Boolean(pendingDecision)}
                loading={pendingDecision === 'reject'}
                size="small"
              >
                {localeCode === 'zh_CN' ? '拒绝' : 'Reject'}
              </Button>
            </Popconfirm>
          ) : null}
          <Text type="secondary">{formatDateTime(run.updatedAt)}</Text>
        </Space>
      </div>
    </Card>
  )
}

export function ReleaseBoardPage() {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [workflowSearch, setWorkflowSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>('all')
  const [page, setPage] = useState(1)
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewWorkflows = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.workflows.view',
  )
  const canReviewWorkflows = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.application-environments.approve',
  )
  const workflowsQuery = useQuery(
    deliveryQueries.workflows.list(
      { limit: WORKFLOW_HISTORY_LIMIT },
      { enabled: canViewWorkflows, refetchInterval: WORKFLOW_REFRESH_INTERVAL_MS },
    ),
  )
  const approveMutation = useMutation(deliveryMutations.workflows.approve(queryClient))
  const rejectMutation = useMutation(deliveryMutations.workflows.reject(queryClient))
  const runs = useMemo(
    () =>
      [...(workflowsQuery.data ?? [])].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [workflowsQuery.data],
  )
  const statusRuns = useMemo(
    () => runs.filter((run) => workflowMatchesStatus(run, statusFilter)),
    [runs, statusFilter],
  )
  const filteredRuns = useManagementTextFilter(statusRuns, workflowSearch, workflowSearchValues)
  const pageCount = Math.max(1, Math.ceil(filteredRuns.length / WORKFLOW_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * WORKFLOW_PAGE_SIZE
  const visibleRuns = filteredRuns.slice(pageStart, pageStart + WORKFLOW_PAGE_SIZE)
  const summary = useMemo(() => summarizeWorkflowRuns(runs), [runs])
  const summaryMetrics: OverviewMetricItem[] = [
    {
      key: 'running',
      label: localeCode === 'zh_CN' ? '运行中' : 'Running',
      value: summary.running,
      helper:
        localeCode === 'zh_CN'
          ? `${summary.running} 个工作流正在执行`
          : `${summary.running} workflows in progress`,
      tone: summary.running ? 'warning' : undefined,
    },
    {
      key: 'approval',
      label: localeCode === 'zh_CN' ? '待审批' : 'Awaiting approval',
      value: summary.approval,
      helper:
        localeCode === 'zh_CN'
          ? `${summary.approval} 个工作流等待处理`
          : `${summary.approval} workflows need review`,
      tone: summary.approval ? 'warning' : undefined,
    },
    {
      key: 'succeeded',
      label: localeCode === 'zh_CN' ? '最近成功' : 'Recently succeeded',
      value: summary.succeeded,
      helper:
        localeCode === 'zh_CN'
          ? `${summary.succeeded} 个成功结果`
          : `${summary.succeeded} successful results`,
      tone: summary.succeeded ? 'success' : undefined,
    },
    {
      key: 'failed',
      label: localeCode === 'zh_CN' ? '最近失败' : 'Recently failed',
      value: summary.failed,
      helper:
        localeCode === 'zh_CN'
          ? `${summary.failed} 个需要关注`
          : `${summary.failed} need attention`,
      tone: summary.failed ? 'danger' : undefined,
    },
  ]

  if (permissionSnapshotQuery.isLoading) {
    return (
      <div className="soha-page soha-release-board">
        <ManagementState
          kind="loading"
          title={localeCode === 'zh_CN' ? '正在加载权限' : 'Loading permissions'}
        />
      </div>
    )
  }

  if (permissionSnapshotQuery.isError) {
    return (
      <div className="soha-page soha-release-board">
        <ManagementState
          actions={
            <Button onClick={() => void permissionSnapshotQuery.refetch()}>
              {localeCode === 'zh_CN' ? '重试' : 'Retry'}
            </Button>
          }
          kind="error"
          title={localeCode === 'zh_CN' ? '权限加载失败' : 'Failed to load permissions'}
        />
      </div>
    )
  }

  if (!canViewWorkflows) {
    return (
      <div className="soha-page soha-release-board">
        <ManagementState
          kind="no-permission"
          title={localeCode === 'zh_CN' ? '无权查看工作流' : 'No workflow access'}
        />
      </div>
    )
  }

  return (
    <div className="soha-page soha-release-board">
      <div className="soha-overview-metric-grid">
        {summaryMetrics.map(({ key, ...item }) => (
          <OverviewMetricCard key={key} {...item} loading={workflowsQuery.isLoading} />
        ))}
      </div>

      <Card
        className="soha-release-board__runs"
        title={
          <div className="soha-release-board__runs-title">
            <Text strong>{localeCode === 'zh_CN' ? '工作流执行' : 'Workflow runs'}</Text>
            <Text type="secondary">
              {localeCode === 'zh_CN'
                ? `最近 ${WORKFLOW_HISTORY_LIMIT} 条`
                : `Latest ${WORKFLOW_HISTORY_LIMIT}`}
            </Text>
          </div>
        }
        extra={
          <ManagementIconButton
            aria-label={localeCode === 'zh_CN' ? '刷新工作流' : 'Refresh workflows'}
            icon={<ReloadOutlined />}
            loading={workflowsQuery.isFetching}
            size="small"
            tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
            onClick={() => void workflowsQuery.refetch()}
          />
        }
      >
        {workflowsQuery.isError ? (
          <ManagementState
            actions={
              <Button
                aria-label={localeCode === 'zh_CN' ? '重试工作流' : 'Retry workflows'}
                onClick={() => void workflowsQuery.refetch()}
              >
                {localeCode === 'zh_CN' ? '重试' : 'Retry'}
              </Button>
            }
            bordered={false}
            kind="error"
            title={localeCode === 'zh_CN' ? '工作流加载失败' : 'Failed to load workflows'}
          />
        ) : workflowsQuery.isLoading ? (
          <ManagementState
            bordered={false}
            kind="loading"
            title={localeCode === 'zh_CN' ? '正在加载工作流' : 'Loading workflows'}
          />
        ) : (
          <>
            <div className="soha-release-board__filters">
              <ManagementQueryScope
                aria-label={
                  localeCode === 'zh_CN' ? '按状态筛选工作流' : 'Filter workflows by status'
                }
                label={localeCode === 'zh_CN' ? '状态' : 'Status'}
                options={[
                  { value: 'all', label: localeCode === 'zh_CN' ? '全部' : 'All' },
                  { value: 'running', label: localeCode === 'zh_CN' ? '运行中' : 'Running' },
                  { value: 'approval', label: localeCode === 'zh_CN' ? '待审批' : 'Approval' },
                  { value: 'succeeded', label: localeCode === 'zh_CN' ? '成功' : 'Succeeded' },
                  { value: 'failed', label: localeCode === 'zh_CN' ? '失败' : 'Failed' },
                ]}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as WorkflowStatusFilter)
                  setPage(1)
                }}
              />
              <ManagementToolbarSearch
                aria-label={localeCode === 'zh_CN' ? '搜索工作流执行' : 'Search workflow runs'}
                placeholder={
                  localeCode === 'zh_CN'
                    ? '搜索应用、服务或工作流'
                    : 'Search application, service, or workflow'
                }
                value={workflowSearch}
                onChange={(value) => {
                  setWorkflowSearch(value)
                  setPage(1)
                }}
              />
            </div>

            {visibleRuns.length ? (
              <>
                <div className="soha-release-board__grid" role="list">
                  {visibleRuns.map((run) => (
                    <WorkflowRunCard
                      key={run.id}
                      run={run}
                      pendingDecision={
                        approveMutation.isPending
                          ? 'approve'
                          : rejectMutation.isPending
                            ? 'reject'
                            : undefined
                      }
                      onApprove={
                        canReviewWorkflows && run.status === 'waiting_approval'
                          ? () =>
                              approveMutation.mutate(
                                { id: run.id, comment: 'Approved from release board' },
                                {
                                  onSuccess: () =>
                                    message.success(
                                      localeCode === 'zh_CN' ? '工作流已批准' : 'Workflow approved',
                                    ),
                                  onError: (error) => message.error(error.message),
                                },
                              )
                          : undefined
                      }
                      onReject={
                        canReviewWorkflows && run.status === 'waiting_approval'
                          ? () =>
                              rejectMutation.mutate(
                                { id: run.id, comment: 'Rejected from release board' },
                                {
                                  onSuccess: () =>
                                    message.success(
                                      localeCode === 'zh_CN' ? '工作流已拒绝' : 'Workflow rejected',
                                    ),
                                  onError: (error) => message.error(error.message),
                                },
                              )
                          : undefined
                      }
                    />
                  ))}
                </div>
                <nav
                  aria-label={localeCode === 'zh_CN' ? '工作流执行分页' : 'Workflow run pagination'}
                  className="soha-release-board__pagination"
                >
                  <Pagination
                    current={currentPage}
                    pageSize={WORKFLOW_PAGE_SIZE}
                    responsive
                    showSizeChanger={false}
                    showTotal={(total, [start, end]) =>
                      localeCode === 'zh_CN'
                        ? `当前 ${start}-${end} / ${total} 条`
                        : `Showing ${start}-${end} of ${total}`
                    }
                    size="small"
                    total={filteredRuns.length}
                    onChange={setPage}
                  />
                </nav>
              </>
            ) : (
              <ManagementState
                bordered={false}
                compact
                title={
                  workflowSearch.trim()
                    ? localeCode === 'zh_CN'
                      ? '没有匹配的工作流'
                      : 'No matching workflows'
                    : statusFilter === 'running'
                      ? localeCode === 'zh_CN'
                        ? '当前没有运行中的工作流'
                        : 'No workflows in progress'
                      : statusFilter === 'all'
                        ? localeCode === 'zh_CN'
                          ? '暂无工作流执行记录'
                          : 'No workflow run records'
                        : localeCode === 'zh_CN'
                          ? '当前状态下没有工作流'
                          : 'No workflows with this status'
                }
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
