import { useCallback, useMemo, useState } from 'react'
import { App, Button, Form, Popconfirm, Select, Space, Switch, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag, MetadataTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import type {
  IdentityApplication,
  IdentityApplicationInput,
  IdentityProviderType,
} from '../shared/types'
import { identityRuntimeQueries } from '../runtime'
import {
  createIdentityOIDCClient,
  identityProviderKeys,
  identityProviderMutations,
  identityProviderQueries,
  OIDCClientFormModal,
  ProviderFormModal,
  SecretRevealModal,
  type IdentityOIDCClientInput,
  type IdentityOIDCSecretReveal,
  type IdentityProvider,
  type IdentityProviderInput,
} from '../providers'
import {
  buildIdentityApplicationInput,
  identityApplicationAccessPolicyFor,
  identityApplicationFormValuesFor,
  identityApplicationStatusOptions,
  identityApplicationTagOptions,
  type IdentityApplicationFormValues,
} from './application-form-model'
import { ApplicationFormModal } from './components/application-form-modal'
import { identityApplicationMutations } from './mutations'
import {
  formatIdentityApplicationDateTime,
  IdentityApplicationNameCell,
  identityApplicationAssignmentsSummary,
} from './presentation'
import { identityApplicationQueries } from './queries'
import type { IdentityApplicationFilters } from './types'
import './styles.css'

const { Text } = Typography

interface OIDCOnboardingState {
  application: IdentityApplication
  applicationInput: IdentityApplicationInput
  provider: IdentityProvider | null
}

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
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [editing, setEditing] = useState<IdentityApplication | null>(null)
  const [oidcOnboarding, setOIDCOnboarding] = useState<OIDCOnboardingState | null>(null)
  const [oidcOnboardingSecret, setOIDCOnboardingSecret] = useState<IdentityOIDCSecretReveal | null>(
    null,
  )
  const [creatingOIDCClient, setCreatingOIDCClient] = useState(false)
  const snapshot = usePermissionSnapshot().data?.data
  const canCreate = hasPermission(snapshot, 'identity.applications.create')
  const canUpdate = hasPermission(snapshot, 'identity.applications.update')
  const canDelete = hasPermission(snapshot, 'identity.applications.delete')
  const canCreateProvider = hasPermission(snapshot, 'identity.providers.create')

  const resetFilters = () => {
    queryForm.resetFields()
    setFilters({ query: '', status: '' })
  }

  const applicationsQuery = useQuery(identityApplicationQueries.list(filters))
  const allApplicationsQuery = useQuery(identityApplicationQueries.list({ query: '', status: '' }))
  const runtimeQuery = useQuery(identityRuntimeQueries.capabilities())
  const providersQuery = useQuery({
    ...identityProviderQueries.list({ applicationId: editing?.id ?? '' }),
    enabled: modalOpen && Boolean(editing?.id),
  })
  const createMutation = useMutation(identityApplicationMutations.create(queryClient))
  const updateMutation = useMutation(identityApplicationMutations.update(queryClient))
  const deleteMutation = useMutation(identityApplicationMutations.remove(queryClient))
  const createProviderMutation = useMutation(identityProviderMutations.create(queryClient))
  const keepOIDCProviderType = useCallback(() => undefined, [])
  const stepUpCapability = runtimeQuery.data?.stepUp

  const closeModal = () => {
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
    createMutation.mutate(input, {
      onSuccess: (application) => {
        message.success(t('identity.applications.created', `已创建 ${application.name}`))
        closeModal()
        if (input.providerType === 'oidc' && canCreateProvider && canUpdate) {
          setOIDCOnboarding({ application, applicationInput: input, provider: null })
        } else if (input.providerType === 'oidc') {
          message.warning('应用已创建，但当前账号缺少创建 Provider 或更新应用的权限。')
        }
      },
    })
  }

  const submitOIDCProvider = (input: IdentityProviderInput) => {
    if (!oidcOnboarding) return
    createProviderMutation.mutate(input, {
      onSuccess: (provider) => {
        const boundInput = { ...oidcOnboarding.applicationInput, providerId: provider.id }
        updateMutation.mutate(
          { applicationId: oidcOnboarding.application.id, input: boundInput },
          {
            onSuccess: (application) =>
              setOIDCOnboarding((current) =>
                current ? { application, applicationInput: boundInput, provider } : current,
              ),
            onError: (error: Error) => {
              message.warning(`Provider 已创建，但应用绑定更新失败：${error.message}`)
              setOIDCOnboarding(null)
            },
          },
        )
      },
      onError: (error: Error) => message.error(error.message),
    })
  }

  const submitOIDCClient = async (input: IdentityOIDCClientInput) => {
    const provider = oidcOnboarding?.provider
    if (!provider) return
    setCreatingOIDCClient(true)
    try {
      const result = await createIdentityOIDCClient({ providerId: provider.id, input })
      await queryClient.invalidateQueries({
        queryKey: identityProviderKeys.oidcClients(provider.id),
      })
      message.success(`已创建 OIDC client ${result.client.clientId}`)
      if (result.clientSecret) {
        setOIDCOnboardingSecret({
          clientId: result.client.clientId,
          clientSecret: result.clientSecret,
        })
        return
      }
      setOIDCOnboarding(null)
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCreatingOIDCClient(false)
    }
  }

  const cancelOIDCOnboarding = () => {
    message.info('已保留创建成功的资源，可稍后继续配置。')
    setOIDCOnboarding(null)
    setOIDCOnboardingSecret(null)
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

  const columns = useMemo<TableColumnsType<IdentityApplication>>(
    () => [
      {
        title: t('identity.applications.column.application', '应用'),
        dataIndex: 'name',
        width: 360,
        render: (_, record) => <IdentityApplicationNameCell application={record} />,
      },
      {
        title: 'Provider',
        dataIndex: 'providerType',
        width: 150,
        render: (value: IdentityProviderType, record) => (
          <Space orientation="vertical" size={2}>
            <MetadataTag label={value.toUpperCase()} />
            {record.providerId ? <Text type="secondary">{record.providerId}</Text> : null}
          </Space>
        ),
      },
      {
        title: t('identity.applications.column.enabled', '启用状态'),
        dataIndex: 'status',
        width: 130,
        render: (_, record) => (
          <Space size={6}>
            <Switch
              aria-label={`${record.name} ${t('identity.applications.column.enabled', '启用状态')}`}
              checked={record.status === 'enabled'}
              disabled={!canUpdate}
              loading={
                updateMutation.isPending && updateMutation.variables?.applicationId === record.id
              }
              size="small"
              onChange={(checked) =>
                quickUpdate(
                  record,
                  { status: checked ? 'enabled' : 'disabled' },
                  checked
                    ? t('identity.applications.enabled', '应用已启用')
                    : t('identity.applications.disabled', '应用已停用'),
                )
              }
            />
            {record.status === 'draft' || record.status === 'maintenance' ? (
              <Text type="secondary">
                {t(`identity.applications.status.${record.status}`, record.status)}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('identity.applications.column.portalVisible', '门户可见'),
        dataIndex: 'portalVisible',
        width: 120,
        render: (portalVisible: boolean, record) => (
          <Switch
            aria-label={`${record.name} ${t('identity.applications.column.portalVisible', '门户可见')}`}
            checked={portalVisible}
            disabled={!canUpdate}
            loading={
              updateMutation.isPending && updateMutation.variables?.applicationId === record.id
            }
            size="small"
            onChange={(checked) =>
              quickUpdate(
                record,
                { portalVisible: checked },
                checked
                  ? t('identity.applications.portalShown', '已在门户显示')
                  : t('identity.applications.portalHidden', '已从门户隐藏'),
              )
            }
          />
        ),
      },
      {
        title: t('identity.applications.column.featured', '推荐'),
        dataIndex: 'featured',
        width: 90,
        render: (featured: boolean) => (
          <BooleanTag
            value={featured}
            trueLabel={t('identity.applications.featured', '推荐')}
            falseLabel={t('identity.applications.notFeatured', '普通')}
          />
        ),
      },
      {
        title: t('identity.applications.column.accessControl', '访问范围'),
        key: 'assignments',
        width: 260,
        render: (_, record) => {
          const conditions = identityApplicationAccessPolicyFor(record)
          return (
            <Space className="soha-identity-access-scope" size={[4, 4]} wrap>
              {identityApplicationAssignmentsSummary(
                record,
                t('identity.applications.allAuthenticatedUsers', '所有已登录用户'),
              )}
              {conditions.requireMfa ? <MetadataTag label="MFA" tone="blue" /> : null}
              {conditions.allowedCidrs.length ? (
                <MetadataTag label={`${conditions.allowedCidrs.length} CIDR`} />
              ) : null}
              {conditions.startTimeUtc && conditions.endTimeUtc ? (
                <MetadataTag label={`${conditions.startTimeUtc}–${conditions.endTimeUtc} UTC`} />
              ) : null}
            </Space>
          )
        },
      },
      {
        title: t('identity.applications.column.launchUrl', '访问地址'),
        dataIndex: 'launchUrl',
        width: 280,
        render: (value: string | undefined, record) =>
          value ? (
            <Typography.Link ellipsis href={value} rel="noreferrer" target="_blank" title={value}>
              {value}
            </Typography.Link>
          ) : record.providerType === 'oidc' ? (
            <MetadataTag
              label={t('identity.applications.generatedAuthorizeUrl', '自动生成授权地址')}
              tone="blue"
            />
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: t('identity.applications.column.updated', '更新时间'),
        dataIndex: 'updatedAt',
        width: 140,
        render: formatIdentityApplicationDateTime,
      },
      {
        title: t('identity.applications.column.actions', '操作'),
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              aria-label={t('common.edit', '编辑')}
              disabled={!canUpdate}
              icon={<EditOutlined />}
              tooltip={t('common.edit', '编辑')}
              onClick={() => openEdit(record)}
            />
            <Popconfirm
              cancelText={t('common.cancel', '取消')}
              disabled={!canDelete}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText={t('common.delete', '删除')}
              title={`删除 ${record.name}`}
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () =>
                    message.success(t('identity.applications.deleted', '应用已删除')),
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
        ),
      },
    ],
    [canDelete, canUpdate, deleteMutation, message, quickUpdate, t, updateMutation],
  )

  const saving = createMutation.isPending || updateMutation.isPending
  const applications = applicationsQuery.data ?? []
  const applicationTagOptions = useMemo(
    () => identityApplicationTagOptions(allApplicationsQuery.data ?? applications),
    [allApplicationsQuery.data, applications],
  )

  return (
    <>
      <ManagementDataPage
        className="soha-identity-applications-page"
        query={{
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
              >
                <Select
                  allowClear
                  options={identityApplicationStatusOptions}
                  placeholder={t('identity.applications.status', '状态')}
                />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          initialValues: { query: '', status: '' },
          onFinish: (values) =>
            setFilters({
              query: String(values.query ?? '').trim(),
              status: values.status ?? '',
            }),
        }}
        table={{
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: applications,
          empty: (
            <ManagementState
              kind="empty"
              title={t('identity.applications.empty', '暂无应用')}
              description={t(
                'identity.applications.emptyDescription',
                '创建应用后会出现在门户目录中。',
              )}
            />
          ),
          headerExtra: (
            <ManagementTableToolbar>
              <Button
                autoInsertSpace={false}
                disabled={!canCreate}
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={openCreate}
              >
                {t('identity.applications.create', '新建应用')}
              </Button>
              <ManagementDensityButton
                aria-label={t('common.tableDensity', '切换表格密度')}
                title={t('common.tableDensity', '切换表格密度')}
                tooltip={t('common.tableDensity', '切换表格密度')}
                onClick={() =>
                  setTableSize((current) => (current === 'small' ? 'middle' : 'small'))
                }
              />
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={applicationsQuery.isFetching}
                title={t('common.refresh', '刷新')}
                tooltip={t('common.refresh', '刷新')}
                onClick={() => void applicationsQuery.refetch()}
              />
            </ManagementTableToolbar>
          ),
          loading: applicationsQuery.isLoading || applicationsQuery.isFetching,
          rowKey: 'id',
          scroll: { x: 'max-content' },
          tableSize,
        }}
      />
      <ApplicationFormModal
        application={editing}
        open={modalOpen}
        providerOptions={providersQuery.data ?? []}
        providerOptionsLoading={providersQuery.isFetching}
        saving={saving}
        stepUpAvailable={stepUpCapability?.available === true}
        stepUpReason={stepUpCapability?.reason}
        tagOptions={applicationTagOptions}
        onCancel={closeModal}
        onSubmit={submitForm}
      />
      <ProviderFormModal
        applicationOptions={
          oidcOnboarding
            ? [
                {
                  label: `${oidcOnboarding.application.name} (${oidcOnboarding.application.id})`,
                  value: oidcOnboarding.application.id,
                },
              ]
            : []
        }
        applicationsLoading={false}
        editing={null}
        initialApplicationId={oidcOnboarding?.application.id}
        lockedType="oidc"
        onCancel={cancelOIDCOnboarding}
        onProviderTypeChange={keepOIDCProviderType}
        onSubmit={submitOIDCProvider}
        open={Boolean(oidcOnboarding && !oidcOnboarding.provider)}
        outpostLoading={false}
        outpostOptions={[]}
        providerType="oidc"
        samlAvailable={false}
        submitting={createProviderMutation.isPending}
        title="接入 OIDC 应用 · 2/3 配置 Provider"
      />
      <OIDCClientFormModal
        editing={null}
        onCancel={cancelOIDCOnboarding}
        onSubmit={submitOIDCClient}
        open={Boolean(oidcOnboarding?.provider && !oidcOnboardingSecret)}
        providerId={oidcOnboarding?.provider?.id ?? ''}
        submitting={creatingOIDCClient}
        title="接入 OIDC 应用 · 3/3 配置 Client"
      />
      <SecretRevealModal
        value={oidcOnboardingSecret}
        onClose={() => {
          setOIDCOnboardingSecret(null)
          setOIDCOnboarding(null)
        }}
      />
    </>
  )
}
