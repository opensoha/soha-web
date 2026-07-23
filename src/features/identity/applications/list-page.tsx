import { useMemo, useState } from 'react'
import { App, Button, Form, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
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
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import type {
  IdentityApplication,
  IdentityApplicationInput,
  IdentityProviderType,
} from '../shared/types'
import { identityProviderQueries } from '../providers'
import {
  identityApplicationStatusOptions,
  identityApplicationTagOptions,
} from './application-form-model'
import { ApplicationFormModal } from './components/application-form-modal'
import { identityApplicationMutations } from './mutations'
import {
  formatIdentityApplicationDateTime,
  IdentityApplicationNameCell,
  identityApplicationAssignmentsSummary,
  identityApplicationStatusTag,
} from './presentation'
import { identityApplicationQueries } from './queries'
import type { IdentityApplicationFilters } from './types'
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
  const [editing, setEditing] = useState<IdentityApplication | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.applications.manage')

  const resetFilters = () => {
    queryForm.resetFields()
    setFilters({ query: '', status: '' })
  }

  const applicationsQuery = useQuery(identityApplicationQueries.list(filters))
  const allApplicationsQuery = useQuery(identityApplicationQueries.list({ query: '', status: '' }))
  const providerCapabilitiesQuery = useQuery(identityApplicationQueries.providerCapabilities())
  const providersQuery = useQuery({
    ...identityProviderQueries.list({ applicationId: editing?.id ?? '' }),
    enabled: modalOpen && Boolean(editing?.id),
  })
  const createMutation = useMutation(identityApplicationMutations.create(queryClient))
  const updateMutation = useMutation(identityApplicationMutations.update(queryClient))
  const deleteMutation = useMutation(identityApplicationMutations.remove(queryClient))

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
      },
    })
  }

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
            <Tag>{value.toUpperCase()}</Tag>
            {record.providerId ? <Text type="secondary">{record.providerId}</Text> : null}
          </Space>
        ),
      },
      {
        title: t('identity.applications.column.portal', '门户'),
        dataIndex: 'portalVisible',
        width: 150,
        render: (portalVisible: boolean, record) => (
          <Space orientation="vertical" size={2}>
            {identityApplicationStatusTag(
              record.status,
              t(`identity.applications.status.${record.status}`, record.status),
            )}
            <Tag color={portalVisible ? 'blue' : 'default'}>
              {portalVisible
                ? t('identity.applications.visible', '可见')
                : t('identity.applications.hidden', '隐藏')}
            </Tag>
            {record.featured ? (
              <Tag color="purple">{t('identity.applications.featured', '推荐')}</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('identity.applications.column.assignments', '访问授权'),
        key: 'assignments',
        width: 260,
        render: (_, record) =>
          identityApplicationAssignmentsSummary(
            record,
            t('identity.applications.allAuthenticatedUsers', '所有已登录用户'),
          ),
      },
      {
        title: t('identity.applications.column.launchUrl', '访问地址'),
        dataIndex: 'launchUrl',
        width: 280,
        render: (value: string | undefined, record) =>
          value ? (
            <Text ellipsis title={value}>
              {value}
            </Text>
          ) : record.providerType === 'oidc' ? (
            <Tag color="blue">
              {t('identity.applications.generatedAuthorizeUrl', '自动生成授权地址')}
            </Tag>
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
              disabled={!canManage}
              icon={<EditOutlined />}
              tooltip={t('common.edit', '编辑')}
              onClick={() => openEdit(record)}
            />
            <Popconfirm
              cancelText={t('common.cancel', '取消')}
              disabled={!canManage}
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
                disabled={!canManage}
                icon={<DeleteOutlined />}
                tooltip={t('common.delete', '删除')}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canManage, deleteMutation, message, t],
  )

  const saving = createMutation.isPending || updateMutation.isPending
  const applications = applicationsQuery.data ?? []
  const applicationTagOptions = useMemo(
    () => identityApplicationTagOptions(allApplicationsQuery.data ?? applications),
    [allApplicationsQuery.data, applications],
  )

  const capabilitySummary = (
    <div className="soha-identity-capability-row">
      {(providerCapabilitiesQuery.data ?? []).map((capability) => (
        <div className="soha-identity-capability" key={capability.type}>
          <div className="soha-identity-capability-title">
            <Tag>{capability.type.toUpperCase()}</Tag>
            <Tag color="gold">
              {t(`identity.applications.capabilityStatus.${capability.status}`, capability.status)}
            </Tag>
          </div>
          <Text type="secondary">
            {t(`identity.applications.capability.${capability.type}`, capability.description)}
          </Text>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <ManagementDataPage
        beforeQuery={capabilitySummary}
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
                disabled={!canManage}
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={openCreate}
              >
                {t('identity.applications.create', '新建应用')}
              </Button>
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
        }}
      />
      <ApplicationFormModal
        application={editing}
        open={modalOpen}
        providerOptions={providersQuery.data ?? []}
        providerOptionsLoading={providersQuery.isFetching}
        saving={saving}
        tagOptions={applicationTagOptions}
        onCancel={closeModal}
        onSubmit={submitForm}
      />
    </>
  )
}
