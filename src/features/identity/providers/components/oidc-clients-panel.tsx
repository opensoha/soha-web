import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import {
  formatIdentityProviderDateTime,
  identityOIDCClientStatusTag,
  identityProviderTagsSummary,
} from '../presentation'
import { identityProviderMutations } from '../mutations'
import { identityProviderQueries } from '../queries'
import type {
  IdentityOIDCClient,
  IdentityOIDCClientInput,
  IdentityOIDCClientStatus,
  IdentityProvider,
} from '../types'
import { OIDCClientFormModal } from './oidc-client-form-modal'
import type { IdentityOIDCSecretReveal } from './secret-reveal-modal'

const { Text } = Typography

interface OIDCClientsPanelProps {
  canManage: boolean
  onSecretCreated: (secret: IdentityOIDCSecretReveal) => void
  provider: IdentityProvider
}

export function OIDCClientsPanel({ canManage, onSecretCreated, provider }: OIDCClientsPanelProps) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityOIDCClient | null>(null)

  const clientsQuery = useQuery(
    identityProviderQueries.oidcClients(provider.id, provider.type === 'oidc'),
  )
  const createMutation = useMutation(identityProviderMutations.createOIDCClient(queryClient))
  const updateMutation = useMutation(identityProviderMutations.updateOIDCClient(queryClient))
  const deleteMutation = useMutation(identityProviderMutations.removeOIDCClient(queryClient))

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (client: IdentityOIDCClient) => {
    setEditing(client)
    setModalOpen(true)
  }

  const submitForm = (input: IdentityOIDCClientInput) => {
    if (editing) {
      updateMutation.mutate(
        { providerId: provider.id, clientId: editing.id, input },
        {
          onSuccess: (client) => {
            message.success(`已更新 OIDC client ${client.clientId}`)
            closeModal()
          },
          onError: (error: Error) => message.error(error.message),
        },
      )
      return
    }
    createMutation.mutate(
      { providerId: provider.id, input },
      {
        onSuccess: (result) => {
          message.success(`已创建 OIDC client ${result.client.clientId}`)
          closeModal()
          if (result.clientSecret) {
            onSecretCreated({
              clientId: result.client.clientId,
              clientSecret: result.clientSecret,
            })
          }
        },
        onError: (error: Error) => message.error(error.message),
      },
    )
  }

  const columns = useMemo<TableColumnsType<IdentityOIDCClient>>(
    () => [
      {
        title: 'Client',
        dataIndex: 'clientId',
        width: 240,
        render: (value: string, record) => (
          <Space orientation="vertical" size={2}>
            <Text strong ellipsis title={value}>
              {value}
            </Text>
            <Text type="secondary" ellipsis title={record.id}>
              {record.id}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Redirect URIs',
        dataIndex: 'redirectUris',
        width: 320,
        render: (values: string[]) => identityProviderTagsSummary(values),
      },
      {
        title: 'Scopes',
        dataIndex: 'allowedScopes',
        width: 220,
        render: (values: string[]) => identityProviderTagsSummary(values),
      },
      {
        title: 'Grant Types',
        dataIndex: 'allowedGrantTypes',
        width: 180,
        render: (values: string[]) => identityProviderTagsSummary(values),
      },
      {
        title: 'TTL',
        key: 'ttl',
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Text>access {record.accessTokenTtlSeconds}s</Text>
            <Text type="secondary">id {record.idTokenTtlSeconds}s</Text>
          </Space>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: 130,
        render: (value: IdentityOIDCClientStatus, record) => (
          <Space orientation="vertical" size={2}>
            {identityOIDCClientStatusTag(value)}
            <Tag color={record.requirePkce ? 'blue' : 'default'}>
              {record.requirePkce ? 'PKCE' : 'No PKCE'}
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
                deleteMutation.mutate(
                  { providerId: provider.id, clientId: record.id },
                  {
                    onSuccess: () => message.success('OIDC client 已删除'),
                    onError: (error: Error) => message.error(error.message),
                  },
                )
              }
              title={`删除 ${record.clientId}`}
            >
              <Button danger disabled={!canManage} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canManage, deleteMutation, message, provider.id],
  )

  if (provider.type !== 'oidc') {
    return (
      <ManagementState
        compact
        description="当前阶段只管理 OIDC client。"
        kind="unsupported"
        title="Proxy Provider runtime 尚未启用"
      />
    )
  }

  return (
    <div className="soha-identity-oidc-panel">
      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={clientsQuery.data ?? []}
        empty={
          <ManagementState
            description="创建 client 后可接入下游 OIDC 应用。"
            kind="empty"
            title="暂无 OIDC client"
          />
        }
        loading={clientsQuery.isLoading || clientsQuery.isFetching}
        title="OIDC Clients"
        toolbar={
          <ManagementTableToolbar>
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              onClick={openCreate}
              size="small"
              type="primary"
            >
              新建 client
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => clientsQuery.refetch()} size="small">
              刷新
            </Button>
          </ManagementTableToolbar>
        }
      />

      <OIDCClientFormModal
        editing={editing}
        onCancel={closeModal}
        onSubmit={submitForm}
        open={modalOpen}
        providerId={provider.id}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
