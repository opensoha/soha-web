import { useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Space, Switch, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementTableToolbar } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { accessMutations, invalidateAccessScopeGrants } from './mutations'
import { accessQueries } from './queries'
import type { AccessScopeGrant } from './types'
import { joinCSV, parseCSV } from './utils'

type ColumnProps<T> = TableColumnsType<T>[number]

interface ScopeGrantManagerProps {
  subjectType: 'user' | 'team'
  subjectId: string | null
  visible: boolean
  title: string
  onClose: () => void
}

export function ScopeGrantManager({
  subjectType,
  subjectId,
  visible,
  title,
  onClose,
}: ScopeGrantManagerProps) {
  const { message } = App.useApp()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageScopeGrants = hasPermission(
    permissionSnapshotQuery.data?.data,
    'access.scope-grants.manage',
  )
  const queryClient = useQueryClient()
  const [form] = Form.useForm<Record<string, unknown>>()
  const [editing, setEditing] = useState<AccessScopeGrant | null>(null)
  const [grantModalVisible, setGrantModalVisible] = useState(false)
  const grantsQuery = useQuery(accessQueries.scopeGrants(visible))
  const applicationsQuery = useQuery(accessQueries.applicationOptions(visible))
  const applicationMap = useMemo(
    () => Object.fromEntries((applicationsQuery.data ?? []).map((item) => [item.id, item.name])),
    [applicationsQuery.data],
  )
  const grants = useMemo(
    () =>
      (grantsQuery.data ?? []).filter(
        (item) => item.subjectType === subjectType && item.subjectId === subjectId,
      ),
    [grantsQuery.data, subjectId, subjectType],
  )

  const createMutation = useMutation({
    ...accessMutations.scopeGrants.create(),
    onSuccess: async () => {
      message.success('授权项创建成功')
      await invalidateAccessScopeGrants(queryClient)
      setGrantModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...accessMutations.scopeGrants.update(),
    onSuccess: async () => {
      message.success('授权项更新成功')
      await invalidateAccessScopeGrants(queryClient)
      setEditing(null)
      setGrantModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const deleteMutation = useMutation({
    ...accessMutations.scopeGrants.delete(),
    onSuccess: async () => {
      message.success('授权项已删除')
      await invalidateAccessScopeGrants(queryClient)
    },
    onError: (error) => message.error(error.message),
  })

  const submitGrant = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      subjectType,
      subjectId,
      environmentIds: parseCSV(values.environmentIds),
      applicationIds: parseCSV(values.applicationIds),
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: payload })
      return
    }
    createMutation.mutate(payload)
  }

  const columns: ColumnProps<AccessScopeGrant>[] = [
    { title: '范围 Key', dataIndex: 'businessLineId', render: (value: string) => value || '-' },
    {
      title: '环境',
      dataIndex: 'environmentIds',
      render: (values: string[]) =>
        values?.length ? values.map((item) => <Tag key={item}>{item}</Tag>) : '全部',
    },
    {
      title: '应用',
      dataIndex: 'applicationIds',
      render: (values: string[]) =>
        values?.length
          ? values.map((item) => <Tag key={item}>{applicationMap[item] || item}</Tag>)
          : '全部',
    },
    { title: '角色', dataIndex: 'role' },
    { title: '效果', dataIndex: 'effect' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessScopeGrant) => (
        <Space className="soha-row-action-icons">
          {canManageScopeGrants ? (
            <>
              <ManagementIconButton
                aria-label="编辑授权项"
                icon={<EditOutlined />}
                size="small"
                tooltip="编辑"
                onClick={() => {
                  setEditing(record)
                  setGrantModalVisible(true)
                }}
              />
              <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
                <ManagementIconButton
                  aria-label="删除授权项"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  tooltip="删除"
                />
              </Popconfirm>
            </>
          ) : (
            '-'
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Modal title={title} open={visible} onCancel={onClose} footer={null} width={880}>
        <div className="soha-page">
          <AdminTable
            columnSettingIconOnly
            columnSettingPlacement="header"
            shellClassName="soha-management-table-shell"
            title="授权项"
            headerExtra={
              canManageScopeGrants ? (
                <ManagementTableToolbar>
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() => {
                      setEditing(null)
                      setGrantModalVisible(true)
                    }}
                  >
                    新建授权项
                  </Button>
                </ManagementTableToolbar>
              ) : null
            }
            columns={columns}
            dataSource={grants}
            rowKey="id"
            loading={grantsQuery.isLoading}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </Modal>
      <Modal
        title={editing ? '编辑授权项' : '新建授权项'}
        open={grantModalVisible}
        onCancel={() => {
          setGrantModalVisible(false)
          setEditing(null)
        }}
        onOk={async () => {
          try {
            submitGrant(await form.validateFields())
          } catch {
            return
          }
        }}
        okText={editing ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={760}
        destroyOnHidden
        mask={{ closable: false }}
        styles={{ body: { maxHeight: '65vh', overflow: 'auto' } }}
      >
        <Form
          form={form}
          key={editing?.id ?? 'create-scope-grant'}
          layout="vertical"
          initialValues={
            editing
              ? {
                  ...editing,
                  environmentIds: joinCSV(editing.environmentIds),
                  applicationIds: joinCSV(editing.applicationIds),
                }
              : { enabled: true, effect: 'allow', role: 'developer' }
          }
        >
          <Form.Item
            name="businessLineId"
            label="范围 Key"
            rules={[{ required: true, message: '请输入范围 Key' }]}
          >
            <Input placeholder="应用组 / 历史 businessLineId" />
          </Form.Item>
          <Form.Item name="environmentIds" label="环境 IDs">
            <Input placeholder="留空表示全部环境，多个以逗号分隔" />
          </Form.Item>
          <Form.Item name="applicationIds" label="应用 IDs">
            <Input placeholder="留空表示全部应用，多个以逗号分隔" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请输入角色' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="effect" label="效果">
            <Input disabled />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
