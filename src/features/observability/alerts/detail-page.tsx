import { useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Modal,
  Select,
  Space,
  Tabs,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { getAIWorkbenchPathForMode, useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { observabilityRuleQueries } from '../rules'
import '../observability-pages.css'
import { alertDisplayStatus, stringifyAlertPayload } from './model'
import { observabilityAlertMutations } from './mutations'
import { observabilityAlertQueries } from './queries'
import type { AlertDeliveryMetadata, HealingRun } from './types'

const { Paragraph } = Typography

function useAlertEventDetailController(eventId: string, enabled: boolean) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canAcknowledge = hasPermission(permissionSnapshotQuery.data?.data, 'observe.alerts.ack')
  const canManageAlerts = hasPermission(permissionSnapshotQuery.data?.data, 'observe.alerts.manage')
  const canHeal = hasPermission(permissionSnapshotQuery.data?.data, 'observe.healing.manage')
  const [healOpen, setHealOpen] = useState(false)
  const [healingPolicyId, setHealingPolicyId] = useState('')
  const eventQuery = useQuery({
    ...observabilityAlertQueries.detail(eventId),
    enabled: enabled && eventId !== '',
  })
  const ruleId = eventQuery.data?.ruleId ?? ''
  const ruleQuery = useQuery({
    ...observabilityRuleQueries.detail(ruleId),
    enabled: enabled && ruleId !== '',
  })
  const ruleRunsQuery = useQuery({
    ...observabilityRuleQueries.runs(ruleId),
    enabled: enabled && ruleId !== '',
  })
  const healingRunsQuery = useQuery({
    ...observabilityAlertQueries.healingRuns(eventId),
    enabled: enabled && eventId !== '',
  })
  const notificationPolicyId = ruleQuery.data?.notificationPolicyId ?? ''
  const previewQuery = useQuery({
    ...observabilityAlertQueries.preview(eventId, notificationPolicyId),
    enabled: enabled && eventId !== '' && notificationPolicyId !== '',
  })
  const deliveryLogsQuery = useQuery({
    ...observabilityAlertQueries.deliveryLogs(eventId),
    enabled: enabled && eventId !== '',
  })
  const healingPoliciesQuery = useQuery({
    ...observabilityAlertQueries.healingPolicies(),
    enabled,
  })
  const mutationError = (error: Error) => message.error(error.message)
  const acknowledgeMutation = useMutation({
    ...observabilityAlertMutations.acknowledge(queryClient),
    onError: mutationError,
  })
  const resolveMutation = useMutation({
    ...observabilityAlertMutations.resolve(queryClient),
    onError: mutationError,
  })
  const healMutation = useMutation({
    ...observabilityAlertMutations.heal(queryClient),
    onError: mutationError,
  })

  return {
    acknowledge: () =>
      acknowledgeMutation.mutate(eventId, {
        onSuccess: () => message.success('告警已确认'),
      }),
    acknowledgeMutation,
    canAcknowledge,
    canHeal,
    canManageAlerts,
    deliveryLogsQuery,
    event: eventQuery.data,
    eventQuery,
    heal: () =>
      healMutation.mutate(
        { eventId, policyId: healingPolicyId },
        {
          onSuccess: () => {
            message.success('自愈运行已创建')
            setHealOpen(false)
          },
        },
      ),
    healMutation,
    healOpen,
    healingPoliciesQuery,
    healingPolicyId,
    healingRunsQuery,
    openHealModal: () => {
      setHealingPolicyId(ruleQuery.data?.healingPolicyIds?.[0] || '')
      setHealOpen(true)
    },
    previewQuery,
    resolve: () =>
      resolveMutation.mutate(eventId, {
        onSuccess: () => message.success('告警已恢复'),
      }),
    resolveMutation,
    rule: ruleQuery.data,
    ruleRunsQuery,
    setHealOpen,
    setHealingPolicyId,
  }
}

type DetailController = ReturnType<typeof useAlertEventDetailController>

function AlertEventDetailBody({
  detail,
  inDrawer = false,
}: {
  detail: DetailController
  inDrawer?: boolean
}) {
  const { event, rule } = detail
  return (
    <div data-testid={inDrawer ? 'alert-event-drawer-content' : 'alert-event-page-content'}>
      <Card title="事件摘要" loading={detail.eventQuery.isLoading}>
        <Descriptions bordered size="small" column={inDrawer ? 1 : 2}>
          <Descriptions.Item label="事件ID">{event?.id || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {event ? <StatusTag value={event.status} /> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="来源">
            {event?.sourceSystem || event?.sourceType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="严重度">
            {event ? <StatusTag value={event.severity} /> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="范围">
            {[event?.clusterId, event?.namespace].filter(Boolean).join(' / ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最近命中">
            {formatDateTime(event?.lastSeenAt)}
          </Descriptions.Item>
          <Descriptions.Item label="规则ID">{event?.ruleId || '-'}</Descriptions.Item>
          <Descriptions.Item label="当前态">{event?.currentState || '-'}</Descriptions.Item>
          <Descriptions.Item label="接收器">{event?.receiver || '-'}</Descriptions.Item>
          <Descriptions.Item label="最近通知">
            {formatDateTime(event?.lastNotificationAt)}
          </Descriptions.Item>
          <Descriptions.Item label="触发时间">{formatDateTime(event?.startsAt)}</Descriptions.Item>
          <Descriptions.Item label="恢复时间">{formatDateTime(event?.endsAt)}</Descriptions.Item>
          <Descriptions.Item label="标题" span={inDrawer ? 1 : 2}>
            {event?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="摘要" span={inDrawer ? 1 : 2}>
            {event?.summary || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="规则与通知上下文" style={{ marginTop: 16 }}>
        <Descriptions bordered size="small" column={inDrawer ? 1 : 2}>
          <Descriptions.Item label="规则名称">{rule?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="规则类型">{rule?.ruleType || '-'}</Descriptions.Item>
          <Descriptions.Item label="通知策略">
            {rule?.notificationPolicyId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="自愈策略">
            {rule?.healingPolicyIds?.join(', ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="聚合维度" span={inDrawer ? 1 : 2}>
            {rule?.groupBy?.join(', ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="生成链接" span={inDrawer ? 1 : 2}>
            {event?.generatorUrl ? (
              <a href={event.generatorUrl} target="_blank" rel="noreferrer">
                {event.generatorUrl}
              </a>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'runs',
            label: '规则运行',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                rowKey="id"
                loading={detail.ruleRunsQuery.isLoading}
                dataSource={detail.ruleRunsQuery.data ?? []}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '运行ID', dataIndex: 'id' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: string) => <StatusTag value={value} />,
                  },
                  {
                    title: '命中',
                    dataIndex: 'matched',
                    render: (value: boolean) => (
                      <BooleanTag value={value} trueLabel="命中" falseLabel="未命中" />
                    ),
                  },
                  { title: '耗时(ms)', dataIndex: 'durationMs' },
                  { title: '摘要', dataIndex: 'summary', ellipsis: true },
                  { title: '错误', dataIndex: 'error', render: (value: string) => value || '-' },
                  { title: '时间', dataIndex: 'createdAt', render: formatDateTime },
                ]}
              />
            ),
          },
          {
            key: 'healing',
            label: '自愈运行',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                rowKey="id"
                loading={detail.healingRunsQuery.isLoading}
                dataSource={detail.healingRunsQuery.data ?? []}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '运行ID', dataIndex: 'id' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: string) => <StatusTag value={value} />,
                  },
                  {
                    title: '审批',
                    dataIndex: 'approvalStatus',
                    render: (value: string) => (value ? <StatusTag value={value} /> : '-'),
                  },
                  {
                    title: 'Workflow',
                    dataIndex: 'workflowStatus',
                    render: (value: string, record: HealingRun) =>
                      value ? <StatusTag value={value} /> : record.workflowRunId || '-',
                  },
                  {
                    title: '摘要',
                    dataIndex: 'workflowSummary',
                    ellipsis: true,
                    render: (value: string) => value || '-',
                  },
                  {
                    title: '审批人',
                    dataIndex: 'approvedBy',
                    render: (value: string) => value || '-',
                  },
                  { title: '创建时间', dataIndex: 'createdAt', render: formatDateTime },
                ]}
              />
            ),
          },
          {
            key: 'preview',
            label: '通知预览',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                rowKey={(record) =>
                  `${String(record.channelId || 'channel')}:${String(record.templateId || 'template')}:${String(record.url || 'url')}`
                }
                loading={detail.previewQuery.isLoading}
                dataSource={detail.previewQuery.data ?? []}
                pagination={false}
                columns={[
                  {
                    title: '渠道',
                    dataIndex: 'channelId',
                    render: (value: string) => value || '-',
                  },
                  {
                    title: '模板',
                    dataIndex: 'templateId',
                    render: (value: string) => value || '-',
                  },
                  { title: 'URL', dataIndex: 'url', ellipsis: true },
                  { title: 'Method', dataIndex: 'method', render: (value: string) => value || '-' },
                  {
                    title: 'Content-Type',
                    dataIndex: 'contentType',
                    render: (value: string) => value || '-',
                  },
                  {
                    title: 'Body',
                    dataIndex: 'body',
                    render: (value: string) => (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{String(value || '')}</pre>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'delivery',
            label: '投递日志',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                rowKey="id"
                loading={detail.deliveryLogsQuery.isLoading}
                dataSource={detail.deliveryLogsQuery.data ?? []}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '时间', dataIndex: 'createdAt', render: formatDateTime },
                  {
                    title: '渠道',
                    dataIndex: 'channelId',
                    render: (value: string) => value || '-',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: string) => <StatusTag value={value} />,
                  },
                  { title: '摘要', dataIndex: 'summary', render: (value: string) => value || '-' },
                  {
                    title: '元数据',
                    dataIndex: 'metadata',
                    render: (value: AlertDeliveryMetadata) => (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {stringifyAlertPayload(value)}
                      </pre>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'raw',
            label: '原始载荷',
            children: (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {[
                  ['Labels', event?.labels],
                  ['Annotations', event?.annotations],
                  ['Rule JSON', rule],
                  ['Event JSON', event],
                ].map(([title, value]) => (
                  <Card size="small" title={title as string} key={title as string}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {stringifyAlertPayload(value)}
                    </pre>
                  </Card>
                ))}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="发起自愈"
        open={detail.healOpen}
        onCancel={() => detail.setHealOpen(false)}
        onOk={detail.heal}
        okButtonProps={{
          disabled: !detail.healingPolicyId,
          loading: detail.healMutation.isPending,
        }}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择自愈策略"
          value={detail.healingPolicyId || undefined}
          onChange={(value) => detail.setHealingPolicyId(String(value))}
          options={(detail.healingPoliciesQuery.data ?? [])
            .filter((item) => item.enabled && rule?.healingPolicyIds?.includes(item.id))
            .map((item) => ({ value: item.id, label: item.name }))}
        />
      </Modal>
    </div>
  )
}

function AlertEventDetailActions({
  detail,
  extra,
}: {
  detail: DetailController
  extra?: ReactNode
}) {
  const navigate = useNavigate()
  const { event, rule } = detail
  const search = new URLSearchParams()
  search.set('timeRangeMinutes', '60')
  if (event) {
    search.set('alertId', event.id)
    if (event.clusterId) search.set('clusterId', event.clusterId)
    if (event.namespace) search.set('namespace', event.namespace)
    const workload =
      event.labels?.workload ||
      event.labels?.deployment ||
      event.labels?.app ||
      event.labels?.service
    if (workload) search.set('workload', workload)
  }
  return (
    <Space wrap>
      {extra}
      <Button onClick={() => navigate(getAIWorkbenchPathForMode('root_cause', search))}>
        AI 调查
      </Button>
      {detail.canAcknowledge && alertDisplayStatus(event) !== 'acknowledged' ? (
        <Button loading={detail.acknowledgeMutation.isPending} onClick={detail.acknowledge}>
          确认
        </Button>
      ) : null}
      {detail.canManageAlerts && alertDisplayStatus(event) !== 'resolved' ? (
        <Button loading={detail.resolveMutation.isPending} onClick={detail.resolve}>
          恢复
        </Button>
      ) : null}
      {detail.canHeal && (rule?.healingPolicyIds?.length ?? 0) > 0 ? (
        <Button type="primary" onClick={detail.openHealModal}>
          发起自愈
        </Button>
      ) : null}
    </Space>
  )
}

export function AlertEventDetailPageContent({
  eventId,
  onBack,
}: {
  eventId: string
  onBack: () => void
}) {
  const detail = useAlertEventDetailController(eventId, eventId !== '')
  const event = detail.event
  const workload =
    event?.labels?.workload ||
    event?.labels?.deployment ||
    event?.labels?.app ||
    event?.labels?.service
  useAIPageContext({
    sourceWorkbench: 'monitoring',
    sourceTitle: event?.title || '告警事件详情',
    entityKind: 'monitoring.alert',
    entityName: event?.title || eventId,
    alertId: event?.id || eventId,
    clusterId: event?.clusterId,
    namespace: event?.namespace,
    workload,
    service: event?.labels?.service,
    timeRangeMinutes: 60,
    pinnedData: {
      severity: event?.severity,
      status: alertDisplayStatus(event),
      sourceType: event?.sourceType,
      sourceSystem: event?.sourceSystem,
      startsAt: event?.startsAt,
      lastSeenAt: event?.lastSeenAt,
    },
    promptHint: `排查告警 ${event?.title || eventId} 的触发原因、影响范围、关联资源和恢复建议。`,
  })
  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={event?.title || '告警事件详情'}
        description={
          event
            ? `${event.sourceSystem || event.sourceType} · ${event.status}`
            : '查看告警事件、规则运行、自愈与通知链路'
        }
        actions={
          <AlertEventDetailActions
            detail={detail}
            extra={<Button onClick={onBack}>返回列表</Button>}
          />
        }
      />
      <AlertEventDetailBody detail={detail} />
    </div>
  )
}

export function AlertEventDetailPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  return (
    <AlertEventDetailPageContent
      eventId={eventId}
      onBack={() => navigate('/monitoring-workbench/alerts')}
    />
  )
}

export function AlertEventDetailDrawer({
  eventId,
  open,
  onClose,
  onOpenStandalone,
}: {
  eventId: string
  open: boolean
  onClose: () => void
  onOpenStandalone: (eventId: string) => void
}) {
  const detail = useAlertEventDetailController(eventId, open && eventId !== '')
  return (
    <Drawer
      data-testid="alert-event-drawer"
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="large"
      title={detail.event?.title || '告警事件详情'}
      extra={
        <AlertEventDetailActions
          detail={detail}
          extra={<Button onClick={() => onOpenStandalone(eventId)}>在详情页打开</Button>}
        />
      }
    >
      {eventId ? (
        <>
          <Paragraph type="secondary" style={{ marginTop: 0 }}>
            {detail.event
              ? `${detail.event.sourceSystem || detail.event.sourceType} · ${detail.event.status}`
              : '查看告警事件、规则运行、自愈与通知链路'}
          </Paragraph>
          <AlertEventDetailBody detail={detail} inDrawer />
        </>
      ) : (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          description="请选择一条告警事件。"
        />
      )}
    </Drawer>
  )
}
