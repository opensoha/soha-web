import { useState } from 'react'
import { CopyOutlined, EditOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import {
  alertIntegrationSamplePayload,
  alertIntegrationTypeLabel,
  alertIntegrationTypeOptions,
  buildAlertIntegrationPayload,
  buildAlertIntegrationTestPayload,
  buildWebhookURL,
  prettyObservabilityJson,
} from './model'
import { invalidateAlertIntegrations, observabilityIntegrationMutations } from './mutations'
import { observabilityIntegrationQueries } from './queries'
import type {
  AlertIntegration,
  AlertIntegrationFormValues,
  AlertIntegrationTestFormValues,
  AlertIntegrationTestResult,
} from './types'

const { Text } = Typography

export function AlertIntegrationsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageIntegrations = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.alert-integrations.manage',
  )
  const [editorForm] = Form.useForm<AlertIntegrationFormValues>()
  const [testForm] = Form.useForm<AlertIntegrationTestFormValues>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<AlertIntegration | null>(null)
  const [createdSecret, setCreatedSecret] = useState<AlertIntegration | null>(null)
  const [testResult, setTestResult] = useState<AlertIntegrationTestResult | null>(null)

  const integrationsQuery = useQuery(observabilityIntegrationQueries.list())
  const createIntegration = useMutation({
    ...observabilityIntegrationMutations.create(queryClient),
    onSuccess: async (integration) => {
      await invalidateAlertIntegrations(queryClient)
      message.success('告警集成已创建')
      setEditorOpen(false)
      setEditingIntegration(null)
      if (integration.token) setCreatedSecret(integration)
    },
    onError: (error) => message.error(error.message),
  })
  const updateIntegration = useMutation({
    ...observabilityIntegrationMutations.update(queryClient),
    onSuccess: async (integration) => {
      await invalidateAlertIntegrations(queryClient)
      message.success('告警集成已更新')
      setEditorOpen(false)
      setEditingIntegration(null)
      if (integration.token) setCreatedSecret(integration)
    },
    onError: (error) => message.error(error.message),
  })
  const testIntegration = useMutation({
    ...observabilityIntegrationMutations.test(),
    onSuccess: (result) => {
      setTestResult(result)
      message.success('Payload 已归一化')
    },
    onError: (error) => message.error(error.message),
  })

  function copyText(value: string, label: string) {
    const text = value.trim()
    if (!text || !navigator.clipboard) {
      message.warning(`${label}不可复制`)
      return
    }
    navigator.clipboard.writeText(text).then(
      () => message.success(`${label}已复制`),
      () => message.error('复制失败'),
    )
  }

  function openEditor(record: AlertIntegration | null) {
    setEditingIntegration(record)
    setEditorOpen(true)
    editorForm.setFieldsValue(
      record
        ? {
            id: record.id,
            name: record.name,
            integrationType: record.integrationType,
            description: record.description || '',
            token: '',
            labelMapping: prettyObservabilityJson(record.labelMapping ?? {}),
            dedupeConfig: prettyObservabilityJson(record.dedupeConfig ?? {}),
            enabled: record.enabled,
          }
        : {
            id: '',
            name: '',
            integrationType: 'alertmanager_v1',
            description: '',
            token: '',
            labelMapping:
              '{\n  "clusterId": "cluster",\n  "namespace": "namespace",\n  "service": "service",\n  "role": "role"\n}',
            dedupeConfig:
              '{\n  "fingerprintLabels": ["alertname", "cluster", "namespace", "service"]\n}',
            enabled: true,
          },
    )
  }

  function openTest(record?: AlertIntegration) {
    const integrationType = record?.integrationType || 'alertmanager_v1'
    setTestResult(null)
    setTestOpen(true)
    testForm.setFieldsValue({
      integrationType,
      labelMapping: prettyObservabilityJson(record?.labelMapping ?? {}),
      dedupeConfig: prettyObservabilityJson(record?.dedupeConfig ?? {}),
      payload: alertIntegrationSamplePayload(integrationType),
    })
  }

  function submitEditor(values: AlertIntegrationFormValues) {
    try {
      const payload = buildAlertIntegrationPayload(values)
      if (editingIntegration?.id) {
        updateIntegration.mutate({ id: editingIntegration.id, payload })
        return
      }
      createIntegration.mutate(payload)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function submitTest(values: AlertIntegrationTestFormValues) {
    try {
      testIntegration.mutate(buildAlertIntegrationTestPayload(values))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '测试失败')
    }
  }

  const columns: TableProps<AlertIntegration>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 220,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{value || record.id}</Text>
          <Text type="secondary" className="text-xs">
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: '来源类型',
      dataIndex: 'integrationType',
      width: 180,
      render: (value: string) => <Tag>{alertIntegrationTypeLabel(value)}</Tag>,
    },
    {
      title: 'Webhook',
      dataIndex: 'webhookPath',
      width: 360,
      ellipsis: true,
      render: (value: string) => {
        const webhookURL = buildWebhookURL(value)
        return webhookURL ? (
          <Space size={4}>
            <Text code ellipsis style={{ maxWidth: 290 }}>
              {webhookURL}
            </Text>
            <ManagementIconButton
              aria-label="复制 Webhook 地址"
              icon={<CopyOutlined />}
              size="small"
              tooltip="复制地址"
              onClick={() => copyText(webhookURL, 'Webhook 地址')}
            />
          </Space>
        ) : (
          '-'
        )
      },
    },
    {
      title: 'Token',
      dataIndex: 'tokenPreview',
      width: 140,
      render: (value: string) => (value ? <Text code>{value}</Text> : '-'),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value: string, record) => (
        <Space size={4}>
          <StatusTag value={value || 'pending'} />
          <BooleanTag value={record.enabled} trueLabel="启用" falseLabel="禁用" />
        </Space>
      ),
    },
    {
      title: '最近接收',
      dataIndex: 'lastReceivedAt',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '错误',
      dataIndex: 'lastError',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) => (
        <Space className="soha-row-action-icons" size={2}>
          <ManagementIconButton
            aria-label="测试告警集成"
            icon={<ExperimentOutlined />}
            size="small"
            tooltip="测试"
            onClick={() => openTest(record)}
          />
          <ManagementIconButton
            aria-label="复制 Webhook 地址"
            icon={<CopyOutlined />}
            size="small"
            tooltip="复制地址"
            onClick={() => copyText(buildWebhookURL(record.webhookPath), 'Webhook 地址')}
          />
          {canManageIntegrations ? (
            <ManagementIconButton
              aria-label="编辑告警集成"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
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
        title="告警集成"
        description="接入 Alertmanager、Grafana Alerting 和第三方 Webhook，并归一化为 Soha 告警事件。"
        actions={
          canManageIntegrations ? (
            <ManagementTableToolbar>
              <Button icon={<ExperimentOutlined />} onClick={() => openTest()}>
                测试 Payload
              </Button>
              <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor(null)}>
                新建集成
              </Button>
            </ManagementTableToolbar>
          ) : null
        }
      />
      <AdminTable
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        columns={columns}
        dataSource={integrationsQuery.data ?? []}
        empty={<ManagementState bordered={false} compact description="暂无告警集成" />}
        rowKey="id"
        loading={integrationsQuery.isLoading}
        pageSize={20}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingIntegration ? '编辑告警集成' : '新建告警集成'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        footer={null}
        destroyOnHidden
        width={820}
      >
        <Form
          layout="vertical"
          form={editorForm}
          onFinish={submitEditor}
          initialValues={{ integrationType: 'alertmanager_v1', enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="id" label="集成 ID" style={{ flex: 1 }}>
              <Input disabled={Boolean(editingIntegration)} placeholder="留空自动生成" />
            </Form.Item>
            <Form.Item
              name="integrationType"
              label="来源类型"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select options={alertIntegrationTypeOptions} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="token" label="Token">
            <Input.Password placeholder={editingIntegration ? '留空则不轮换' : '留空自动生成'} />
          </Form.Item>
          <Form.Item name="labelMapping" label="标签映射(JSON)">
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="dedupeConfig" label="去重配置(JSON)">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createIntegration.isPending || updateIntegration.isPending}
            >
              保存
            </Button>
            <Button onClick={() => setEditorOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="测试 Payload"
        open={testOpen}
        onCancel={() => setTestOpen(false)}
        footer={null}
        destroyOnHidden
        width={920}
      >
        <Form
          layout="vertical"
          form={testForm}
          onFinish={submitTest}
          initialValues={{ integrationType: 'alertmanager_v1' }}
        >
          <Form.Item name="integrationType" label="来源类型" rules={[{ required: true }]}>
            <Select
              options={alertIntegrationTypeOptions}
              onChange={(value) =>
                testForm.setFieldValue('payload', alertIntegrationSamplePayload(String(value)))
              }
            />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }} align="start">
            <Form.Item name="labelMapping" label="标签映射(JSON)" style={{ flex: 1 }}>
              <Input.TextArea rows={5} />
            </Form.Item>
            <Form.Item name="dedupeConfig" label="去重配置(JSON)" style={{ flex: 1 }}>
              <Input.TextArea rows={5} />
            </Form.Item>
          </Space>
          <Form.Item name="payload" label="Payload(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={10} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={testIntegration.isPending}>
              归一化测试
            </Button>
            <Button onClick={() => setTestOpen(false)}>关闭</Button>
          </Space>
        </Form>
        {testResult ? (
          <Input.TextArea
            style={{ marginTop: 16 }}
            rows={8}
            readOnly
            value={prettyObservabilityJson(testResult)}
          />
        ) : null}
      </Modal>

      <Modal
        title="集成 Token"
        open={Boolean(createdSecret)}
        onCancel={() => setCreatedSecret(null)}
        footer={
          <Button type="primary" onClick={() => setCreatedSecret(null)}>
            完成
          </Button>
        }
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Input readOnly value={createdSecret?.token || ''} />
          <Button
            icon={<CopyOutlined />}
            onClick={() => copyText(createdSecret?.token || '', 'Token')}
          >
            复制 Token
          </Button>
          <Text type="secondary">关闭后仅显示 Token 摘要。</Text>
        </Space>
      </Modal>
    </div>
  )
}
