import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Space, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementDensityButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { isApiError } from '@/services/api-error'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatIdentityProviderDateTime, identityProviderTagsSummary } from '../presentation'
import { createIdentityOIDCClient, revealIdentityOIDCClientSecret } from '../api'
import { identityProviderKeys } from '../keys'
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
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canRotate: boolean
  onSecretCreated: (secret: IdentityOIDCSecretReveal) => void
  provider: IdentityProvider
}

export function OIDCClientsPanel({
  canCreate,
  canUpdate,
  canDelete,
  canRotate,
  onSecretCreated,
  provider,
}: OIDCClientsPanelProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityOIDCClient | null>(null)
  const [creatingClient, setCreatingClient] = useState(false)
  const [revealingClientId, setRevealingClientId] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')

  const clientsQuery = useQuery(
    identityProviderQueries.oidcClients(provider.id, provider.type === 'oidc'),
  )
  const updateMutation = useMutation(identityProviderMutations.updateOIDCClient(queryClient))
  const deleteMutation = useMutation(identityProviderMutations.removeOIDCClient(queryClient))
  const rotateSigningKeyMutation = useMutation(
    identityProviderMutations.rotateSigningKey(queryClient),
  )

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

  const revealSecret = async (client: IdentityOIDCClient) => {
    setRevealingClientId(client.id)
    try {
      const secret = await revealIdentityOIDCClientSecret(client.id)
      onSecretCreated({ clientId: secret.clientId, clientSecret: secret.clientSecret })
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setRevealingClientId('')
    }
  }

  const createClient = async (input: IdentityOIDCClientInput) => {
    setCreatingClient(true)
    try {
      const result = await createIdentityOIDCClient({ providerId: provider.id, input })
      await queryClient.invalidateQueries({
        queryKey: identityProviderKeys.oidcClients(provider.id),
      })
      message.success(`已创建 OIDC client ${result.client.clientId}`)
      closeModal()
      if (result.clientSecret) {
        onSecretCreated({
          clientId: result.client.clientId,
          clientSecret: result.clientSecret,
        })
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCreatingClient(false)
    }
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
    void createClient(input)
  }

  const columns = useMemo<TableColumnsType<IdentityOIDCClient>>(
    () => [
      {
        title: t('identity.providers.client.id'),
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
        title: t('identity.providers.client.redirectUris'),
        key: 'redirectUris',
        width: 320,
        render: (_, record) =>
          identityProviderTagsSummary([
            ...record.redirectUris,
            ...(record.redirectUriRegexes ?? []).map((pattern) => `正则: ${pattern}`),
          ]),
      },
      {
        title: t('identity.providers.client.type'),
        dataIndex: 'clientType',
        width: 120,
        render: (value: string) => <MetadataTag label={value || 'confidential'} />,
      },
      {
        title: t('identity.providers.client.scopes'),
        dataIndex: 'allowedScopes',
        width: 220,
        render: (values: string[]) => identityProviderTagsSummary(values),
      },
      {
        title: t('identity.providers.client.grantTypes'),
        dataIndex: 'allowedGrantTypes',
        width: 180,
        render: (values: string[]) => identityProviderTagsSummary(values),
      },
      {
        title: t('identity.providers.client.ttl'),
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
        ...tableColumnPresets.status,
        title: t('identity.providers.client.status'),
        dataIndex: 'status',
        render: (value: IdentityOIDCClientStatus, record) => (
          <Space orientation="vertical" size={2}>
            <StatusTag value={value} />
            <MetadataTag
              label={record.requirePkce ? 'PKCE' : 'No PKCE'}
              tone={record.requirePkce ? 'blue' : 'default'}
            />
          </Space>
        ),
      },
      {
        ...tableColumnPresets.datetime,
        title: t('identity.providers.client.updated'),
        dataIndex: 'updatedAt',
        render: formatIdentityProviderDateTime,
      },
      {
        ...tableColumnPresets.action,
        key: 'actions',
        render: (_, record) => (
          <Space size={4}>
            <Popconfirm
              cancelText="取消"
              description="查看操作会记录到审计日志。"
              disabled={
                !canUpdate ||
                record.clientType === 'public' ||
                record.clientSecretAvailable === false
              }
              okButtonProps={{ loading: revealingClientId === record.id }}
              okText="查看"
              title={`查看 ${record.clientId} 的 Client Secret`}
              onConfirm={() => void revealSecret(record)}
            >
              <ManagementIconButton
                aria-label="查看 Client Secret"
                disabled={
                  !canUpdate ||
                  record.clientType === 'public' ||
                  record.clientSecretAvailable === false
                }
                icon={<EyeOutlined />}
                tooltip={
                  record.clientType === 'public'
                    ? 'Public client 不使用 Secret'
                    : record.clientSecretAvailable === false
                      ? 'Secret 不可查看，请编辑并设置新 Secret'
                      : '查看 Client Secret'
                }
              />
            </Popconfirm>
            <ManagementIconButton
              disabled={!canUpdate}
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
              tooltip="编辑"
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canDelete}
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
              <Button danger disabled={!canDelete} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      canDelete,
      canUpdate,
      deleteMutation,
      message,
      onSecretCreated,
      provider.id,
      queryClient,
      revealSecret,
      revealingClientId,
      t,
    ],
  )

  if (provider.type !== 'oidc') {
    return (
      <ManagementState
        compact
        description="OIDC client 仅适用于 OIDC Provider。"
        kind="unsupported"
        title="非 OIDC Provider"
      />
    )
  }

  if (clientsQuery.isError) {
    return (
      <ManagementState
        kind={
          isApiError(clientsQuery.error) && clientsQuery.error.status === 403
            ? 'no-permission'
            : 'error'
        }
        title={t('identity.providers.client.loadError')}
        description={clientsQuery.error.message}
        actions={<Button onClick={() => void clientsQuery.refetch()}>{t('common.retry')}</Button>}
      />
    )
  }

  return (
    <div className="soha-identity-oidc-panel">
      <AdminTable
        shellClassName="soha-management-table-shell"
        columnSettingPlacement="header"
        columnSettingIconOnly
        tableSize={tableSize}
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
        headerExtra={
          <ManagementTableToolbar>
            <Popconfirm
              cancelText="取消"
              description="旧公钥会保留 24 小时，之后使用旧密钥签发的令牌将无法验证。"
              disabled={!canRotate}
              okButtonProps={{ loading: rotateSigningKeyMutation.isPending }}
              okText="轮换"
              onConfirm={() =>
                rotateSigningKeyMutation.mutate(provider.id, {
                  onSuccess: (key) => message.success(`签名密钥已轮换，kid: ${key.kid}`),
                  onError: (error: Error) => message.error(error.message),
                })
              }
              title="轮换 OIDC 签名密钥"
            >
              <ManagementIconButton
                aria-label="轮换签名密钥"
                disabled={!canRotate}
                icon={<KeyOutlined />}
                tooltip="轮换签名密钥"
              />
            </Popconfirm>
            <Button
              disabled={!canCreate}
              icon={<PlusOutlined />}
              onClick={openCreate}
              size="small"
              type="primary"
            >
              新建 client
            </Button>
            <ManagementDensityButton
              aria-label={t('table.density')}
              tooltip={t('table.density')}
              onClick={() => setTableSize((size) => (size === 'small' ? 'middle' : 'small'))}
            />
            <ManagementRefreshButton
              aria-label={t('common.refresh')}
              tooltip={t('common.refresh')}
              loading={clientsQuery.isFetching}
              onClick={() => void clientsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
      />

      <OIDCClientFormModal
        editing={editing}
        onCancel={closeModal}
        onSubmit={submitForm}
        open={modalOpen}
        providerId={provider.id}
        submitting={creatingClient || updateMutation.isPending}
      />
    </div>
  )
}
