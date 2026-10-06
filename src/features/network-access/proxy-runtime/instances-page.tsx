import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type {
  NetworkProxyConfigurationInput,
  NetworkProxyEngine,
  NetworkProxyInstance,
  NetworkProxyInstanceInput,
  NetworkRuntimeEnrollmentSecret,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementState,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { networkAccessKeys } from '../keys'
import { createEnrollment, createInstance, updateConfiguration } from './api'
import { proxyKeys, proxyQueries } from './queries'
import './styles.css'

const engines: NetworkProxyEngine[] = ['mihomo', 'sing-box', 'v2ray']

export default function ProxyInstancesPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissions = usePermissionSnapshot()
  const can = (key: string) => hasPermission(permissions.data?.data, key)
  const canView = can('network_access.proxy_instances.view')
  const canCreate = can('network_access.proxy_instances.create')
  const canUpdate = can('network_access.proxy_instances.update')
  const canEnroll = can('network_access.enrollments.create')
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draftEngine, setDraftEngine] = useState<NetworkProxyEngine | undefined>()
  const [engine, setEngine] = useState<NetworkProxyEngine | undefined>()
  const instances = useQuery(proxyQueries.instances({ search: keyword, engine }, canView))
  const [createOpen, setCreateOpen] = useState(false)
  const [configurationTarget, setConfigurationTarget] = useState<NetworkProxyInstance>()
  const [secret, setSecret] = useState<NetworkRuntimeEnrollmentSecret>()
  const [createForm] = Form.useForm<NetworkProxyInstanceInput>()
  const [configurationForm] = Form.useForm<NetworkProxyConfigurationInput>()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: proxyKeys.all })
  const create = useMutation({
    mutationFn: createInstance,
    onSuccess: () => {
      message.success(t('networkAccess.proxyRuntime.created', '代理实例已创建。'))
      setCreateOpen(false)
      createForm.resetFields()
      refresh()
    },
    onError: () =>
      message.error(
        t('networkAccess.proxyRuntime.createError', '创建失败，请检查 ID 是否已存在。'),
      ),
  })
  const configure = useMutation({
    mutationFn: ({ id, input }: { id: string; input: NetworkProxyConfigurationInput }) =>
      updateConfiguration(id, input),
    onSuccess: () => {
      message.success(
        t('networkAccess.proxyRuntime.configurationSaved', '期望配置已保存，等待运行时应用。'),
      )
      setConfigurationTarget(undefined)
      configurationForm.resetFields()
      refresh()
    },
    onError: () => {
      message.error(
        t('networkAccess.proxyRuntime.configurationError', '配置保存失败，请刷新实例版本后重试。'),
      )
      refresh()
    },
  })
  const enroll = useMutation({
    mutationFn: createEnrollment,
    onSuccess: (value) => {
      setSecret(value)
      void queryClient.invalidateQueries({ queryKey: networkAccessKeys.enrollments.all })
    },
    onError: () =>
      message.error(t('networkAccess.proxyRuntime.enrollmentError', '登记令牌创建失败。')),
  })
  const columns: TableColumnsType<NetworkProxyInstance> = [
    { title: t('networkAccess.proxyRuntime.name', '名称'), dataIndex: 'name', ellipsis: true },
    { title: t('networkAccess.proxyRuntime.id', '实例 ID'), dataIndex: 'id', ellipsis: true },
    { title: t('networkAccess.proxyRuntime.engine', '引擎'), dataIndex: 'engine', width: 105 },
    {
      title: t('networkAccess.proxyRuntime.status', '状态'),
      dataIndex: 'status',
      width: 100,
      render: (status: NetworkProxyInstance['status']) => (
        <Tag
          color={
            {
              online: 'success',
              degraded: 'warning',
              offline: 'error',
              disabled: 'default',
              unregistered: 'default',
            }[status]
          }
        >
          {t(
            `networkAccess.proxyRuntime.status.${status}`,
            {
              online: '在线',
              degraded: '降级',
              offline: '失联',
              disabled: '已停用',
              unregistered: '未登记',
            }[status],
          )}
        </Tag>
      ),
    },
    {
      title: t('networkAccess.proxyRuntime.version', '版本'),
      dataIndex: 'engineVersion',
      width: 120,
      render: (value?: string) => value || '—',
    },
    {
      title: t('networkAccess.proxyRuntime.revisions', '配置版本'),
      width: 115,
      render: (_, item) => `${item.observedRevision} / ${item.desiredRevision}`,
    },
    {
      title: t('networkAccess.proxyRuntime.lastSeen', '最近联系'),
      dataIndex: 'lastSeenAt',
      width: 175,
      render: (value?: string) => (value ? formatDateTime(value) : '—'),
    },
    {
      title: t('common.actions', '操作'),
      key: 'actions',
      className: 'soha-table-actions-column',
      width: 185,
      fixed: 'right',
      render: (_, item) => (
        <Space size={4}>
          {canUpdate ? (
            <Button
              size="small"
              onClick={() => {
                setConfigurationTarget(item)
                configurationForm.setFieldsValue({
                  expectedRevision: item.desiredRevision,
                  enabled: item.enabled,
                  content: '',
                })
              }}
            >
              {t('networkAccess.proxyRuntime.configure', '配置')}
            </Button>
          ) : null}
          {canEnroll ? (
            <Button
              size="small"
              loading={enroll.isPending && enroll.variables === item.id}
              onClick={() => enroll.mutate(item.id)}
            >
              {t('networkAccess.proxyRuntime.enroll', '登记令牌')}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]
  if (!canView)
    return <ManagementState kind={permissions.isLoading ? 'loading' : 'no-permission'} />
  return (
    <main className="soha-server-proxy-page">
      <h1 className="soha-server-proxy-list-title">
        {t('networkAccess.proxyRuntime.instances', '代理实例')}
      </h1>
      <Typography.Text type="secondary">
        {t(
          'networkAccess.proxyRuntime.instanceScope',
          '管理服务器上的 Mihomo、sing-box 与 V2Ray 实例。配置保存后由已登记的 Linux 运行时拉取并应用。',
        )}
      </Typography.Text>
      <ManagementQueryPanel
        onFinish={() => {
          setKeyword(draft.trim())
          setEngine(draftEngine)
        }}
        actions={
          <ManagementQueryActions
            disabledReset={!draft && !keyword && !draftEngine && !engine}
            onReset={() => {
              setDraft('')
              setKeyword('')
              setDraftEngine(undefined)
              setEngine(undefined)
            }}
          />
        }
      >
        <ManagementKeywordField
          value={draft}
          onChange={setDraft}
          placeholder={t('networkAccess.proxyRuntime.searchInstances', '搜索名称、实例 ID 或主机')}
        />
        <ManagementQueryField label={t('networkAccess.proxyRuntime.engine', '引擎')} width={220}>
          <Select
            aria-label={t('networkAccess.proxyRuntime.engine', '引擎')}
            allowClear
            placeholder={t('networkAccess.proxyRuntime.allEngines', '全部引擎')}
            value={draftEngine}
            onChange={setDraftEngine}
            options={engines.map((value) => ({ value, label: value }))}
          />
        </ManagementQueryField>
      </ManagementQueryPanel>
      {instances.data?.length === 200 ? (
        <Typography.Text type="secondary">
          {t(
            'networkAccess.proxyRuntime.resultLimit',
            '最多展示 200 个匹配实例。可使用上方条件缩小查询范围。',
          )}
        </Typography.Text>
      ) : null}
      <AdminTable
        columns={columns}
        scroll={{ x: 1160 }}
        dataSource={instances.data ?? []}
        rowKey="id"
        loading={instances.isLoading}
        refreshing={instances.isFetching}
        error={instances.error ?? undefined}
        onRefresh={() => void instances.refetch()}
        localSorting
        pagination={{ pageSize: 15, showSizeChanger: false }}
        toolbarExtra={
          canCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('networkAccess.proxyRuntime.add', '新增实例')}
            </Button>
          ) : null
        }
        empty={t('networkAccess.proxyRuntime.noInstances', '尚无代理实例。请先创建并登记运行时。')}
      />
      <Modal
        title={t('networkAccess.proxyRuntime.add', '新增实例')}
        open={createOpen}
        destroyOnHidden
        confirmLoading={create.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createForm.validateFields().then((values) => create.mutate(values))}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="id"
            label={t('networkAccess.proxyRuntime.id', '实例 ID')}
            rules={[{ required: true, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/ }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('networkAccess.proxyRuntime.name', '名称')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="engine"
            label={t('networkAccess.proxyRuntime.engine', '引擎')}
            rules={[{ required: true }]}
          >
            <Select options={engines.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="host" label={t('networkAccess.proxyRuntime.host', '主机标识')}>
            <Input maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={
          configurationTarget
            ? `${t('networkAccess.proxyRuntime.configure', '配置')} · ${configurationTarget.name}`
            : ''
        }
        open={Boolean(configurationTarget)}
        destroyOnHidden
        width={760}
        confirmLoading={configure.isPending}
        onCancel={() => setConfigurationTarget(undefined)}
        onOk={() => {
          if (!configurationTarget) return
          void configurationForm
            .validateFields()
            .then((input) => configure.mutate({ id: configurationTarget.id, input }))
        }}
      >
        <Alert
          type="info"
          showIcon
          title={t(
            'networkAccess.proxyRuntime.contentWriteOnly',
            '配置内容只写且不回显。请粘贴完整引擎配置；运行时会在本机注入 loopback controller 与密钥。',
          )}
        />
        <Form form={configurationForm} layout="vertical" className="soha-server-proxy-config-form">
          <Form.Item name="expectedRevision" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="enabled"
            label={t('networkAccess.proxyRuntime.enabled', '启用引擎')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('networkAccess.proxyRuntime.content', '完整配置')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea rows={14} maxLength={1048576} spellCheck={false} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={t('networkAccess.proxyRuntime.enrollmentSecret', '一次性登记信息')}
        open={Boolean(secret)}
        destroyOnHidden
        cancelButtonProps={{ style: { display: 'none' } }}
        okText={t('networkAccess.proxyRuntime.saved', '我已保存')}
        onCancel={() => setSecret(undefined)}
        onOk={() => setSecret(undefined)}
      >
        <Alert
          type="warning"
          showIcon
          title={t(
            'networkAccess.proxyRuntime.secretOnce',
            '令牌只显示一次，请保存到运行时私有文件。有效期 10 分钟。',
          )}
        />
        <div className="soha-server-proxy-secret">
          <Typography.Text>Enrollment ID：{secret?.enrollment.id}</Typography.Text>
          <Typography.Text>Challenge ID：{secret?.enrollment.challengeId}</Typography.Text>
          <Typography.Text copyable={{ text: secret?.token }}>
            {t('networkAccess.proxyRuntime.token', '登记令牌')}：{secret?.token}
          </Typography.Text>
        </div>
      </Modal>
    </main>
  )
}
