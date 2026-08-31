import { useEffect, useRef, useState } from 'react'
import { EditOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton } from '@/components/management-list'
import { BooleanTag, MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import {
  alertRuleConditionSummary,
  alertRuleDashboardDraft,
  alertRuleFormValues,
  buildAlertRulePayload,
  prettyObservabilityJson,
} from './model'
import { observabilityRuleMutations } from './mutations'
import { observabilityRuleQueries } from './queries'
import type {
  AlertRule,
  AlertRuleDatasourceSelector,
  AlertRuleFormValues,
  AlertRuleTestResult,
} from './types'

const { Text } = Typography

export function AlertRulesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canManageRule = hasPermission(permissionSnapshot, 'observe.alert-rules.manage')
  const canTestRule = hasPermission(permissionSnapshot, 'observe.alert-rules.view')
  const [searchParams] = useSearchParams()
  const dashboardDraftOpened = useRef(false)
  const [form] = Form.useForm<AlertRuleFormValues>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AlertRule | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testResult, setTestResult] = useState<AlertRuleTestResult | null>(null)
  const [runsOpen, setRunsOpen] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const editorMode = Form.useWatch('mode', form) ?? 'simple'

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

  useEffect(() => {
    if (dashboardDraftOpened.current || !canManageRule) return
    const draft = alertRuleDashboardDraft(searchParams)
    if (!draft) return
    dashboardDraftOpened.current = true
    setEditing(null)
    form.setFieldsValue(draft)
    setOpen(true)
  }, [canManageRule, form, searchParams])

  function openEditor(record: AlertRule | null) {
    setEditing(record)
    setOpen(true)
    form.setFieldsValue(alertRuleFormValues(record))
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

  function testEditor() {
    try {
      const payload = buildAlertRulePayload(form.getFieldsValue())
      testRule(editing ?? ({ id: 'preview' } as AlertRule), payload)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '规则测试失败')
    }
  }

  const columns: TableProps<AlertRule>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'ruleType',
      render: (value: string) => <MetadataTag label={value} />,
    },
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
            <MetadataTag key={item} label={item} />
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
            disabled={!canTestRule}
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
          {canManageRule ? (
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
      <AdminTable
        title="告警规则"
        headerExtra={
          canManageRule ? (
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor(null)}>
              新建规则
            </Button>
          ) : null
        }
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
          initialValues={{ mode: 'simple', ruleType: 'metrics', forSeconds: 60, enabled: true }}
        >
          <Form.Item name="mode" label="配置模式">
            <Segmented
              block
              className="soha-form-segmented"
              options={[
                { value: 'simple', label: '普通' },
                { value: 'advanced', label: '高级' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input />
          </Form.Item>
          {editorMode === 'simple' ? (
            <>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  name="metricKey"
                  label="监控指标"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 220px' }}
                >
                  <Select
                    options={[
                      { value: 'cpu_usage', label: 'CPU 使用率' },
                      { value: 'memory_usage', label: '内存使用率' },
                      { value: 'restart_rate', label: '重启次数' },
                      { value: 'error_rate', label: '错误率' },
                      { value: 'latency_p95', label: 'P95 延迟' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="reducer"
                  label="取值"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 160px' }}
                >
                  <Select
                    options={[
                      { value: 'latest', label: '最新值' },
                      { value: 'average', label: '平均值' },
                      { value: 'max', label: '最大值' },
                      { value: 'min', label: '最小值' },
                      { value: 'sum', label: '总和' },
                      { value: 'count', label: '样本数' },
                    ]}
                  />
                </Form.Item>
              </Space>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  name="operator"
                  label="条件"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 180px' }}
                >
                  <Select
                    options={[
                      { value: 'gt', label: '大于' },
                      { value: 'gte', label: '大于等于' },
                      { value: 'lt', label: '小于' },
                      { value: 'lte', label: '小于等于' },
                      { value: 'eq', label: '等于' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="thresholdValue"
                  label="阈值"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 180px' }}
                >
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  name="windowMinutes"
                  label="查询窗口(分钟)"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 180px' }}
                >
                  <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Space>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item name="clusterId" label="集群" style={{ flex: '1 1 220px' }}>
                  <Input />
                </Form.Item>
                <Form.Item name="namespace" label="命名空间" style={{ flex: '1 1 220px' }}>
                  <Input />
                </Form.Item>
                <Form.Item name="workload" label="工作负载" style={{ flex: '1 1 220px' }}>
                  <Input />
                </Form.Item>
              </Space>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  name="severity"
                  label="严重级别"
                  rules={[{ required: true }]}
                  style={{ flex: '1 1 220px' }}
                >
                  <Select
                    options={[
                      { value: 'critical', label: '严重' },
                      { value: 'warning', label: '警告' },
                      { value: 'info', label: '提示' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="summary" label="告警摘要" style={{ flex: '2 1 360px' }}>
                  <Input />
                </Form.Item>
              </Space>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldsValue }) => (
                  <Alert
                    description={alertRuleConditionSummary(getFieldsValue(true))}
                    showIcon
                    title="条件说明"
                    type="info"
                  />
                )}
              </Form.Item>
            </>
          ) : (
            <>
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
            </>
          )}
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
            {canTestRule ? (
              <Button
                icon={<PlayCircleOutlined />}
                loading={testMutation.isPending}
                onClick={testEditor}
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
          <Alert
            type={
              testResult?.state === 'error' ? 'error' : testResult?.matched ? 'warning' : 'success'
            }
            showIcon
            title={
              <Space>
                <StatusTag value={String(testResult?.state ?? 'unknown')} />
                {String(testResult?.summary ?? '-')}
              </Space>
            }
          />
          {(
            [
              ['errors', testResult?.errors],
              ['dataSources', testResult?.dataSources],
              ['samples', testResult?.samples],
              ['notificationPreview', testResult?.notificationPreview],
              ['querySnapshot', testResult?.querySnapshot],
            ] as const
          ).map(([key, value]) => (
              <Card size="small" title={key} key={key}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(value ?? '-', null, 2)}
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
