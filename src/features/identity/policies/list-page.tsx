import { useMemo, useState } from 'react'
import { App, Form, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined } from '@ant-design/icons'
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
import type { IdentityApplicationPolicy, IdentityApplicationPolicyInput } from '../shared/types'
import { PolicyFormModal } from './components/policy-form-modal'
import { identityPolicyMutations } from './mutations'
import { identityPolicyQueries } from './queries'
import type { IdentityPolicyFilters } from './types'

const { Text } = Typography
const policyStatusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Maintenance', value: 'maintenance' },
]

export function IdentityPoliciesPage() {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<IdentityPolicyFilters>()
  const [filters, setFilters] = useState<IdentityPolicyFilters>({ query: '', status: '' })
  const [editing, setEditing] = useState<IdentityApplicationPolicy | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.policies.manage')
  const policiesQuery = useQuery(identityPolicyQueries.list(filters))
  const updateMutation = useMutation(identityPolicyMutations.update(queryClient))

  const columns = useMemo<TableColumnsType<IdentityApplicationPolicy>>(
    () => [
      {
        title: t('identity.applications.column.application', '应用'),
        dataIndex: 'applicationName',
        render: (value: string, record) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{value}</Text>
            <Text type="secondary">{record.applicationSlug}</Text>
          </Space>
        ),
      },
      {
        title: t('identity.applications.column.assignments', '访问授权'),
        dataIndex: 'assignments',
        render: (assignments: IdentityApplicationPolicy['assignments']) =>
          assignments.length ? (
            <Space size={[4, 4]} wrap>
              {assignments.map((assignment) => (
                <Tag key={`${assignment.subjectType}:${assignment.subjectId}`}>
                  {assignment.subjectType}:{assignment.subjectId}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">
              {t('identity.applications.allAuthenticatedUsers', '所有已登录用户')}
            </Text>
          ),
      },
      {
        title: t('identity.applications.column.actions', '操作'),
        key: 'actions',
        fixed: 'right',
        render: (_, record) => (
          <ManagementIconButton
            disabled={!canManage}
            icon={<EditOutlined />}
            onClick={() => setEditing(record)}
            tooltip={t('common.edit', '编辑')}
          />
        ),
      },
    ],
    [canManage, t],
  )

  const submit = (input: IdentityApplicationPolicyInput) => {
    if (!editing) return
    updateMutation.mutate(
      { applicationId: editing.applicationId, input },
      {
        onSuccess: () => {
          void message.success(t('identity.policies.updated', '访问策略已更新'))
          setEditing(null)
        },
        onError: (error: Error) => void message.error(error.message),
      },
    )
  }

  return (
    <>
      <ManagementDataPage
        className="soha-identity-policies-page"
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.status}
              loading={policiesQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({ query: '', status: '' })
              }}
            />
          ),
          children: (
            <>
              <ManagementKeywordField
                label={t('common.keyword', '关键词')}
                name="query"
                placeholder={t('identity.applications.search', '搜索名称、slug、分类')}
              />
              <ManagementQueryField
                label={t('identity.applications.status', '状态')}
                name="status"
                width={160}
              >
                <Select allowClear options={policyStatusOptions} />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          initialValues: { query: '', status: '' },
          onFinish: (values) =>
            setFilters({ query: String(values.query ?? '').trim(), status: values.status ?? '' }),
        }}
        table={{
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: policiesQuery.data ?? [],
          empty: <ManagementState kind="empty" title={t('identity.policies.empty', '暂无策略')} />,
          headerExtra: (
            <ManagementTableToolbar>
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={policiesQuery.isFetching}
                onClick={() => void policiesQuery.refetch()}
                title={t('common.refresh', '刷新')}
                tooltip={t('common.refresh', '刷新')}
              />
            </ManagementTableToolbar>
          ),
          loading: policiesQuery.isLoading || policiesQuery.isFetching,
          rowKey: 'applicationId',
          scroll: { x: 'max-content' },
        }}
      />
      <PolicyFormModal
        editing={editing}
        onCancel={() => setEditing(null)}
        onSubmit={submit}
        open={Boolean(editing)}
        submitting={updateMutation.isPending}
      />
    </>
  )
}
