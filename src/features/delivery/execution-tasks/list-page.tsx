import { useMemo } from 'react'
import { Alert, App, Button, Popconfirm, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementIconButton } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { DeliveryTable } from '@/features/delivery/delivery-table'
import {
  canCancelExecutionTask,
  canRetryExecutionTask,
  summarizeExecutionTaskArtifacts,
  summarizeExecutionTaskStatus,
} from '@/features/delivery/delivery-status'
import { deliveryMutations } from '@/features/delivery/mutations'
import { deliveryQueries } from '@/features/delivery/queries'
import type { ExecutionArtifact, ExecutionTask } from '@/features/delivery/types'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { summarizeDeliveryGovernance } from '../workbench/governance'

const { Text } = Typography

export function ExecutionTasksPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusedExecutionTaskId = searchParams.get('executionTaskId')?.trim() ?? ''
  const focusedReleaseBundleId = searchParams.get('releaseBundleId')?.trim() ?? ''
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canCancel = hasPermission(permissionSnapshot, 'delivery.execution-tasks.cancel')
  const canRetry = hasPermission(permissionSnapshot, 'delivery.execution-tasks.retry')
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list({ refetchInterval: 5000 }))
  const cancelMutation = useMutation(deliveryMutations.executionTasks.cancel(queryClient))
  const retryMutation = useMutation(deliveryMutations.executionTasks.retry(queryClient))
  const executionTasks = tasksQuery.data ?? []
  const focusedTask = focusedExecutionTaskId
    ? executionTasks.find((item) => item.id === focusedExecutionTaskId)
    : undefined
  const executionSummary = useMemo(
    () => summarizeExecutionTaskStatus(executionTasks),
    [executionTasks],
  )
  const summaryMetrics: OverviewMetricItem[] = [
    {
      key: 'total',
      label: '任务总数',
      value: executionSummary.total,
      helper: `${executionSummary.active} 个执行中`,
    },
    {
      key: 'blocked',
      label: '阻塞任务',
      value: executionSummary.blocked,
      helper: `${executionSummary.retryable} 个可重试`,
      tone: executionSummary.blocked > 0 ? 'danger' : 'success',
    },
    {
      key: 'artifacts',
      label: '交付物线索',
      value: executionSummary.artifacts,
      helper: '来自任务结果',
    },
    {
      key: 'callbacks',
      label: '回调可用',
      value: executionSummary.callbackReady,
      helper: 'agent / callback token',
      tone: 'success',
    },
  ]

  function refreshTaskEvidence() {
    void tasksQuery.refetch()
  }

  function handleCancel(task: ExecutionTask) {
    cancelMutation.mutate(
      { id: task.id, reason: 'Canceled from execution tasks console' },
      {
        onSuccess: () => {
          message.success('任务已取消')
          refreshTaskEvidence()
        },
        onError: (error) => message.error(error.message),
      },
    )
  }

  function handleRetry(task: ExecutionTask) {
    retryMutation.mutate(
      { id: task.id, reason: 'Retried from execution tasks console' },
      {
        onSuccess: () => {
          message.success('任务已重新入队')
          refreshTaskEvidence()
        },
        onError: (error) => message.error(error.message),
      },
    )
  }

  return (
    <div className="soha-page">
      {focusedExecutionTaskId || focusedReleaseBundleId ? (
        <Alert
          showIcon
          title={focusedTask ? `已定位执行任务 ${focusedTask.id}` : '执行任务定位'}
          description={[
            focusedExecutionTaskId ? `executionTaskId=${focusedExecutionTaskId}` : '',
            focusedReleaseBundleId ? `releaseBundleId=${focusedReleaseBundleId}` : '',
          ]
            .filter(Boolean)
            .join(' / ')}
          type={focusedTask || tasksQuery.isLoading ? 'info' : 'warning'}
        />
      ) : null}
      <div className="soha-overview-metric-grid">
        {summaryMetrics.map(({ key, ...item }) => (
          <OverviewMetricCard key={key} {...item} loading={tasksQuery.isLoading} />
        ))}
      </div>
      <DeliveryTable
        rowKey="id"
        refreshing={tasksQuery.isFetching}
        onRefresh={() => void tasksQuery.refetch()}
        isError={tasksQuery.isError}
        errorDescription="暂时无法读取执行任务。"
        onRetry={() => void tasksQuery.refetch()}
        localSorting
        loading={tasksQuery.isLoading}
        dataSource={executionTasks}
        columns={[
          {
            title: '任务',
            dataIndex: 'taskKind',
            render: (value: string, record: ExecutionTask) => (
              <Space orientation="vertical" size={0}>
                <Space size={6} wrap>
                  <Text strong>{value}</Text>
                  {record.id === focusedExecutionTaskId ? <Tag color="blue">已定位</Tag> : null}
                </Space>
                <Text type="secondary">{record.id}</Text>
              </Space>
            ),
          },
          { title: '执行器', dataIndex: 'providerKind' },
          { title: '目标类型', dataIndex: 'targetKind' },
          {
            title: '应用',
            dataIndex: 'applicationId',
            render: (value: string, record: ExecutionTask) => (
              <Space orientation="vertical" size={0}>
                <Text>{value}</Text>
                <Text type="secondary">{record.applicationEnvironmentId || '-'}</Text>
              </Space>
            ),
          },
          {
            title: '版本包',
            dataIndex: 'releaseBundleId',
            render: (value: string) =>
              value ? (
                <Button
                  type="link"
                  size="small"
                  aria-label={`查看版本包 ${value}`}
                  onClick={() => navigate(`/delivery/release-bundles/${value}`)}
                >
                  {value}
                </Button>
              ) : (
                '-'
              ),
          },
          {
            title: '交付物',
            dataIndex: 'artifacts',
            render: (value?: ExecutionArtifact[]) => summarizeExecutionTaskArtifacts(value),
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: '治理证据',
            dataIndex: 'releaseBundleId',
            render: (value: string, record: ExecutionTask) => {
              if (!value) return '-'
              const bundle = {
                id: value,
                applicationId: record.applicationId,
                version: '-',
                sourceType: '-',
                status: 'completed',
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              }
              const governance = summarizeDeliveryGovernance(bundle, [record])
              return (
                <Space size={4} wrap>
                  <StatusTag value={governance.label} />
                  {governance.aiAuditRefs.length ? <Tag color="purple">AI审计</Tag> : null}
                  {governance.approvalRequestId ? <Tag color="gold">审批</Tag> : null}
                </Space>
              )
            },
          },
          {
            title: '重试',
            dataIndex: 'attemptCount',
            render: (value: number, record: ExecutionTask) => `${value}/${record.maxRetries}`,
          },
          { title: '超时（秒）', dataIndex: 'timeoutSeconds' },
          {
            ...tableColumnPresets.datetime,
            title: '心跳',
            dataIndex: 'lastHeartbeatAt',
            render: (value?: string) => (value ? formatDateTime(value) : '-'),
          },
          {
            ...tableColumnPresets.datetime,
            title: '更新时间',
            dataIndex: 'updatedAt',
            render: (value: string) => formatDateTime(value),
          },
          {
            ...tableColumnPresets.action,
            title: '操作',
            dataIndex: 'id',
            render: (_: unknown, record: ExecutionTask) => (
              <Space className="soha-row-action-icons" size={2}>
                <ManagementIconButton
                  aria-label="查看执行详情"
                  icon={<ArrowRightOutlined />}
                  size="small"
                  tooltip="查看详情"
                  onClick={() => navigate(`/delivery/execution-tasks/${record.id}`)}
                />
                {canCancel && canCancelExecutionTask(record) ? (
                  <Popconfirm title="确认取消该任务？" onConfirm={() => handleCancel(record)}>
                    <ManagementIconButton
                      aria-label="取消执行任务"
                      danger
                      icon={<StopOutlined />}
                      size="small"
                      tooltip="取消"
                    />
                  </Popconfirm>
                ) : null}
                {canRetry && canRetryExecutionTask(record) ? (
                  <ManagementIconButton
                    aria-label="重试执行任务"
                    icon={<ReloadOutlined />}
                    size="small"
                    tooltip="重试"
                    onClick={() => handleRetry(record)}
                  />
                ) : null}
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
