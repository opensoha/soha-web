import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isApiError } from '@/services/api-error'
import { App, Button, Form, Pagination, Popconfirm, Select, Space, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementState,
  ManagementRefreshButton,
  ManagementTableToolbar,
  ManagementSearchableListPane,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { identityApplicationQueries } from '../applications'
import type { IdentityApplication } from '../shared/types'
import { identityOutpostQueries } from '../outposts'
import { identityRuntimeQueries } from '../runtime'
import { ProviderDetailContent } from './components/provider-detail-content'
import { ProviderConfigurationStatus } from './components/provider-setup-panel'
import { ProviderFormModal } from './components/provider-form-modal'
import { identityProviderMutations } from './mutations'
import { providerStatusOptions, providerTypeOptions } from './provider-form-model'
import { identityProviderQueries } from './queries'
import type {
  IdentityProvider,
  IdentityProviderFilters,
  IdentityProviderInput,
  IdentityRuntimeProviderType,
} from './types'
import './styles.css'

const { Text } = Typography

interface IdentityProviderPageFilters extends IdentityProviderFilters {
  query: string
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
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15 })
  const [editing, setEditing] = useState<IdentityProvider | null>(null)
  const [params, setParams] = useSearchParams()
  const clearSelection = () =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('provider')
      return next
    })
  const selectProvider = (id: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('provider', id)
      return next
    })
  const [formProviderType, setFormProviderType] = useState<IdentityRuntimeProviderType>('oidc')
  const snapshot = usePermissionSnapshot().data?.data
  const canCreate = hasPermission(snapshot, 'identity.providers.create')
  const canUpdate = hasPermission(snapshot, 'identity.providers.update')
  const canDelete = hasPermission(snapshot, 'identity.providers.delete')
  const canViewApplications = hasPermission(snapshot, 'identity.applications.view')
  const canViewOutposts = hasPermission(snapshot, 'identity.outposts.view')

  const providersQuery = useQuery(
    identityProviderQueries.list({ status: filters.status, type: filters.type }),
  )
  const applicationsQuery = useQuery({
    ...identityApplicationQueries.list({}),
    enabled: canViewApplications,
  })
  const outpostsQuery = useQuery({
    ...identityOutpostQueries.list(),
    enabled: modalOpen && formProviderType === 'proxy' && canViewOutposts,
  })
  const runtimeQuery = useQuery(identityRuntimeQueries.capabilities())
  const samlCapability = runtimeQuery.data?.samlApplicationProvider
  const samlAvailable = samlCapability?.available === true
  const createMutation = useMutation(identityProviderMutations.create(queryClient))
  const updateMutation = useMutation(identityProviderMutations.update(queryClient))
  const deleteMutation = useMutation(identityProviderMutations.remove(queryClient))

  const applications = canViewApplications ? (applicationsQuery.data ?? []) : []
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
      (canViewOutposts ? (outpostsQuery.data ?? []) : []).map((outpost) => ({
        label: `${outpost.name} (${outpost.mode})`,
        value: outpost.id,
      })),
    [canViewOutposts, outpostsQuery.data],
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
        selectProvider(provider.id)
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

  const requestedIndex = filteredProviders.findIndex(
    (provider) => provider.id === params.get('provider'),
  )
  const currentPage =
    requestedIndex >= 0
      ? Math.floor(requestedIndex / pagination.pageSize) + 1
      : Math.min(
          pagination.current,
          Math.max(1, Math.ceil(filteredProviders.length / pagination.pageSize)),
        )
  const visibleProviders = filteredProviders.slice(
    (currentPage - 1) * pagination.pageSize,
    currentPage * pagination.pageSize,
  )
  const selectedId = params.get('provider') ?? visibleProviders[0]?.id ?? ''
  const detailQuery = useQuery(identityProviderQueries.detail(selectedId))
  const selectedProvider = detailQuery.data
  const selectedApplication =
    selectedProvider && applicationById.get(selectedProvider.applicationId)

  const providerActions = (provider: IdentityProvider) => (
    <Space size={4}>
      <ManagementIconButton
        aria-label={t('common.edit', '编辑')}
        disabled={!canUpdate}
        icon={<EditOutlined />}
        onClick={() => openEdit(provider)}
        tooltip={t('common.edit', '编辑')}
      />
      <Popconfirm
        cancelText={t('common.cancel', '取消')}
        disabled={!canDelete}
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        okText={t('common.delete', '删除')}
        title={t('identity.providers.deleteConfirm', `删除 ${provider.name}`)}
        onConfirm={() =>
          deleteMutation.mutate(provider.id, {
            onSuccess: () => {
              message.success(t('identity.providers.deleted', 'Provider 已删除'))
              if (selectedId === provider.id) clearSelection()
            },
            onError: (error: Error) => message.error(error.message),
          })
        }
      >
        <ManagementIconButton
          aria-label={t('common.delete', '删除')}
          danger
          disabled={!canDelete}
          icon={<DeleteOutlined />}
          tooltip={t('common.delete', '删除')}
        />
      </Popconfirm>
    </Space>
  )

  return (
    <>
      <ManagementDataPage
        className="soha-identity-providers-page"
        beforeQuery={
          providersQuery.isError ? (
            <ManagementState
              kind={
                isApiError(providersQuery.error) && providersQuery.error.status === 403
                  ? 'no-permission'
                  : 'error'
              }
              title="认证接入加载失败"
              description={providersQuery.error.message}
              actions={<Button onClick={() => void providersQuery.refetch()}>重试</Button>}
            />
          ) : canViewApplications && applicationsQuery.isError ? (
            <ManagementState
              kind="error"
              title="应用信息加载失败"
              description={applicationsQuery.error.message}
              actions={<Button onClick={() => void applicationsQuery.refetch()}>重试</Button>}
            />
          ) : null
        }
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.status && !filters.type}
              loading={providersQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({ query: '', status: '', type: '' })
                setPagination((current) => ({ ...current, current: 1 }))
                clearSelection()
              }}
            />
          ),
          children: (
            <>
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
          onFinish: (values) => {
            setFilters((current) => ({
              ...current,
              status: values.status ?? '',
              type: values.type ?? '',
            }))
            setPagination((current) => ({ ...current, current: 1 }))
            clearSelection()
          },
        }}
        tableNode={
          <section className="soha-identity-provider-workbench" aria-label="认证接入配置工作区">
            <div className="soha-identity-provider-workspace">
              <div className="soha-identity-provider-picker">
                <ManagementSearchableListPane
                  activeKey={selectedId}
                  items={visibleProviders}
                  getItemKey={(provider) => provider.id}
                  isLoading={providersQuery.isLoading}
                  isError={providersQuery.isError}
                  onRetry={() => void providersQuery.refetch()}
                  searchActions={
                    <ManagementTableToolbar>
                      <ManagementIconButton
                        aria-label={t('identity.providers.create', '新建 Provider')}
                        color="primary"
                        disabled={!canCreate}
                        icon={<PlusOutlined />}
                        onClick={openCreate}
                        tooltip={t('identity.providers.create', '新建 Provider')}
                        variant="solid"
                      />
                      <ManagementRefreshButton
                        aria-label={t('common.refresh', '刷新')}
                        loading={providersQuery.isFetching || detailQuery.isFetching}
                        onClick={() => {
                          void providersQuery.refetch()
                          if (selectedId) void detailQuery.refetch()
                        }}
                        tooltip={t('common.refresh', '刷新')}
                      />
                    </ManagementTableToolbar>
                  }
                  searchPlaceholder={t('identity.providers.search', '搜索 Provider 或应用')}
                  searchValue={filters.query}
                  onSearchChange={(query) => {
                    setFilters((current) => ({ ...current, query }))
                    setPagination((current) => ({ ...current, current: 1 }))
                    clearSelection()
                  }}
                  onItemSelect={(provider) => selectProvider(provider.id)}
                  emptyTitle={t('identity.providers.empty', '暂无 Provider')}
                  emptyDescription={
                    filters.query || filters.status || filters.type
                      ? '没有符合条件的认证接入，请调整筛选条件。'
                      : '创建认证接入，为应用配置统一登录。'
                  }
                  renderItem={(provider) => (
                    <>
                      <span className="soha-identity-provider-list-heading">
                        <Text strong>{provider.name}</Text>
                        <MetadataTag label={provider.type.toUpperCase()} />
                      </span>
                      {applicationById.get(provider.applicationId)?.name ? (
                        <Text type="secondary">
                          {applicationById.get(provider.applicationId)?.name}
                        </Text>
                      ) : null}
                      <span className="soha-identity-provider-list-state">
                        <StatusTag
                          value={
                            provider.enabled && provider.status === 'enabled'
                              ? 'enabled'
                              : 'disabled'
                          }
                          label={
                            provider.enabled && provider.status === 'enabled'
                              ? t('identity.providers.enabled', '已启用')
                              : t('identity.providers.disabled', '已停用')
                          }
                        />
                        <ProviderConfigurationStatus providerId={provider.id} />
                      </span>
                    </>
                  )}
                />
                {!providersQuery.isError &&
                  !providersQuery.isLoading &&
                  filteredProviders.length > 0 && (
                    <Pagination
                      className="soha-identity-provider-pagination"
                      current={currentPage}
                      pageSize={pagination.pageSize}
                      total={filteredProviders.length}
                      size="small"
                      simple={{ readOnly: true }}
                      showSizeChanger={false}
                      showTotal={(total) => `共 ${total} 条`}
                      onChange={(current, pageSize) => {
                        setPagination({ current, pageSize })
                        clearSelection()
                      }}
                    />
                  )}
              </div>
              <section
                className="soha-identity-provider-detail"
                aria-label="认证接入详情"
                aria-busy={detailQuery.isFetching}
              >
                {selectedId ? (
                  detailQuery.isError ? (
                    <ManagementState
                      kind={
                        isApiError(detailQuery.error) && detailQuery.error.status === 403
                          ? 'no-permission'
                          : 'error'
                      }
                      title="认证接入加载失败"
                      description={detailQuery.error.message}
                      actions={<Button onClick={() => void detailQuery.refetch()}>重试</Button>}
                    />
                  ) : selectedProvider ? (
                    <>
                      <div className="soha-identity-provider-detail-heading">
                        <div>
                          <Text strong>{selectedProvider.name}</Text>
                          {selectedApplication ? (
                            <div>
                              <Link
                                to={
                                  '/identity/applications?application=' +
                                  encodeURIComponent(selectedApplication.id)
                                }
                              >
                                {selectedApplication.name}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                        {providerActions(selectedProvider)}
                      </div>
                      <ProviderDetailContent
                        key={selectedProvider.id}
                        provider={selectedProvider}
                      />
                    </>
                  ) : (
                    <ManagementState kind="loading" title="正在读取认证接入" />
                  )
                ) : (
                  <ManagementState
                    kind={providersQuery.isLoading ? 'loading' : 'select-scope'}
                    title={providersQuery.isLoading ? '正在读取认证接入' : '选择认证接入'}
                    description="选择左侧应用的认证接入，查看资料并继续配置。"
                  />
                )}
              </section>
            </div>
          </section>
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
        samlAvailable={samlAvailable}
        samlUnavailableReason={samlCapability?.reason}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}
