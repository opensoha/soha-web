import { useEffect, useMemo, useState } from 'react'
import type { Key } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementBatchBar,
  ManagementDensityButton,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import { toScopeKey } from '@/types'
import type { TableColumnsType } from 'antd'
import { clusterMutations } from './mutations'
import { clusterQueries } from './queries'
import {
  clusterHealthTone,
  clusterTypeOf,
  clusterTypeOptions,
  formatClusterHealth,
  formatClusterType,
  formatConnectionMode,
} from './presentation'
import type { Cluster, ClusterFormValues, ConnectionMode } from './types'
import './styles.css'

const { Text } = Typography

export function ClustersPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('direct_kubeconfig')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>()
  const [typeFilter, setTypeFilter] = useState<string>()
  const [modeFilter, setModeFilter] = useState<string>()
  const [appliedSearchText, setAppliedSearchText] = useState('')
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<string>()
  const [appliedTypeFilter, setAppliedTypeFilter] = useState<string>()
  const [appliedModeFilter, setAppliedModeFilter] = useState<string>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [tableSize, setTableSize] = useState<'middle' | 'small'>('small')
  const setClusterId = usePlatformScopeStore((state) => state.setClusterId)

  const clustersQuery = useQuery(clusterQueries.list())
  const editingScope = toScopeKey(editingCluster?.id, null)
  const editDetailOptions = clusterQueries.detail(editingScope)
  const clusterDetailQuery = useQuery({
    ...editDetailOptions,
    enabled: Boolean(editDetailOptions.enabled) && modalVisible && Boolean(editingCluster),
  })
  const createMutation = useMutation(clusterMutations.create(queryClient))
  const updateMutation = useMutation(clusterMutations.update(queryClient))
  const deleteMutation = useMutation(clusterMutations.remove(queryClient))
  const batchDeleteMutation = useMutation(clusterMutations.removeMany(queryClient))

  const clusters = clustersQuery.data ?? []
  const targetFor = (id: string) => ({ scope: toScopeKey(id, null) })

  useEffect(() => {
    const clusterIds = new Set(clusters.map((cluster) => cluster.id))
    setSelectedRowKeys((current) => {
      const next = current.filter((id) => clusterIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [clusters])

  const statusOptions = useMemo(() => {
    const values = Array.from(
      new Set(clusters.map((cluster) => cluster.health?.status || 'unknown')),
    )
    return values.sort().map((value) => ({ value, label: value }))
  }, [clusters])

  const typeOptions = useMemo(() => {
    const values = new Set(clusterTypeOptions.map((option) => option.value))
    clusters.forEach((cluster) => {
      const type = clusterTypeOf(cluster)
      if (type) values.add(type)
    })
    return Array.from(values).map((value) => ({
      value,
      label: formatClusterType(value, localeCode),
    }))
  }, [clusters, localeCode])

  const modeOptions = useMemo(() => {
    const values = Array.from(
      new Set(clusters.map((cluster) => cluster.connectionMode).filter(Boolean)),
    )
    return values.sort().map((value) => ({ value, label: formatConnectionMode(value, localeCode) }))
  }, [clusters, localeCode])

  const filteredClusters = useMemo(() => {
    const keyword = appliedSearchText.trim().toLowerCase()
    return clusters.filter((cluster) => {
      const clusterType = clusterTypeOf(cluster)
      const haystack = [
        cluster.name,
        cluster.environment,
        cluster.version,
        cluster.connectionMode,
        cluster.health?.status,
        clusterType,
        formatClusterType(clusterType, localeCode),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (keyword && !haystack.includes(keyword)) return false
      if (appliedStatusFilter && (cluster.health?.status || 'unknown') !== appliedStatusFilter)
        return false
      if (appliedTypeFilter && clusterType !== appliedTypeFilter) return false
      if (appliedModeFilter && cluster.connectionMode !== appliedModeFilter) return false
      return true
    })
  }, [
    appliedModeFilter,
    appliedSearchText,
    appliedStatusFilter,
    appliedTypeFilter,
    clusters,
    localeCode,
  ])

  const columns: TableColumnsType<Cluster> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (_: unknown, record: Cluster) => (
        <div className="soha-cluster-name-cell">
          <Button
            className="soha-cluster-name-link"
            type="link"
            onClick={() => navigate(`/clusters/${record.id}`)}
          >
            {record.name}
          </Button>
        </div>
      ),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'health',
      width: 104,
      render: (health: Cluster['health']) => {
        const status = health?.status ?? 'unknown'
        return (
          <span className={`soha-cluster-status is-${clusterHealthTone(status)}`}>
            <span className="soha-cluster-status-dot" />
            {formatClusterHealth(status, localeCode)}
          </span>
        )
      },
    },
    {
      title: localeCode === 'zh_CN' ? '类型' : 'Type',
      dataIndex: 'region',
      width: 120,
      render: (_: string, record: Cluster) => formatClusterType(clusterTypeOf(record), localeCode),
    },
    {
      title: localeCode === 'zh_CN' ? '版本' : 'Version',
      dataIndex: 'version',
      width: 124,
      render: (value: string) => value || '-',
    },
    { title: 'Env', dataIndex: 'environment', width: 132, render: (value: string) => value || '-' },
    {
      title: localeCode === 'zh_CN' ? '连接方式' : 'Mode',
      dataIndex: 'connectionMode',
      width: 104,
      render: (value: string) => <Tag>{formatConnectionMode(value, localeCode)}</Tag>,
    },
    {
      ...tableColumnPresets.datetime,
      title: localeCode === 'zh_CN' ? '最近检查' : 'Last Checked',
      dataIndex: ['health', 'lastChecked'],
      render: (_: unknown, record: Cluster) =>
        record.health?.lastChecked ? formatDateTime(record.health.lastChecked) : '-',
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      width: 112,
      render: (_: unknown, record: Cluster) => (
        <Space size={2} className="soha-cluster-action-links">
          <ManagementIconButton
            aria-label={localeCode === 'zh_CN' ? '查看集群详情' : 'View cluster detail'}
            icon={<EyeOutlined />}
            size="small"
            tooltip={localeCode === 'zh_CN' ? '详情' : 'Detail'}
            onClick={() => navigate(`/clusters/${record.id}`)}
          />
          <ManagementIconButton
            aria-label={localeCode === 'zh_CN' ? '编辑集群' : 'Edit cluster'}
            icon={<EditOutlined />}
            size="small"
            tooltip={localeCode === 'zh_CN' ? '编辑' : 'Edit'}
            onClick={() => {
              setEditingCluster(record)
              setModalVisible(true)
            }}
          />
          <Popconfirm
            title={
              localeCode === 'zh_CN'
                ? `确认删除集群 ${record.name}？`
                : `Delete cluster ${record.name}?`
            }
            description={
              localeCode === 'zh_CN'
                ? '删除后会移除该集群在 Soha 中的注册信息。'
                : 'This removes the cluster registration from Soha.'
            }
            okText={localeCode === 'zh_CN' ? '删除' : 'Delete'}
            cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
            okButtonProps={{
              danger: true,
              loading:
                deleteMutation.isPending && deleteMutation.variables?.scope.clusterId === record.id,
            }}
            placement="topRight"
            onConfirm={() =>
              deleteMutation.mutate(targetFor(record.id), {
                onSuccess: () => void message.success('集群已删除'),
                onError: (error) => void message.error(error.message),
              })
            }
          >
            <ManagementIconButton
              aria-label={localeCode === 'zh_CN' ? '删除集群' : 'Delete cluster'}
              danger
              icon={<DeleteOutlined />}
              loading={
                deleteMutation.isPending && deleteMutation.variables?.scope.clusterId === record.id
              }
              size="small"
              tooltip={localeCode === 'zh_CN' ? '删除' : 'Delete'}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  useEffect(() => {
    if (!modalVisible) return
    if (editingCluster) {
      setConnectionMode(
        (clusterDetailQuery.data?.connection.mode as ConnectionMode) ||
          (editingCluster.connectionMode as ConnectionMode) ||
          'direct_kubeconfig',
      )
      return
    }
    setConnectionMode('direct_kubeconfig')
  }, [modalVisible, editingCluster, clusterDetailQuery.data])

  const initialValues = useMemo<ClusterFormValues>(() => {
    if (!editingCluster) {
      return {
        connectionMode: 'direct_kubeconfig',
        provider: 'standard_kubernetes',
      }
    }
    const detail = clusterDetailQuery.data
    return {
      name: editingCluster.name,
      provider: clusterTypeOf(editingCluster) || undefined,
      environment: editingCluster.environment,
      connectionMode:
        ((detail?.connection.mode || editingCluster.connectionMode) as ConnectionMode) ||
        'direct_kubeconfig',
      agentEndpoint: detail?.connection.endpoint || '',
      prometheusBaseUrl: detail?.monitoring.prometheus.baseUrl || '',
    }
  }, [editingCluster, clusterDetailQuery.data])

  const formKey = editingCluster
    ? `cluster-edit:${editingCluster.id}:${clusterDetailQuery.data ? 'ready' : 'loading'}:${connectionMode}`
    : `cluster-create:${connectionMode}`

  const agentConfigExample = `app:
  name: soha-agent

http:
  addr: :18080

auth:
  bearer_token: demo-agent-token

kubernetes:
  kubeconfig: /abs/path/to/kubeconfig
  context: ""
`

  const handleSubmit = (values: Record<string, unknown>) => {
    const provider = typeof values.provider === 'string' ? values.provider.trim() : ''
    const labels = { ...(editingCluster?.labels ?? {}) }
    if (provider) {
      labels.provider = provider
    } else {
      delete labels.provider
    }
    const payload = {
      ...values,
      labels,
    }
    delete (payload as Record<string, unknown>).provider
    if (editingCluster) {
      updateMutation.mutate(
        { scope: toScopeKey(editingCluster.id, null), values: payload },
        {
          onSuccess: () => {
            void message.success('集群更新成功')
            setModalVisible(false)
            setEditingCluster(null)
          },
          onError: (error) => void message.error(error.message),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          void message.success('集群创建成功')
          setModalVisible(false)
        },
        onError: (error) => void message.error(error.message),
      })
    }
  }

  const openCreateModal = () => {
    setEditingCluster(null)
    setModalVisible(true)
  }

  const hasActiveFilters = Boolean(
    searchText.trim() ||
    statusFilter ||
    typeFilter ||
    modeFilter ||
    appliedSearchText.trim() ||
    appliedStatusFilter ||
    appliedTypeFilter ||
    appliedModeFilter,
  )
  const applyFilters = () => {
    setAppliedSearchText(searchText)
    setAppliedStatusFilter(statusFilter)
    setAppliedTypeFilter(typeFilter)
    setAppliedModeFilter(modeFilter)
  }

  const resetFilters = () => {
    setSearchText('')
    setStatusFilter(undefined)
    setTypeFilter(undefined)
    setModeFilter(undefined)
    setAppliedSearchText('')
    setAppliedStatusFilter(undefined)
    setAppliedTypeFilter(undefined)
    setAppliedModeFilter(undefined)
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchDeleteMutation.mutateAsync({
        scopes: selectedRowKeys.map((id) => toScopeKey(id, null)),
      })
      void message.success('集群已删除')
      setSelectedRowKeys([])
    } catch (err) {
      void message.error((err as Error).message)
      throw err
    }
  }

  const openSelectedNodes = () => {
    if (selectedRowKeys.length !== 1) return
    setClusterId(selectedRowKeys[0])
    navigate('/cluster-resources/nodes')
  }

  const queryPanel = (
    <ManagementQueryPanel
      onFinish={applyFilters}
      actions={
        <ManagementQueryActions
          disabledReset={!hasActiveFilters}
          onReset={resetFilters}
          resetLabel={localeCode === 'zh_CN' ? '重置' : 'Reset'}
          submitLabel={localeCode === 'zh_CN' ? '查询' : 'Search'}
        />
      }
    >
      <ManagementKeywordField
        label={localeCode === 'zh_CN' ? '集群名称' : 'Cluster Name'}
        placeholder={localeCode === 'zh_CN' ? '请输入' : 'Search'}
        value={searchText}
        onChange={setSearchText}
        inputProps={{
          onPressEnter: applyFilters,
        }}
      />
      <ManagementQueryField label={localeCode === 'zh_CN' ? '集群类型' : 'Cluster Type'}>
        <Select
          allowClear
          options={typeOptions}
          placeholder={localeCode === 'zh_CN' ? '请选择' : 'Select'}
          value={typeFilter}
          onChange={(value) => setTypeFilter(value)}
        />
      </ManagementQueryField>
      <ManagementQueryField label={localeCode === 'zh_CN' ? '状态' : 'Status'}>
        <Select
          allowClear
          options={statusOptions}
          placeholder={localeCode === 'zh_CN' ? '请选择' : 'Select'}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
        />
      </ManagementQueryField>
      <ManagementQueryField label={localeCode === 'zh_CN' ? '连接方式' : 'Mode'}>
        <Select
          allowClear
          options={modeOptions}
          placeholder={localeCode === 'zh_CN' ? '请选择' : 'Select'}
          value={modeFilter}
          onChange={(value) => setModeFilter(value)}
        />
      </ManagementQueryField>
    </ManagementQueryPanel>
  )

  const tableToolbarExtra =
    selectedRowKeys.length > 0 ? (
      <ManagementBatchBar
        selectedCount={selectedRowKeys.length}
        selectedLabel={
          localeCode === 'zh_CN'
            ? `已选 ${selectedRowKeys.length} 项`
            : `${selectedRowKeys.length} selected`
        }
      >
        <Button
          autoInsertSpace={false}
          size="small"
          onClick={openSelectedNodes}
          disabled={selectedRowKeys.length !== 1}
        >
          {localeCode === 'zh_CN' ? '查看节点' : 'Open Nodes'}
        </Button>
        <Popconfirm
          title={
            localeCode === 'zh_CN'
              ? `确认删除 ${selectedRowKeys.length} 个集群？`
              : `Delete ${selectedRowKeys.length} clusters?`
          }
          description={
            localeCode === 'zh_CN'
              ? '删除后会移除这些集群在 Soha 中的注册信息。'
              : 'This removes these cluster registrations from Soha.'
          }
          okText={localeCode === 'zh_CN' ? '删除' : 'Delete'}
          cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
          okButtonProps={{ danger: true }}
          placement="top"
          onConfirm={handleBatchDelete}
        >
          <Button autoInsertSpace={false} size="small" danger>
            {localeCode === 'zh_CN' ? '批量删除' : 'Batch Delete'}
          </Button>
        </Popconfirm>
        <Button
          autoInsertSpace={false}
          size="small"
          type="text"
          onClick={() => setSelectedRowKeys([])}
        >
          {localeCode === 'zh_CN' ? '清空' : 'Clear'}
        </Button>
      </ManagementBatchBar>
    ) : null

  const tableHeaderExtra = (
    <ManagementTableToolbar batchBar={tableToolbarExtra}>
      <Button
        autoInsertSpace={false}
        className="soha-clusters-create-button"
        icon={<PlusOutlined />}
        type="primary"
        onClick={openCreateModal}
      >
        {t('common.create', 'Create')}
      </Button>
      <ManagementDensityButton
        aria-label={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
        title={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
        tooltip={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
        onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
      />
      <ManagementRefreshButton
        aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
        loading={clustersQuery.isFetching}
        title={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
        tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
        onClick={() => void clustersQuery.refetch()}
      />
    </ManagementTableToolbar>
  )

  return (
    <div className="soha-page soha-clusters-page">
      {queryPanel}
      <AdminTable
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={tableHeaderExtra}
        columns={columns}
        dataSource={filteredClusters}
        rowKey="id"
        loading={clustersQuery.isLoading}
        paginationSummary={
          localeCode === 'zh_CN'
            ? `当前 ${filteredClusters.length} / ${clusters.length} 条`
            : `${filteredClusters.length} / ${clusters.length} items`
        }
        pageSize={20}
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys,
          onChange: (nextSelectedRowKeys: Key[]) => {
            setSelectedRowKeys(
              nextSelectedRowKeys.filter((key): key is string => typeof key === 'string'),
            )
          },
        }}
      />

      <Modal
        title={editingCluster ? '编辑集群' : '添加集群'}
        open={modalVisible}
        width={760}
        onCancel={() => {
          setModalVisible(false)
          setEditingCluster(null)
        }}
        footer={null}
      >
        {editingCluster && clusterDetailQuery.isLoading && !clusterDetailQuery.data ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        ) : (
          <Form
            key={formKey}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={initialValues}
          >
            <Form.Item
              name="name"
              label="集群名称"
              rules={[{ required: true, message: '请输入集群名称' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="provider"
              label={localeCode === 'zh_CN' ? '集群类型' : 'Cluster Type'}
              rules={[
                {
                  required: true,
                  message: localeCode === 'zh_CN' ? '请选择集群类型' : 'Select a cluster type',
                },
              ]}
            >
              <Select
                options={clusterTypeOptions.map((item) => ({
                  value: item.value,
                  label: localeCode === 'zh_CN' ? item.labelZh : item.labelEn,
                }))}
              />
            </Form.Item>
            <Form.Item name="environment" label="Environment">
              <Input />
            </Form.Item>
            <Form.Item name="connectionMode" label="连接方式">
              <Select
                options={[
                  { value: 'direct_kubeconfig', label: '直接 Kubeconfig' },
                  { value: 'agent', label: 'Agent' },
                ]}
                onChange={(value) => setConnectionMode(value as ConnectionMode)}
              />
            </Form.Item>

            {connectionMode === 'direct_kubeconfig' ? (
              <Form.Item
                name="kubeconfig"
                label="Kubeconfig"
                rules={
                  editingCluster ? undefined : [{ required: true, message: '请输入 Kubeconfig' }]
                }
              >
                <Input.TextArea
                  placeholder={
                    editingCluster ? '留空则沿用现有 kubeconfig' : '请输入 kubeconfig 内容'
                  }
                  rows={8}
                />
              </Form.Item>
            ) : (
              <>
                <Form.Item
                  name="agentEndpoint"
                  label="Agent Endpoint"
                  rules={
                    editingCluster
                      ? undefined
                      : [{ required: true, message: '请输入 Agent Endpoint' }]
                  }
                >
                  <Input
                    placeholder={
                      editingCluster ? '留空则沿用现有 endpoint' : 'http://127.0.0.1:18080'
                    }
                  />
                </Form.Item>
                <Form.Item name="agentToken" label="Agent Token">
                  <Input.Password
                    placeholder={
                      editingCluster
                        ? '留空则沿用现有 token'
                        : '与 agent 配置中的 auth.bearer_token 一致'
                    }
                  />
                </Form.Item>
                <Card className="soha-detail-card">
                  <div className="soha-detail-meta">
                    <Text strong>Agent 部署方式</Text>
                    <pre className="soha-code-block">{agentConfigExample}</pre>
                    <pre className="soha-code-block">{`go run ./cmd/agent\nKC_AGENT_CONFIG_FILE=/abs/path/to/agent.config.yaml go run ./cmd/agent`}</pre>
                  </div>
                </Card>
              </>
            )}

            <Card className="soha-detail-card">
              <div className="soha-detail-meta">
                <Text strong>Prometheus</Text>
              </div>
              <Form.Item name="prometheusBaseUrl" label="Prometheus URL">
                <Input placeholder="http://prometheus:9090" />
              </Form.Item>
              <Form.Item name="prometheusBearerToken" label="Prometheus Token">
                <Input.Password placeholder={editingCluster ? '留空则沿用现有 token' : ''} />
              </Form.Item>
            </Card>

            <div className="soha-form-actions">
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button
                htmlType="submit"
                type="primary"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingCluster ? '更新' : '创建'}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  )
}
