import { useMemo, useState } from 'react'
import type {
  SecretBinding,
  SecretCreateRequest,
  SecretMetadata,
  SecretScopeType,
  SecretStatus,
  SecretUpdateRequest,
  SecretVaultKV2Reference,
  SecretVersionMetadata,
} from '@opensoha/contracts/gen/ts/sohaapi'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import { buildSecretReference, type SecretFilters } from './api'
import { secretMutations } from './mutations'
import { secretQueries } from './queries'

const { Text } = Typography

type SecretSource = 'local' | 'vault_kv2'

interface SecretValueValues {
  source: SecretSource
  value?: string
  vaultKv2?: Partial<SecretVaultKV2Reference>
}

interface SecretEditorValues extends SecretValueValues {
  bindings?: SecretBinding[]
  description?: string
  name: string
  scopeId: string
  scopeType: SecretScopeType
  status?: SecretStatus
}

interface SecretPageFilters extends SecretFilters {
  query?: string
}

const scopeOptions = [
  { value: 'workspace', label: 'Workspace' },
  { value: 'project', label: 'Project' },
  { value: 'environment', label: 'Environment' },
] satisfies Array<{ value: SecretScopeType; label: string }>

const bindingOptions = [
  { value: 'capability', label: 'Capability' },
  { value: 'project', label: 'Project' },
  { value: 'connection', label: 'Connection' },
] satisfies Array<{ value: SecretBinding['targetType']; label: string }>

const vaultPathPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/

function toSecretValueInput(values: SecretValueValues) {
  if (values.source === 'vault_kv2') {
    return {
      vaultKv2: {
        key: values.vaultKv2?.key ?? '',
        mount: values.vaultKv2?.mount?.trim() ?? '',
        path: values.vaultKv2?.path?.trim() ?? '',
        version: values.vaultKv2?.version ?? 0,
      },
    }
  }
  return { value: values.value ?? '' }
}

function SecretValueFields({ label, source }: { label: string; source: SecretSource }) {
  return (
    <>
      <Form.Item name="source" label="来源" rules={[{ required: true }]}>
        <Segmented
          block
          options={[
            { label: '本地加密', value: 'local' },
            { label: 'Vault KV v2', value: 'vault_kv2' },
          ]}
        />
      </Form.Item>
      {source === 'vault_kv2' ? (
        <Space align="start" size={12} wrap>
          <Form.Item
            name={['vaultKv2', 'mount']}
            label="Mount"
            rules={[
              { required: true, whitespace: true },
              { max: 256, message: 'Mount 最多 256 个字符' },
              { pattern: vaultPathPattern, message: 'Mount 路径格式无效' },
            ]}
          >
            <Input maxLength={256} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item
            name={['vaultKv2', 'path']}
            label="Path"
            rules={[
              { required: true, whitespace: true },
              { max: 1024, message: 'Path 最多 1024 个字符' },
              { pattern: vaultPathPattern, message: 'Path 路径格式无效' },
            ]}
          >
            <Input maxLength={1024} style={{ width: 260 }} />
          </Form.Item>
          <Form.Item
            name={['vaultKv2', 'key']}
            label="Key"
            rules={[
              { required: true, whitespace: true },
              { max: 256, message: 'Key 最多 256 个字符' },
              {
                validator: (_, value?: string) =>
                  !value ||
                  (!value.includes(String.fromCharCode(0)) &&
                    !value.includes('\r') &&
                    !value.includes('\n'))
                    ? Promise.resolve()
                    : Promise.reject(new Error('Key 不能包含换行或 NUL 字符')),
              },
            ]}
          >
            <Input maxLength={256} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item
            name={['vaultKv2', 'version']}
            label="Version"
            rules={[
              { required: true },
              { type: 'integer', min: 1, message: 'Version 必须是正整数' },
            ]}
          >
            <InputNumber min={1} step={1} style={{ width: 140 }} />
          </Form.Item>
        </Space>
      ) : (
        <Form.Item name="value" label={label} rules={[{ required: true }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      )}
    </>
  )
}

export function SecretsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<SecretPageFilters>()
  const [editorForm] = Form.useForm<SecretEditorValues>()
  const [rotateForm] = Form.useForm<SecretValueValues>()
  const editorSource = (Form.useWatch('source', editorForm) ?? 'local') as SecretSource
  const rotateSource = (Form.useWatch('source', rotateForm) ?? 'local') as SecretSource
  const [filters, setFilters] = useState<SecretPageFilters>({})
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<SecretMetadata | null>(null)
  const [rotating, setRotating] = useState<SecretMetadata | null>(null)
  const [versionSecret, setVersionSecret] = useState<SecretMetadata | null>(null)
  const canManage = hasPermission(usePermissionSnapshot().data?.data, 'secret.manage')

  const secretsQuery = useQuery(
    secretQueries.list({ scopeId: filters.scopeId, scopeType: filters.scopeType }),
  )
  const versionsQuery = useQuery(secretQueries.versions(versionSecret?.id ?? ''))
  const createMutation = useMutation(secretMutations.create(queryClient))
  const updateMutation = useMutation(secretMutations.update(queryClient))
  const disableMutation = useMutation(secretMutations.disable(queryClient))
  const rotateMutation = useMutation(secretMutations.rotate(queryClient))
  const revokeMutation = useMutation(secretMutations.revokeVersion(queryClient))

  const secrets = useMemo(() => {
    const query = filters.query?.trim().toLowerCase()
    if (!query) return secretsQuery.data ?? []
    return (secretsQuery.data ?? []).filter((secret) =>
      [secret.name, secret.id, secret.description, secret.scopeType, secret.scopeId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [filters.query, secretsQuery.data])

  function closeEditor() {
    setEditorOpen(false)
    setEditing(null)
    editorForm.resetFields()
  }

  function openCreate() {
    setEditing(null)
    editorForm.setFieldsValue({
      bindings: [{ targetType: 'project', targetRef: '' }],
      description: '',
      name: '',
      scopeId: 'default',
      scopeType: 'workspace',
      source: 'local',
      value: '',
      vaultKv2: { version: 1 },
    })
    setEditorOpen(true)
  }

  function openEdit(secret: SecretMetadata) {
    setEditing(secret)
    editorForm.setFieldsValue({
      bindings: secret.bindings,
      description: secret.description ?? '',
      name: secret.name,
      scopeId: secret.scopeId,
      scopeType: secret.scopeType,
      status: secret.status,
    })
    setEditorOpen(true)
  }

  function submitEditor(values: SecretEditorValues) {
    const bindings = (values.bindings ?? []).map((binding) => ({
      targetType: binding.targetType,
      targetRef: binding.targetRef.trim(),
    }))
    if (editing) {
      const input: SecretUpdateRequest = {
        bindings,
        description: values.description?.trim() ?? '',
        name: values.name.trim(),
        status: values.status,
      }
      updateMutation.mutate(
        { secretId: editing.id, input },
        {
          onError: (error) => message.error(error.message),
          onSuccess: () => {
            message.success('Secret 已更新')
            closeEditor()
          },
        },
      )
      return
    }

    const input: SecretCreateRequest = {
      bindings,
      description: values.description?.trim() || undefined,
      name: values.name.trim(),
      scopeId: values.scopeId.trim(),
      scopeType: values.scopeType,
      ...toSecretValueInput(values),
    }
    createMutation.mutate(input, {
      onError: (error) => message.error(error.message),
      onSuccess: () => {
        message.success('Secret 已创建')
        closeEditor()
      },
    })
  }

  function copyReference(secret: SecretMetadata, version?: number) {
    try {
      const reference = buildSecretReference(secret.id, version)
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      void navigator.clipboard.writeText(reference).then(
        () => message.success('Secret 引用已复制'),
        () => message.error('复制失败'),
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制失败')
    }
  }

  const columns = useMemo<TableColumnsType<SecretMetadata>>(
    () => [
      {
        title: 'Secret',
        dataIndex: 'name',
        width: 260,
        render: (name: string, secret) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{name}</Text>
            <Text code copyable={false} type="secondary">
              {secret.id}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 220,
        render: (_, secret) => (
          <Space size={4} wrap>
            <MetadataTag label={secret.scopeType} tone="blue" />
            <MetadataTag label={secret.scopeId} />
          </Space>
        ),
      },
      {
        title: 'Bindings',
        dataIndex: 'bindings',
        width: 320,
        render: (bindings: SecretBinding[]) => (
          <Space size={4} wrap>
            {bindings.slice(0, 3).map((binding) => (
              <MetadataTag
                key={`${binding.targetType}:${binding.targetRef}`}
                label={`${binding.targetType}:${binding.targetRef}`}
                tone="cyan"
              />
            ))}
            {bindings.length > 3 ? <MetadataTag label={`+${bindings.length - 3}`} /> : null}
          </Space>
        ),
      },
      {
        title: 'Version',
        dataIndex: 'currentVersion',
        width: 92,
        render: (version: number) => `v${version}`,
      },
      {
        ...tableColumnPresets.status,
        title: 'Status',
        dataIndex: 'status',
        render: (status: string) => <StatusTag value={status} />,
      },
      {
        ...tableColumnPresets.datetime,
        title: 'Updated',
        dataIndex: 'updatedAt',
        render: formatDateTime,
      },
      {
        ...tableColumnPresets.action,
        key: 'actions',
        render: (_, secret) => (
          <Space size={2}>
            <ManagementIconButton
              aria-label="复制 Secret 引用"
              icon={<CopyOutlined />}
              tooltip="复制引用"
              onClick={() => copyReference(secret)}
            />
            <ManagementIconButton
              aria-label="查看 Secret 版本"
              icon={<HistoryOutlined />}
              tooltip="版本"
              onClick={() => setVersionSecret(secret)}
            />
            <ManagementIconButton
              aria-label="轮换 Secret"
              disabled={!canManage || secret.status !== 'active'}
              icon={<ReloadOutlined />}
              tooltip="轮换"
              onClick={() => {
                rotateForm.resetFields()
                rotateForm.setFieldsValue({ source: 'local', value: '', vaultKv2: { version: 1 } })
                setRotating(secret)
              }}
            />
            <ManagementIconButton
              aria-label="编辑 Secret"
              disabled={!canManage}
              icon={<EditOutlined />}
              tooltip="编辑"
              onClick={() => openEdit(secret)}
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canManage || secret.status === 'disabled'}
              okButtonProps={{ danger: true, loading: disableMutation.isPending }}
              okText="停用"
              title={`停用 ${secret.name}`}
              onConfirm={() =>
                disableMutation.mutate(secret.id, {
                  onError: (error) => message.error(error.message),
                  onSuccess: () => message.success('Secret 已停用'),
                })
              }
            >
              <ManagementIconButton
                aria-label="停用 Secret"
                danger
                disabled={!canManage || secret.status === 'disabled'}
                icon={<StopOutlined />}
                tooltip="停用"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canManage, disableMutation, message, rotateForm],
  )

  const versionColumns: TableColumnsType<SecretVersionMetadata> = [
    {
      title: 'Version',
      dataIndex: 'version',
      width: 88,
      render: (version: number) => `v${version}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => <StatusTag value={status} />,
    },
    { title: 'Created by', dataIndex: 'createdBy', ellipsis: true },
    { title: 'Created', dataIndex: 'createdAt', width: 180, render: formatDateTime },
    {
      key: 'actions',
      fixed: 'right',
      width: 92,
      render: (_, version) => (
        <Space size={2}>
          <ManagementIconButton
            aria-label="复制版本引用"
            icon={<CopyOutlined />}
            tooltip="复制引用"
            onClick={() => versionSecret && copyReference(versionSecret, version.version)}
          />
          <Popconfirm
            cancelText="取消"
            disabled={!canManage || version.status === 'revoked'}
            okButtonProps={{ danger: true, loading: revokeMutation.isPending }}
            okText="撤销"
            title={`撤销 v${version.version}`}
            onConfirm={() =>
              versionSecret &&
              revokeMutation.mutate(
                { secretId: versionSecret.id, version: version.version },
                {
                  onError: (error) => message.error(error.message),
                  onSuccess: () => message.success('Secret 版本已撤销'),
                },
              )
            }
          >
            <ManagementIconButton
              aria-label="撤销 Secret 版本"
              danger
              disabled={!canManage || version.status === 'revoked'}
              icon={<DeleteOutlined />}
              tooltip="撤销"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ManagementDataPage
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.scopeType && !filters.scopeId}
              loading={secretsQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({})
              }}
            />
          ),
          children: (
            <>
              <ManagementKeywordField label="关键词" name="query" placeholder="名称、ID、描述" />
              <ManagementQueryField label="Scope 类型" name="scopeType" width={180}>
                <Select allowClear options={scopeOptions} />
              </ManagementQueryField>
              <ManagementQueryField label="Scope ID" name="scopeId" width={220}>
                <Input allowClear />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          onFinish: (values) =>
            setFilters({
              query: values.query?.trim(),
              scopeId: values.scopeId?.trim(),
              scopeType: values.scopeType,
            }),
        }}
        table={{
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: secretsQuery.isError ? [] : secrets,
          empty: secretsQuery.isError ? (
            <ManagementState
              kind="error"
              title="Secret 加载失败"
              description="Secret 列表请求失败，请稍后重试。"
              actions={
                <Button
                  icon={<ReloadOutlined />}
                  loading={secretsQuery.isFetching}
                  onClick={() => void secretsQuery.refetch()}
                >
                  重试
                </Button>
              }
            />
          ) : (
            <ManagementState kind="empty" title="暂无 Secret" />
          ),
          headerExtra: (
            <ManagementTableToolbar>
              <Button
                disabled={!canManage}
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={openCreate}
              >
                新建 Secret
              </Button>
              <ManagementRefreshButton
                aria-label="刷新 Secret"
                loading={secretsQuery.isFetching}
                title="刷新"
                tooltip="刷新"
                onClick={() => void secretsQuery.refetch()}
              />
            </ManagementTableToolbar>
          ),
          loading: !secretsQuery.isError && (secretsQuery.isLoading || secretsQuery.isFetching),
          rowKey: 'id',
          scroll: { x: 'max-content' },
        }}
      />

      <Modal
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
        open={editorOpen}
        title={editing ? '编辑 Secret' : '新建 Secret'}
        width={720}
        onCancel={closeEditor}
        onOk={() => void editorForm.submit()}
      >
        <Form form={editorForm} layout="vertical" onFinish={submitEditor}>
          <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={128} />
          </Form.Item>
          {!editing ? <SecretValueFields label="值" source={editorSource} /> : null}
          <Form.Item name="description" label="描述">
            <Input.TextArea maxLength={1024} rows={3} />
          </Form.Item>
          <Space align="start" size={12} wrap>
            <Form.Item name="scopeType" label="Scope 类型" rules={[{ required: true }]}>
              <Select disabled={Boolean(editing)} options={scopeOptions} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              name="scopeId"
              label="Scope ID"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input disabled={Boolean(editing)} maxLength={128} style={{ width: 260 }} />
            </Form.Item>
            {editing ? (
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'disabled', label: 'Disabled' },
                  ]}
                  style={{ width: 140 }}
                />
              </Form.Item>
            ) : null}
          </Space>
          <Form.List
            name="bindings"
            rules={[
              {
                validator: async (_, bindings) => {
                  if (!bindings?.length) throw new Error('至少添加一个 Binding')
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <Form.Item label="Bindings">
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Space.Compact block key={field.key}>
                      <Form.Item
                        noStyle
                        name={[field.name, 'targetType']}
                        rules={[{ required: true }]}
                      >
                        <Select options={bindingOptions} style={{ width: 170 }} />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        name={[field.name, 'targetRef']}
                        rules={[{ required: true, whitespace: true }]}
                      >
                        <Input maxLength={256} />
                      </Form.Item>
                      <Button
                        aria-label="删除 Binding"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </Space.Compact>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ targetType: 'project', targetRef: '' })}
                  >
                    添加 Binding
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Space>
              </Form.Item>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        confirmLoading={rotateMutation.isPending}
        destroyOnHidden
        open={Boolean(rotating)}
        title={`轮换 ${rotating?.name ?? ''}`}
        onCancel={() => setRotating(null)}
        onOk={() => void rotateForm.submit()}
      >
        <Form
          form={rotateForm}
          layout="vertical"
          onFinish={(values) =>
            rotating &&
            rotateMutation.mutate(
              { secretId: rotating.id, input: toSecretValueInput(values) },
              {
                onError: (error) => message.error(error.message),
                onSuccess: () => {
                  message.success('Secret 已轮换')
                  setRotating(null)
                },
              },
            )
          }
        >
          <SecretValueFields label="新值" source={rotateSource} />
        </Form>
      </Modal>

      <Drawer
        destroyOnHidden
        open={Boolean(versionSecret)}
        size="large"
        title={`${versionSecret?.name ?? ''} · Versions`}
        onClose={() => setVersionSecret(null)}
      >
        {versionsQuery.isLoading ? (
          <ManagementState kind="loading" />
        ) : versionsQuery.isError ? (
          <ManagementState kind="error" title="版本加载失败" />
        ) : (versionsQuery.data ?? []).length ? (
          <AdminTable
            columns={versionColumns}
            dataSource={versionsQuery.data ?? []}
            loading={versionsQuery.isFetching}
            pagination={false}
            rowKey="version"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <ManagementState kind="empty" title="暂无版本" />
        )}
      </Drawer>
    </>
  )
}
