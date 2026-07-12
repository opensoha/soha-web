import { useMemo, useState } from 'react'
import {
  BellOutlined,
  EditOutlined,
  EyeOutlined,
  NotificationOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import {
  buildNotificationChannelPayload,
  buildNotificationPolicyPayload,
  buildNotificationRoutePayload,
  buildNotificationSilencePayload,
  buildNotificationTemplatePayload,
  formatNotificationSilenceStatus,
  prettyNotificationJson,
  resolveChannelEndpoint,
  shortNotificationJson,
  stringifyNotificationMatchers,
} from './model'
import { observabilityNotificationMutations } from './mutations'
import { observabilityNotificationQueries } from './queries'
import type {
  NotificationChannel,
  NotificationChannelConfig,
  NotificationChannelFormValues,
  NotificationMatchers,
  NotificationPolicy,
  NotificationPolicyFormValues,
  NotificationPreviewItem,
  NotificationRoute,
  NotificationRouteFormValues,
  NotificationSilence,
  NotificationSilenceFormValues,
  NotificationTemplate,
  NotificationTemplateFormValues,
} from './types'

const { Text } = Typography

export function NotificationsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageNotifications = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.notifications.manage',
  )
  const [policyForm] = Form.useForm<NotificationPolicyFormValues>()
  const [templateForm] = Form.useForm<NotificationTemplateFormValues>()
  const [channelForm] = Form.useForm<NotificationChannelFormValues>()
  const [routeForm] = Form.useForm<NotificationRouteFormValues>()
  const [silenceForm] = Form.useForm<NotificationSilenceFormValues>()
  const [policyOpen, setPolicyOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [silenceOpen, setSilenceOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<NotificationPolicy | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [editingRoute, setEditingRoute] = useState<NotificationRoute | null>(null)
  const [editingSilence, setEditingSilence] = useState<NotificationSilence | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPolicy, setPreviewPolicy] = useState<NotificationPolicy | null>(null)
  const [previewEventId, setPreviewEventId] = useState('')
  const [previewItems, setPreviewItems] = useState<NotificationPreviewItem[]>([])

  const channelsQuery = useQuery(observabilityNotificationQueries.channels())
  const alertEventsQuery = useQuery(observabilityNotificationQueries.previewEvents())
  const policiesQuery = useQuery(observabilityNotificationQueries.policies())
  const templatesQuery = useQuery(observabilityNotificationQueries.templates())
  const routesQuery = useQuery(observabilityNotificationQueries.routes())
  const silencesQuery = useQuery(observabilityNotificationQueries.silences())
  const oncallSchedulesQuery = useQuery(observabilityNotificationQueries.oncallSchedules())
  const oncallPoliciesQuery = useQuery(observabilityNotificationQueries.oncallPolicies())

  const mutationError = (error: Error) => message.error(error.message)
  const createPolicy = useMutation({
    ...observabilityNotificationMutations.createPolicy(queryClient),
    onError: mutationError,
  })
  const updatePolicy = useMutation({
    ...observabilityNotificationMutations.updatePolicy(queryClient),
    onError: mutationError,
  })
  const createTemplate = useMutation({
    ...observabilityNotificationMutations.createTemplate(queryClient),
    onError: mutationError,
  })
  const updateTemplate = useMutation({
    ...observabilityNotificationMutations.updateTemplate(queryClient),
    onError: mutationError,
  })
  const createChannel = useMutation({
    ...observabilityNotificationMutations.createChannel(queryClient),
    onError: mutationError,
  })
  const updateChannel = useMutation({
    ...observabilityNotificationMutations.updateChannel(queryClient),
    onError: mutationError,
  })
  const createRoute = useMutation({
    ...observabilityNotificationMutations.createRoute(queryClient),
    onError: mutationError,
  })
  const updateRoute = useMutation({
    ...observabilityNotificationMutations.updateRoute(queryClient),
    onError: mutationError,
  })
  const createSilence = useMutation({
    ...observabilityNotificationMutations.createSilence(queryClient),
    onError: mutationError,
  })
  const updateSilence = useMutation({
    ...observabilityNotificationMutations.updateSilence(queryClient),
    onError: mutationError,
  })
  const previewMutation = useMutation({
    ...observabilityNotificationMutations.preview(),
    onError: mutationError,
  })

  const channelNamesById = useMemo(
    () => Object.fromEntries((channelsQuery.data ?? []).map((item) => [item.id, item.name])),
    [channelsQuery.data],
  )
  const oncallOptions = useMemo(
    () => [
      ...(oncallSchedulesQuery.data ?? []).map((item) => ({
        value: item.id,
        label: `值班表 · ${item.name}`,
      })),
      ...(oncallPoliciesQuery.data ?? []).map((item) => ({
        value: item.id,
        label: `升级策略 · ${item.name}`,
      })),
    ],
    [oncallPoliciesQuery.data, oncallSchedulesQuery.data],
  )
  const channelOptions = useMemo(
    () => (channelsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    [channelsQuery.data],
  )

  function openPolicyEditor(record: NotificationPolicy | null) {
    setEditingPolicy(record)
    setPolicyOpen(true)
    policyForm.setFieldsValue(
      record
        ? {
            ...record,
            matchers: prettyNotificationJson(record.matchers ?? {}),
            processorChain: record.processorChain ?? [],
            channelRefs: record.channelRefs ?? [],
          }
        : {
            name: '',
            matchers: '{}',
            processorChain: ['template_render', 'webhook_update'],
            channelRefs: [],
            oncallRef: '',
            sendResolved: false,
            cooldownSeconds: 0,
            enabled: true,
          },
    )
  }

  function openTemplateEditor(record: NotificationTemplate | null) {
    setEditingTemplate(record)
    setTemplateOpen(true)
    templateForm.setFieldsValue(
      record
        ? {
            ...record,
            headers: prettyNotificationJson(record.headers ?? {}),
            queryParams: prettyNotificationJson(record.queryParams ?? {}),
            samplePayload: prettyNotificationJson(record.samplePayload ?? {}),
          }
        : {
            name: '',
            templateType: 'generic_json',
            contentType: 'application/json',
            bodyTemplate: '{"alert":"{{ .alert.title }}"}',
            headers: '{}',
            queryParams: '{}',
            samplePayload: '{}',
            enabled: true,
          },
    )
  }

  function openChannelEditor(record: NotificationChannel | null) {
    setEditingChannel(record)
    setChannelOpen(true)
    channelForm.setFieldsValue(
      record
        ? { ...record, config: prettyNotificationJson(record.config ?? {}) }
        : {
            name: '',
            channelType: 'webhook',
            config: '{\n  "url": "https://example.com/webhook"\n}',
            enabled: true,
          },
    )
  }

  function openRouteEditor(record: NotificationRoute | null) {
    setEditingRoute(record)
    setRouteOpen(true)
    routeForm.setFieldsValue(
      record
        ? {
            ...record,
            matchers: prettyNotificationJson(record.matchers ?? {}),
            channelIds: record.channelIds ?? [],
          }
        : {
            name: '',
            matchers: '{\n  "severity": "critical"\n}',
            channelIds: [],
            enabled: true,
          },
    )
  }

  function openSilenceEditor(record: NotificationSilence | null) {
    setEditingSilence(record)
    setSilenceOpen(true)
    const now = Date.now()
    silenceForm.setFieldsValue(
      record
        ? { ...record, matchers: prettyNotificationJson(record.matchers ?? {}) }
        : {
            name: '',
            matchers: '{\n  "severity": "warning"\n}',
            reason: '',
            startsAt: new Date(now).toISOString(),
            endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
            enabled: true,
          },
    )
  }

  function closePolicy(messageText: string) {
    message.success(messageText)
    setPolicyOpen(false)
    setEditingPolicy(null)
  }

  function submitPolicy(values: NotificationPolicyFormValues) {
    try {
      const payload = buildNotificationPolicyPayload(values)
      if (editingPolicy?.id) {
        updatePolicy.mutate(
          { id: editingPolicy.id, payload },
          { onSuccess: () => closePolicy('通知策略已更新') },
        )
        return
      }
      createPolicy.mutate(payload, { onSuccess: () => closePolicy('通知策略已保存') })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function submitTemplate(values: NotificationTemplateFormValues) {
    try {
      const payload = buildNotificationTemplatePayload(values)
      const onSuccess = () => {
        message.success(editingTemplate ? '通知模板已更新' : '通知模板已保存')
        setTemplateOpen(false)
        setEditingTemplate(null)
      }
      if (editingTemplate?.id) {
        updateTemplate.mutate({ id: editingTemplate.id, payload }, { onSuccess })
        return
      }
      createTemplate.mutate(payload, { onSuccess })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function submitChannel(values: NotificationChannelFormValues) {
    try {
      const payload = buildNotificationChannelPayload(values)
      const onSuccess = () => {
        message.success(editingChannel ? '通知渠道已更新' : '通知渠道已保存')
        setChannelOpen(false)
        setEditingChannel(null)
      }
      if (editingChannel?.id) {
        updateChannel.mutate({ id: editingChannel.id, payload }, { onSuccess })
        return
      }
      createChannel.mutate(payload, { onSuccess })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function submitRoute(values: NotificationRouteFormValues) {
    try {
      const payload = buildNotificationRoutePayload(values)
      const onSuccess = () => {
        message.success(editingRoute ? '路由规则已更新' : '路由规则已保存')
        setRouteOpen(false)
        setEditingRoute(null)
      }
      if (editingRoute?.id) {
        updateRoute.mutate({ id: editingRoute.id, payload }, { onSuccess })
        return
      }
      createRoute.mutate(payload, { onSuccess })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function submitSilence(values: NotificationSilenceFormValues) {
    try {
      const payload = buildNotificationSilencePayload(values)
      const onSuccess = () => {
        message.success(editingSilence ? '静默规则已更新' : '静默规则已保存')
        setSilenceOpen(false)
        setEditingSilence(null)
      }
      if (editingSilence?.id) {
        updateSilence.mutate({ id: editingSilence.id, payload }, { onSuccess })
        return
      }
      createSilence.mutate(payload, { onSuccess })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  function previewPolicyForEvent(policy: NotificationPolicy, eventId: string) {
    if (!eventId) {
      setPreviewItems([])
      setPreviewOpen(true)
      return
    }
    previewMutation.mutate(
      { policyId: policy.id, eventId },
      {
        onSuccess: (items) => {
          setPreviewItems(items)
          setPreviewOpen(true)
        },
      },
    )
  }

  const channelColumns: TableProps<NotificationChannel>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'channelType',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Endpoint',
      dataIndex: 'config',
      ellipsis: true,
      render: (value: NotificationChannelConfig) => resolveChannelEndpoint(value),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) =>
        canManageNotifications ? (
          <ManagementIconButton
            aria-label="编辑通知渠道"
            icon={<BellOutlined />}
            size="small"
            tooltip="编辑"
            onClick={() => openChannelEditor(record)}
          />
        ) : null,
    },
  ]

  const routeColumns: TableProps<NotificationRoute>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '匹配规则',
      dataIndex: 'matchers',
      render: (value: NotificationMatchers) => (
        <Text code>{stringifyNotificationMatchers(value)}</Text>
      ),
    },
    {
      title: '接收器',
      dataIndex: 'channelIds',
      render: (value: string[]) => {
        const items = (value ?? []).map((item) => channelNamesById[item] || item)
        return items.length > 0 ? (
          <Space wrap>
            {items.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        )
      },
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) =>
        canManageNotifications ? (
          <ManagementIconButton
            aria-label="编辑通知路由"
            icon={<NotificationOutlined />}
            size="small"
            tooltip="编辑"
            onClick={() => openRouteEditor(record)}
          />
        ) : null,
    },
  ]

  const silenceColumns: TableProps<NotificationSilence>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '匹配器',
      dataIndex: 'matchers',
      render: (value: NotificationMatchers) => <Text code>{shortNotificationJson(value)}</Text>,
    },
    { title: '原因', dataIndex: 'reason', render: (value: string) => value || '-' },
    {
      ...tableColumnPresets.datetime,
      title: '开始时间',
      dataIndex: 'startsAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.datetime,
      title: '结束时间',
      dataIndex: 'endsAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'enabled',
      render: (_: boolean, record) => <StatusTag value={formatNotificationSilenceStatus(record)} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) =>
        canManageNotifications ? (
          <ManagementIconButton
            aria-label="编辑静默规则"
            icon={<EditOutlined />}
            size="small"
            tooltip="编辑"
            onClick={() => openSilenceEditor(record)}
          />
        ) : null,
    },
  ]

  const policyColumns: TableProps<NotificationPolicy>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '处理链',
      dataIndex: 'processorChain',
      render: (value: string[]) => (
        <Space wrap>
          {(value ?? []).map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channelRefs',
      render: (value: string[]) => (
        <Space wrap>
          {(value ?? []).map((item) => (
            <Tag key={item}>{channelNamesById[item] || item}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'OnCall',
      dataIndex: 'oncallRef',
      render: (value: string) =>
        oncallOptions.find((item) => item.value === value)?.label || value || '-',
    },
    {
      title: '恢复通知',
      dataIndex: 'sendResolved',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="发送" falseLabel="不发送" />,
    },
    { title: '冷却(s)', dataIndex: 'cooldownSeconds' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) => (
        <Space className="soha-row-action-icons" size={2}>
          {canManageNotifications ? (
            <ManagementIconButton
              aria-label="编辑通知策略"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => openPolicyEditor(record)}
            />
          ) : null}
          <ManagementIconButton
            aria-label="预览通知策略"
            icon={<EyeOutlined />}
            size="small"
            tooltip="预览"
            onClick={() => {
              const firstEvent = alertEventsQuery.data?.[0]?.id || ''
              setPreviewPolicy(record)
              setPreviewEventId(firstEvent)
              previewPolicyForEvent(record, firstEvent)
            }}
          />
        </Space>
      ),
    },
  ]

  const templateColumns: TableProps<NotificationTemplate>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '模板类型',
      dataIndex: 'templateType',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: '内容类型', dataIndex: 'contentType' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} trueLabel="启用" falseLabel="禁用" />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: string, record) =>
        canManageNotifications ? (
          <ManagementIconButton
            aria-label="编辑通知模板"
            icon={<EditOutlined />}
            size="small"
            tooltip="编辑"
            onClick={() => openTemplateEditor(record)}
          />
        ) : null,
    },
  ]

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="通知策略"
        description="维护通知策略、模板、渠道、路由规则与静默策略。"
        actions={
          canManageNotifications ? (
            <ManagementTableToolbar>
              <Button icon={<PlusOutlined />} onClick={() => openSilenceEditor(null)}>
                新建静默
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => openChannelEditor(null)}>
                新建渠道
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => openTemplateEditor(null)}>
                新建模板
              </Button>
              <Button icon={<PlusOutlined />} type="primary" onClick={() => openPolicyEditor(null)}>
                新建策略
              </Button>
            </ManagementTableToolbar>
          ) : null
        }
      />
      <Tabs
        items={[
          {
            key: 'policies',
            label: '通知策略',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                columns={policyColumns}
                dataSource={policiesQuery.data ?? []}
                rowKey="id"
                loading={policiesQuery.isLoading}
              />
            ),
          },
          {
            key: 'templates',
            label: '通知模板',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                columns={templateColumns}
                dataSource={templatesQuery.data ?? []}
                rowKey="id"
                loading={templatesQuery.isLoading}
              />
            ),
          },
          {
            key: 'channels',
            label: '通知渠道',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                columns={channelColumns}
                dataSource={channelsQuery.data ?? []}
                rowKey="id"
                loading={channelsQuery.isLoading}
              />
            ),
          },
          {
            key: 'routes',
            label: '路由规则',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                columns={routeColumns}
                dataSource={routesQuery.data ?? []}
                rowKey="id"
                loading={routesQuery.isLoading}
                headerExtra={
                  <Space>
                    <Text data-testid="notification-route-compat-note" type="secondary">
                      兼容 `/alert-routes`，保存后同步到通知策略。
                    </Text>
                    {canManageNotifications ? (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => openRouteEditor(null)}
                      >
                        新建路由
                      </Button>
                    ) : null}
                  </Space>
                }
              />
            ),
          },
          {
            key: 'silences',
            label: '静默规则',
            children: (
              <AdminTable
                shellClassName="soha-management-table-shell"
                columns={silenceColumns}
                dataSource={silencesQuery.data ?? []}
                rowKey="id"
                loading={silencesQuery.isLoading}
              />
            ),
          },
        ]}
      />

      <Modal
        title={editingPolicy ? '编辑通知策略' : '新建通知策略'}
        open={policyOpen}
        onCancel={() => setPolicyOpen(false)}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={policyForm}
          onFinish={submitPolicy}
          initialValues={{ sendResolved: false, cooldownSeconds: 0, enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="matchers" label="匹配器(JSON)">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="processorChain" label="处理链">
            <Select
              mode="tags"
              options={[
                { value: 'template_render', label: 'template_render' },
                { value: 'webhook_update', label: 'webhook_update' },
              ]}
            />
          </Form.Item>
          <Form.Item name="channelRefs" label="渠道引用">
            <Select mode="multiple" allowClear options={channelOptions} />
          </Form.Item>
          <Form.Item name="oncallRef" label="OnCall 引用">
            <Select allowClear options={oncallOptions} />
          </Form.Item>
          <Form.Item name="cooldownSeconds" label="冷却(s)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sendResolved" label="恢复通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
            <Button onClick={() => setPolicyOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingTemplate ? '编辑通知模板' : '新建通知模板'}
        open={templateOpen}
        onCancel={() => setTemplateOpen(false)}
        footer={null}
        destroyOnHidden
        width={860}
      >
        <Form
          layout="vertical"
          form={templateForm}
          onFinish={submitTemplate}
          initialValues={{
            templateType: 'generic_json',
            contentType: 'application/json',
            enabled: true,
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item name="templateType" label="模板类型" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'generic_json', label: 'generic_json' },
                  { value: 'alertmanager_v1', label: 'alertmanager_v1' },
                  { value: 'grafana_v1', label: 'grafana_v1' },
                ]}
              />
            </Form.Item>
            <Form.Item name="contentType" label="Content-Type" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="bodyTemplate" label="Body 模板">
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="headers" label="Headers(JSON)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="queryParams" label="QueryParams(JSON)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="samplePayload" label="样例 Payload(JSON)">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
            <Button onClick={() => setTemplateOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingChannel ? '编辑通知渠道' : '新建通知渠道'}
        open={channelOpen}
        onCancel={() => setChannelOpen(false)}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={channelForm}
          onFinish={submitChannel}
          initialValues={{ channelType: 'webhook', enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="channelType" label="渠道类型" rules={[{ required: true }]}>
            <Select
              options={['webhook', 'slack', 'feishu', 'dingtalk', 'wechat'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          <Form.Item name="config" label="配置(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={7} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createChannel.isPending || updateChannel.isPending}
            >
              保存
            </Button>
            <Button onClick={() => setChannelOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingRoute ? '编辑路由规则' : '新建路由规则'}
        open={routeOpen}
        onCancel={() => setRouteOpen(false)}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={routeForm}
          onFinish={submitRoute}
          initialValues={{ enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="matchers" label="匹配器(JSON)">
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="channelIds" label="接收渠道">
            <Select mode="multiple" allowClear options={channelOptions} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createRoute.isPending || updateRoute.isPending}
            >
              保存
            </Button>
            <Button onClick={() => setRouteOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingSilence ? '编辑静默规则' : '新建静默规则'}
        open={silenceOpen}
        onCancel={() => setSilenceOpen(false)}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          layout="vertical"
          form={silenceForm}
          onFinish={submitSilence}
          initialValues={{ enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="matchers" label="匹配器(JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="reason" label="静默原因">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              name="startsAt"
              label="开始时间(ISO)"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="endsAt"
              label="结束时间(ISO)"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createSilence.isPending || updateSilence.isPending}
            >
              保存
            </Button>
            <Button onClick={() => setSilenceOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={previewPolicy ? `通知预览 · ${previewPolicy.name}` : '通知预览'}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Select
            value={previewEventId}
            onChange={(value) => {
              const next = String(value)
              setPreviewEventId(next)
              if (previewPolicy) previewPolicyForEvent(previewPolicy, next)
            }}
            style={{ width: '100%' }}
            placeholder="选择告警事件"
            options={(alertEventsQuery.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.title} (${item.status})`,
            }))}
          />
          <AdminTable
            columns={[
              { title: '渠道', dataIndex: 'channelId' },
              {
                title: '模板',
                dataIndex: 'templateId',
                render: (value: string) => value || '-',
              },
              { title: 'URL', dataIndex: 'url', ellipsis: true },
              { title: 'Method', dataIndex: 'method' },
              { title: 'Content-Type', dataIndex: 'contentType' },
              {
                title: 'Body',
                dataIndex: 'body',
                render: (value: string) => <Text code>{String(value || '')}</Text>,
              },
            ]}
            dataSource={previewItems}
            rowKey={(record) =>
              `${record.channelId || 'channel'}:${record.templateId || 'template'}:${record.url || 'url'}`
            }
            pagination={false}
          />
        </Space>
      </Modal>
    </div>
  )
}
