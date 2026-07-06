import { useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import type {
  IdentityApplicationPolicy,
  IdentityApplicationPolicyInput,
  IdentityApplicationStatus,
  IdentityAssignmentSubjectType,
  IdentityProviderType,
} from '@/features/provider-portal/provider-portal-api'
import {
  identityPolicyQueryKeys,
  listIdentityPolicies,
  updateIdentityPolicy,
} from './identity-policies-api'
import './identity-policies-page.css'

const { Text } = Typography

interface IdentityPolicyFormValues {
  assignments: Array<{
    effect: 'allow'
    subjectId: string
    subjectType: IdentityAssignmentSubjectType
  }>
}

const statusOptions: Array<{ label: string; value: IdentityApplicationStatus }> = [
  { label: 'Draft', value: 'draft' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Maintenance', value: 'maintenance' },
]

const assignmentSubjectOptions: Array<{ label: string; value: IdentityAssignmentSubjectType }> = [
  { label: 'User', value: 'user' },
  { label: 'Role', value: 'role' },
  { label: 'Team', value: 'team' },
  { label: 'Tag', value: 'tag' },
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
  if (!assignments.length) {
    return <Text type="secondary">All authenticated users</Text>
  }
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

function policyFormValues(policy: IdentityApplicationPolicy): IdentityPolicyFormValues {
  return {
    assignments: (policy.assignments ?? []).map((assignment) => ({
      effect: 'allow',
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
    })),
  }
}

function inputFromFormValues(values: IdentityPolicyFormValues): IdentityApplicationPolicyInput {
  return {
    assignments: (values.assignments ?? [])
      .filter((assignment) => String(assignment.subjectId ?? '').trim())
      .map((assignment) => ({
        effect: 'allow',
        subjectId: assignment.subjectId.trim(),
        subjectType: assignment.subjectType || 'role',
      })),
  }
}

function providerTypeTag(type: IdentityProviderType) {
  const color = type === 'oidc' ? 'blue' : type === 'proxy' ? 'purple' : 'default'
  return <Tag color={color}>{type.toUpperCase()}</Tag>
}

export function IdentityPoliciesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ query: '', status: '' })
  const [editing, setEditing] = useState<IdentityApplicationPolicy | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<IdentityPolicyFormValues>()
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.policies.manage')

  const policiesQuery = useQuery({
    queryKey: identityPolicyQueryKeys.policies(filters),
    queryFn: () => listIdentityPolicies(filters),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identity', 'policies'] })
    void queryClient.invalidateQueries({ queryKey: ['identity', 'applications'] })
    void queryClient.invalidateQueries({ queryKey: ['provider-portal'] })
  }

  const updateMutation = useMutation({
    mutationFn: ({
      applicationId,
      input,
    }: {
      applicationId: string
      input: IdentityApplicationPolicyInput
    }) => updateIdentityPolicy(applicationId, input),
    onSuccess: (policy) => {
      message.success(`已更新 ${policy?.applicationName ?? '应用'} 访问策略`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const openEdit = (policy: IdentityApplicationPolicy) => {
    setEditing(policy)
    form.setFieldsValue(policyFormValues(policy))
    setModalOpen(true)
  }

  const submitForm = (values: IdentityPolicyFormValues) => {
    if (!editing) return
    updateMutation.mutate({
      applicationId: editing.applicationId,
      input: inputFromFormValues(values),
    })
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
            tooltip="编辑策略"
            onClick={() => openEdit(record)}
          />
        ),
      },
    ],
    [canManage],
  )

  const policies = policiesQuery.data ?? []

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
        dataSource={policies}
        empty={<ManagementState kind="empty" title="暂无策略" description="创建应用后可以在此维护访问主体。" />}
        loading={policiesQuery.isLoading || policiesQuery.isFetching}
        title="访问策略"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索应用、slug、分类"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={statusOptions}
              value={filters.status || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
            />
          </ManagementTableToolbar>
        }
      />

      <Modal
        destroyOnHidden
        footer={null}
        open={modalOpen}
        title={editing ? `访问策略: ${editing.applicationName}` : '访问策略'}
        width={760}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      >
        <Form
          form={form}
          className="soha-identity-policy-form"
          initialValues={{ assignments: [] }}
          layout="vertical"
          onFinish={submitForm}
        >
          <Form.List name="assignments">
            {(fields, { add, remove }) => (
              <div className="soha-identity-policy-assignment-editor">
                <div className="soha-identity-policy-assignment-header">
                  <Text strong>Assignments</Text>
                  <Button
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={() => add({ effect: 'allow', subjectId: '', subjectType: 'role' })}
                  >
                    添加
                  </Button>
                </div>
                {fields.length ? (
                  fields.map((field) => (
                    <div className="soha-identity-policy-assignment-row" key={field.key}>
                      <Form.Item name={[field.name, 'subjectType']} rules={[{ required: true }]}>
                        <Select options={assignmentSubjectOptions} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'subjectId']}
                        rules={[{ required: true, message: '请输入 subject id' }]}
                      >
                        <Input placeholder="admin / team-a / user-id" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'effect']}>
                        <Select disabled options={[{ label: 'Allow', value: 'allow' }]} />
                      </Form.Item>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">未配置 assignment 时，所有已登录用户可访问该应用。</Text>
                )}
              </div>
            )}
          </Form.List>

          <div className="soha-identity-policy-form-actions">
            <Button
              onClick={() => {
                setModalOpen(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button htmlType="submit" loading={updateMutation.isPending} type="primary">
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
