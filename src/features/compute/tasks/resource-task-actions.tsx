import { App, Popconfirm, Space, Typography } from 'antd'
import { FileTextOutlined, RedoOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { ComputeTaskView } from '@opensoha/contracts/gen/ts/sohaapi'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { computeMutations } from '../mutations'

const { Text } = Typography

export function latestTaskForResource(
  tasks: ComputeTaskView[],
  resourceKind: string,
  resourceId: string,
) {
  return tasks.find((task) =>
    task.resources.some((resource) => resource.kind === resourceKind && resource.id === resourceId),
  )
}

export function ResourceTaskActions({
  task,
  resourceKind,
  resourceId,
}: {
  task?: ComputeTaskView
  resourceKind: string
  resourceId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const cancelMutation = useMutation(computeMutations.cancelTask(queryClient))
  const retryMutation = useMutation(computeMutations.retryTask(queryClient))

  if (!task) return <Text type="secondary">-</Text>

  const openLogs = () => {
    const search = new URLSearchParams({
      domain: task.domain,
      resourceKind,
      resourceId,
      taskId: task.id,
      view: 'logs',
    })
    navigate(`/compute/tasks/operations?${search.toString()}`)
  }

  const mutate = (action: 'cancel' | 'retry') => {
    const mutation = action === 'cancel' ? cancelMutation : retryMutation
    mutation.mutate(
      { domain: task.domain, taskId: task.id },
      {
        onSuccess: () =>
          void message.success(action === 'cancel' ? '任务已取消' : '任务已重新排队'),
      },
    )
  }

  return (
    <Space size={4} wrap={false}>
      <StatusTag value={task.normalizedStatus} />
      {task.availableActions.includes('logs') ? (
        <ManagementIconButton
          aria-label="查看最近任务日志"
          size="small"
          tooltip="查看日志"
          icon={<FileTextOutlined />}
          onClick={openLogs}
        />
      ) : null}
      {task.availableActions.includes('cancel') ? (
        <Popconfirm title="确认取消任务？" onConfirm={() => mutate('cancel')}>
          <ManagementIconButton
            aria-label="取消最近任务"
            size="small"
            danger
            tooltip="取消"
            icon={<StopOutlined />}
            loading={cancelMutation.isPending}
          />
        </Popconfirm>
      ) : null}
      {task.availableActions.includes('retry') ? (
        <Popconfirm title="确认重试任务？" onConfirm={() => mutate('retry')}>
          <ManagementIconButton
            aria-label="重试最近任务"
            size="small"
            tooltip="重试"
            icon={<RedoOutlined />}
            loading={retryMutation.isPending}
          />
        </Popconfirm>
      ) : null}
    </Space>
  )
}
