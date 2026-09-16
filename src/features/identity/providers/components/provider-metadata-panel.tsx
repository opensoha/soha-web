import { useState } from 'react'
import { Button, Form, Select, Space, Tooltip, Typography } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import { ManagementRefreshButton, ManagementState } from '@/components/management-list'
import { accessQueries } from '@/features/access'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { identityProviderQueries } from '../queries'
import type { IdentityProvider } from '../types'

export function ProviderProtocolMetadataPanel({ provider }: { provider: IdentityProvider }) {
  const { t } = useI18n()
  const query = useQuery(identityProviderQueries.protocolMetadata(provider))
  return (
    <div className="soha-identity-provider-metadata">
      <div className="soha-identity-provider-setup-summary">
        <Typography.Text strong>
          {provider.type === 'oidc' ? 'OpenID Connect Discovery' : 'SAML IdP Metadata'}
        </Typography.Text>
        <Space>
          {query.data && (
            <Typography.Text copyable={{ text: query.data }}>
              {t('common.copy', '复制')}
            </Typography.Text>
          )}
          <ManagementRefreshButton
            loading={query.isFetching}
            onClick={() => void query.refetch()}
            tooltip={t('common.refresh', '刷新')}
          />
        </Space>
      </div>
      {query.isPending ? (
        <ManagementState kind="loading" compact />
      ) : query.isError ? (
        <ManagementState
          kind="error"
          title={t('identity.providers.metadata.failed')}
          description={query.error.message}
          actions={
            <Button onClick={() => void query.refetch()}>{t('common.retry', '重试')}</Button>
          }
        />
      ) : (
        <pre className="soha-json-block" aria-label={t('identity.providers.tabs.protocolMetadata')}>
          {query.data}
        </pre>
      )}
    </div>
  )
}

export function ProviderUserMetadataPanel({ provider }: { provider: IdentityProvider }) {
  const { t } = useI18n()
  const snapshot = usePermissionSnapshot().data?.data
  const canViewUsers = hasPermission(snapshot, 'access.users.view')
  const users = useQuery(accessQueries.users(canViewUsers))
  const clients = useQuery(
    identityProviderQueries.oidcClients(provider.id, canViewUsers && provider.type === 'oidc'),
  )
  const [selection, setSelection] = useState<{ userId: string; clientId?: string } | null>(null)
  const metadata = useQuery({
    ...identityProviderQueries.userMetadata(
      provider.id,
      selection?.userId ?? '',
      selection?.clientId,
    ),
    enabled: canViewUsers && Boolean(selection),
  })
  if (!canViewUsers)
    return (
      <ManagementState
        kind="no-permission"
        title={t('identity.providers.metadata.noUserPermission')}
      />
    )
  if (users.isError || (provider.type === 'oidc' && clients.isError))
    return (
      <ManagementState
        kind="error"
        title={t('identity.providers.metadata.optionsFailed')}
        actions={
          <Button
            onClick={() => {
              void users.refetch()
              if (provider.type === 'oidc') void clients.refetch()
            }}
          >
            {t('common.retry', '重试')}
          </Button>
        }
      />
    )
  return (
    <div className="soha-identity-provider-metadata">
      <Form
        layout="inline"
        style={{ rowGap: 12 }}
        onValuesChange={() => setSelection(null)}
        onFinish={(values) => {
          if (selection) void metadata.refetch()
          else setSelection(values)
        }}
      >
        <Form.Item
          name="userId"
          label={t('identity.providers.metadata.user')}
          rules={[{ required: true, message: t('identity.providers.metadata.selectUser') }]}
        >
          <Select
            aria-label={t('identity.providers.metadata.user')}
            style={{ width: 220 }}
            showSearch={{ optionFilterProp: 'label' }}
            loading={users.isPending}
            placeholder={t('identity.providers.metadata.selectUser')}
            options={(users.data ?? [])
              .filter((user) => user.status === 'active')
              .map((user) => ({
                value: user.id,
                label: (user.displayName || user.username) + ' · ' + (user.email || user.username),
              }))}
          />
        </Form.Item>
        {provider.type === 'oidc' && (
          <Form.Item
            name="clientId"
            label={t('identity.providers.metadata.client')}
            rules={[{ required: true, message: t('identity.providers.metadata.selectClient') }]}
          >
            <Select
              aria-label={t('identity.providers.metadata.client')}
              style={{ width: 200 }}
              loading={clients.isPending}
              placeholder={t('identity.providers.metadata.selectClient')}
              options={(clients.data ?? []).map((client) => ({
                value: client.id,
                label: client.clientId,
              }))}
            />
          </Form.Item>
        )}
        <Form.Item>
          <Space size={4}>
            <Button type="primary" htmlType="submit" loading={metadata.isFetching}>
              {t('identity.providers.metadata.preview')}
            </Button>
            <Tooltip title={t('identity.providers.metadata.hint')} trigger={['hover', 'focus']}>
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                aria-label={t('identity.providers.metadata.help')}
              />
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>
      {metadata.isError ? (
        <ManagementState
          kind="error"
          title={t('identity.providers.metadata.failed')}
          description={metadata.error.message}
          actions={
            <Button onClick={() => void metadata.refetch()}>{t('common.retry', '重试')}</Button>
          }
        />
      ) : !selection ? (
        <ManagementState kind="empty" compact title={t('identity.providers.metadata.selectHint')} />
      ) : metadata.isPending ? (
        <ManagementState kind="loading" compact />
      ) : (
        <>
          {metadata.data.scopes?.length ? (
            <Typography.Text type="secondary">
              Scopes: {metadata.data.scopes.join(', ')}
            </Typography.Text>
          ) : null}
          {metadata.data.subject && (
            <Typography.Text>NameID: {metadata.data.subject}</Typography.Text>
          )}
          <AdminTable
            rowKey="name"
            scroll={{ x: '100%' }}
            tableLayout="fixed"
            pagination={false}
            enableColumnSelection={false}
            columns={[
              { title: t('identity.providers.metadata.attribute'), dataIndex: 'name', width: 200 },
              {
                title: t('identity.providers.metadata.value'),
                dataIndex: 'values',
                render: (values: string[]) => (
                  <span style={{ overflowWrap: 'anywhere' }}>{values.join(', ') || '—'}</span>
                ),
              },
            ]}
            dataSource={Object.entries(metadata.data.attributes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, values]) => ({ name, values }))}
          />
        </>
      )}
    </div>
  )
}
