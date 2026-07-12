import { useMemo, useState } from 'react'
import { App, Button, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
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
import type {
  IdentityApplicationPolicy,
  IdentityApplicationPolicyInput,
  IdentityApplicationStatus,
  IdentityProviderType,
} from '../shared/types'
import { PolicyFormModal } from './components/policy-form-modal'
import { identityPolicyMutations } from './mutations'
import { identityPolicyQueries } from './queries'
import type { IdentityPolicyFilters } from './types'
import './styles.css'

const { Text } = Typography

interface IdentityPolicyPageFilters extends IdentityPolicyFilters {
  query: string
}

const statusOptions: Array<{ label: string; value: IdentityApplicationStatus }> = [
  { label: 'Draft', value: 'draft' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Maintenance', value: 'maintenance' },
]

const statusTagMeta: Record<IdentityApplicationStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Draft' },
  enabled: { color: 'green', label: 'Enabled' },
  disabled: { color: 'default', label: 'Disabled' },
  maintenance: { color: 'gold', label: 'Maintenance' },
}

function statusTag(status: IdentityApplicationStatus) {
  const meta = statusTagMeta[status] ?? statusTagMeta.draft
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function assignmentsSummary(policy: IdentityApplicationPolicy) {
  const assignments = policy.assignments ?? []
  if (!assignments.length) return <Text type="secondary">All authenticated users</Text>
  return (
    <Space size={[4, 4]} wrap>
      {assignments.slice(0, 5).map((assignment) => (
        <Tag key={`${assignment.subjectType}:${assignment.subjectId}`}>
          {assignment.subjectType}:{assignment.subjectId}
        </Tag>
      ))}
      {assignments.length > 5 ? <Tag>+{assignments.length - 5}</Tag> : null}
    </Space>
  )
}

function providerTypeTag(type: IdentityProviderType) {
  const color = type === 'oidc' ? 'blue' : type === 'proxy' ? 'purple' : 'default'
  return <Tag color={color}>{type.toUpperCase()}</Tag>
}

export function IdentityPoliciesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IdentityPolicyPageFilters>({ query: '', status: '' })
  const [editing, setEditing] = useState<IdentityApplicationPolicy | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.policies.manage')

  const policiesQuery = useQuery(
    identityPolicyQueries.list({ query: filters.query, status: filters.status }),
  )
  const updateMutation = useMutation(identityPolicyMutations.update(queryClient))

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const openEdit = (policy: IdentityApplicationPolicy) => {
    setEditing(policy)
    setModalOpen(true)
  }

  const submitForm = (input: IdentityApplicationPolicyInput) => {
    if (!editing) return
    updateMutation.mutate(
      { applicationId: editing.applicationId, input },
      {
        onSuccess: (policy) => {
          message.success(`已更新 ${policy.applicationName} 访问策略`)
          closeModal()
        },
        onError: (error: Error) => message.error(error.message),
      },
    )
  }

  const columns = useMemo<TableColumnsType<IdentityApplicationPolicy>>(
    () => [
      {
        title: 'Application',
        dataIndex: 'applicationName',
        width: 340,
        render: (_, record) => (
          <div className="soha-identity-policy-application">
            <div className="soha-identity-policy-icon">
              <SafetyCertificateOutlined />
            </div>
            <div className="soha-identity-policy-copy">
              <Text strong ellipsis title={record.applicationName}>
                {record.applicationName}
              </Text>
              <Text type="secondary" ellipsis title={record.applicationSlug}>
                {record.applicationSlug}
              </Text>
              {record.category ? <Tag>{record.category}</Tag> : null}
            </div>
          </div>
        ),
      },
      {
        title: 'Provider',
        dataIndex: 'providerType',
        width: 150,
        render: (value: IdentityProviderType, record) => (
          <Space orientation="vertical" size={2}>
            {providerTypeTag(value)}
            {record.providerId ? <Text type="secondary">{record.providerId}</Text> : null}
          </Space>
        ),
      },
      {
        title: 'State',
        dataIndex: 'status',
        width: 150,
        render: (status: IdentityApplicationStatus, record) => (
          <Space orientation="vertical" size={2}>
            {statusTag(status)}
            <Tag color={record.portalVisible ? 'blue' : 'default'}>
              {record.portalVisible ? 'Visible' : 'Hidden'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'Assignments',
        key: 'assignments',
        width: 320,
        render: (_, record) => assignmentsSummary(record),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatDateTime,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 96,
        render: (_, record) => (
          <ManagementIconButton
            disabled={!canManage}
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            tooltip="编辑策略"
          />
        ),
      },
    ],
    [canManage],
  )

  return (
    <div className="soha-page soha-identity-policies-page">
      <ManagementDetailHeader
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => policiesQuery.refetch()}>
            刷新
          </Button>
        }
        description="管理 Provider Portal 应用访问策略。第一阶段策略由 user / role / team / tag allow assignments 组成。"
        title="Identity Policies"
      />

      <AdminTable
        rowKey="applicationId"
        columns={columns}
        dataSource={policiesQuery.data ?? []}
        empty={
          <ManagementState
            description="创建应用后可以在此维护访问主体。"
            kind="empty"
            title="暂无策略"
          />
        }
        loading={policiesQuery.isLoading || policiesQuery.isFetching}
        title="访问策略"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
              placeholder="搜索应用、slug、分类"
              value={filters.query}
            />
            <Select
              allowClear
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
              options={statusOptions}
              placeholder="状态"
              style={{ width: 160 }}
              value={filters.status || undefined}
            />
          </ManagementTableToolbar>
        }
      />

      <PolicyFormModal
        editing={editing}
        onCancel={closeModal}
        onSubmit={submitForm}
        open={modalOpen}
        submitting={updateMutation.isPending}
      />
    </div>
  )
}
