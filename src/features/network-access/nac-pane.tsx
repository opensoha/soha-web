import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import type {
  NetworkAccessDeviceType,
  NetworkAccessMedium,
  NetworkAccessProfile,
  NetworkNASBinding,
  NetworkNASBindingInput,
  NetworkNASBindingStatus,
  NetworkSession,
  NetworkSessionAction,
  NetworkSessionActionPlan,
  NetworkSiteProfileBinding,
  NetworkSiteProfileBindingInput,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { ManagementIconButton } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { networkAccessMutations } from './mutations'
import { networkAccessQueries } from './queries'
import { TablePane } from './table-pane'

const LIST_FILTER = { limit: 200 } as const
const ACCESS_PROFILES: NetworkAccessProfile[] = [
  'onboarding',
  'full',
  'restricted',
  'quarantine',
  'deny',
]

interface NASBindingValues {
  accessMedium: NetworkAccessMedium
  coaSupported: boolean
  deviceType: NetworkAccessDeviceType
  disconnectSupported: boolean
  managementAddress?: string
  name: string
  nasId: string
  runtimeId: string
  siteId: string
  ssid?: string
  status: NetworkNASBindingStatus
}

interface NetworkNASBindingsPaneProps {
  canManage: boolean
  view?: 'network-device' | 'ssid' | 'user-admission'
}

export function NetworkNASBindingsPane({
  canManage,
  view = 'network-device',
}: NetworkNASBindingsPaneProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const query = useQuery(networkAccessQueries.nasBindings(LIST_FILTER))
  const create = useMutation(networkAccessMutations.nasBindings.create(queryClient))
  const update = useMutation(networkAccessMutations.nasBindings.update(queryClient))
  const remove = useMutation(networkAccessMutations.nasBindings.remove(queryClient))
  const [editing, setEditing] = useState<NetworkNASBinding | null | undefined>(undefined)
  const [form] = Form.useForm<NASBindingValues>()
  const selectedMedium = Form.useWatch('accessMedium', form)
  const fixedMedium: NetworkAccessMedium | undefined = view === 'ssid' ? 'wifi' : undefined
  const items = fixedMedium
    ? query.data?.filter((item) => item.accessMedium === fixedMedium)
    : query.data
  const addLabel =
    view === 'user-admission'
      ? t('networkAccess.add.admission', '新增入网配置')
      : view === 'ssid'
        ? t('networkAccess.add.ssid', '新增 SSID')
        : t('networkAccess.add.networkDevice', '新增网络设备')
  const editLabel =
    view === 'user-admission'
      ? t('networkAccess.edit.admission', '编辑入网配置')
      : view === 'ssid'
        ? t('networkAccess.edit.ssid', '编辑 SSID')
        : t('networkAccess.edit.networkDevice', '编辑网络设备')
  const deleteLabel =
    view === 'user-admission'
      ? t('networkAccess.delete.admission', '删除入网配置')
      : view === 'ssid'
        ? t('networkAccess.delete.ssid', '删除 SSID')
        : t('networkAccess.delete.networkDevice', '删除网络设备')
  const confirmDeleteLabel =
    view === 'user-admission'
      ? t('networkAccess.confirmDelete.admission', '确认删除入网配置？')
      : view === 'ssid'
        ? t('networkAccess.confirmDelete.ssid', '确认删除 SSID？')
        : t('networkAccess.confirmDelete.networkDevice', '确认删除网络设备？')
  const searchPlaceholder =
    view === 'user-admission'
      ? t('networkAccess.search.admission', '搜索 Wi-Fi、有线、SSID、NAS、运行时或站点')
      : view === 'ssid'
        ? t('networkAccess.search.ssids', '搜索 SSID、无线设备、NAS、运行时或站点')
        : t('networkAccess.search.networkDevices', '搜索设备、SSID、NAS、运行时或站点')

  function openEditor(record: NetworkNASBinding | null) {
    setEditing(record)
    form.setFieldsValue(
      record ?? {
        accessMedium: fixedMedium ?? 'wired',
        name: '',
        nasId: '',
        runtimeId: '',
        siteId: '',
        deviceType: fixedMedium === 'wifi' ? 'wireless_controller' : 'switch',
        status: 'active',
        coaSupported: true,
        disconnectSupported: true,
      },
    )
  }

  function closeEditor() {
    setEditing(undefined)
    form.resetFields()
  }

  async function submit() {
    const values = await form.validateFields()
    const input: NetworkNASBindingInput = {
      name: values.name.trim(),
      nasId: values.nasId.trim(),
      runtimeId: values.runtimeId.trim(),
      siteId: values.siteId.trim(),
      accessMedium: fixedMedium ?? values.accessMedium,
      deviceType: values.deviceType,
      ...(selectedMedium === 'wifi' && values.ssid?.trim() ? { ssid: values.ssid.trim() } : {}),
      ...(values.managementAddress?.trim()
        ? { managementAddress: values.managementAddress.trim() }
        : {}),
      status: values.status,
      coaSupported: values.coaSupported,
      disconnectSupported: values.disconnectSupported,
    }
    if (editing) await update.mutateAsync({ bindingId: editing.id, input })
    else await create.mutateAsync(input)
    void message.success(t('networkAccess.saved', '已保存'))
    closeEditor()
  }

  const columns: TableColumnsType<NetworkNASBinding> = [
    { title: t('networkAccess.name', '名称'), dataIndex: 'name', width: 180 },
    {
      title: t('networkAccess.accessMedium', '入网方式'),
      dataIndex: 'accessMedium',
      width: 110,
      render: (value?: NetworkAccessMedium) =>
        value === 'wifi' ? 'Wi-Fi' : value === 'wired' ? t('networkAccess.wired', '有线') : '-',
    },
    {
      title: t('networkAccess.deviceType', '设备类型'),
      dataIndex: 'deviceType',
      width: 130,
      render: (value?: NetworkAccessDeviceType) => {
        if (!value) return '-'
        const labels: Record<NetworkAccessDeviceType, string> = {
          wireless_controller: t('networkAccess.deviceType.controller', '无线控制器'),
          access_point: t('networkAccess.deviceType.ap', '无线 AP'),
          switch: t('networkAccess.deviceType.switch', '交换机'),
          other: t('networkAccess.deviceType.other', '其他'),
        }
        return labels[value]
      },
    },
    { title: 'SSID', dataIndex: 'ssid', width: 150, render: (value?: string) => value || '-' },
    {
      title: t('networkAccess.managementAddress', '管理地址'),
      dataIndex: 'managementAddress',
      width: 170,
      render: (value?: string) => value || '-',
    },
    { title: 'NAS ID', dataIndex: 'nasId', width: 180 },
    { title: t('networkAccess.runtimeId', '运行时 ID'), dataIndex: 'runtimeId', width: 180 },
    { title: t('networkAccess.siteId', '站点 ID'), dataIndex: 'siteId', width: 180 },
    {
      title: 'CoA',
      dataIndex: 'coaSupported',
      width: 90,
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    {
      title: t('networkAccess.disconnect', '断线'),
      dataIndex: 'disconnectSupported',
      width: 90,
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    {
      title: t('networkAccess.status', '状态'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            width: 96,
            render: (_: unknown, record: NetworkNASBinding) => (
              <Space className="soha-row-action-icons">
                <ManagementIconButton
                  aria-label={editLabel}
                  icon={<EditOutlined />}
                  tooltip={t('common.edit', '编辑')}
                  onClick={() => openEditor(record)}
                />
                <Popconfirm
                  title={confirmDeleteLabel}
                  onConfirm={() =>
                    remove.mutate(record.id, {
                      onSuccess: () => void message.success(t('networkAccess.deleted', '已删除')),
                    })
                  }
                >
                  <ManagementIconButton
                    aria-label={deleteLabel}
                    danger
                    icon={<DeleteOutlined />}
                    tooltip={t('common.delete', '删除')}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <TablePane
        columns={columns}
        items={items}
        loading={query.isLoading}
        refreshing={query.isFetching}
        error={query.isError}
        onRefresh={() => void query.refetch()}
        searchPlaceholder={searchPlaceholder}
        getSearchValues={(item) => [
          item.name,
          item.nasId,
          item.runtimeId,
          item.siteId,
          item.accessMedium,
          item.deviceType,
          item.ssid,
          item.managementAddress,
          item.status,
        ]}
        createAction={
          canManage ? (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditor(null)}
            >
              {addLabel}
            </Button>
          ) : null
        }
      />
      <Modal
        centered
        destroyOnHidden
        mask={{ closable: false }}
        open={editing !== undefined}
        title={editing ? editLabel : addLabel}
        confirmLoading={create.isPending || update.isPending}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        onCancel={closeEditor}
        onOk={() => void submit()}
      >
        <Form form={form} layout="vertical">
          {[
            ['name', t('networkAccess.name', '名称')],
            ['nasId', 'NAS ID'],
            ['runtimeId', t('networkAccess.runtimeId', '运行时 ID')],
            ['siteId', t('networkAccess.siteId', '站点 ID')],
          ].map(([name, label]) => (
            <Form.Item
              key={name}
              name={name}
              label={label}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: t('networkAccess.form.required', '必填项'),
                },
              ]}
            >
              <Input maxLength={name === 'name' ? 200 : 128} />
            </Form.Item>
          ))}
          <Form.Item
            name="accessMedium"
            label={t('networkAccess.accessMedium', '入网方式')}
            rules={[{ required: true }]}
          >
            <Select
              disabled={Boolean(fixedMedium)}
              options={[
                { value: 'wifi', label: 'Wi-Fi' },
                { value: 'wired', label: t('networkAccess.wired', '有线') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="deviceType"
            label={t('networkAccess.deviceType', '设备类型')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: 'wireless_controller',
                  label: t('networkAccess.deviceType.controller', '无线控制器'),
                },
                { value: 'access_point', label: t('networkAccess.deviceType.ap', '无线 AP') },
                { value: 'switch', label: t('networkAccess.deviceType.switch', '交换机') },
                { value: 'other', label: t('networkAccess.deviceType.other', '其他') },
              ]}
            />
          </Form.Item>
          {selectedMedium === 'wifi' ? (
            <Form.Item name="ssid" label="SSID">
              <Input maxLength={32} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="managementAddress"
            label={t('networkAccess.managementAddress', '管理地址')}
            extra={t(
              'networkAccess.managementAddressHint',
              '填写交换机、AP 或无线控制器的管理 IP/主机名，不保存设备密码。',
            )}
          >
            <Input maxLength={255} placeholder="10.0.10.2" />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('networkAccess.status', '状态')}
            rules={[{ required: true }]}
          >
            <Select options={['active', 'disabled'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="coaSupported" label="CoA" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="disconnectSupported"
            label={t('networkAccess.disconnectSupported', '支持断线重认证')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

interface SiteProfileValues {
  accessProfile: NetworkAccessProfile
  filterId?: string
  sessionTimeoutSeconds: number
  siteId: string
  vlanId?: number
}

export function NetworkSiteProfileBindingsPane({ canManage }: { canManage: boolean }) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const query = useQuery(networkAccessQueries.siteProfileBindings(LIST_FILTER))
  const create = useMutation(networkAccessMutations.siteProfileBindings.create(queryClient))
  const update = useMutation(networkAccessMutations.siteProfileBindings.update(queryClient))
  const remove = useMutation(networkAccessMutations.siteProfileBindings.remove(queryClient))
  const [editing, setEditing] = useState<NetworkSiteProfileBinding | null | undefined>(undefined)
  const [form] = Form.useForm<SiteProfileValues>()

  function openEditor(record: NetworkSiteProfileBinding | null) {
    setEditing(record)
    form.setFieldsValue(
      record ?? { siteId: '', accessProfile: 'restricted', sessionTimeoutSeconds: 900 },
    )
  }

  function closeEditor() {
    setEditing(undefined)
    form.resetFields()
  }

  async function submit() {
    const values = await form.validateFields()
    const input: NetworkSiteProfileBindingInput = {
      siteId: values.siteId.trim(),
      accessProfile: values.accessProfile,
      sessionTimeoutSeconds: values.sessionTimeoutSeconds,
      ...(values.vlanId ? { vlanId: values.vlanId } : {}),
      ...(values.filterId?.trim() ? { filterId: values.filterId.trim() } : {}),
    }
    if (editing) await update.mutateAsync({ bindingId: editing.id, input })
    else await create.mutateAsync(input)
    void message.success(t('networkAccess.saved', '已保存'))
    closeEditor()
  }

  const columns: TableColumnsType<NetworkSiteProfileBinding> = [
    { title: t('networkAccess.siteId', '站点 ID'), dataIndex: 'siteId', width: 200 },
    {
      title: t('networkAccess.accessProfile', '接入等级'),
      dataIndex: 'accessProfile',
      width: 140,
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: 'VLAN', dataIndex: 'vlanId', width: 90, render: (value?: number) => value ?? '-' },
    {
      title: 'Filter-Id',
      dataIndex: 'filterId',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: t('networkAccess.sessionTimeout', '会话时长（秒）'),
      dataIndex: 'sessionTimeoutSeconds',
      width: 150,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            width: 96,
            render: (_: unknown, record: NetworkSiteProfileBinding) => (
              <Space className="soha-row-action-icons">
                <ManagementIconButton
                  aria-label={t('networkAccess.edit.siteProfile', '编辑接入等级')}
                  icon={<EditOutlined />}
                  tooltip={t('common.edit', '编辑')}
                  onClick={() => openEditor(record)}
                />
                <Popconfirm
                  title={t('networkAccess.confirmDelete.siteProfile', '确认删除接入等级？')}
                  onConfirm={() =>
                    remove.mutate(record.id, {
                      onSuccess: () => void message.success(t('networkAccess.deleted', '已删除')),
                    })
                  }
                >
                  <ManagementIconButton
                    aria-label={t('networkAccess.delete.siteProfile', '删除接入等级')}
                    danger
                    icon={<DeleteOutlined />}
                    tooltip={t('common.delete', '删除')}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <TablePane
        columns={columns}
        items={query.data}
        loading={query.isLoading}
        refreshing={query.isFetching}
        error={query.isError}
        onRefresh={() => void query.refetch()}
        searchPlaceholder={t('networkAccess.search.siteProfiles', '搜索站点、等级或 Filter-Id')}
        getSearchValues={(item) => [item.siteId, item.accessProfile, item.filterId, item.vlanId]}
        createAction={
          canManage ? (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditor(null)}
            >
              {t('networkAccess.add.siteProfile', '新增接入等级')}
            </Button>
          ) : null
        }
      />
      <Modal
        centered
        destroyOnHidden
        mask={{ closable: false }}
        open={editing !== undefined}
        title={
          editing
            ? t('networkAccess.edit.siteProfile', '编辑接入等级')
            : t('networkAccess.add.siteProfile', '新增接入等级')
        }
        confirmLoading={create.isPending || update.isPending}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        onCancel={closeEditor}
        onOk={() => void submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="siteId"
            label={t('networkAccess.siteId', '站点 ID')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('networkAccess.form.required', '必填项'),
              },
            ]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="accessProfile"
            label={t('networkAccess.accessProfile', '接入等级')}
            rules={[{ required: true }]}
          >
            <Select options={ACCESS_PROFILES.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="vlanId" label="VLAN ID">
            <InputNumber min={1} max={4094} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="filterId" label="Filter-Id">
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="sessionTimeoutSeconds"
            label={t('networkAccess.sessionTimeout', '会话时长（秒）')}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={86400} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

interface SessionActionValues {
  action: NetworkSessionAction
  reasonCode: string
  targetAccessProfile: NetworkAccessProfile
}

export function NetworkSessionsPane({ canManage }: { canManage: boolean }) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const query = useQuery(networkAccessQueries.sessions(LIST_FILTER))
  const planAction = useMutation(networkAccessMutations.sessions.plan())
  const executeAction = useMutation(networkAccessMutations.sessions.execute(queryClient))
  const [session, setSession] = useState<NetworkSession | null>(null)
  const [plan, setPlan] = useState<NetworkSessionActionPlan | null>(null)
  const [form] = Form.useForm<SessionActionValues>()

  function openAction(record: NetworkSession) {
    setSession(record)
    setPlan(null)
    form.setFieldsValue({ action: 'coa', reasonCode: '', targetAccessProfile: undefined })
  }

  function closeAction() {
    setSession(null)
    setPlan(null)
    form.resetFields()
  }

  async function submitAction() {
    if (!session) return
    if (!plan) {
      const values = await form.validateFields()
      const next = await planAction.mutateAsync({
        sessionId: session.id,
        input: { ...values, reasonCode: values.reasonCode.trim() },
      })
      setPlan(next)
      return
    }
    const command = await executeAction.mutateAsync({
      sessionId: session.id,
      input: {
        action: plan.requestedAction,
        targetAccessProfile: plan.targetAccessProfile,
        reasonCode: plan.reasonCode,
        planHash: plan.planHash,
      },
    })
    void message.success(
      t('networkAccess.sessionActionQueued', '命令已入队：{status}').replace(
        '{status}',
        command.status,
      ),
    )
    closeAction()
  }

  const columns: TableColumnsType<NetworkSession> = [
    { title: t('networkAccess.subjectId', '用户 ID'), dataIndex: 'subjectId', width: 190 },
    { title: t('networkAccess.deviceId', '设备 ID'), dataIndex: 'deviceId', width: 190 },
    {
      title: t('networkAccess.siteId', '站点 ID'),
      dataIndex: 'siteId',
      width: 160,
      render: (value) => value || '-',
    },
    { title: 'NAS ID', dataIndex: 'nasId', width: 150, render: (value) => value || '-' },
    { title: t('networkAccess.mode', '接入模式'), dataIndex: 'mode', width: 150 },
    { title: t('networkAccess.pathMode', '路径'), dataIndex: 'path', width: 140 },
    {
      title: t('networkAccess.accessProfile', '接入等级'),
      dataIndex: 'accessProfile',
      width: 130,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: t('networkAccess.status', '状态'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: t('networkAccess.policyVersion', '策略版本'), dataIndex: 'policyVersion', width: 110 },
    ...(canManage
      ? [
          {
            key: 'actions',
            width: 64,
            render: (_: unknown, record: NetworkSession) => (
              <ManagementIconButton
                aria-label={t('networkAccess.sessionAction', '调整会话访问')}
                disabled={record.status !== 'active'}
                icon={<SafetyCertificateOutlined />}
                tooltip={t('networkAccess.sessionAction', '调整会话访问')}
                onClick={() => openAction(record)}
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <TablePane
        columns={columns}
        items={query.data}
        loading={query.isLoading}
        refreshing={query.isFetching}
        error={query.isError}
        onRefresh={() => void query.refetch()}
        searchPlaceholder={t('networkAccess.search.sessions', '搜索用户、设备、站点或 NAS')}
        getSearchValues={(item) => [
          item.subjectId,
          item.deviceId,
          item.siteId,
          item.nasId,
          item.mode,
          item.path,
          item.accessProfile,
          item.status,
        ]}
      />
      <Modal
        centered
        destroyOnHidden
        mask={{ closable: false }}
        width={640}
        open={Boolean(session)}
        title={t('networkAccess.sessionAction', '调整会话访问')}
        confirmLoading={planAction.isPending || executeAction.isPending}
        okButtonProps={{ danger: Boolean(plan?.willDisconnect) }}
        okText={
          plan
            ? t('networkAccess.sessionActionExecute', '确认执行')
            : t('networkAccess.sessionActionPlan', '生成计划')
        }
        cancelText={t('common.cancel', '取消')}
        onCancel={closeAction}
        onOk={() => void submitAction()}
      >
        <Form form={form} layout="vertical" disabled={Boolean(plan)}>
          <Form.Item
            name="action"
            label={t('networkAccess.requestedAction', '请求动作')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'coa', label: 'CoA' },
                { value: 'disconnect', label: t('networkAccess.disconnect', '断线') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="targetAccessProfile"
            label={t('networkAccess.targetAccessProfile', '目标接入等级')}
            rules={[
              { required: true },
              {
                validator: (_, value) =>
                  value && value !== session?.accessProfile
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t('networkAccess.sessionActionNoop', '目标接入等级必须发生变化')),
                      ),
              },
            ]}
          >
            <Select options={ACCESS_PROFILES.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item
            name="reasonCode"
            label={t('networkAccess.reasonCode', '原因代码')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('networkAccess.form.required', '必填项'),
              },
            ]}
          >
            <Input maxLength={128} placeholder="risk_change" />
          </Form.Item>
        </Form>
        {plan ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {plan.willDisconnect ? (
              <Alert
                showIcon
                type="warning"
                title={t(
                  'networkAccess.sessionWillDisconnect',
                  '该操作会断开当前会话并要求重新认证',
                )}
                description={
                  plan.effectiveAction !== plan.requestedAction
                    ? t('networkAccess.coaFallback', 'NAS 不支持 CoA，已安全降级为断线重认证。')
                    : undefined
                }
              />
            ) : null}
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'requested',
                  label: t('networkAccess.requestedAction', '请求动作'),
                  children: plan.requestedAction,
                },
                {
                  key: 'effective',
                  label: t('networkAccess.effectiveAction', '实际动作'),
                  children: plan.effectiveAction,
                },
                {
                  key: 'current',
                  label: t('networkAccess.currentAccessProfile', '当前等级'),
                  children: plan.currentAccessProfile,
                },
                {
                  key: 'target',
                  label: t('networkAccess.targetAccessProfile', '目标接入等级'),
                  children: plan.targetAccessProfile,
                },
                {
                  key: 'expires',
                  label: t('networkAccess.commandExpiresAt', '命令过期时间'),
                  children: plan.commandExpiresAt,
                  span: 2,
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  )
}
