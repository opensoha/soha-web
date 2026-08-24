import { useMemo, useState } from 'react'
import { Alert, App, Button, Checkbox, Form, Input, Modal, Popconfirm, Space, Spin } from 'antd'
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
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import {
  NodeResourcePanel,
  parseStringMap,
  parseTaints,
  stringifyMap,
  stringifyTaints,
} from '@/features/platform/node-resource-utils'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import { ResourceStreamStatus } from '@/features/platform/shared/resource-stream-status'
import { useKubernetesResourceStream } from '@/features/platform/shared/resource-stream'
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
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId } = usePlatformScopeStore()
  const scope = toClusterScope(clusterId)
  const [editingNodeName, setEditingNodeName] = useState<string | null>(null)
  const [drainingNodeName, setDrainingNodeName] = useState<string | null>(null)
  const [drainForm] = Form.useForm()
  const [nodeTableSize, setNodeTableSize] = useState<'middle' | 'small'>('small')
  const nodeListQuery = nodeQueries.list(scope)
  const nodeStream = useKubernetesResourceStream({
    clusterId,
    kinds: ['Node', 'Pod', 'Event'],
    onEvent: () => void queryClient.invalidateQueries({ queryKey: nodeListQuery.queryKey }),
    onFallback: () => void queryClient.invalidateQueries({ queryKey: nodeListQuery.queryKey }),
    onResyncRequired: () => queryClient.invalidateQueries({ queryKey: nodeListQuery.queryKey }),
  })
  const nodesQuery = useQuery(nodeListQuery)
  const nodes = nodesQuery.data ?? []
  const canShowNodeActions = nodes.some((node) =>
    ['update', 'delete'].some((action) => hasAllowedAction(node.allowedActions, action)),
  )
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
  const copy =
    localeCode === 'zh_CN'
      ? {
          unschedulable: '禁止调度',
          restoreScheduling: '恢复调度',
          drain: '排空节点',
          edit: '编辑节点',
          deleted: '节点对象已删除',
          updated: '节点配置已更新',
          drained: '节点已禁止调度，可迁移 Pod 已完成驱逐',
          drainWarning:
            '节点会先进入禁止调度状态，再驱逐可迁移的 Pod。DaemonSet 和静态 Pod 不会被驱逐。',
          deleteDescription: '这会删除 Kubernetes 中的 Node 对象，不会自动回收底层机器。',
        }
      : {
          unschedulable: 'Disable Scheduling',
          restoreScheduling: 'Enable Scheduling',
          drain: 'Drain Node',
          edit: 'Edit Node',
          deleted: 'Node object deleted',
          updated: 'Node configuration updated',
          drained: 'Node cordoned and evictable pods drained',
          drainWarning:
            'The node will be cordoned before evictable pods are drained. DaemonSet and static pods are not evicted.',
          deleteDescription:
            'This deletes the Kubernetes Node object without reclaiming the underlying machine.',
        }

  const nodeColumns: TableColumnsType<ClusterNode> = [
    {
      title: t('common.name', '名称'),
      dataIndex: 'name',
      render: (name: string) => (
        <Button type="text" onClick={() => navigate(detailPath(name))}>
          {name}
        </Button>
      ),
    },
    {
      ...tableColumnPresets.status,
      title: t('common.status', '状态'),
      dataIndex: 'status',
      render: (status: string, record) => (
        <Space size={4} wrap>
          <StatusTag value={status} />
          {record.unschedulable ? <StatusTag label={copy.unschedulable} value="warning" /> : null}
        </Space>
      ),
    },
    {
      title: t('common.role', '角色'),
      dataIndex: 'roles',
      className: 'soha-table-cell-wrap',
      render: (roles: string[]) =>
        roles?.length ? (
          <Space size={[4, 4]} wrap>
            {roles.map((role) => (
              <MetadataTag key={role} label={role} />
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    { title: 'IP', dataIndex: 'internalIp', render: (value: string) => value || '-' },
    {
      title: t('common.version', '版本'),
      dataIndex: 'version',
      render: (value: string) => value || '-',
    },
    { title: t('common.pods', 'Pods'), dataIndex: 'podCount' },
    {
      ...tableColumnPresets.datetime,
      title: t('common.age', '时长'),
      dataIndex: 'ageSeconds',
      render: (value: number) => formatAgeSeconds(value),
    },
    {
      ...tableColumnPresets.action,
      title: t('common.actions', '操作'),
      dataIndex: 'name',
      key: 'actions',
      width: 176,
      render: (name: string, record) => {
        const deleting = deleteNodeMutation.isPending && deleteNodeMutation.variables?.name === name
        const changingSchedulability =
          schedulabilityMutation.isPending && schedulabilityMutation.variables?.name === name
        const canUpdate = hasAllowedAction(record.allowedActions, 'update')
        const canDelete = hasAllowedAction(record.allowedActions, 'delete')
        const schedulabilityLabel = record.unschedulable
          ? copy.restoreScheduling
          : copy.unschedulable
        return (
          <Space size={2} className="soha-row-action-icons">
            <ManagementIconButton
              aria-label={`${t('common.details', '详情')} ${name}`}
              icon={<EyeOutlined />}
              size="small"
              tooltip={t('common.details', '详情')}
              onClick={() => navigate(detailPath(name))}
            />
            {canUpdate ? (
              <Popconfirm
                title={
                  localeCode === 'zh_CN'
                    ? `确认${schedulabilityLabel}节点 ${name}？`
                    : `Confirm ${schedulabilityLabel.toLowerCase()} for node ${name}?`
                }
                description={
                  record.unschedulable
                    ? localeCode === 'zh_CN'
                      ? '恢复后，新的 Pod 可以再次调度到该节点。'
                      : 'New pods can be scheduled to this node again.'
                    : localeCode === 'zh_CN'
                      ? '现有 Pod 不受影响，但新的 Pod 将不再调度到该节点。'
                      : 'Existing pods are unaffected, but new pods will not be scheduled here.'
                }
                okText={schedulabilityLabel}
                cancelText={t('common.cancel', '取消')}
                onConfirm={() =>
                  schedulabilityMutation.mutate(
                    { scope, name, unschedulable: !record.unschedulable },
                    {
                      onSuccess: () =>
                        void message.success(
                          localeCode === 'zh_CN' ? `已${schedulabilityLabel}` : schedulabilityLabel,
                        ),
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
                aria-label={`${copy.drain} ${name}`}
                danger
                icon={<ClearOutlined />}
                loading={drainNodeMutation.isPending && drainNodeMutation.variables?.name === name}
                size="small"
                tooltip={copy.drain}
                onClick={() => {
                  drainForm.resetFields()
                  setDrainingNodeName(name)
                }}
              />
            ) : null}
            {canUpdate ? (
              <ManagementIconButton
                aria-label={`${copy.edit} ${name}`}
                icon={<EditOutlined />}
                size="small"
                tooltip={t('common.edit', '编辑')}
                onClick={() => setEditingNodeName(name)}
              />
            ) : null}
            {canDelete ? (
              <Popconfirm
                title={
                  localeCode === 'zh_CN'
                    ? `确认删除节点 ${name}？`
                    : `Confirm deletion of node ${name}?`
                }
                description={copy.deleteDescription}
                okText={t('common.delete', '删除')}
                cancelText={t('common.cancel', '取消')}
                okButtonProps={{ danger: true, loading: deleting }}
                placement="topRight"
                onConfirm={() =>
                  deleteNodeMutation.mutate(
                    { scope, name },
                    {
                      onSuccess: () => void message.success(copy.deleted),
                      onError: (error) => void message.error(error.message),
                    },
                  )
                }
              >
                <ManagementIconButton
                  aria-label={localeCode === 'zh_CN' ? `删除节点 ${name}` : `Delete node ${name}`}
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleting}
                  size="small"
                  tooltip={t('common.delete', '删除')}
                />
              </Popconfirm>
            ) : null}
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
              <ResourceStreamStatus
                status={nodeStream.status}
                lastEventAt={nodeStream.lastEventAt}
                localeCode={localeCode}
              />
              <ManagementDensityButton
                aria-label={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
                title={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
                tooltip={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
                onClick={() =>
                  setNodeTableSize((current) => (current === 'middle' ? 'small' : 'middle'))
                }
              />
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={nodesQuery.isFetching}
                title={t('common.refresh', '刷新')}
                tooltip={t('common.refresh', '刷新')}
                onClick={() => void nodesQuery.refetch()}
              />
            </ManagementTableToolbar>
          }
          columns={
            canShowNodeActions
              ? nodeColumns
              : nodeColumns.filter((column) => column.key !== 'actions')
          }
          dataSource={nodes}
          rowKey="name"
          loading={nodesQuery.isLoading}
          localSorting
          pageSize={K8S_TABLE_PAGE_SIZE}
          tableSize={nodeTableSize}
          scroll={{ x: 'max-content' }}
          viewportScroll
          expandedRowRender={(record: ClusterNode) => <NodeResourcePanel node={record} />}
          hideExpandedColumn={false}
        />
      )}

      <Modal
        title={editingNodeName ? `${copy.edit} ${editingNodeName}` : copy.edit}
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
                    void message.success(copy.updated)
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
              <Button onClick={() => setEditingNodeName(null)}>{t('common.cancel', '取消')}</Button>
              <Button htmlType="submit" type="primary" loading={updateNodeMutation.isPending}>
                {t('common.save', '保存')}
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      <Modal
        title={drainingNodeName ? `${copy.drain} ${drainingNodeName}` : copy.drain}
        open={!!drainingNodeName}
        okText={localeCode === 'zh_CN' ? '确认排空' : 'Confirm Drain'}
        cancelText={t('common.cancel', '取消')}
        okButtonProps={{ danger: true }}
        confirmLoading={drainNodeMutation.isPending}
        mask={{ closable: !drainNodeMutation.isPending }}
        onCancel={() => !drainNodeMutation.isPending && setDrainingNodeName(null)}
        onOk={() => drainForm.submit()}
      >
        <Alert type="warning" showIcon title={copy.drainWarning} />
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
                  void message.success(copy.drained)
                  setDrainingNodeName(null)
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }}
        >
          <Form.Item name="deleteEmptyDirData" valuePropName="checked">
            <Checkbox>
              {localeCode === 'zh_CN'
                ? '允许删除使用 emptyDir 的 Pod（本地临时数据会丢失）'
                : 'Allow deletion of pods using emptyDir (local temporary data will be lost)'}
            </Checkbox>
          </Form.Item>
          <Form.Item name="force" valuePropName="checked">
            <Checkbox>
              {localeCode === 'zh_CN'
                ? '强制驱逐没有控制器管理的 Pod'
                : 'Force eviction of pods without a controller'}
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
