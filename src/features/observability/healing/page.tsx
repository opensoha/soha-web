import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReleaseDagDefinition } from '@/components/release-flow-dag-definition'
import { AdminTable } from '@/components/admin-table'
import { ManagementDetailHeader, ManagementIconButton } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import { buildHealingPolicyPayload } from './model'
import { observabilityHealingMutations } from './mutations'
import { observabilityHealingQueries } from './queries'
import type { HealingPolicy, HealingPolicyFormValues, HealingRun } from './types'

const { Paragraph } = Typography
const HealingDagEditor = lazy(() => import('./editor'))

export function HealingPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageHealing = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.healing.manage',
  )
  const [form] = Form.useForm<HealingPolicyFormValues>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealingPolicy | null>(null)
  const [definition, setDefinition] = useState<ReleaseDagDefinition>()
  const policiesQuery = useQuery(observabilityHealingQueries.policies())
  const runsQuery = useQuery(observabilityHealingQueries.runs())
  const mutationError = (error: Error) => message.error(error.message)
  const createMutation = useMutation({
    ...observabilityHealingMutations.createPolicy(queryClient),
    onError: mutationError,
  })
  const updateMutation = useMutation({
    ...observabilityHealingMutations.updatePolicy(queryClient),
    onError: mutationError,
  })
  const approveMutation = useMutation({
    ...observabilityHealingMutations.approveRun(queryClient),
    onError: mutationError,
  })
  const rejectMutation = useMutation({
    ...observabilityHealingMutations.rejectRun(queryClient),
    onError: mutationError,
  })
  const retryMutation = useMutation({
    ...observabilityHealingMutations.retryRun(queryClient),
    onError: mutationError,
  })

  function openEditor(record: HealingPolicy | null) {
    setEditing(record)
    setOpen(true)
    const defaults = record ?? {
      id: '',
      name: '',
      triggerMode: 'approval_then_auto',
      workflowTemplateId: '',
      approvalPolicyRef: '',
      cooldownSeconds: 300,
      concurrencyKey: '',
      safetyWindowSeconds: 600,
      enabled: true,
      definition: undefined,
    }
    setDefinition(defaults.definition)
    form.setFieldsValue({
      name: defaults.name,
      triggerMode: defaults.triggerMode,
      workflowTemplateId: defaults.workflowTemplateId,
      approvalPolicyRef: defaults.approvalPolicyRef,
      cooldownSeconds: defaults.cooldownSeconds,
      concurrencyKey: defaults.concurrencyKey,
      safetyWindowSeconds: defaults.safetyWindowSeconds,
      enabled: defaults.enabled,
    })
  }

  function submit(values: HealingPolicyFormValues) {
    if (!definition) {
      message.warning('自愈 DAG 尚未加载完成')
      return
    }
    const payload = buildHealingPolicyPayload(values, definition)
    const onSuccess = () => {
      message.success(editing ? '自愈策略已更新' : '自愈策略已保存')
      setOpen(false)
      setEditing(null)
    }
    if (editing) updateMutation.mutate({ id: editing.id, payload }, { onSuccess })
    else createMutation.mutate(payload, { onSuccess })
  }

  const updateDefinition = useCallback((next: ReleaseDagDefinition) => {
    setDefinition(next)
  }, [])

  const runColumns: TableProps<HealingRun>['columns'] = useMemo(
    () => [
      { title: '运行ID', dataIndex: 'id' },
      { title: '策略', dataIndex: 'policyId' },
      { title: '事件', dataIndex: 'eventId' },
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
        render: (value: string, record) =>
          value ? <StatusTag value={value} /> : record.workflowRunId || '-',
      },
      {
        title: '审批人',
        dataIndex: 'approvedBy',
        render: (value: string) => value || '-',
      },
      {
        title: '执行摘要',
        dataIndex: 'workflowSummary',
        render: (value: string) => value || '-',
      },
      { title: '创建时间', dataIndex: 'createdAt', render: formatDateTime },
      {
        title: '操作',
        dataIndex: 'id',
        render: (value: string, record) => (
          <Space>
            {canManageHealing ? (
              <>
                <Button
                  size="small"
                  icon={<CheckOutlined />}
                  disabled={['completed', 'rejected'].includes(record.status)}
                  onClick={() =>
                    approveMutation.mutate(
                      { id: value, comment: 'approved from console' },
                      { onSuccess: () => message.success('已审批通过') },
                    )
                  }
                >
                  通过
                </Button>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  disabled={['completed', 'rejected'].includes(record.status)}
                  onClick={() =>
                    rejectMutation.mutate(
                      { id: value, comment: 'rejected from console' },
                      { onSuccess: () => message.success('已拒绝') },
                    )
                  }
                >
                  拒绝
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() =>
                    retryMutation.mutate(value, {
                      onSuccess: () => message.success('已重试'),
                    })
                  }
                >
                  重试
                </Button>
              </>
            ) : null}
          </Space>
        ),
      },
    ],
    [approveMutation, canManageHealing, message, rejectMutation, retryMutation],
  )

  const policyColumns: TableProps<HealingPolicy>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '触发模式',
      dataIndex: 'triggerMode',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: '工作流模板', dataIndex: 'workflowTemplateId' },
    {
      title: '审批策略',
      dataIndex: 'approvalPolicyRef',
      render: (value: string) => value || '-',
    },
    { title: '冷却(s)', dataIndex: 'cooldownSeconds' },
    { title: '安全窗(s)', dataIndex: 'safetyWindowSeconds' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    {
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) =>
        canManageHealing ? (
          <ManagementIconButton
            aria-label="编辑自愈策略"
            size="small"
            tooltip="编辑"
            icon={<EditOutlined />}
            onClick={() => openEditor(record)}
          />
        ) : null,
    },
  ]

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="自愈中心"
        description="维护自愈策略和审批运行记录，策略定义复用 DAG 编辑器。"
        actions={
          canManageHealing ? (
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor(null)}>
              新建自愈策略
            </Button>
          ) : null
        }
      />
      <Card>
        <Paragraph type="secondary" className="mb-0">
          自愈策略以 `approval_then_auto`
          为默认触发模式，审批通过后由运行记录推进。当前版本先做策略和审批台，执行可在后续接入工作流执行器。
        </Paragraph>
      </Card>
      <AdminTable
        shellClassName="soha-management-table-shell"
        columns={policyColumns}
        dataSource={policiesQuery.data ?? []}
        rowKey="id"
        loading={policiesQuery.isLoading}
      />
      <Card className="soha-overview-panel-card" title="自愈运行">
        <AdminTable
          shellClassName="soha-management-table-shell"
          columns={runColumns}
          dataSource={runsQuery.data ?? []}
          rowKey="id"
          loading={runsQuery.isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑自愈策略' : '新建自愈策略'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
        }}
        footer={null}
        width={1180}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={submit}
          initialValues={{
            triggerMode: 'approval_then_auto',
            cooldownSeconds: 300,
            safetyWindowSeconds: 600,
            enabled: true,
          }}
        >
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="triggerMode" label="触发模式" style={{ width: 240 }}>
              <Select
                options={[
                  { value: 'approval_then_auto', label: '审批后自动' },
                  { value: 'manual', label: '仅手动' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="workflowTemplateId"
              label="工作流模板 ID"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="approvalPolicyRef" label="审批策略引用" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="concurrencyKey" label="并发键" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="cooldownSeconds" label="冷却(s)" style={{ width: 180 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="safetyWindowSeconds" label="安全窗(s)" style={{ width: 180 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Card title="自愈 DAG" size="small">
            <Suspense fallback={<Card loading variant="borderless" />}>
              <HealingDagEditor initialDefinition={definition} onChange={updateDefinition} />
            </Suspense>
          </Card>
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!definition}
            >
              保存
            </Button>
            <Button onClick={() => setOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
