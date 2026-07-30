import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
} from 'antd'
import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
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
import { hasAllowedAction } from '@/features/auth'
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
  const [drainingNodeName, setDrainingNodeName] = useState<string | null>(null)
  const [drainForm] = Form.useForm()
  const [nodeTableSize, setNodeTableSize] = useState<'middle' | 'small'>('small')
  const nodesQuery = useQuery(nodeQueries.list(scope))
  const nodeDetailQuery = useQuery(nodeQueries.detail(scope, editingNodeName ?? ''))
  const updateNodeMutation = useMutation(nodeMutations.update(queryClient))
  const deleteNodeMutation = useMutation(nodeMutations.remove(queryClient))
  const schedulabilityMutation = useMutation(nodeMutations.schedulability(queryClient))
  const drainNodeMutation = useMutation(nodeMutations.drain(queryClient))

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
      render: (status: string, record) => (
        <Space size={4} wrap>
          <StatusTag value={status} />
          {record.unschedulable ? <StatusTag value="禁止调度" /> : null}
        </Space>
      ),
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
      width: 176,
      render: (name: string, record) => {
        const deleting = deleteNodeMutation.isPending && deleteNodeMutation.variables?.name === name
        const changingSchedulability =
          schedulabilityMutation.isPending && schedulabilityMutation.variables?.name === name
        const canUpdate = hasAllowedAction(record.allowedActions, 'update')
        const schedulabilityLabel = record.unschedulable ? '恢复调度' : '禁止调度'
        return (
          <Space size={2} className="soha-row-action-icons">
            <ManagementIconButton
              aria-label={`查看节点 ${name}`}
              icon={<EyeOutlined />}
              size="small"
              tooltip="详情"
              onClick={() => navigate(detailPath(name))}
            />
            {canUpdate ? (
              <Popconfirm
                title={`确认${schedulabilityLabel}节点 ${name}？`}
                description={
                  record.unschedulable
                    ? '恢复后，新的 Pod 可以再次调度到该节点。'
                    : '现有 Pod 不受影响，但新的 Pod 将不再调度到该节点。'
                }
                okText={schedulabilityLabel}
                cancelText="取消"
                onConfirm={() =>
                  schedulabilityMutation.mutate(
                    { scope, name, unschedulable: !record.unschedulable },
                    {
                      onSuccess: () => void message.success(`已${schedulabilityLabel}`),
                      onError: (error) => void message.error(error.message),
                    },
                  )
                }
              >
                <ManagementIconButton
                  aria-label={`${schedulabilityLabel}节点 ${name}`}
                  icon={record.unschedulable ? <PlayCircleOutlined /> : <StopOutlined />}
                  loading={changingSchedulability}
                  size="small"
                  tooltip={schedulabilityLabel}
                />
              </Popconfirm>
            ) : null}
            {canUpdate ? (
              <ManagementIconButton
                aria-label={`排空节点 ${name}`}
                danger
                icon={<ClearOutlined />}
                loading={drainNodeMutation.isPending && drainNodeMutation.variables?.name === name}
                size="small"
                tooltip="排空节点"
                onClick={() => {
                  drainForm.resetFields()
                  setDrainingNodeName(name)
                }}
              />
            ) : null}
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

      <Modal
        title={drainingNodeName ? `排空节点 ${drainingNodeName}` : '排空节点'}
        open={!!drainingNodeName}
        okText="确认排空"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={drainNodeMutation.isPending}
        mask={{ closable: !drainNodeMutation.isPending }}
        onCancel={() => !drainNodeMutation.isPending && setDrainingNodeName(null)}
        onOk={() => drainForm.submit()}
      >
        <Alert
          type="warning"
          showIcon
          title="节点会先进入禁止调度状态，再驱逐可迁移的 Pod。DaemonSet 和静态 Pod 不会被驱逐。"
        />
        <Form
          form={drainForm}
          layout="vertical"
          initialValues={{ deleteEmptyDirData: false, force: false }}
          onFinish={(values) => {
            if (!drainingNodeName) return
            drainNodeMutation.mutate(
              {
                scope,
                name: drainingNodeName,
                force: Boolean(values.force),
                deleteEmptyDirData: Boolean(values.deleteEmptyDirData),
                timeoutSeconds: 300,
              },
              {
                onSuccess: () => {
                  void message.success('节点已禁止调度，可迁移 Pod 已完成驱逐')
                  setDrainingNodeName(null)
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }}
        >
          <Form.Item name="deleteEmptyDirData" valuePropName="checked">
            <Checkbox>允许删除使用 emptyDir 的 Pod（本地临时数据会丢失）</Checkbox>
          </Form.Item>
          <Form.Item name="force" valuePropName="checked">
            <Checkbox>强制驱逐没有控制器管理的 Pod</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
