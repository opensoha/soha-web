import { lazy, Suspense, useState } from 'react'
import {
  AlertOutlined,
  BellOutlined,
  EyeOutlined,
  FireOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { App, Modal, Select, Space } from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  encodeAIContextForElement,
  getAIWorkbenchPathForMode,
  useAIPageContext,
} from '@/features/copilot'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import { alertDisplayStatus } from './model'
import { observabilityAlertMutations } from './mutations'
import { observabilityAlertQueries } from './queries'
import type { AlertEvent } from './types'

const AlertEventDetailDrawer = lazy(async () => {
  const module = await import('./detail-page')
  return { default: module.AlertEventDetailDrawer }
})

export function AlertsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canAcknowledge = hasPermission(permissionSnapshotQuery.data?.data, 'observe.alerts.ack')
  const canResolve = hasPermission(permissionSnapshotQuery.data?.data, 'observe.alerts.manage')
  const canHeal = hasPermission(permissionSnapshotQuery.data?.data, 'observe.healing.manage')
  const [healOpen, setHealOpen] = useState(false)
  const [healingPolicyId, setHealingPolicyId] = useState('')
  const [selectedAlertId, setSelectedAlertId] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEventId, setDetailEventId] = useState('')

  const alertsQuery = useQuery(observabilityAlertQueries.list())
  const healingPoliciesQuery = useQuery({
    ...observabilityAlertQueries.healingPolicies(),
    enabled: canHeal,
  })
  const alerts = alertsQuery.data ?? []
  useAIPageContext({
    sourceWorkbench: 'monitoring',
    sourceTitle: '活跃告警',
    entityKind: 'monitoring.alert.list',
    entityName: 'Alerts',
    timeRangeMinutes: 60,
    pinnedData: {
      total: alerts.length,
      firing: alerts.filter((item) => alertDisplayStatus(item) !== 'resolved').length,
    },
    promptHint: '分析当前活跃告警的严重程度、范围、来源系统和最近命中趋势。',
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

  const columns: TableProps<AlertEvent>['columns'] = [
    { title: '名称', dataIndex: 'title' },
    {
      ...tableColumnPresets.status,
      title: '严重程度',
      dataIndex: 'severity',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (_: string, record) => <StatusTag value={alertDisplayStatus(record)} />,
    },
    {
      title: '来源',
      dataIndex: 'sourceSystem',
      render: (value: string, record) => value || record.sourceType || '-',
    },
    {
      title: '范围',
      dataIndex: 'namespace',
      render: (value: string, record) =>
        [record.clusterId, value].filter(Boolean).join(' / ') || '-',
    },
    { title: '消息', dataIndex: 'summary', ellipsis: true },
    {
      ...tableColumnPresets.datetime,
      title: '触发时间',
      dataIndex: 'startsAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近命中',
      dataIndex: 'lastSeenAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record) => (
        <Space className="soha-row-action-icons" size={2}>
          <ManagementIconButton
            aria-label="发起 AI 调查"
            icon={<AlertOutlined />}
            size="small"
            tooltip="AI调查"
            onClick={() => {
              const search = new URLSearchParams()
              search.set('alertId', record.id)
              search.set('timeRangeMinutes', '60')
              if (record.clusterId) search.set('clusterId', record.clusterId)
              if (record.namespace) search.set('namespace', record.namespace)
              navigate(getAIWorkbenchPathForMode('root_cause', search))
            }}
          />
          <ManagementIconButton
            aria-label="查看告警详情"
            icon={<EyeOutlined />}
            size="small"
            tooltip="详情"
            onClick={() => {
              setDetailEventId(record.id)
              setDetailOpen(true)
            }}
          />
          {canHeal ? (
            <ManagementIconButton
              aria-label="触发自愈"
              icon={<FireOutlined />}
              size="small"
              tooltip="自愈"
              onClick={() => {
                setSelectedAlertId(record.id)
                setHealingPolicyId('')
                setHealOpen(true)
              }}
            />
          ) : null}
          {canAcknowledge && alertDisplayStatus(record) !== 'acknowledged' ? (
            <ManagementIconButton
              aria-label="确认告警"
              icon={<BellOutlined />}
              size="small"
              tooltip="确认"
              onClick={() =>
                acknowledgeMutation.mutate(record.id, {
                  onSuccess: () => message.success('告警已确认'),
                })
              }
            />
          ) : null}
          {canResolve && alertDisplayStatus(record) !== 'resolved' ? (
            <ManagementIconButton
              aria-label="恢复告警"
              icon={<ReloadOutlined />}
              size="small"
              tooltip="恢复"
              onClick={() =>
                resolveMutation.mutate(record.id, {
                  onSuccess: () => message.success('告警已恢复'),
                })
              }
            />
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <AdminTable
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        title="活跃告警"
        columns={columns}
        dataSource={alerts}
        rowKey="id"
        onRow={(record: AlertEvent) => ({
          'data-ai-context': encodeAIContextForElement({
            sourceWorkbench: 'monitoring',
            sourceRoute: `/monitoring-workbench/alerts/${record.id}`,
            sourceTitle: record.title,
            entityKind: 'monitoring.alert',
            entityName: record.title,
            alertId: record.id,
            clusterId: record.clusterId,
            namespace: record.namespace,
            timeRangeMinutes: 60,
          }),
        })}
        loading={alertsQuery.isLoading}
        pageSize={20}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="发起自愈"
        open={healOpen}
        onCancel={() => setHealOpen(false)}
        onOk={() =>
          healMutation.mutate(
            { eventId: selectedAlertId, policyId: healingPolicyId },
            {
              onSuccess: () => {
                message.success('自愈运行已创建')
                setHealOpen(false)
              },
            },
          )
        }
        okButtonProps={{ disabled: !healingPolicyId, loading: healMutation.isPending }}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择自愈策略"
          value={healingPolicyId || undefined}
          onChange={(value) => setHealingPolicyId(String(value))}
          options={(healingPoliciesQuery.data ?? [])
            .filter((item) => item.enabled)
            .map((item) => ({ value: item.id, label: item.name }))}
        />
      </Modal>
      {detailOpen ? (
        <Suspense fallback={null}>
          <AlertEventDetailDrawer
            eventId={detailEventId}
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            onOpenStandalone={(eventId) => {
              setDetailOpen(false)
              navigate(`/monitoring-workbench/alerts/${eventId}`)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
