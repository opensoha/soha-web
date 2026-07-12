import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { identityApplicationQueries } from '../applications'
import type { IdentityApplication } from '../shared/types'
import { identityOutpostQueries } from '../outposts'
import { OIDCClientsPanel } from './components/oidc-clients-panel'
import { ProviderFormModal } from './components/provider-form-modal'
import { SecretRevealModal, type IdentityOIDCSecretReveal } from './components/secret-reveal-modal'
import { identityProviderMutations } from './mutations'
import { formatIdentityProviderDateTime, identityProviderStatusTag } from './presentation'
import { providerStatusOptions, providerTypeOptions } from './provider-form-model'
import { identityProviderQueries } from './queries'
import type {
  IdentityProvider,
  IdentityProviderFilters,
  IdentityProviderInput,
  IdentityRuntimeProviderStatus,
  IdentityRuntimeProviderType,
} from './types'
import './styles.css'

const { Text } = Typography

interface IdentityProviderPageFilters extends IdentityProviderFilters {
  query: string
}

function ProviderNameCell({ provider }: { provider: IdentityProvider }) {
  return (
    <div className="soha-identity-provider-name-cell">
      <div className="soha-identity-provider-icon">
        <ApiOutlined />
      </div>
      <div className="soha-identity-provider-copy">
        <Text strong ellipsis title={provider.name}>
          {provider.name}
        </Text>
        <Text type="secondary" ellipsis title={provider.id}>
          {provider.id}
        </Text>
      </div>
    </div>
  )
}

export function IdentityProvidersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IdentityProviderPageFilters>({
    query: '',
    status: '',
    type: '',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityProvider | null>(null)
  const [createdSecret, setCreatedSecret] = useState<IdentityOIDCSecretReveal | null>(null)
  const [formProviderType, setFormProviderType] = useState<IdentityRuntimeProviderType>('oidc')
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.providers.manage')

  const providersQuery = useQuery(
    identityProviderQueries.list({ status: filters.status, type: filters.type }),
  )
  const applicationsQuery = useQuery(identityApplicationQueries.list({}))
  const outpostsQuery = useQuery({
    ...identityOutpostQueries.list(),
    enabled: modalOpen && formProviderType === 'proxy',
  })
  const createMutation = useMutation(identityProviderMutations.create(queryClient))
  const updateMutation = useMutation(identityProviderMutations.update(queryClient))
  const deleteMutation = useMutation(identityProviderMutations.remove(queryClient))

  const applications = applicationsQuery.data ?? []
  const applicationById = useMemo(() => {
    const result = new Map<string, IdentityApplication>()
    applications.forEach((application) => result.set(application.id, application))
    return result
  }, [applications])
  const applicationOptions = useMemo(
    () =>
      applications.map((application) => ({
        label: `${application.name} (${application.slug})`,
        value: application.id,
      })),
    [applications],
  )
  const outpostOptions = useMemo(
    () =>
      (outpostsQuery.data ?? []).map((outpost) => ({
        label: `${outpost.name} (${outpost.mode})`,
        value: outpost.id,
      })),
    [outpostsQuery.data],
  )

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setFormProviderType('oidc')
    setModalOpen(true)
  }

  const openEdit = (provider: IdentityProvider) => {
    setEditing(provider)
    setFormProviderType(provider.type)
    setModalOpen(true)
  }

  const submitForm = (input: IdentityProviderInput) => {
    if (editing) {
      updateMutation.mutate(
        { providerId: editing.id, input },
        {
          onSuccess: (provider) => {
            message.success(`已更新 ${provider.name}`)
            closeModal()
          },
          onError: (error: Error) => message.error(error.message),
        },
      )
      return
    }
    createMutation.mutate(input, {
      onSuccess: (provider) => {
        message.success(`已创建 ${provider.name}`)
        closeModal()
      },
      onError: (error: Error) => message.error(error.message),
    })
  }

  const filteredProviders = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const providers = providersQuery.data ?? []
    if (!query) return providers
    return providers.filter((provider) => {
      const application = applicationById.get(provider.applicationId)
      return [
        provider.name,
        provider.id,
        provider.applicationId,
        application?.name,
        application?.slug,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      )
    })
  }, [applicationById, filters.query, providersQuery.data])

  const columns = useMemo<TableColumnsType<IdentityProvider>>(
    () => [
      {
        title: 'Provider',
        dataIndex: 'name',
        width: 300,
        render: (_, record) => <ProviderNameCell provider={record} />,
      },
      {
        title: 'Type',
        dataIndex: 'type',
        width: 140,
        render: (value: IdentityRuntimeProviderType) => (
          <Tag color={value === 'oidc' ? 'blue' : 'gold'}>{value.toUpperCase()}</Tag>
        ),
      },
      {
        title: 'Application',
        dataIndex: 'applicationId',
        width: 260,
        render: (value: string) => {
          const application = applicationById.get(value)
          return (
            <Space orientation="vertical" size={2}>
              <Text ellipsis title={application?.name ?? value}>
                {application?.name ?? value}
              </Text>
              {application?.slug ? <Text type="secondary">{application.slug}</Text> : null}
            </Space>
          )
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: 150,
        render: (value: IdentityRuntimeProviderStatus, record) => (
          <Space orientation="vertical" size={2}>
            {identityProviderStatusTag(value)}
            <Tag color={record.enabled ? 'green' : 'default'}>
              {record.enabled ? 'Runtime on' : 'Runtime off'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatIdentityProviderDateTime,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              disabled={!canManage}
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
              tooltip="编辑"
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canManage}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText="删除"
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () => message.success('Provider 已删除'),
                  onError: (error: Error) => message.error(error.message),
                })
              }
              title={`删除 ${record.name}`}
            >
              <Button danger disabled={!canManage} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [applicationById, canManage, deleteMutation, message],
  )

  return (
    <div className="soha-page soha-identity-providers-page">
      <ManagementDetailHeader
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => providersQuery.refetch()}>
              刷新
            </Button>
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              onClick={openCreate}
              type="primary"
            >
              新建 Provider
            </Button>
          </Space>
        }
        description="管理 Soha 对下游应用暴露的 OIDC / Proxy Provider。OIDC client 可在展开行中维护。"
        title="Identity Providers"
      />

      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={filteredProviders}
        empty={
          <ManagementState
            description="创建 Provider 后可为下游应用提供统一登录。"
            kind="empty"
            title="暂无 Provider"
          />
        }
        expandable={{
          expandedRowRender: (record: IdentityProvider) => (
            <OIDCClientsPanel
              canManage={canManage}
              onSecretCreated={setCreatedSecret}
              provider={record}
            />
          ),
          rowExpandable: (record: IdentityProvider) => record.type === 'oidc',
        }}
        loading={providersQuery.isLoading || providersQuery.isFetching}
        title="Provider 列表"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
              placeholder="搜索 Provider 或应用"
              value={filters.query}
            />
            <Select
              allowClear
              onChange={(value) => setFilters((current) => ({ ...current, type: value ?? '' }))}
              options={providerTypeOptions}
              placeholder="类型"
              style={{ width: 140 }}
              value={filters.type || undefined}
            />
            <Select
              allowClear
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
              options={providerStatusOptions}
              placeholder="状态"
              style={{ width: 150 }}
              value={filters.status || undefined}
            />
          </ManagementTableToolbar>
        }
      />

      <ProviderFormModal
        applicationOptions={applicationOptions}
        applicationsLoading={applicationsQuery.isLoading || applicationsQuery.isFetching}
        editing={editing}
        onCancel={closeModal}
        onProviderTypeChange={setFormProviderType}
        onSubmit={submitForm}
        open={modalOpen}
        outpostLoading={outpostsQuery.isLoading || outpostsQuery.isFetching}
        outpostOptions={outpostOptions}
        providerType={formProviderType}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <SecretRevealModal onClose={() => setCreatedSecret(null)} value={createdSecret} />
    </div>
  )
}
