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
  NetworkAccessGrant,
  NetworkAccessGrantInput,
  NetworkAccessGrantSecret,
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

interface NetworkAccessGrantPaneProps {
  canCreate: boolean
  canRevoke: boolean
}

type GrantFormValues = Omit<NetworkAccessGrantInput, 'resourceIds'> & {
  resourceIdsText: string
}

const LIST_FILTER = { limit: 200 } as const

export function NetworkAccessGrantPane({ canCreate, canRevoke }: NetworkAccessGrantPaneProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const grants = useQuery(networkAccessQueries.accessGrants(LIST_FILTER))
  const createGrant = useMutation({
    ...networkAccessMutations.accessGrants.create(queryClient),
    onError: (error) => void message.error(error.message),
  })
  const revokeGrant = useMutation({
    ...networkAccessMutations.accessGrants.revoke(queryClient),
    onError: (error) => void message.error(error.message),
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [secret, setSecret] = useState<NetworkAccessGrantSecret | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm<GrantFormValues>()

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    if (!keyword) return grants.data ?? []
    return (grants.data ?? []).filter((item) =>
      [
        item.id,
        item.subjectId,
        item.deviceId,
        item.siteId,
        item.networkSpaceId,
        item.mode,
        item.status,
        ...item.resourceIds,
      ].some((value) => value.toLocaleLowerCase().includes(keyword)),
    )
  }, [grants.data, search])

  function openCreate() {
    form.resetFields()
    form.setFieldsValue({ mode: 'internal_ztna', ttlSeconds: 300 })
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    form.resetFields()
  }

  async function submitCreate() {
    const values = await form.validateFields()
    const resourceIds = [...new Set(values.resourceIdsText.split(/[\s,]+/).filter(Boolean))].sort()
    const result = await createGrant.mutateAsync({
      deviceId: values.deviceId.trim(),
      siteId: values.siteId.trim(),
      networkSpaceId: values.networkSpaceId.trim(),
      mode: values.mode,
      resourceIds,
      ttlSeconds: values.ttlSeconds,
    })
    closeCreate()
    setSecret(result)
  }

  function closeSecret() {
    setSecret(null)
    createGrant.reset()
  }

  const columns: TableColumnsType<NetworkAccessGrant> = [
    { title: t('networkAccess.grant.subjectId', '主体 ID'), dataIndex: 'subjectId' },
    { title: t('networkAccess.grant.deviceId', '设备 ID'), dataIndex: 'deviceId' },
    { title: t('networkAccess.grant.siteId', '站点 ID'), dataIndex: 'siteId' },
    {
      title: t('networkAccess.grant.mode', '访问形态'),
      dataIndex: 'mode',
      width: 180,
    },
    {
      title: t('networkAccess.grant.resources', '资源'),
      dataIndex: 'resourceIds',
      render: (value: string[]) => value.join(', '),
    },
    {
      title: t('networkAccess.status', '状态'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => (
        <Tag color={value === 'issued' ? 'orange' : value === 'consumed' ? 'green' : 'red'}>
          {value}
        </Tag>
      ),
    },
    {
      title: t('networkAccess.grant.expiresAt', '过期时间'),
      dataIndex: 'expiresAt',
      width: 200,
    },
    ...(canRevoke
      ? [
          {
            key: 'actions',
            width: 70,
            render: (_: unknown, item: NetworkAccessGrant) =>
              item.status === 'issued' ? (
                <Popconfirm
                  title={t('networkAccess.grant.confirmRevoke', '确认吊销此访问授权？')}
                  onConfirm={() =>
                    revokeGrant.mutate(item.id, {
                      onSuccess: () =>
                        void message.success(t('networkAccess.grant.revoked', '访问授权已吊销')),
                    })
                  }
                >
                  <ManagementIconButton
                    aria-label={t('networkAccess.grant.revoke', '吊销访问授权')}
                    danger
                    icon={<StopOutlined />}
                    tooltip={t('networkAccess.grant.revoke', '吊销访问授权')}
                  />
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <>
      <AdminTable
        columns={columns}
        dataSource={filtered}
        empty={grants.isError ? <ManagementState compact kind="error" /> : undefined}
        loading={grants.isLoading}
        localSorting
        rowKey="id"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder={t('networkAccess.grant.search', '搜索主体、设备、站点、资源或状态')}
              value={search}
              onChange={setSearch}
            />
            <ManagementIconButton
              aria-label={t('networkAccess.refresh', '刷新')}
              icon={<ReloadOutlined />}
              loading={grants.isFetching}
              tooltip={t('networkAccess.refresh', '刷新')}
              onClick={() => void grants.refetch()}
            />
            {canCreate ? (
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                {t('networkAccess.grant.create', '创建访问授权')}
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
        title={t('networkAccess.grant.create', '创建访问授权')}
        confirmLoading={createGrant.isPending}
        okText={t('common.create', '创建')}
        cancelText={t('common.cancel', '取消')}
        onCancel={closeCreate}
        onOk={() => void submitCreate().catch(() => undefined)}
      >
        <Alert
          showIcon
          type="info"
          title={t('networkAccess.grant.mfaRequired', '创建前需要近期完成 MFA 验证')}
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="deviceId"
            label={t('networkAccess.grant.deviceId', '设备 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="siteId"
            label={t('networkAccess.grant.siteId', '站点 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="networkSpaceId"
            label={t('networkAccess.grant.networkSpaceId', '网络空间 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="mode"
            label={t('networkAccess.grant.mode', '访问形态')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: 'internal_ztna',
                  label: t('networkAccess.mode.internalZtna', '内网 ZTNA'),
                },
                {
                  value: 'external_vpn_ztna',
                  label: t('networkAccess.mode.externalVpnZtna', '外部 VPN + ZTNA'),
                },
                {
                  value: 'external_direct_ztna',
                  label: t('networkAccess.mode.externalDirectZtna', '外部直接 ZTNA'),
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="resourceIdsText"
            label={t('networkAccess.grant.resources', '资源 ID')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea maxLength={33023} rows={3} />
          </Form.Item>
          <Form.Item
            name="ttlSeconds"
            label={t('networkAccess.grant.ttlSeconds', '有效期（秒）')}
            rules={[{ required: true }]}
          >
            <InputNumber min={60} max={300} step={60} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        cancelButtonProps={{ style: { display: 'none' } }}
        open={Boolean(secret)}
        title={t('networkAccess.grant.secretTitle', '一次性访问授权')}
        okText={t('networkAccess.grant.saved', '我已保存')}
        onCancel={closeSecret}
        onOk={closeSecret}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            title={t('networkAccess.grant.secretOnce', '明文授权令牌只展示一次')}
            description={t(
              'networkAccess.grant.secretHint',
              '关闭后无法再次查看；令牌将在首次连接后失效。',
            )}
          />
          <Typography.Text type="secondary">
            {secret?.grant.id} · {secret?.grant.expiresAt}
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
