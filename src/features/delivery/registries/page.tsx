import { useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { DeliveryStringRecordInput, RegistryRecord } from '../types'

type ColumnProps<T> = TableColumnsType<T>[number]

export function RegistriesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [form] = Form.useForm<DeliveryStringRecordInput>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<RegistryRecord | null>(null)
  const canManageRegistry = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.registries.manage',
  )

  const registriesQuery = useQuery(deliveryQueries.registries.list())
  const createMutation = useMutation(deliveryMutations.registries.create(queryClient))
  const updateMutation = useMutation(deliveryMutations.registries.update(queryClient))
  const deleteMutation = useMutation(deliveryMutations.registries.delete(queryClient))

  const closeModal = () => {
    setModalVisible(false)
    setEditing(null)
  }

  const handleSubmit = (payload: DeliveryStringRecordInput) => {
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            message.success('仓库更新成功')
            closeModal()
          },
          onError: (error) =>
            message.error(error instanceof Error ? error.message : '仓库更新失败'),
        },
      )
      return
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        message.success('仓库创建成功')
        closeModal()
      },
      onError: (error) => message.error(error instanceof Error ? error.message : '仓库创建失败'),
    })
  }

  const columns: ColumnProps<RegistryRecord>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', render: (type: string) => <Tag>{type}</Tag> },
    { title: 'Endpoint', dataIndex: 'endpoint', ellipsis: true },
    { title: '用户名', dataIndex: 'username' },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <StatusTag value={status} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: RegistryRecord) => (
        <Space className="soha-row-action-icons" size={2}>
          {canManageRegistry ? (
            <ManagementIconButton
              aria-label="编辑仓库"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => {
                setEditing(record)
                setModalVisible(true)
              }}
            />
          ) : null}
          {canManageRegistry ? (
            <Popconfirm
              title="确认删除？"
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () => message.success('仓库已删除'),
                  onError: (error) =>
                    message.error(error instanceof Error ? error.message : '仓库删除失败'),
                })
              }
              placement="topRight"
            >
              <ManagementIconButton
                aria-label="删除仓库"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
          {!canManageRegistry ? '-' : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <DeliveryTable
        actions={
          canManageRegistry ? (
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setEditing(null)
                setModalVisible(true)
              }}
            >
              添加仓库
            </Button>
          ) : null
        }
        refreshing={registriesQuery.isFetching}
        onRefresh={() => void registriesQuery.refetch()}
        columns={columns}
        dataSource={registriesQuery.data ?? []}
        rowKey="id"
        loading={registriesQuery.isLoading}
      />
      <Modal
        title={editing ? '编辑仓库' : '添加仓库'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          key={editing?.id ?? 'create-registry'}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  endpoint: editing.endpoint,
                  username: editing.username,
                }
              : {}
          }
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'docker', label: 'Docker Hub' },
                { value: 'harbor', label: 'Harbor' },
                { value: 'acr', label: 'ACR' },
                { value: 'ecr', label: 'ECR' },
                { value: 'gcr', label: 'GCR' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Endpoint"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="username" label="用户名">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={closeModal}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
