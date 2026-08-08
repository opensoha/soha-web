import { useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementIconButton } from '@/components/management-list'
import { BooleanTag, MetadataTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { RegistryInput, RegistryRecord } from '../types'

type ColumnProps<T> = TableColumnsType<T>[number]

export function RegistriesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [form] = Form.useForm<RegistryInput>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<RegistryRecord | null>(null)
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canCreateRegistry = hasPermission(permissionSnapshot, 'delivery.registries.create')
  const canUpdateRegistry = hasPermission(permissionSnapshot, 'delivery.registries.update')
  const canDeleteRegistry = hasPermission(permissionSnapshot, 'delivery.registries.delete')

  const registriesQuery = useQuery(deliveryQueries.registries.list())
  const createMutation = useMutation(deliveryMutations.registries.create(queryClient))
  const updateMutation = useMutation(deliveryMutations.registries.update(queryClient))
  const deleteMutation = useMutation(deliveryMutations.registries.delete(queryClient))

  const closeModal = () => {
    setModalVisible(false)
    setEditing(null)
  }

  const handleSubmit = (payload: RegistryInput) => {
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
    {
      title: '类型',
      dataIndex: 'registryType',
      render: (registryType: string) => <MetadataTag label={registryType} />,
    },
    { title: 'Endpoint', dataIndex: 'endpoint', ellipsis: true },
    { title: '命名空间', dataIndex: 'namespace', render: (value?: string) => value || '-' },
    { title: '用户名', dataIndex: 'username', render: (value?: string) => value || '-' },
    {
      title: '凭据',
      dataIndex: 'metadata',
      render: (_: RegistryRecord['metadata'], record: RegistryRecord) => (
        <BooleanTag
          value={record.metadata.secretConfigured}
          trueLabel="已配置"
          falseLabel="未配置"
        />
      ),
    },
    {
      ...tableColumnPresets.status,
      title: 'TLS 校验',
      dataIndex: 'insecure',
      render: (insecure: boolean) => (
        <BooleanTag value={!insecure} trueLabel="校验" falseLabel="跳过" falseColor="warning" />
      ),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: RegistryRecord) => (
        <Space className="soha-row-action-icons" size={2}>
          {canUpdateRegistry ? (
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
          {canDeleteRegistry ? (
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
          {!canUpdateRegistry && !canDeleteRegistry ? '-' : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <DeliveryTable
        actions={
          canCreateRegistry ? (
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
                  registryType: editing.registryType,
                  endpoint: editing.endpoint,
                  namespace: editing.namespace,
                  username: editing.username,
                  insecure: editing.insecure,
                }
              : { insecure: false }
          }
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="registryType"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
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
          <Form.Item name="namespace" label="命名空间">
            <Input />
          </Form.Item>
          <Form.Item name="secret" label={editing ? '凭据（留空不修改）' : '凭据'}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="insecure" label="跳过 TLS 证书校验" valuePropName="checked">
            <Switch />
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
