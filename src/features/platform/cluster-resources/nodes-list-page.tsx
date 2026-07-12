import { useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Space, Spin, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useAIPageContext } from '@/features/copilot'
import {
  NodeResourcePanel,
  parseStringMap,
  parseTaints,
  stringifyMap,
  stringifyTaints,
} from '@/features/platform/node-resource-utils'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { nodeMutations } from './mutations'
import { nodeQueries } from './queries'
import { toClusterScope } from './scope'
import type { ClusterNode } from './types'
import '@/features/platform/styles/base.css'

export function ClusterNodesPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId } = usePlatformScopeStore()
  const scope = toClusterScope(clusterId)
  const [editingNodeName, setEditingNodeName] = useState<string | null>(null)
  const [nodeTableSize, setNodeTableSize] = useState<'middle' | 'small'>('small')
  const nodesQuery = useQuery(nodeQueries.list(scope))
  const nodeDetailQuery = useQuery(nodeQueries.detail(scope, editingNodeName ?? ''))
  const updateNodeMutation = useMutation(nodeMutations.update(queryClient))
  const deleteNodeMutation = useMutation(nodeMutations.remove(queryClient))

  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: '集群节点',
    entityKind: 'kubernetes.node-list',
    entityName: clusterId || 'nodes',
    clusterId: clusterId ?? undefined,
    node: editingNodeName ?? undefined,
    pinnedData: {
      nodeCount: nodesQuery.data?.length ?? 0,
      editingNodeName,
    },
  })

  const nodeDetail = nodeDetailQuery.data
  const nodeModalInitValues = useMemo(() => {
    if (!nodeDetail) return undefined
    return {
      labels: stringifyMap(nodeDetail.labels),
      taints: stringifyTaints(nodeDetail.taints),
    }
  }, [nodeDetail])

  const detailPath = (name: string) =>
    `/cluster-resources/nodes/${encodeURIComponent(name)}?clusterId=${encodeURIComponent(clusterId || '')}`

  const nodeColumns: TableColumnsType<ClusterNode> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string) => (
        <Button type="text" onClick={() => navigate(detailPath(name))}>
          {name}
        </Button>
      ),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <StatusTag value={status} />,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (roles: string[]) =>
        roles?.map((role) => (
          <Tag key={role} className="mr-1">
            {role}
          </Tag>
        )) ?? '-',
    },
    { title: 'IP', dataIndex: 'internalIp', render: (value: string) => value || '-' },
    { title: 'Version', dataIndex: 'version', render: (value: string) => value || '-' },
    { title: 'Pods', dataIndex: 'podCount' },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      render: (value: number) => formatAgeSeconds(value),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'name',
      width: 112,
      render: (name: string) => {
        const deleting = deleteNodeMutation.isPending && deleteNodeMutation.variables?.name === name
        return (
          <Space size={2} className="soha-row-action-icons">
            <ManagementIconButton
              aria-label={`查看节点 ${name}`}
              icon={<EyeOutlined />}
              size="small"
              tooltip="详情"
              onClick={() => navigate(detailPath(name))}
            />
            <ManagementIconButton
              aria-label={`编辑节点 ${name}`}
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => setEditingNodeName(name)}
            />
            <Popconfirm
              title={`确认删除节点 ${name}？`}
              description="这会删除 Kubernetes 中的 Node 对象，不会自动回收底层机器。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleting }}
              placement="topRight"
              onConfirm={() =>
                deleteNodeMutation.mutate(
                  { scope, name },
                  {
                    onSuccess: () => void message.success('节点对象已删除'),
                    onError: (error) => void message.error(error.message),
                  },
                )
              }
            >
              <ManagementIconButton
                aria-label={`删除节点 ${name}`}
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
      {!clusterId ? (
        <ManagementState
          compact
          kind="select-scope"
          title={t('common.pleaseSelectCluster', 'Please select a cluster')}
        />
      ) : (
        <AdminTable
          columnSettingIconOnly
          columnSettingPlacement="header"
          shellClassName="soha-management-table-shell"
          headerExtra={
            <ManagementTableToolbar>
              <ManagementDensityButton
                aria-label="切换表格密度"
                title="切换表格密度"
                tooltip="切换表格密度"
                onClick={() =>
                  setNodeTableSize((current) => (current === 'middle' ? 'small' : 'middle'))
                }
              />
              <ManagementRefreshButton
                aria-label="刷新"
                loading={nodesQuery.isFetching}
                title="刷新"
                tooltip="刷新"
                onClick={() => void nodesQuery.refetch()}
              />
            </ManagementTableToolbar>
          }
          columns={nodeColumns}
          dataSource={nodesQuery.data ?? []}
          rowKey="name"
          loading={nodesQuery.isLoading}
          pageSize={10}
          tableSize={nodeTableSize}
          scroll={{ x: 'max-content' }}
          expandedRowRender={(record: ClusterNode) => <NodeResourcePanel node={record} />}
          hideExpandedColumn={false}
        />
      )}

      <Modal
        title={editingNodeName ? `编辑节点 ${editingNodeName}` : '编辑节点'}
        open={!!editingNodeName}
        footer={null}
        width={720}
        onCancel={() => setEditingNodeName(null)}
      >
        {nodeDetailQuery.isLoading && !nodeDetail ? (
          <div className="flex items-center justify-center h-48">
            <Spin size="large" />
          </div>
        ) : (
          <Form
            key={editingNodeName ?? 'node'}
            layout="vertical"
            initialValues={nodeModalInitValues}
            onFinish={(values) => {
              if (!editingNodeName) return
              updateNodeMutation.mutate(
                {
                  scope,
                  name: editingNodeName,
                  input: {
                    labels: parseStringMap(values.labels, 'Labels'),
                    taints: parseTaints(values.taints),
                  },
                },
                {
                  onSuccess: () => {
                    void message.success('节点配置已更新')
                    setEditingNodeName(null)
                  },
                  onError: (error) => void message.error(error.message),
                },
              )
            }}
          >
            <Form.Item name="labels" label="Labels(JSON)">
              <Input.TextArea rows={8} />
            </Form.Item>
            <Form.Item name="taints" label="Taints(JSON Array)">
              <Input.TextArea rows={8} />
            </Form.Item>
            <div className="soha-form-actions">
              <Button onClick={() => setEditingNodeName(null)}>取消</Button>
              <Button htmlType="submit" type="primary" loading={updateNodeMutation.isPending}>
                保存
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  )
}
