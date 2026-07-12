import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd'
import { ApiOutlined, FileTextOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ManagementIconButton } from '@/components/management-list'
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

const { Text } = Typography

export function ExecutionTasksPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const focusedExecutionTaskId = searchParams.get('executionTaskId')?.trim() ?? ''
  const focusedReleaseBundleId = searchParams.get('releaseBundleId')?.trim() ?? ''
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.execution-tasks.manage',
  )
  const [selectedTask, setSelectedTask] = useState<ExecutionTask | null>(null)
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list({ refetchInterval: 5000 }))
  const logsQuery = useQuery(
    deliveryQueries.executionTasks.logs(selectedTask?.id ?? '', {
      enabled: !!selectedTask?.id,
      refetchInterval: selectedTask?.id ? 5000 : false,
    }),
  )
  const callbackMutation = useMutation(deliveryMutations.executionTasks.callback(queryClient))
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

  useEffect(() => {
    if (!focusedTask || selectedTask?.id === focusedTask.id) return
    setSelectedTask(focusedTask)
  }, [focusedTask, selectedTask?.id])

  function refreshTaskEvidence() {
    void tasksQuery.refetch()
    if (selectedTask?.id) void logsQuery.refetch()
  }

  function handleCallback(task: ExecutionTask) {
    callbackMutation.mutate(
      {
        callbackToken: task.callbackToken,
        status: 'completed',
        payload: { logs: [`manual callback for ${task.id}`] },
      },
      {
        onSuccess: () => {
          message.success('回调已记录')
          refreshTaskEvidence()
        },
        onError: (error) => message.error(error.message),
      },
    )
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
      <div className="soha-execution-task-summary">
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">任务总数</Text>
          <strong>{executionSummary.total}</strong>
          <Text type="secondary">{executionSummary.active} 个执行中</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">阻塞任务</Text>
          <strong>{executionSummary.blocked}</strong>
          <Text type="secondary">{executionSummary.retryable} 个可重试</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">交付物线索</Text>
          <strong>{executionSummary.artifacts}</strong>
          <Text type="secondary">来自任务结果</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">回调可用</Text>
          <strong>{executionSummary.callbackReady}</strong>
          <Text type="secondary">agent / callback token</Text>
        </Card>
      </div>
      <DeliveryTable
        rowKey="id"
        refreshing={tasksQuery.isFetching}
        onRefresh={() => void tasksQuery.refetch()}
        loading={tasksQuery.isLoading}
        dataSource={executionTasks}
        columns={[
          {
            title: 'Task',
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
          { title: 'Provider', dataIndex: 'providerKind' },
          { title: 'Target', dataIndex: 'targetKind' },
          {
            title: 'Application',
            dataIndex: 'applicationId',
            render: (value: string, record: ExecutionTask) => (
              <Space orientation="vertical" size={0}>
                <Text>{value}</Text>
                <Text type="secondary">{record.applicationEnvironmentId || '-'}</Text>
              </Space>
            ),
          },
          {
            title: 'Bundle',
            dataIndex: 'releaseBundleId',
            render: (value: string) => value || '-',
          },
          {
            title: 'Artifacts',
            dataIndex: 'artifacts',
            render: (value?: ExecutionArtifact[]) => summarizeExecutionTaskArtifacts(value),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            title: 'Retries',
            dataIndex: 'attemptCount',
            render: (value: number, record: ExecutionTask) => `${value}/${record.maxRetries}`,
          },
          { title: 'Timeout(s)', dataIndex: 'timeoutSeconds' },
          {
            ...tableColumnPresets.datetime,
            title: 'Heartbeat',
            dataIndex: 'lastHeartbeatAt',
            render: (value?: string) => (value ? formatDateTime(value) : '-'),
          },
          {
            ...tableColumnPresets.datetime,
            title: 'Updated',
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
                  aria-label="查看执行日志"
                  icon={<FileTextOutlined />}
                  size="small"
                  tooltip="日志"
                  onClick={() => setSelectedTask(record)}
                />
                {canManage && canCancelExecutionTask(record) ? (
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
                {canManage && canRetryExecutionTask(record) ? (
                  <ManagementIconButton
                    aria-label="重试执行任务"
                    icon={<ReloadOutlined />}
                    size="small"
                    tooltip="重试"
                    onClick={() => handleRetry(record)}
                  />
                ) : null}
                {canManage && record.providerKind !== 'k8s_job_runner' && record.callbackToken ? (
                  <ManagementIconButton
                    aria-label="模拟执行回调"
                    icon={<ApiOutlined />}
                    size="small"
                    tooltip="模拟回调"
                    onClick={() => handleCallback(record)}
                  />
                ) : null}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={selectedTask ? `任务日志 · ${selectedTask.id}` : '任务日志'}
        open={!!selectedTask}
        onCancel={() => setSelectedTask(null)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <Descriptions
          items={
            selectedTask
              ? [
                  { key: 'provider', label: 'Provider', children: selectedTask.providerKind },
                  {
                    key: 'status',
                    label: 'Status',
                    children: <StatusTag value={selectedTask.status} />,
                  },
                  {
                    key: 'bundle',
                    label: 'Bundle',
                    children: selectedTask.releaseBundleId || '-',
                  },
                  {
                    key: 'heartbeat',
                    label: 'Last Heartbeat',
                    children: selectedTask.lastHeartbeatAt
                      ? formatDateTime(selectedTask.lastHeartbeatAt)
                      : '-',
                  },
                  {
                    key: 'callback',
                    label: 'Callback Token',
                    children: selectedTask.callbackToken || '-',
                  },
                ]
              : []
          }
        />
        {canManage && selectedTask ? (
          <Space style={{ marginBottom: 12 }}>
            {canCancelExecutionTask(selectedTask) ? (
              <Button
                danger
                icon={<StopOutlined />}
                loading={cancelMutation.isPending}
                onClick={() => handleCancel(selectedTask)}
                size="small"
              >
                取消任务
              </Button>
            ) : null}
            {canRetryExecutionTask(selectedTask) ? (
              <Button
                icon={<ReloadOutlined />}
                loading={retryMutation.isPending}
                onClick={() => handleRetry(selectedTask)}
                size="small"
              >
                重新入队
              </Button>
            ) : null}
          </Space>
        ) : null}
        <Card className="soha-management-panel-card" size="small" title="Execution Logs">
          <pre className="soha-json-block">
            {logsQuery.data
              ?.map((item) => `[${item.createdAt}] ${item.logLevel.toUpperCase()} ${item.message}`)
              .join('\n') || 'No logs'}
          </pre>
        </Card>
        <Card className="soha-management-panel-card" size="small" title="Artifacts">
          <pre className="soha-json-block">
            {JSON.stringify(selectedTask?.artifacts ?? [], null, 2)}
          </pre>
        </Card>
        <Card className="soha-management-panel-card" size="small" title="Result">
          <pre className="soha-json-block">
            {JSON.stringify(selectedTask?.result ?? {}, null, 2)}
          </pre>
        </Card>
      </Modal>
    </div>
  )
}
