import { useState } from 'react'
import type {
  ObservabilityDataSource,
  ObservabilityDataSourceBackendType,
  ObservabilityDataSourceInput,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { EditOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import {
  App,
  Button,
  Collapse,
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
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { observabilityLogMutations } from './mutations'
import { observabilityLogQueries } from './queries'
import './styles.css'

const { Text } = Typography
const backendOptions = [
  { value: 'loki', label: 'Loki' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
  { value: 'clickhouse', label: 'ClickHouse' },
]
const labelDefaults = {
  labelCluster: 'cluster',
  labelNamespace: 'namespace',
  labelService: 'service',
  labelWorkload: 'workload',
  labelSeverity: 'level',
  labelPod: 'pod',
  labelContainer: 'container',
}

interface DataSourceFormValues {
  name: string
  backendType: ObservabilityDataSourceBackendType
  enabled: boolean
  endpoint: string
  tenantId?: string
  index?: string
  table?: string
  clusterIds?: string[]
  namespaces?: string[]
  maxEntries: number
  maxRangeSeconds: number
  timeoutSeconds: number
  dropAttributeKeys?: string[]
  bearerToken?: string
  username?: string
  password?: string
  clearCredentialKeys?: Array<'bearer_token' | 'username' | 'password'>
  labelCluster?: string
  labelNamespace?: string
  labelService?: string
  labelWorkload?: string
  labelSeverity?: string
  labelPod?: string
  labelContainer?: string
  timestampField?: string
  messageField?: string
  severityField?: string
  serviceField?: string
  workloadField?: string
  namespaceField?: string
  clusterField?: string
  podField?: string
  containerField?: string
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function formValues(item?: ObservabilityDataSource): DataSourceFormValues {
  const labels = item?.config.labelKeys
  return {
    name: item?.name ?? '',
    backendType: item?.backendType ?? 'loki',
    enabled: item?.enabled ?? true,
    endpoint: item?.config.endpoint ?? '',
    tenantId: item?.config.tenantId,
    index: item?.config.index ?? 'logs-*',
    table: item?.config.table ?? 'logs',
    clusterIds: item?.scope.clusterIds,
    namespaces: item?.scope.namespaces,
    maxEntries: item?.queryBudget.maxEntries ?? 1000,
    maxRangeSeconds: item?.queryBudget.maxRangeSeconds ?? 86400,
    timeoutSeconds: item?.queryBudget.timeoutSeconds ?? 10,
    dropAttributeKeys: item?.redactionPolicy.dropAttributeKeys,
    ...labelDefaults,
    labelCluster: labels?.cluster ?? labelDefaults.labelCluster,
    labelNamespace: labels?.namespace ?? labelDefaults.labelNamespace,
    labelService: labels?.service ?? labelDefaults.labelService,
    labelWorkload: labels?.workload ?? labelDefaults.labelWorkload,
    labelSeverity: labels?.severity ?? labelDefaults.labelSeverity,
    labelPod: labels?.pod ?? labelDefaults.labelPod,
    labelContainer: labels?.container ?? labelDefaults.labelContainer,
    timestampField: item?.config.timestampField,
    messageField: item?.config.messageField,
    severityField: item?.config.severityField,
    serviceField: item?.config.serviceField,
    workloadField: item?.config.workloadField,
    namespaceField: item?.config.namespaceField,
    clusterField: item?.config.clusterField,
    podField: item?.config.podField,
    containerField: item?.config.containerField,
  }
}

export function buildDataSourceInput(values: DataSourceFormValues): ObservabilityDataSourceInput {
  const config: ObservabilityDataSourceInput['config'] = { endpoint: values.endpoint.trim() }
  const optionalConfig = {
    tenantId: clean(values.tenantId),
    index: values.backendType === 'elasticsearch' ? clean(values.index) : undefined,
    table: values.backendType === 'clickhouse' ? clean(values.table) : undefined,
    timestampField: clean(values.timestampField),
    messageField: clean(values.messageField),
    severityField: clean(values.severityField),
    serviceField: clean(values.serviceField),
    workloadField: clean(values.workloadField),
    namespaceField: clean(values.namespaceField),
    clusterField: clean(values.clusterField),
    podField: clean(values.podField),
    containerField: clean(values.containerField),
  }
  Object.assign(
    config,
    Object.fromEntries(Object.entries(optionalConfig).filter(([, value]) => value !== undefined)),
  )
  if (values.backendType === 'loki') {
    config.labelKeys = {
      cluster: clean(values.labelCluster),
      namespace: clean(values.labelNamespace),
      service: clean(values.labelService),
      workload: clean(values.labelWorkload),
      severity: clean(values.labelSeverity),
      pod: clean(values.labelPod),
      container: clean(values.labelContainer),
    }
  }
  const credentials = [
    { key: 'bearer_token', value: clean(values.bearerToken) },
    { key: 'username', value: clean(values.username) },
    { key: 'password', value: clean(values.password) },
  ].filter((item): item is { key: string; value: string } => Boolean(item.value))
  return {
    name: values.name.trim(),
    backendType: values.backendType,
    enabled: values.enabled,
    scope: { clusterIds: values.clusterIds, namespaces: values.namespaces },
    queryBudget: {
      maxEntries: values.maxEntries,
      maxRangeSeconds: values.maxRangeSeconds,
      timeoutSeconds: values.timeoutSeconds,
    },
    redactionPolicy: { dropAttributeKeys: values.dropAttributeKeys },
    config,
    credentials,
    clearCredentialKeys: values.clearCredentialKeys,
  }
}

export function LogDataSourcesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'observe.log-data-sources.manage')
  const [form] = Form.useForm<DataSourceFormValues>()
  const backendType = Form.useWatch('backendType', form)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ObservabilityDataSource | null>(null)
  const sourcesQuery = useQuery(observabilityLogQueries.dataSources())
  const createMutation = useMutation(observabilityLogMutations.createDataSource(queryClient))
  const updateMutation = useMutation(observabilityLogMutations.updateDataSource(queryClient))
  const validateMutation = useMutation(observabilityLogMutations.validateDataSource(queryClient))

  function openEditor(item?: ObservabilityDataSource) {
    setEditing(item ?? null)
    form.setFieldsValue(formValues(item))
    setOpen(true)
  }

  function closeEditor() {
    setOpen(false)
    setEditing(null)
    form.resetFields()
  }

  function submit(values: DataSourceFormValues) {
    const input = buildDataSourceInput(values)
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            void message.success('日志数据源已更新')
            closeEditor()
          },
          onError: (error) => void message.error(error.message),
        },
      )
      return
    }
    createMutation.mutate(input, {
      onSuccess: () => {
        void message.success('日志数据源已创建')
        closeEditor()
      },
      onError: (error) => void message.error(error.message),
    })
  }

  const columns: TableColumnsType<ObservabilityDataSource> = [
    {
      title: '数据源',
      dataIndex: 'name',
      width: 260,
      render: (name: string, item) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{name}</Text>
          <Text type="secondary" className="text-xs">
            {item.config.endpoint}
          </Text>
        </Space>
      ),
    },
    {
      title: '后端',
      dataIndex: 'backendType',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '作用域',
      key: 'scope',
      width: 280,
      render: (_, item) => (
        <Space orientation="vertical" size={2}>
          <Text>{item.scope.clusterIds?.join(', ') || '全部集群'}</Text>
          <Text type="secondary">{item.scope.namespaces?.join(', ') || '全部命名空间'}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 190,
      render: (_, item) => (
        <Space size={4} wrap>
          <StatusTag value={item.validationStatus} />
          <BooleanTag value={item.enabled} trueLabel="启用" falseLabel="停用" />
        </Space>
      ),
    },
    {
      title: '认证',
      dataIndex: 'credentialKeys',
      width: 180,
      render: (keys: string[]) => keys.map((key) => <Tag key={key}>{key}</Tag>),
    },
    {
      title: '最近验证',
      dataIndex: 'lastValidatedAt',
      width: 180,
      render: (value?: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 104,
      render: (_, item) => (
        <Space size={2}>
          <ManagementIconButton
            aria-label="验证日志数据源"
            disabled={!canManage}
            icon={<ExperimentOutlined />}
            loading={validateMutation.isPending && validateMutation.variables === item.id}
            tooltip="验证连接"
            onClick={() =>
              validateMutation.mutate(item.id, {
                onSuccess: (result) =>
                  void message[result.validationStatus === 'healthy' ? 'success' : 'error'](
                    result.validationStatus === 'healthy' ? '连接验证通过' : '连接验证失败',
                  ),
                onError: (error) => void message.error(error.message),
              })
            }
          />
          <ManagementIconButton
            aria-label="编辑日志数据源"
            disabled={!canManage}
            icon={<EditOutlined />}
            tooltip="编辑"
            onClick={() => openEditor(item)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      {sourcesQuery.isError ? (
        <ManagementState
          kind="error"
          title="日志数据源加载失败"
          description={sourcesQuery.error.message}
        />
      ) : (
        <AdminTable
          title="日志数据源"
          headerExtra={
            canManage ? (
              <ManagementTableToolbar>
                <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>
                  新建数据源
                </Button>
              </ManagementTableToolbar>
            ) : null
          }
          columnSettingIconOnly
          columnSettingPlacement="header"
          shellClassName="soha-management-table-shell"
          columns={columns}
          dataSource={sourcesQuery.data ?? []}
          empty={<ManagementState bordered={false} compact description="暂无日志数据源" />}
          loading={sourcesQuery.isLoading}
          pageSize={20}
          rowKey="id"
          scroll={{ x: 'max-content' }}
        />
      )}

      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title={editing ? '编辑日志数据源' : '新建日志数据源'}
        width={860}
        onCancel={closeEditor}
      >
        <Form<DataSourceFormValues>
          form={form}
          initialValues={formValues()}
          layout="vertical"
          onFinish={submit}
        >
          <div className="soha-log-filter-grid">
            <Form.Item label="名称" name="name" rules={[{ required: true, whitespace: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="后端" name="backendType" rules={[{ required: true }]}>
              <Select options={backendOptions} />
            </Form.Item>
            <Form.Item label="Endpoint" name="endpoint" rules={[{ required: true, type: 'url' }]}>
              <Input placeholder="https://logs.example.com" />
            </Form.Item>
            <Form.Item label="Tenant ID" name="tenantId">
              <Input />
            </Form.Item>
            {backendType === 'elasticsearch' ? (
              <Form.Item label="Index" name="index" rules={[{ required: true, whitespace: true }]}>
                <Input />
              </Form.Item>
            ) : null}
            {backendType === 'clickhouse' ? (
              <Form.Item label="Table" name="table" rules={[{ required: true, whitespace: true }]}>
                <Input />
              </Form.Item>
            ) : null}
            <Form.Item label="集群范围" name="clusterIds">
              <Select mode="tags" tokenSeparators={[',']} placeholder="留空表示全部集群" />
            </Form.Item>
            <Form.Item label="命名空间范围" name="namespaces">
              <Select mode="tags" tokenSeparators={[',']} placeholder="留空表示全部命名空间" />
            </Form.Item>
            <Form.Item label="每页最大行数" name="maxEntries" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="最大时间范围（秒）"
              name="maxRangeSeconds"
              rules={[{ required: true }]}
            >
              <InputNumber min={60} max={2592000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="查询超时（秒）" name="timeoutSeconds" rules={[{ required: true }]}>
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="脱敏属性" name="dropAttributeKeys">
              <Select mode="tags" tokenSeparators={[',']} />
            </Form.Item>
            <Form.Item label="Bearer Token" name="bearerToken">
              <Input.Password autoComplete="new-password" placeholder="留空保持不变" />
            </Form.Item>
            {backendType === 'clickhouse' ? (
              <>
                <Form.Item label="Username" name="username">
                  <Input autoComplete="off" placeholder="留空保持不变" />
                </Form.Item>
                <Form.Item label="Password" name="password">
                  <Input.Password autoComplete="new-password" placeholder="留空保持不变" />
                </Form.Item>
              </>
            ) : null}
            {editing?.credentialKeys.length ? (
              <Form.Item label="清除认证字段" name="clearCredentialKeys">
                <Select
                  mode="multiple"
                  options={editing.credentialKeys.map((key) => ({ value: key, label: key }))}
                />
              </Form.Item>
            ) : null}
          </div>

          <Collapse
            ghost
            items={[
              {
                key: 'mapping',
                label: backendType === 'loki' ? '标签映射' : '字段映射',
                children: (
                  <div className="soha-log-filter-grid">
                    {backendType === 'loki'
                      ? [
                          ['labelCluster', 'Cluster'],
                          ['labelNamespace', 'Namespace'],
                          ['labelService', 'Service'],
                          ['labelWorkload', 'Workload'],
                          ['labelSeverity', 'Severity'],
                          ['labelPod', 'Pod'],
                          ['labelContainer', 'Container'],
                        ].map(([name, label]) => (
                          <Form.Item key={name} label={label} name={name}>
                            <Input />
                          </Form.Item>
                        ))
                      : [
                          ['timestampField', 'Timestamp'],
                          ['messageField', 'Message'],
                          ['severityField', 'Severity'],
                          ['serviceField', 'Service'],
                          ['workloadField', 'Workload'],
                          ['namespaceField', 'Namespace'],
                          ['clusterField', 'Cluster'],
                          ['podField', 'Pod'],
                          ['containerField', 'Container'],
                        ].map(([name, label]) => (
                          <Form.Item key={name} label={label} name={name}>
                            <Input placeholder="使用后端默认字段" />
                          </Form.Item>
                        ))}
                  </div>
                ),
              },
            ]}
          />
          <Space>
            <Form.Item name="enabled" noStyle valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Button
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              type="primary"
            >
              保存
            </Button>
            <Button onClick={closeEditor}>取消</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
