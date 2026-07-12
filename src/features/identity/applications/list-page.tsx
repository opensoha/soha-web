import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
  IdentityApplication,
  IdentityApplicationInput,
  IdentityProviderType,
} from '../shared/types'
import { identityApplicationStatusOptions } from './application-form-model'
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
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IdentityApplicationFilters>({
    query: '',
    status: '',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityApplication | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.applications.manage')

  const applicationsQuery = useQuery(identityApplicationQueries.list(filters))
  const providerCapabilitiesQuery = useQuery(identityApplicationQueries.providerCapabilities())
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
            message.success(`已更新 ${application.name}`)
            closeModal()
          },
        },
      )
      return
    }
    createMutation.mutate(input, {
      onSuccess: (application) => {
        message.success(`已创建 ${application.name}`)
        closeModal()
      },
    })
  }

  const columns = useMemo<TableColumnsType<IdentityApplication>>(
    () => [
      {
        title: 'Application',
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
        title: 'Portal',
        dataIndex: 'portalVisible',
        width: 150,
        render: (portalVisible: boolean, record) => (
          <Space orientation="vertical" size={2}>
            {identityApplicationStatusTag(record.status)}
            <Tag color={portalVisible ? 'blue' : 'default'}>
              {portalVisible ? 'Visible' : 'Hidden'}
            </Tag>
            {record.featured ? <Tag color="purple">Featured</Tag> : null}
          </Space>
        ),
      },
      {
        title: 'Assignments',
        key: 'assignments',
        width: 260,
        render: (_, record) => identityApplicationAssignmentsSummary(record),
      },
      {
        title: 'Launch URL',
        dataIndex: 'launchUrl',
        width: 280,
        render: (value: string | undefined, record) =>
          value ? (
            <Text ellipsis title={value}>
              {value}
            </Text>
          ) : record.providerType === 'oidc' ? (
            <Tag color="blue">Generated authorize URL</Tag>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatIdentityApplicationDateTime,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              disabled={!canManage}
              icon={<EditOutlined />}
              tooltip="编辑"
              onClick={() => openEdit(record)}
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canManage}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText="删除"
              title={`删除 ${record.name}`}
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () => message.success('应用已删除'),
                })
              }
            >
              <Button danger disabled={!canManage} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canManage, deleteMutation, message],
  )

  const saving = createMutation.isPending || updateMutation.isPending
  const applications = applicationsQuery.data ?? []

  return (
    <div className="soha-page soha-identity-applications-page">
      <ManagementDetailHeader
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => applicationsQuery.refetch()}>
              刷新
            </Button>
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              type="primary"
              onClick={openCreate}
            >
              新建应用
            </Button>
          </Space>
        }
        description="管理 Soha Provider Portal 中展示和授权的下游应用。OIDC 与 Proxy Provider 可在 Providers 页面配置。"
        title="Identity Applications"
      />

      <div className="soha-identity-capability-row">
        {(providerCapabilitiesQuery.data ?? []).map((capability) => (
          <div className="soha-identity-capability" key={capability.type}>
            <div className="soha-identity-capability-title">
              <Tag>{capability.type.toUpperCase()}</Tag>
              <Tag color="gold">{capability.status}</Tag>
            </div>
            <Text type="secondary">{capability.description}</Text>
          </div>
        ))}
      </div>

      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={applications}
        empty={
          <ManagementState
            kind="empty"
            title="暂无应用"
            description="创建应用后会出现在门户目录中。"
          />
        }
        loading={applicationsQuery.isLoading || applicationsQuery.isFetching}
        title="应用目录"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索名称、slug、分类"
              value={filters.query ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={identityApplicationStatusOptions}
              value={filters.status || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
            />
          </ManagementTableToolbar>
        }
      />

      <ApplicationFormModal
        application={editing}
        open={modalOpen}
        saving={saving}
        onCancel={closeModal}
        onSubmit={submitForm}
      />
    </div>
  )
}
