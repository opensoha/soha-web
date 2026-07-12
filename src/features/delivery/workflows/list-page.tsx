import { useEffect, useState } from 'react'
import type { Key } from 'react'
import { Alert, App, Button, Collapse, Descriptions, Space, Tag, Timeline, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, LinkOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { DeliveryTable } from '@/features/delivery/delivery-table'
import { deliveryMutations } from '@/features/delivery/mutations'
import { deliveryQueries } from '@/features/delivery/queries'
import type { WorkflowNodeRun, WorkflowRun } from '@/features/delivery/types'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

function metadataText(metadata: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

function workflowGatewayTrace(run: WorkflowRun) {
  return {
    approvalRequestId: metadataText(
      run.metadata,
      'aiGatewayApprovalRequestId',
      'approvalRequestId',
    ),
    approvalPolicyRef: metadataText(run.metadata, 'aiGatewayApprovalPolicyRef'),
    policyId: metadataText(run.metadata, 'aiGatewayPolicyId'),
    toolName: metadataText(run.metadata, 'aiGatewayToolName'),
    skillId: metadataText(run.metadata, 'aiGatewaySkillId'),
    aiClientId: metadataText(run.metadata, 'aiGatewayAIClientId'),
  }
}

function workflowGatewayPath(approvalRequestId: string) {
  const search = new URLSearchParams()
  if (approvalRequestId) search.set('approvalRequestId', approvalRequestId)
  const suffix = search.toString()
  return `/ai-gateway/governance${suffix ? `?${suffix}` : ''}`
}

function workflowManualApprovalNode(run: WorkflowRun) {
  return run.nodeRuns?.find((item) => item.type === 'manual_approval') ?? null
}

function workflowNodeTimelineColor(status: string) {
  const normalized = status.toLowerCase()
  if (['completed', 'success', 'approved'].includes(normalized)) return 'var(--soha-success)'
  if (['failed', 'rejected', 'canceled', 'callback_timeout'].includes(normalized)) {
    return 'var(--soha-danger)'
  }
  if (['waiting_approval', 'pending_approval', 'pending'].includes(normalized)) {
    return 'var(--soha-warning)'
  }
  if (['running', 'dispatching'].includes(normalized)) return 'var(--soha-primary)'
  return 'var(--soha-graph-muted)'
}

function workflowNodeSummary(node: WorkflowNodeRun) {
  return node.summary || [node.type, node.status].filter(Boolean).join(' / ') || '-'
}

function WorkflowNodeTimeline({ nodes }: { nodes?: WorkflowNodeRun[] }) {
  if (!nodes?.length) {
    return <ManagementState bordered={false} compact description="No workflow nodes" />
  }
  return (
    <Timeline
      mode="start"
      items={nodes.map((node) => ({
        color: workflowNodeTimelineColor(node.status),
        title: (
          <Text type="secondary">
            {node.finishedAt
              ? formatDateTime(node.finishedAt)
              : node.startedAt
                ? formatDateTime(node.startedAt)
                : '-'}
          </Text>
        ),
        content: (
          <Space orientation="vertical" size={2}>
            <Space size={6} wrap>
              <Text strong>{node.name || node.nodeId}</Text>
              <Tag>{node.type}</Tag>
              <StatusTag value={node.status} />
            </Space>
            <Text type="secondary">{node.nodeId}</Text>
            <Text>{workflowNodeSummary(node)}</Text>
          </Space>
        ),
      }))}
    />
  )
}

function WorkflowManualApprovalDetail({ run }: { run: WorkflowRun }) {
  const trace = workflowGatewayTrace(run)
  const approvalNode = workflowManualApprovalNode(run)
  if (!approvalNode) {
    return <ManagementState bordered={false} compact description="No manual approval node" />
  }
  return (
    <Descriptions
      size="small"
      bordered
      column={3}
      items={[
        { key: 'nodeId', label: 'Node ID', children: approvalNode.nodeId },
        { key: 'name', label: 'Name', children: approvalNode.name || '-' },
        { key: 'type', label: 'Type', children: approvalNode.type || '-' },
        {
          key: 'status',
          label: 'Status',
          children: <StatusTag value={approvalNode.status} />,
        },
        {
          key: 'startedAt',
          label: 'Started',
          children: approvalNode.startedAt ? formatDateTime(approvalNode.startedAt) : '-',
        },
        {
          key: 'finishedAt',
          label: 'Finished',
          children: approvalNode.finishedAt ? formatDateTime(approvalNode.finishedAt) : '-',
        },
        { key: 'summary', label: 'Summary', span: 3, children: approvalNode.summary || '-' },
        {
          key: 'approvalRequestId',
          label: 'Gateway Approval',
          children: trace.approvalRequestId || '-',
        },
        {
          key: 'policy',
          label: 'Policy',
          children: trace.approvalPolicyRef || trace.policyId || '-',
        },
        { key: 'tool', label: 'Tool', children: trace.toolName || '-' },
        { key: 'skill', label: 'Skill', children: trace.skillId || '-' },
        { key: 'client', label: 'AI Client', children: trace.aiClientId || '-' },
      ]}
    />
  )
}

function WorkflowGatewayTracePanel({ run }: { run: WorkflowRun }) {
  const navigate = useNavigate()
  const trace = workflowGatewayTrace(run)
  const approvalNode = workflowManualApprovalNode(run)
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions
        size="small"
        bordered
        column={3}
        items={[
          {
            key: 'approval',
            label: 'Gateway Approval',
            children: trace.approvalRequestId ? (
              <Button
                size="small"
                type="link"
                icon={<LinkOutlined />}
                onClick={() => navigate(workflowGatewayPath(trace.approvalRequestId))}
              >
                {trace.approvalRequestId}
              </Button>
            ) : (
              '-'
            ),
          },
          {
            key: 'policy',
            label: 'Policy',
            children: trace.approvalPolicyRef || trace.policyId || '-',
          },
          { key: 'tool', label: 'Tool', children: trace.toolName || '-' },
          { key: 'skill', label: 'Skill', children: trace.skillId || '-' },
          { key: 'client', label: 'AI Client', children: trace.aiClientId || '-' },
          {
            key: 'manualNode',
            label: 'Manual Approval Node',
            children: approvalNode
              ? `${approvalNode.name || approvalNode.nodeId} / ${approvalNode.status}`
              : '-',
          },
        ]}
      />
      <Collapse
        size="small"
        defaultActiveKey={['manual-approval', 'node-timeline']}
        items={[
          {
            key: 'manual-approval',
            label: 'Manual approval detail',
            children: <WorkflowManualApprovalDetail run={run} />,
          },
          {
            key: 'node-timeline',
            label: 'Workflow node timeline',
            children: <WorkflowNodeTimeline nodes={run.nodeRuns} />,
          },
          {
            key: 'raw-trace',
            label: 'Raw trace',
            children: (
              <pre className="soha-json-block">
                {JSON.stringify(
                  { id: run.id, metadata: run.metadata, nodeRuns: run.nodeRuns },
                  null,
                  2,
                )}
              </pre>
            ),
          },
        ]}
      />
    </Space>
  )
}

export function WorkflowsPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusedWorkflowRunId = searchParams.get('workflowRunId')?.trim() ?? ''
  const focusedGatewayApprovalRequestId = searchParams.get('gatewayApprovalRequestId')?.trim() ?? ''
  const [expandedWorkflowRunIds, setExpandedWorkflowRunIds] = useState<string[]>([])
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canTriggerWorkflow = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.workflows.trigger',
  )

  const workflowsQuery = useQuery(deliveryQueries.workflows.list())
  const triggerMutation = useMutation(deliveryMutations.workflows.trigger(queryClient))
  const approveMutation = useMutation(deliveryMutations.workflows.approve(queryClient))
  const rejectMutation = useMutation(deliveryMutations.workflows.reject(queryClient))

  const workflows = workflowsQuery.data ?? []
  const focusedRun = focusedWorkflowRunId
    ? workflows.find((item) => item.id === focusedWorkflowRunId)
    : undefined
  useEffect(() => {
    if (!focusedWorkflowRunId) return
    setExpandedWorkflowRunIds((current) =>
      current.includes(focusedWorkflowRunId) ? current : [focusedWorkflowRunId, ...current],
    )
  }, [focusedWorkflowRunId])

  const columns: ColumnProps<WorkflowRun>[] = [
    {
      title: t('common.workflow', 'Workflow'),
      dataIndex: 'workflowName',
      render: (value: string, record: WorkflowRun) => (
        <Space orientation="vertical" size={0}>
          <Space size={6} wrap>
            <Text strong>{value}</Text>
            {record.id === focusedWorkflowRunId ? <Tag color="blue">已定位</Tag> : null}
          </Space>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: t('common.application', 'Application'), dataIndex: 'applicationId' },
    { title: t('common.cluster', 'Cluster'), dataIndex: 'clusterId' },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace' },
    {
      ...tableColumnPresets.status,
      title: t('common.status', 'Status'),
      dataIndex: 'status',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: t('page.delivery.workflows.nodeProgress', 'Node Progress'),
      dataIndex: 'nodeRuns',
      render: (value: WorkflowRun['nodeRuns']) =>
        `${value?.filter((item) => item.status !== 'pending').length ?? 0}/${value?.length ?? 0}`,
    },
    {
      title: 'Gateway',
      key: 'gateway',
      width: 220,
      render: (_: unknown, record: WorkflowRun) => {
        const trace = workflowGatewayTrace(record)
        return trace.approvalRequestId ? (
          <Space orientation="vertical" size={0}>
            <Button
              size="small"
              type="link"
              icon={<LinkOutlined />}
              onClick={() => navigate(workflowGatewayPath(trace.approvalRequestId))}
            >
              {trace.approvalRequestId}
            </Button>
            <Text type="secondary">{trace.toolName || 'AI Gateway'}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
      },
    },
    {
      ...tableColumnPresets.datetime,
      title: localeCode === 'zh_CN' ? '最近运行' : 'Last Run',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.action,
      title: t('common.actions', 'Actions'),
      dataIndex: 'id',
      render: (_: unknown, record: WorkflowRun) => (
        <Space className="soha-row-action-icons" size={2}>
          {canTriggerWorkflow ? (
            <ManagementIconButton
              aria-label={localeCode === 'zh_CN' ? '触发工作流' : 'Trigger workflow'}
              icon={<PlayCircleOutlined />}
              size="small"
              tooltip={localeCode === 'zh_CN' ? '触发' : 'Trigger'}
              onClick={() =>
                triggerMutation.mutate(
                  {
                    applicationId: record.applicationId,
                    workflowName: record.workflowName,
                    clusterId: record.clusterId,
                    namespace: record.namespace,
                    deploymentName: record.deploymentName,
                    triggerBuild: true,
                    triggerRelease: true,
                  },
                  { onError: (error) => message.error(error.message) },
                )
              }
            />
          ) : null}
          {canTriggerWorkflow && record.status === 'waiting_approval' ? (
            <ManagementIconButton
              aria-label="批准工作流"
              icon={<CheckOutlined />}
              size="small"
              tooltip="批准"
              onClick={() =>
                approveMutation.mutate(
                  { id: record.id, comment: 'Approved from console' },
                  { onError: (error) => message.error(error.message) },
                )
              }
            />
          ) : null}
          {canTriggerWorkflow && record.status === 'waiting_approval' ? (
            <ManagementIconButton
              aria-label="拒绝工作流"
              danger
              icon={<CloseOutlined />}
              size="small"
              tooltip="拒绝"
              onClick={() =>
                rejectMutation.mutate(
                  { id: record.id, comment: 'Rejected from console' },
                  { onError: (error) => message.error(error.message) },
                )
              }
            />
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      {focusedWorkflowRunId || focusedGatewayApprovalRequestId ? (
        <Alert
          type={
            focusedWorkflowRunId && !workflowsQuery.isLoading && !focusedRun ? 'warning' : 'info'
          }
          showIcon
          title={focusedRun ? `已定位工作流 ${focusedRun.id}` : 'Gateway 审批关联工作流定位'}
          description={
            [
              focusedWorkflowRunId ? `workflowRunId=${focusedWorkflowRunId}` : '',
              focusedGatewayApprovalRequestId
                ? `gatewayApprovalRequestId=${focusedGatewayApprovalRequestId}`
                : '',
            ]
              .filter(Boolean)
              .join(' / ') || undefined
          }
        />
      ) : null}
      <DeliveryTable
        refreshing={workflowsQuery.isFetching}
        onRefresh={() => void workflowsQuery.refetch()}
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={workflowsQuery.isLoading}
        expandable={{
          expandedRowKeys: expandedWorkflowRunIds,
          expandedRowRender: (record: WorkflowRun) => <WorkflowGatewayTracePanel run={record} />,
          onExpandedRowsChange: (keys: readonly Key[]) =>
            setExpandedWorkflowRunIds(keys.map(String)),
        }}
      />
    </div>
  )
}
