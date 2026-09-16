import { App, Button, Space, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { gatewayApi } from '../../gateway/api'
import { gatewayQueries } from '../../gateway/queries'
import { gatewayKeys } from '../../gateway/keys'

export function MessageApproval({ id }: { id: string }) {
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const snapshot = usePermissionSnapshot().data?.data
  const canView = hasPermission(snapshot, 'ai.gateway.approvals.view')
  const query = useQuery({
    ...gatewayQueries.approvals(
      {
        id,
        status: '',
        actor: '',
        aiClientId: '',
        toolName: '',
        riskLevel: '',
        strategy: '',
        from: '',
        to: '',
      },
      canView,
    ),
    refetchInterval: (state) =>
      state.state.data?.data?.some((item) => ['pending', 'approved'].includes(item.status))
        ? 4000
        : false,
  })
  const request = query.data?.data?.find((item) => item.id === id)
  const decide = useMutation({
    mutationFn: (action: 'approve' | 'reject' | 'cancel') =>
      gatewayApi.approvals.decide(id, action),
    onSuccess: () => {
      void message.success('审批状态已更新')
    },
    onError: () => {
      void message.error('操作未完成，请检查最新状态与权限。')
    },
    onSettled: () => client.invalidateQueries({ queryKey: gatewayKeys.all }),
  })
  if (!canView)
    return (
      <Typography.Paragraph type="secondary">
        申请已提交；当前账号无权查看审批。
      </Typography.Paragraph>
    )
  if (query.isError) return <Button onClick={() => void query.refetch()}>审批读取失败，重试</Button>
  if (!request)
    return (
      <Typography.Paragraph type="secondary">
        {query.isPending ? '正在读取审批…' : '审批记录不可用'}
      </Typography.Paragraph>
    )
  const pending = request.status === 'pending'
  const labels: Record<string, string> = {
    pending: '等待审批',
    approved: '已批准，执行中',
    executed: '已执行',
    failed: '执行失败',
    rejected: '已拒绝',
    canceled: '已取消',
    expired: '已过期',
  }
  return (
    <div className="soha-ai-approval">
      <Space wrap>
        <Typography.Text strong>变更审批</Typography.Text>
        <Tag color={pending ? 'warning' : request.status === 'executed' ? 'success' : 'default'}>
          {labels[request.status] || request.status}
        </Tag>
      </Space>
      <Typography.Paragraph>
        {pending
          ? '请核对已保存参数，再决定是否执行。'
          : request.status === 'executed'
            ? '变更已执行，可展开查看实际结果。'
            : request.summary}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        {request.toolName}
        {request.expiresAt ? ` · 有效期至 ${new Date(request.expiresAt).toLocaleString()}` : ''}
      </Typography.Paragraph>
      <details open={pending}>
        <summary>已保存的动作参数</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {JSON.stringify(request.toolInput, null, 2)}
        </pre>
      </details>
      {request.output && request.status !== 'pending' ? (
        <details>
          <summary>实际执行结果</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(request.output, null, 2)}
          </pre>
        </details>
      ) : null}
      {pending ? (
        <Space wrap>
          {(['approve', 'reject', 'cancel'] as const)
            .filter((action) => hasPermission(snapshot, `ai.gateway.approvals.${action}`))
            .map((action) => (
              <Button
                key={action}
                size="small"
                loading={decide.isPending && decide.variables === action}
                disabled={decide.isPending}
                onClick={() => {
                  if (action !== 'approve') {
                    decide.mutate(action)
                    return
                  }
                  modal.confirm({
                    title: '批准并执行已保存的变更？',
                    content: (
                      <>
                        <Typography.Paragraph>{request.toolName}</Typography.Paragraph>
                        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {JSON.stringify(request.toolInput, null, 2)}
                        </pre>
                      </>
                    ),
                    okText: '批准并执行',
                    cancelText: '返回',
                    onOk: () => decide.mutateAsync(action),
                  })
                }}
              >
                {{ approve: '批准', reject: '拒绝', cancel: '取消申请' }[action]}
              </Button>
            ))}
        </Space>
      ) : null}
      <Typography.Paragraph type="secondary">
        批准仅执行以上参数。回滚需单独发起申请；本步骤不会自动重试变更。
        助手本轮已结束，审批结果在此更新；需要后续分析时，请发送新消息。
      </Typography.Paragraph>
    </div>
  )
}
