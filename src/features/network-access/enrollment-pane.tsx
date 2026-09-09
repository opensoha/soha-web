import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import type {
  NetworkRuntimeEnrollment,
  NetworkRuntimeEnrollmentInput,
  NetworkRuntimeEnrollmentSecret,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { useI18n } from '@/i18n'
import { networkAccessMutations } from './mutations'
import { networkAccessQueries } from './queries'

interface NetworkEnrollmentPaneProps {
  canCreate: boolean
  canRevoke: boolean
  runtimeKind?: NetworkRuntimeEnrollmentInput['runtimeKind']
}

const LIST_FILTER = { limit: 200 } as const

export function NetworkEnrollmentPane({
  canCreate,
  canRevoke,
  runtimeKind,
}: NetworkEnrollmentPaneProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const enrollments = useQuery(networkAccessQueries.enrollments(LIST_FILTER))
  const createEnrollment = useMutation(networkAccessMutations.enrollments.create(queryClient))
  const revokeEnrollment = useMutation(networkAccessMutations.enrollments.revoke(queryClient))
  const [createOpen, setCreateOpen] = useState(false)
  const [secret, setSecret] = useState<NetworkRuntimeEnrollmentSecret | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm<NetworkRuntimeEnrollmentInput>()
  const isRadius = runtimeKind === 'nas'

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    const scoped = (enrollments.data ?? []).filter(
      (item) => !runtimeKind || item.runtimeKind === runtimeKind,
    )
    if (!keyword) return scoped
    return scoped.filter((item) =>
      [item.runtimeId, item.runtimeKind, item.deviceId, item.subjectId, item.status].some((value) =>
        value.toLocaleLowerCase().includes(keyword),
      ),
    )
  }, [enrollments.data, runtimeKind, search])

  function openCreate() {
    form.resetFields()
    form.setFieldsValue({ runtimeKind: runtimeKind ?? 'endpoint', ttlSeconds: 600 })
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    form.resetFields()
  }

  async function submitCreate() {
    const values = await form.validateFields()
    const result = await createEnrollment.mutateAsync({
      runtimeId: values.runtimeId.trim(),
      runtimeKind: runtimeKind ?? values.runtimeKind,
      deviceId: values.deviceId.trim(),
      subjectId: values.subjectId.trim(),
      ttlSeconds: values.ttlSeconds,
    })
    closeCreate()
    setSecret(result)
  }

  function closeSecret() {
    setSecret(null)
    createEnrollment.reset()
  }

  const columns: TableColumnsType<NetworkRuntimeEnrollment> = [
    { title: t('networkAccess.enrollment.runtimeId', '运行时 ID'), dataIndex: 'runtimeId' },
    {
      title: t('networkAccess.enrollment.runtimeKind', '运行时类型'),
      dataIndex: 'runtimeKind',
      width: 120,
    },
    { title: t('networkAccess.enrollment.deviceId', '设备 ID'), dataIndex: 'deviceId' },
    { title: t('networkAccess.enrollment.subjectId', '主体 ID'), dataIndex: 'subjectId' },
    {
      title: t('networkAccess.status', '状态'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => (
        <Tag color={value === 'pending' ? 'orange' : value === 'revoked' ? 'red' : 'green'}>
          {value}
        </Tag>
      ),
    },
    {
      title: t('networkAccess.enrollment.expiresAt', '过期时间'),
      dataIndex: 'expiresAt',
      width: 200,
    },
    ...(canRevoke
      ? [
          {
            key: 'actions',
            width: 70,
            render: (_: unknown, item: NetworkRuntimeEnrollment) =>
              item.status === 'pending' ? (
                <Popconfirm
                  title={t('networkAccess.enrollment.confirmRevoke', '确认吊销此注册令牌？')}
                  onConfirm={() =>
                    revokeEnrollment.mutate(item.id, {
                      onSuccess: () =>
                        void message.success(
                          t('networkAccess.enrollment.revoked', '注册令牌已吊销'),
                        ),
                    })
                  }
                >
                  <ManagementIconButton
                    aria-label={t('networkAccess.enrollment.revoke', '吊销注册令牌')}
                    danger
                    icon={<StopOutlined />}
                    tooltip={t('networkAccess.enrollment.revoke', '吊销注册令牌')}
                  />
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <>
      {isRadius ? (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          title={t('networkAccess.radius.runtimeTitle', '接入 FreeRADIUS 服务')}
          description={t(
            'networkAccess.radius.runtimeHint',
            '先创建一次性注册令牌，再由 Docker Compose、Kubernetes 或独立 FreeRADIUS 实例完成注册；密钥不会保存在网络设备记录中。',
          )}
        />
      ) : null}
      <AdminTable
        columns={columns}
        dataSource={filtered}
        empty={enrollments.isError ? <ManagementState compact kind="error" /> : undefined}
        loading={enrollments.isLoading}
        localSorting
        rowKey="id"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder={t('networkAccess.enrollment.search', '搜索运行时、设备、主体或状态')}
              value={search}
              onChange={setSearch}
            />
            <ManagementIconButton
              aria-label={t('networkAccess.refresh', '刷新')}
              icon={<ReloadOutlined />}
              loading={enrollments.isFetching}
              tooltip={t('networkAccess.refresh', '刷新')}
              onClick={() => void enrollments.refetch()}
            />
            {canCreate ? (
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                {isRadius
                  ? t('networkAccess.radius.connect', '接入 RADIUS 服务')
                  : t('networkAccess.enrollment.create', '创建注册令牌')}
              </Button>
            ) : null}
          </ManagementTableToolbar>
        }
        viewportScroll
      />

      <Modal
        centered
        destroyOnHidden
        mask={{ closable: false }}
        open={createOpen}
        title={
          isRadius
            ? t('networkAccess.radius.connect', '接入 RADIUS 服务')
            : t('networkAccess.enrollment.create', '创建注册令牌')
        }
        confirmLoading={createEnrollment.isPending}
        okText={t('common.create', '创建')}
        cancelText={t('common.cancel', '取消')}
        onCancel={closeCreate}
        onOk={() => void submitCreate()}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="runtimeId"
            label={t('networkAccess.enrollment.runtimeId', '运行时 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          {runtimeKind ? (
            <Form.Item label={t('networkAccess.enrollment.runtimeKind', '运行时类型')}>
              <Input value={runtimeKind} disabled />
            </Form.Item>
          ) : (
            <Form.Item
              name="runtimeKind"
              label={t('networkAccess.enrollment.runtimeKind', '运行时类型')}
              rules={[{ required: true }]}
            >
              <Select
                options={['endpoint', 'gateway', 'nas'].map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="deviceId"
            label={t('networkAccess.enrollment.deviceId', '设备 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="subjectId"
            label={t('networkAccess.enrollment.subjectId', '主体 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="ttlSeconds"
            label={t('networkAccess.enrollment.ttlSeconds', '有效期（秒）')}
            rules={[{ required: true }]}
          >
            <InputNumber min={60} max={600} step={60} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        cancelButtonProps={{ style: { display: 'none' } }}
        open={Boolean(secret)}
        title={t('networkAccess.enrollment.secretTitle', '一次性注册令牌')}
        okText={t('networkAccess.enrollment.saved', '我已保存')}
        onCancel={closeSecret}
        onOk={closeSecret}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            title={t('networkAccess.enrollment.secretOnce', '明文令牌只展示一次')}
            description={t(
              'networkAccess.enrollment.secretHint',
              '关闭后无法再次查看；如未完成注册，请吊销并重新创建。',
            )}
          />
          <Typography.Text type="secondary">
            {secret?.enrollment.runtimeId} · {secret?.enrollment.expiresAt}
          </Typography.Text>
          <Typography.Text
            code
            copyable={{ text: secret?.token ?? '' }}
            style={{ wordBreak: 'break-all' }}
          >
            {secret?.token}
          </Typography.Text>
        </Space>
      </Modal>
    </>
  )
}
