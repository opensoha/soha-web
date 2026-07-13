import { useMemo, useState } from 'react'
import { App, Button, Form, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { ApiOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementState,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { identityApplicationQueries } from '../applications'
import type { IdentityApplication } from '../shared/types'
import { identityOutpostQueries } from '../outposts'
import { OIDCClientsPanel } from './components/oidc-clients-panel'
import { ProviderFormModal } from './components/provider-form-modal'
import { ProxySetupPanel } from './components/proxy-setup-panel'
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
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<IdentityProviderPageFilters>()
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
            message.success(t('identity.providers.updated', `已更新 ${provider.name}`))
            closeModal()
          },
          onError: (error: Error) => message.error(error.message),
        },
      )
      return
    }
    createMutation.mutate(input, {
      onSuccess: (provider) => {
        message.success(t('identity.providers.created', `已创建 ${provider.name}`))
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
        title: t('identity.providers.column.provider', 'Provider'),
        dataIndex: 'name',
        width: 300,
        render: (_, record) => <ProviderNameCell provider={record} />,
      },
      {
        title: t('identity.providers.column.type', '类型'),
        dataIndex: 'type',
        width: 140,
        render: (value: IdentityRuntimeProviderType) => (
          <Tag color={value === 'oidc' ? 'blue' : 'gold'}>{value.toUpperCase()}</Tag>
        ),
      },
      {
        title: t('identity.providers.column.application', '应用'),
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
        title: t('identity.providers.column.status', '状态'),
        dataIndex: 'status',
        width: 150,
        render: (value: IdentityRuntimeProviderStatus, record) => (
          <Space orientation="vertical" size={2}>
            {identityProviderStatusTag(value)}
            <Tag color={record.enabled ? 'green' : 'default'}>
              {record.enabled
                ? t('identity.providers.runtimeOn', '运行中')
                : t('identity.providers.runtimeOff', '已停止')}
            </Tag>
          </Space>
        ),
      },
      {
        title: t('identity.providers.column.updated', '更新时间'),
        dataIndex: 'updatedAt',
        width: 140,
        render: formatIdentityProviderDateTime,
      },
      {
        title: t('identity.providers.column.actions', '操作'),
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              aria-label={t('common.edit', '编辑')}
              disabled={!canManage}
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
              tooltip={t('common.edit', '编辑')}
            />
            <Popconfirm
              cancelText={t('common.cancel', '取消')}
              disabled={!canManage}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText={t('common.delete', '删除')}
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () =>
                    message.success(t('identity.providers.deleted', 'Provider 已删除')),
                  onError: (error: Error) => message.error(error.message),
                })
              }
              title={t('identity.providers.deleteConfirm', `删除 ${record.name}`)}
            >
              <ManagementIconButton
                aria-label={t('common.delete', '删除')}
                danger
                disabled={!canManage}
                icon={<DeleteOutlined />}
                tooltip={t('common.delete', '删除')}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [applicationById, canManage, deleteMutation, message, t],
  )

  return (
    <>
      <ManagementDataPage
        className="soha-identity-providers-page"
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.status && !filters.type}
              loading={providersQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({ query: '', status: '', type: '' })
              }}
            />
          ),
          children: (
            <>
              <ManagementKeywordField
                label={t('identity.providers.keyword', '关键词')}
                name="query"
                placeholder={t('identity.providers.search', '搜索 Provider 或应用')}
              />
              <ManagementQueryField
                label={t('identity.providers.type', '类型')}
                name="type"
                width={160}
              >
                <Select
                  allowClear
                  options={providerTypeOptions}
                  placeholder={t('identity.providers.type', '类型')}
                />
              </ManagementQueryField>
              <ManagementQueryField
                label={t('identity.providers.status', '状态')}
                name="status"
                width={160}
              >
                <Select
                  allowClear
                  options={providerStatusOptions}
                  placeholder={t('identity.providers.status', '状态')}
                />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          initialValues: { query: '', status: '', type: '' },
          onFinish: (values) =>
            setFilters({
              query: String(values.query ?? '').trim(),
              status: values.status ?? '',
              type: values.type ?? '',
            }),
        }}
        table={{
          rowKey: 'id',
          columns,
          dataSource: filteredProviders,
          empty: (
            <ManagementState
              description={t(
                'identity.providers.emptyDescription',
                '创建 Provider 后可为下游应用提供统一登录。',
              )}
              kind="empty"
              title={t('identity.providers.empty', '暂无 Provider')}
            />
          ),
          expandable: {
            expandedRowRender: (record: IdentityProvider) =>
              record.type === 'oidc' ? (
                <OIDCClientsPanel
                  canManage={canManage}
                  onSecretCreated={setCreatedSecret}
                  provider={record}
                />
              ) : (
                <ProxySetupPanel provider={record} />
              ),
            rowExpandable: () => true,
          },
          loading: providersQuery.isLoading || providersQuery.isFetching,
          scroll: { x: 'max-content' },
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          headerExtra: (
            <ManagementTableToolbar>
              <Button
                autoInsertSpace={false}
                disabled={!canManage}
                icon={<PlusOutlined />}
                onClick={openCreate}
                size="small"
                type="primary"
              >
                {t('identity.providers.create', '新建 Provider')}
              </Button>
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={providersQuery.isFetching}
                onClick={() => void providersQuery.refetch()}
                title={t('common.refresh', '刷新')}
                tooltip={t('common.refresh', '刷新')}
              />
            </ManagementTableToolbar>
          ),
        }}
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
    </>
  )
}
