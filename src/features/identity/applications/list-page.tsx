import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { IdentityApplicationOnboardingInput } from '@opensoha/contracts/gen/ts/sohaapi'
import { isApiError } from '@/services/api-error'
import {
  App,
  Button,
  Card,
  Form,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import type { IdentityApplication, IdentityApplicationInput } from '../shared/types'
import { identityRuntimeQueries } from '../runtime'
import {
  identityProviderQueries,
  SecretRevealModal,
  type IdentityOIDCSecretReveal,
} from '../providers'

import {
  buildIdentityApplicationInput,
  identityApplicationAccessPolicyFor,
  identityApplicationFormValuesFor,
  identityApplicationStatusOptions,
  identityApplicationTagOptions,
  type IdentityApplicationFormValues,
} from './application-form-model'
import { ApplicationDetailDrawer } from './components/application-detail-drawer'
import { listIdentityApplications } from './api'
import { ApplicationFormModal } from './components/application-form-modal'
import { identityApplicationMutations } from './mutations'
import { IdentityApplicationNameCell, identityApplicationAssignmentsSummary } from './presentation'
import { identityApplicationQueries } from './queries'
import type { IdentityApplicationFilters } from './types'
import '../shared/application-access.css'
import './styles.css'

const { Text } = Typography

export function IdentityApplicationsPage() {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<IdentityApplicationFilters>()
  const [filters, setFilters] = useState<IdentityApplicationFilters>({
    query: '',
    status: '',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15 })
  const [editing, setEditing] = useState<IdentityApplication | null>(null)
  const [params, setParams] = useSearchParams()
  const [createdSecret, setCreatedSecret] = useState<IdentityOIDCSecretReveal | null>(null)
  const showDetails = (id: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('application', id)
      return next
    })
  const closeDetails = () =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('application')
      return next
    })
  const snapshot = usePermissionSnapshot().data?.data
  const canCreate = hasPermission(snapshot, 'identity.applications.create')
  const canUpdate = hasPermission(snapshot, 'identity.applications.update')
  const canDelete = hasPermission(snapshot, 'identity.applications.delete')
  const canCreateProvider = hasPermission(snapshot, 'identity.providers.create')
  const canViewProvider = hasPermission(snapshot, 'identity.providers.view')

  const resetFilters = () => {
    queryForm.resetFields()
    setFilters({ query: '', status: '' })
    setPagination((current) => ({ ...current, current: 1 }))
  }

  const applicationsQuery = useQuery(identityApplicationQueries.list(filters))
  const allApplicationsQuery = useQuery(identityApplicationQueries.list({ query: '', status: '' }))
  const runtimeQuery = useQuery(identityRuntimeQueries.capabilities())
  const providersQuery = useQuery({
    ...identityProviderQueries.list({ applicationId: editing?.id ?? '' }),
    enabled: modalOpen && Boolean(editing?.id) && canViewProvider,
  })
  const onboardMutation = useMutation(identityApplicationMutations.onboard(queryClient))
  const updateMutation = useMutation(identityApplicationMutations.update(queryClient))
  const deleteMutation = useMutation(identityApplicationMutations.remove(queryClient))
  const stepUpCapability = runtimeQuery.data?.stepUp

  const closeModal = () => {
    onboardMutation.reset()
    setModalOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (application: IdentityApplication) => {
    setEditing(application)
    setModalOpen(true)
  }

  const submitForm = (input: IdentityApplicationInput) => {
    if (editing) {
      updateMutation.mutate(
        { applicationId: editing.id, input },
        {
          onSuccess: (application) => {
            message.success(t('identity.applications.updated', `已更新 ${application.name}`))
            closeModal()
          },
        },
      )
      return
    }
  }

  const submitOnboarding = (input: IdentityApplicationOnboardingInput) => {
    onboardMutation.mutate(input, {
      onSuccess: (result) => {
        closeModal()
        showDetails(result.application.id)
        if (result.oidcClient?.clientSecret)
          setCreatedSecret({
            clientId: result.oidcClient.client.clientId,
            clientSecret: result.oidcClient.clientSecret,
          })
        void message.success('应用已保存，尚未启用。')
      },
      onError: async (error) => {
        void message.error(error.message)
        if (isApiError(error) && error.status === 409) {
          try {
            const existing = (
              await listIdentityApplications({ query: input.application.slug })
            ).find((item) => item.slug === input.application.slug)
            if (existing) {
              closeModal()
              showDetails(existing.id)
              void message.info('相同标识的应用已存在，请核对实际配置后继续。')
            }
          } catch {
            /* The mutation error remains visible; no unverified resource is selected. */
          }
        }
      },
    })
  }

  const quickUpdate = useCallback(
    (
      application: IdentityApplication,
      changes: Partial<IdentityApplicationFormValues>,
      successMessage: string,
    ) => {
      updateMutation.mutate(
        {
          applicationId: application.id,
          input: buildIdentityApplicationInput(
            { ...identityApplicationFormValuesFor(application), ...changes },
            application,
          ),
        },
        {
          onSuccess: () => void message.success(successMessage),
          onError: (error: Error) => void message.error(error.message),
        },
      )
    },
    [message, updateMutation],
  )

  const saving = onboardMutation.isPending || updateMutation.isPending
  const applications = applicationsQuery.data ?? []
  const currentPage = Math.min(
    pagination.current,
    Math.max(1, Math.ceil(applications.length / pagination.pageSize)),
  )
  const visibleApplications = applications.slice(
    (currentPage - 1) * pagination.pageSize,
    currentPage * pagination.pageSize,
  )
  const applicationTagOptions = useMemo(
    () => identityApplicationTagOptions(allApplicationsQuery.data ?? applications),
    [allApplicationsQuery.data, applications],
  )

  return (
    <>
      <ManagementDataPage
        className="soha-identity-access-page soha-identity-applications-page"
        beforeQuery={
          applicationsQuery.isError && (
            <ManagementState
              kind={
                isApiError(applicationsQuery.error) && applicationsQuery.error.status === 403
                  ? 'no-permission'
                  : 'error'
              }
              title="应用目录加载失败"
              description={applicationsQuery.error.message}
              actions={<Button onClick={() => void applicationsQuery.refetch()}>重试</Button>}
            />
          )
        }
        query={{
          form: queryForm,
          initialValues: { query: '', status: '' },
          onFinish: (values) => {
            setFilters({
              query: String(values.query ?? '').trim(),
              status: values.status ?? '',
            })
            setPagination((current) => ({ ...current, current: 1 }))
          },
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.status}
              loading={applicationsQuery.isFetching}
              onReset={resetFilters}
            />
          ),
          children: (
            <>
              <ManagementKeywordField
                label={t('identity.applications.keyword', '关键词')}
                name="query"
                placeholder={t('identity.applications.search', '搜索名称、slug')}
              />
              <ManagementQueryField
                label={t('identity.applications.status', '状态')}
                name="status"
                width={180}
                minWidth={180}
              >
                <Select
                  allowClear
                  options={identityApplicationStatusOptions}
                  placeholder={t('identity.applications.status', '状态')}
                />
              </ManagementQueryField>
            </>
          ),
        }}
        tableNode={
          <section
            className="soha-identity-application-catalog"
            aria-label="应用目录"
            aria-busy={applicationsQuery.isFetching}
          >
            <div className="soha-identity-catalog-toolbar">
              <ManagementTableToolbar>
                <Button
                  autoInsertSpace={false}
                  disabled={!canCreate}
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={openCreate}
                >
                  接入应用
                </Button>
                <ManagementRefreshButton
                  aria-label={t('common.refresh', '刷新')}
                  loading={applicationsQuery.isFetching}
                  title={t('common.refresh', '刷新')}
                  tooltip={t('common.refresh', '刷新')}
                  onClick={() => void applicationsQuery.refetch()}
                />
              </ManagementTableToolbar>
            </div>
            {applicationsQuery.isError ? null : applicationsQuery.isLoading ? (
              <ManagementState kind="loading" title="正在读取应用目录" />
            ) : applications.length ? (
              <>
                <div className="soha-identity-application-list">
                  {visibleApplications.map((application) => {
                    const conditions = identityApplicationAccessPolicyFor(application)
                    const updating =
                      updateMutation.isPending &&
                      updateMutation.variables?.applicationId === application.id
                    return (
                      <Card
                        key={application.id}
                        size="small"
                        className="soha-identity-application-card"
                        classNames={{ body: 'soha-identity-application-card-body' }}
                        role="article"
                        aria-label={application.name}
                      >
                        <div className="soha-identity-application-card-heading">
                          <IdentityApplicationNameCell application={application} />
                        </div>
                        <div className="soha-identity-application-card-field">
                          <Text type="secondary">Slug</Text>
                          <Text ellipsis title={application.slug}>
                            {application.slug}
                          </Text>
                        </div>
                        <div className="soha-identity-application-card-field">
                          <Text type="secondary">{t('common.type', '类型')}</Text>
                          <MetadataTag label={application.providerType.toUpperCase()} />
                        </div>
                        <div className="soha-identity-application-card-field">
                          <Text type="secondary">{t('identity.applications.status', '状态')}</Text>
                          <StatusTag value={application.status} />
                        </div>
                        <div className="soha-identity-application-card-access">
                          <Text type="secondary">
                            {t('identity.applications.column.accessControl', '访问范围')}
                          </Text>
                          <Space className="soha-identity-access-scope" size={[4, 4]} wrap>
                            {identityApplicationAssignmentsSummary(
                              application,
                              t('identity.applications.allAuthenticatedUsers', '所有已登录用户'),
                            )}
                            {conditions.requireMfa ? <MetadataTag label="MFA" tone="blue" /> : null}
                            {conditions.allowedCidrs.length ? (
                              <MetadataTag label={`${conditions.allowedCidrs.length} CIDR`} />
                            ) : null}
                            {conditions.startTimeUtc && conditions.endTimeUtc ? (
                              <MetadataTag
                                label={`${conditions.startTimeUtc}–${conditions.endTimeUtc} UTC`}
                              />
                            ) : null}
                          </Space>
                        </div>
                        <div className="soha-identity-application-card-controls">
                          <label className="soha-identity-inline-switch">
                            <span>{t('identity.applications.column.enabled', '启用状态')}</span>
                            <Switch
                              aria-label={`${application.name} ${t('identity.applications.column.enabled', '启用状态')}`}
                              checked={application.status === 'enabled'}
                              disabled={!canUpdate}
                              loading={updating}
                              size="small"
                              onChange={(checked) =>
                                quickUpdate(
                                  application,
                                  { status: checked ? 'enabled' : 'disabled' },
                                  checked
                                    ? t('identity.applications.enabled', '应用已启用')
                                    : t('identity.applications.disabled', '应用已停用'),
                                )
                              }
                            />
                          </label>
                          <label className="soha-identity-inline-switch">
                            <span>
                              {t('identity.applications.column.portalVisible', '门户可见')}
                            </span>
                            <Switch
                              aria-label={`${application.name} ${t('identity.applications.column.portalVisible', '门户可见')}`}
                              checked={application.portalVisible}
                              disabled={!canUpdate}
                              loading={updating}
                              size="small"
                              onChange={(checked) =>
                                quickUpdate(
                                  application,
                                  { portalVisible: checked },
                                  checked
                                    ? t('identity.applications.portalShown', '已在门户显示')
                                    : t('identity.applications.portalHidden', '已从门户隐藏'),
                                )
                              }
                            />
                          </label>
                        </div>
                        <div className="soha-identity-application-card-actions">
                          <Space size={0}>
                            <ManagementIconButton
                              aria-label={t('common.edit', '编辑')}
                              disabled={!canUpdate}
                              icon={<EditOutlined />}
                              tooltip={t('common.edit', '编辑')}
                              onClick={() => openEdit(application)}
                            />
                            <Popconfirm
                              cancelText={t('common.cancel', '取消')}
                              disabled={!canDelete}
                              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                              okText={t('common.delete', '删除')}
                              title={`删除 ${application.name}`}
                              onConfirm={() =>
                                deleteMutation.mutate(application.id, {
                                  onSuccess: () =>
                                    message.success(
                                      t('identity.applications.deleted', '应用已删除'),
                                    ),
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
                        </div>
                      </Card>
                    )
                  })}
                </div>
                <Pagination
                  className="soha-identity-catalog-pagination"
                  current={currentPage}
                  pageSize={pagination.pageSize}
                  total={applications.length}
                  size="small"
                  responsive
                  showSizeChanger
                  pageSizeOptions={[15, 30, 50, 100]}
                  showTotal={(total, range) => `当前 ${range[0]}–${range[1]} / ${total} 条`}
                  onChange={(current, pageSize) => setPagination({ current, pageSize })}
                />
              </>
            ) : (
              <ManagementState
                kind="empty"
                title={t('identity.applications.empty', '暂无应用')}
                description={
                  filters.query || filters.status
                    ? '没有符合条件的应用，请调整筛选条件。'
                    : '接入应用后，可继续配置认证与访问范围。'
                }
              />
            )}
          </section>
        }
      />
      <ApplicationFormModal
        application={editing}
        open={modalOpen}
        providerOptions={canViewProvider ? (providersQuery.data ?? []) : []}
        providerOptionsLoading={providersQuery.isFetching}
        saving={saving}
        stepUpAvailable={stepUpCapability?.available === true}
        stepUpReason={stepUpCapability?.reason}
        tagOptions={applicationTagOptions}
        onCancel={closeModal}
        onSubmit={submitForm}
        onOnboard={submitOnboarding}
        canConfigureProvider={canCreateProvider}
        samlAvailable={runtimeQuery.data?.samlApplicationProvider.available === true}
      />
      {params.get('application') && (
        <ApplicationDetailDrawer
          id={params.get('application') ?? ''}
          onClose={closeDetails}
          onEdit={openEdit}
        />
      )}
      <SecretRevealModal
        value={createdSecret}
        onClose={() => {
          setCreatedSecret(null)
          onboardMutation.reset()
        }}
      />
    </>
  )
}
