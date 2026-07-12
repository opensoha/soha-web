import { useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tag } from 'antd'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useAIPageContext } from '@/features/copilot'
import { parseStringMap, stringifyMap } from '@/features/platform/node-resource-utils'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { tableColumnPresets } from '@/utils/table-columns'
import { namespaceMutations } from './mutations'
import { namespaceQueries } from './queries'
import { toClusterScope } from './scope'
import type { ClusterNamespace } from './types'
import '@/features/platform/styles/base.css'

export function ClusterNamespacesPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, setNamespace } = usePlatformScopeStore()
  const scope = toClusterScope(clusterId)
  const [editingNamespace, setEditingNamespace] = useState<ClusterNamespace | null>(null)
  const [namespaceModalVisible, setNamespaceModalVisible] = useState(false)
  const namespacesQuery = useQuery(namespaceQueries.list(scope))
  const createNamespaceMutation = useMutation(namespaceMutations.create(queryClient))
  const updateNamespaceMutation = useMutation(namespaceMutations.update(queryClient))
  const deleteNamespaceMutation = useMutation(namespaceMutations.remove(queryClient))

  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: '集群命名空间',
    entityKind: 'kubernetes.namespace-list',
    entityName: clusterId || 'namespaces',
    clusterId: clusterId ?? undefined,
    namespace: editingNamespace?.name,
    pinnedData: {
      namespaceCount: namespacesQuery.data?.length ?? 0,
      editingNamespace: editingNamespace?.name,
    },
  })

  const closeModal = () => {
    setNamespaceModalVisible(false)
    setEditingNamespace(null)
  }

  const namespaceModalInitValues = useMemo(() => {
    if (!editingNamespace) return { labels: '{}', annotations: '{}' }
    return {
      name: editingNamespace.name,
      labels: stringifyMap(editingNamespace.labels),
      annotations: stringifyMap(editingNamespace.annotations),
    }
  }, [editingNamespace])

  const columns: TableColumnsType<ClusterNamespace> = [
    { title: '名称', dataIndex: 'name' },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <StatusTag value={status} />,
    },
    {
      title: '标签',
      dataIndex: 'labels',
      render: (labels: Record<string, string>) =>
        labels
          ? Object.entries(labels)
              .slice(0, 3)
              .map(([key, value]) => <Tag key={key} className="mr-1">{`${key}=${value}`}</Tag>)
          : '-',
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'name',
      width: 150,
      render: (name: string, record) => {
        const deleting =
          deleteNamespaceMutation.isPending && deleteNamespaceMutation.variables?.name === name
        return (
          <Space size={2} className="soha-row-action-icons">
            <ManagementIconButton
              aria-label={`查看命名空间 ${name} 资源`}
              size="small"
              tooltip="查看资源"
              icon={<SendOutlined />}
              onClick={() => {
                setNamespace(name)
                navigate('/workloads/overview')
              }}
            />
            <ManagementIconButton
              aria-label={`查看命名空间 ${name} Helm`}
              size="small"
              tooltip="Helm"
              icon={<ApartmentOutlined />}
              onClick={() => {
                setNamespace(name)
                navigate('/helm/releases')
              }}
            />
            <ManagementIconButton
              aria-label={`编辑命名空间 ${name}`}
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingNamespace(record)
                setNamespaceModalVisible(true)
              }}
            />
            <Popconfirm
              title={`确认删除命名空间 ${name}？`}
              description="删除后该命名空间下的资源会一并回收，请确认。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleting }}
              placement="topRight"
              onConfirm={() =>
                deleteNamespaceMutation.mutate(
                  { scope, name },
                  {
                    onSuccess: () => void message.success('命名空间已删除'),
                    onError: (error) => void message.error(error.message),
                  },
                )
              }
            >
              <ManagementIconButton
                aria-label={`删除命名空间 ${name}`}
                danger
                icon={<DeleteOutlined />}
                loading={deleting}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={t('page.namespaces.title', 'Namespaces')}
        description={t(
          'page.namespaces.desc',
          'Manage namespaces in the current cluster scope and jump into related workload views.',
        )}
      />
      {!clusterId ? (
        <ManagementState
          compact
          kind="select-scope"
          title={t('common.pleaseSelectClusterShort', 'Select a cluster')}
        />
      ) : (
        <AdminTable
          columnSettingIconOnly
          columnSettingPlacement="header"
          shellClassName="soha-management-table-shell"
          columns={columns}
          dataSource={namespacesQuery.data ?? []}
          rowKey="name"
          loading={namespacesQuery.isLoading}
          pageSize={10}
          tableSize="small"
          scroll={{ x: 'max-content' }}
          headerExtra={
            <ManagementTableToolbar>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => {
                  setEditingNamespace(null)
                  setNamespaceModalVisible(true)
                }}
              >
                {t('common.create', 'Create')}
              </Button>
            </ManagementTableToolbar>
          }
        />
      )}

      <Modal
        title={editingNamespace ? `编辑命名空间 ${editingNamespace.name}` : '新建命名空间'}
        open={namespaceModalVisible}
        footer={null}
        width={720}
        onCancel={closeModal}
      >
        <Form
          key={editingNamespace?.name ?? 'namespace-new'}
          layout="vertical"
          initialValues={namespaceModalInitValues}
          onFinish={(values) => {
            const input = {
              name: editingNamespace?.name ?? String(values.name ?? ''),
              labels: parseStringMap(values.labels, 'Labels'),
              annotations: parseStringMap(values.annotations, 'Annotations'),
            }
            const callbacks = {
              onSuccess: () => {
                void message.success(editingNamespace ? '命名空间已更新' : '命名空间已创建')
                closeModal()
              },
              onError: (error: Error) => void message.error(error.message),
            }
            if (editingNamespace) {
              updateNamespaceMutation.mutate(
                { scope, name: editingNamespace.name, input },
                callbacks,
              )
            } else {
              createNamespaceMutation.mutate({ scope, input }, callbacks)
            }
          }}
        >
          {!editingNamespace ? (
            <Form.Item
              name="name"
              label="命名空间名称"
              rules={[{ required: true, message: '请输入命名空间名称' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="labels" label="Labels(JSON)">
            <Input.TextArea rows={8} />
          </Form.Item>
          <Form.Item name="annotations" label="Annotations(JSON)">
            <Input.TextArea rows={8} />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={closeModal}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={createNamespaceMutation.isPending || updateNamespaceMutation.isPending}
            >
              {editingNamespace ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
