import { useState } from 'react'
import { EditOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
import { AdminTable } from '@/components/admin-table'
import { ManagementDetailHeader, ManagementIconButton } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import { buildAlertRulePayload, prettyObservabilityJson } from './model'
import { observabilityRuleMutations } from './mutations'
import { observabilityRuleQueries } from './queries'
import type {
  AlertRule,
  AlertRuleDatasourceSelector,
  AlertRuleFormValues,
  AlertRuleTestResult,
} from './types'

const { Paragraph, Text } = Typography

export function AlertRulesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageRules = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.alert-rules.manage',
  )
  const [form] = Form.useForm<AlertRuleFormValues>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AlertRule | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testResult, setTestResult] = useState<AlertRuleTestResult | null>(null)
  const [runsOpen, setRunsOpen] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState('')

  const rulesQuery = useQuery(observabilityRuleQueries.list())
  const notificationPoliciesQuery = useQuery(observabilityRuleQueries.notificationPolicies())
  const healingPoliciesQuery = useQuery(observabilityRuleQueries.healingPolicies())
  const ruleRunsQuery = useQuery({
    ...observabilityRuleQueries.runs(selectedRuleId),
    enabled: runsOpen && selectedRuleId !== '',
  })
  const mutationError = (error: Error) => message.error(error.message)
  const createMutation = useMutation({
    ...observabilityRuleMutations.create(queryClient),
    onError: mutationError,
  })
  const updateMutation = useMutation({
    ...observabilityRuleMutations.update(queryClient),
    onError: mutationError,
  })
  const testMutation = useMutation({
    ...observabilityRuleMutations.test(),
    onError: mutationError,
  })

  function openEditor(record: AlertRule | null) {
    setEditing(record)
    setOpen(true)
    const defaults = record ?? {
      id: '',
      name: '',
      ruleType: 'metrics',
      datasourceSelector: {},
      querySpec: { metricKey: 'cpu_usage', windowMinutes: 60, stepSeconds: 60 },
      thresholdSpec: { sampleLimit: 20 },
      forSeconds: 60,
      groupBy: [],
      labels: {},
      annotations: {},
      notificationPolicyId: '',
      healingPolicyIds: [],
      enabled: true,
      createdAt: '',
      updatedAt: '',
    }
    form.setFieldsValue({
      name: defaults.name,
      ruleType: defaults.ruleType,
      datasourceSelector: prettyObservabilityJson(defaults.datasourceSelector),
      querySpec: prettyObservabilityJson(defaults.querySpec),
      thresholdSpec: prettyObservabilityJson(defaults.thresholdSpec),
      forSeconds: defaults.forSeconds,
      groupBy: (defaults.groupBy ?? []).join(', '),
      labels: prettyObservabilityJson(defaults.labels),
      annotations: prettyObservabilityJson(defaults.annotations),
      notificationPolicyId: defaults.notificationPolicyId,
      healingPolicyIds: defaults.healingPolicyIds ?? [],
      enabled: defaults.enabled,
    })
  }

  function closeEditor(label: string) {
    message.success(label)
    setOpen(false)
    setEditing(null)
  }

  function submit(values: AlertRuleFormValues) {
    try {
      const payload = buildAlertRulePayload(values)
      if (editing) {
        updateMutation.mutate(
          { id: editing.id, payload },
          { onSuccess: () => closeEditor('告警规则已更新') },
        )
      } else {
        createMutation.mutate(payload, {
          onSuccess: () => closeEditor('告警规则已保存'),
        })
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function testRule(record: AlertRule, values = buildAlertRulePayload(record)) {
    testMutation.mutate(
      { id: record.id, payload: values },
      {
        onSuccess: (result) => {
          setTestResult(result)
          setTestOpen(true)
          message.success('规则测试已执行')
        },
      },
    )
  }

  const columns: TableProps<AlertRule>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'ruleType', render: (value: string) => <Tag>{value}</Tag> },
    {
      title: '数据源',
      dataIndex: 'datasourceSelector',
      render: (value: AlertRuleDatasourceSelector) => (
        <Text code>{prettyObservabilityJson(value)}</Text>
      ),
    },
    {
      title: '通知策略',
      dataIndex: 'notificationPolicyId',
      render: (value: string) => value || '-',
    },
    {
      title: '自愈策略',
      dataIndex: 'healingPolicyIds',
      render: (value: string[]) => (
        <Space wrap>
          {(value ?? []).map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Space>
      ),
    },
    { title: '持续(s)', dataIndex: 'forSeconds' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    { title: '更新时间', dataIndex: 'updatedAt', render: formatDateTime },
    {
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) => (
        <Space className="soha-row-action-icons" size={2}>
          <ManagementIconButton
            aria-label="测试告警规则"
            size="small"
            tooltip="测试"
            icon={<PlayCircleOutlined />}
            onClick={() => testRule(record)}
          />
          <ManagementIconButton
            aria-label="查看运行记录"
            size="small"
            tooltip="运行记录"
            icon={<ReloadOutlined />}
            onClick={() => {
              setSelectedRuleId(record.id)
              setRunsOpen(true)
            }}
          />
          {canManageRules ? (
            <ManagementIconButton
              aria-label="编辑告警规则"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => openEditor(record)}
            />
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="告警规则"
        description="按数据源、查询和阈值创建规则，并绑定通知策略与自愈策略。"
        actions={
          canManageRules ? (
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor(null)}>
              新建规则
            </Button>
          ) : null
        }
      />
      <Card>
        <Paragraph type="secondary" className="mb-0">
          规则支持 `metrics` / `logs` / `traces` /
          `external_passthrough`。测试会按选择的数据源执行一次预览查询。
        </Paragraph>
      </Card>
      <AdminTable
        shellClassName="soha-management-table-shell"
        columns={columns}
        dataSource={rulesQuery.data ?? []}
        rowKey="id"
        loading={rulesQuery.isLoading}
      />

      <Modal
        title={editing ? '编辑告警规则' : '新建告警规则'}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={submit}
          initialValues={{ ruleType: 'metrics', forSeconds: 60, groupBy: '', enabled: true }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="ruleType" label="规则类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'metrics', label: 'Metrics' },
                { value: 'logs', label: 'Logs' },
                { value: 'traces', label: 'Traces' },
                { value: 'external_passthrough', label: 'External passthrough' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="datasourceSelector"
            label="数据源选择器(JSON)"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="querySpec" label="查询定义(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="thresholdSpec" label="阈值定义(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="groupBy" label="分组标签(逗号分隔)">
            <Input />
          </Form.Item>
          <Form.Item name="labels" label="事件标签(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="annotations" label="事件注释(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="forSeconds" label="持续时间(s)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="notificationPolicyId" label="通知策略" style={{ flex: 1 }}>
              <Select
                allowClear
                options={(notificationPoliciesQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Form.Item>
          </Space>
          <Form.Item name="healingPolicyIds" label="自愈策略">
            <Select
              mode="multiple"
              allowClear
              options={(healingPoliciesQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              保存
            </Button>
            <Button onClick={() => setOpen(false)}>取消</Button>
            {editing ? (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  try {
                    testRule(editing, buildAlertRulePayload(form.getFieldsValue()))
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : '规则测试失败')
                  }
                }}
              >
                测试
              </Button>
            ) : null}
          </Space>
        </Form>
      </Modal>

      <Modal
        title="规则测试结果"
        open={testOpen}
        onCancel={() => setTestOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          {['summary', 'matched', 'dataSources', 'samples', 'notificationPreview'].map((key) => (
            <Card size="small" title={key} key={key}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(testResult?.[key] ?? (key === 'matched' ? false : '-'), null, 2)}
              </pre>
            </Card>
          ))}
        </Space>
      </Modal>

      <Modal
        title="最近运行记录"
        open={runsOpen}
        onCancel={() => setRunsOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <AdminTable
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
            { title: '摘要', dataIndex: 'summary' },
            { title: '错误', dataIndex: 'error', render: (value: string) => value || '-' },
            { title: '时间', dataIndex: 'createdAt', render: formatDateTime },
          ]}
          dataSource={ruleRunsQuery.data ?? []}
          rowKey="id"
          loading={ruleRunsQuery.isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  )
}
