import { useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CloudServerOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { useWorkbenchModuleEnabled } from '@/features/modules'
import { formatDateTime } from '@/utils/time'
import {
  virtualizationQueries,
  type VirtualizationCluster,
  type VirtualizationImage,
  type VirtualizationPage,
} from '@/features/virtualization'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerHost, DockerHostInput, DockerQuickCreateHostInput } from '../docker-types'
import {
  ARCHITECTURE_OPTIONS,
  DockerAdminTable,
  DrawerFooter,
  HOST_STATUS_OPTIONS,
  architectureTag,
  compactRecord,
  formatBytes,
  normalizePage,
  pageTablePagination,
  refreshDocker,
  statusTag,
  type DockerFilterState,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography
const { TextArea } = Input

interface HostFormValues extends DockerHostInput {
  memoryGiB?: number
  diskGiB?: number
}

interface QuickCreateHostFormValues extends DockerQuickCreateHostInput {
  memoryGiB?: number
  diskGiB?: number
}

const VIRTUALIZATION_PROVIDER_LABELS: Record<string, string> = {
  kubevirt: 'KubeVirt',
  pve: 'PVE',
}

function virtualizationItems<T>(data: VirtualizationPage<T> | T[] | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.items ?? [])
}

function stringConfigValue(config: { [key: string]: unknown } | undefined, key: string) {
  const value = config?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function providerLabel(provider?: string) {
  return VIRTUALIZATION_PROVIDER_LABELS[String(provider || '').toLowerCase()] ?? provider ?? '-'
}

function isProvisionConnection(item: VirtualizationCluster) {
  const provider = String(item.provider || '').toLowerCase()
  return item.enabled !== false && (provider === 'pve' || provider === 'kubevirt')
}

function isProvisionImage(item: VirtualizationImage) {
  const provider = String(item.provider || '').toLowerCase()
  const sourceKind = String(item.sourceKind || item.assetKind || '').toLowerCase()
  if (provider === 'pve') {
    return sourceKind === '' || sourceKind === 'template' || sourceKind === 'iso'
  }
  if (provider === 'kubevirt') {
    return (
      sourceKind === '' ||
      sourceKind === 'datasource' ||
      sourceKind === 'pvc' ||
      sourceKind === 'containerdisk' ||
      sourceKind === 'container_disk'
    )
  }
  return false
}

function useVirtualizationProvisionOptions(enabled: boolean) {
  const clustersQuery = useQuery({
    ...virtualizationQueries.clusters(enabled),
  })
  const imagesQuery = useQuery({
    ...virtualizationQueries.images({ page: 1, pageSize: 500 }, enabled),
  })
  const flavorsQuery = useQuery({
    ...virtualizationQueries.flavors(enabled),
  })
  const connections = (clustersQuery.data ?? []).filter(isProvisionConnection)
  const images = virtualizationItems(imagesQuery.data).filter(isProvisionImage)
  const flavors = (flavorsQuery.data ?? []).filter((item) => item.enabled !== false)
  return {
    connections,
    images,
    flavors,
    loading: clustersQuery.isLoading || imagesQuery.isLoading || flavorsQuery.isLoading,
  }
}

function buildHostPayload(values: HostFormValues): DockerHostInput {
  return compactRecord({
    ...values,
    memoryBytes: values.memoryGiB ? Math.round(values.memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: values.diskGiB ? Math.round(values.diskGiB * 1024 ** 3) : values.diskBytes,
    memoryGiB: undefined,
    diskGiB: undefined,
  })
}

function hostToForm(record?: DockerHost): Partial<HostFormValues> {
  if (!record)
    return {
      status: 'pending',
      architecture: 'amd64',
      availablePortStart: 20000,
      availablePortEnd: 39999,
    }
  return {
    ...record,
    memoryGiB: record.memoryBytes
      ? Math.round((record.memoryBytes / 1024 ** 3) * 10) / 10
      : undefined,
    diskGiB: record.diskBytes ? Math.round((record.diskBytes / 1024 ** 3) * 10) / 10 : undefined,
  }
}

export function buildQuickHostPayload(
  values: QuickCreateHostFormValues,
): DockerQuickCreateHostInput {
  return compactRecord({
    ...values,
    memoryBytes: values.memoryGiB ? Math.round(values.memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: values.diskGiB ? Math.round(values.diskGiB * 1024 ** 3) : values.diskBytes,
    memoryGiB: undefined,
    diskGiB: undefined,
  })
}

function HostsTable({ embedded = false }: { embedded?: boolean }) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<HostFormValues>()
  const [quickForm] = Form.useForm<QuickCreateHostFormValues>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<DockerHost | null>(null)
  const { dockerModuleEnabled, canManageHosts } = useDockerPermissions()
  const { moduleEnabled: virtualizationModuleEnabled } = useWorkbenchModuleEnabled('virtualization')
  const provisionOptions = useVirtualizationProvisionOptions(
    canManageHosts && virtualizationModuleEnabled,
  )
  const selectedProvisionConnectionID = Form.useWatch('virtualizationConnectionId', quickForm)
  const kubevirtQuickNetworkType =
    Form.useWatch(['config', 'providerParams', 'networkType'], quickForm) ?? 'pod'
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const hostsQuery = useQuery(dockerQueries.hosts(filters, dockerModuleEnabled))
  const createMutation = useMutation({
    mutationFn: (values: HostFormValues) =>
      editing
        ? dockerApi.updateHost(editing.id, buildHostPayload(values))
        : dockerApi.createHost(buildHostPayload(values)),
    onSuccess: () => {
      message.success(editing ? '主机已更新' : '主机已创建')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      refreshDocker(queryClient)
    },
  })
  const quickCreateMutation = useMutation({
    mutationFn: (values: QuickCreateHostFormValues) =>
      dockerApi.quickCreateHost(buildQuickHostPayload(values)),
    onSuccess: () => {
      message.success('虚拟化构建任务已提交')
      setQuickDrawerOpen(false)
      quickForm.resetFields()
      refreshDocker(queryClient)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deleteHost,
    onSuccess: () => {
      message.success('主机已删除')
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(hostsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const selectedProvisionConnection = provisionOptions.connections.find(
    (item) => item.id === selectedProvisionConnectionID,
  )
  const selectedProvisionProvider = String(
    selectedProvisionConnection?.provider || '',
  ).toLowerCase()
  const quickConnectionOptions = provisionOptions.connections.map((item) => ({
    value: item.id,
    label: `${item.name || item.id} (${providerLabel(item.provider)})`,
  }))
  const quickImageOptions = provisionOptions.images
    .filter(
      (item) =>
        !selectedProvisionConnectionID || item.connectionId === selectedProvisionConnectionID,
    )
    .map((item) => ({
      value: item.id,
      label: [item.name || item.id, item.sourceKind || item.assetKind, item.sourceRef]
        .filter(Boolean)
        .join(' / '),
    }))
  const quickFlavorOptions = provisionOptions.flavors.map((item) => ({
    value: item.id,
    label: `${item.name || item.id} (${item.cpu}C / ${formatBytes(item.memoryMiB * 1024 ** 2)} / ${item.diskGiB || '-'}GiB)`,
  }))
  const applyProvisionConnectionDefaults = (connectionID?: string) => {
    const connection = provisionOptions.connections.find((item) => item.id === connectionID)
    const provider = String(connection?.provider || '').toLowerCase()
    quickForm.setFieldsValue({
      imageId: undefined,
      vmTemplateId: undefined,
      network:
        provider === 'pve'
          ? stringConfigValue(connection?.config, 'defaultBridge') || undefined
          : undefined,
      config:
        provider === 'kubevirt'
          ? { providerParams: { networkType: 'pod', interfaceBinding: 'bridge' } }
          : { providerParams: { runtimeEndpoint: 'http://__SOHA_VM_IP__:18080' } },
    })
  }
  const applyProvisionImageDefaults = (imageID?: string) => {
    const image = provisionOptions.images.find((item) => item.id === imageID)
    const sourceKind = String(image?.sourceKind || image?.assetKind || '').toLowerCase()
    quickForm.setFieldsValue({
      vmTemplateId:
        image?.provider === 'pve' && sourceKind === 'template' && image.sourceRef
          ? image.sourceRef
          : undefined,
    })
  }
  const columns: ColumnsType<DockerHost> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 190,
      render: (value, record) => <Text strong>{value || record.id}</Text>,
    },
    { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
    { title: '架构', dataIndex: 'architecture', width: 120, render: architectureTag },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      width: 220,
      render: (value, record) => value || record.ipAddress || '-',
    },
    {
      title: '环境/归属',
      width: 180,
      render: (_value, record) =>
        [record.environment, record.owner || record.team].filter(Boolean).join(' / ') || '-',
    },
    {
      title: 'VM',
      width: 180,
      render: (_value, record) =>
        record.vmName || record.vmId || record.virtualizationConnectionId || '-',
    },
    {
      title: '规格',
      width: 180,
      render: (_value, record) =>
        `${record.cpuCoreCount || '-'}C / ${formatBytes(record.memoryBytes)} / ${formatBytes(record.diskBytes)}`,
    },
    {
      title: '端口池',
      width: 140,
      render: (_value, record) =>
        record.availablePortStart && record.availablePortEnd
          ? `${record.availablePortStart}-${record.availablePortEnd}`
          : '-',
    },
    { title: '心跳', dataIndex: 'lastHeartbeatAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 96,
      render: (_value, record) =>
        canManageHosts ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="编辑主机"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue(hostToForm(record))
                setDrawerOpen(true)
              }}
            />
            <Popconfirm
              title="确认删除 Docker 主机？"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <ManagementIconButton
                aria-label="删除主机"
                size="small"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]
  return (
    <>
      {!embedded ? (
        <div className="soha-vrt-query">
          <ManagementQueryPanel
            form={filterForm}
            actions={
              <ManagementQueryActions
                loading={hostsQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters({ page: 1, pageSize: filters.pageSize ?? 10 })
                }}
              />
            }
            onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
          >
            <ManagementKeywordField placeholder="主机、Endpoint、VM 或 IP" />
            <ManagementQueryField minWidth={132} width={150} name="status" label="状态">
              <Select
                allowClear
                placeholder="全部"
                options={HOST_STATUS_OPTIONS.map((item) => ({ value: item, label: item }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={148} width={170} name="architecture" label="架构">
              <Select allowClear placeholder="全部" options={ARCHITECTURE_OPTIONS} />
            </ManagementQueryField>
            <ManagementQueryField minWidth={150} width={180} name="environment" label="环境">
              <Input allowClear placeholder="dev / test" />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={hostsQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: 1340 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        actions={
          canManageHosts && !embedded ? (
            <>
              <Button
                icon={<CloudServerOutlined />}
                onClick={() => {
                  quickForm.setFieldsValue({
                    architecture: 'amd64',
                    availablePortStart: 20000,
                    availablePortEnd: 39999,
                    cpuCoreCount: 4,
                    memoryGiB: 8,
                    diskGiB: 80,
                  })
                  setQuickDrawerOpen(true)
                }}
              >
                虚拟化快速构建
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null)
                  form.setFieldsValue(hostToForm())
                  setDrawerOpen(true)
                }}
              >
                接入主机
              </Button>
            </>
          ) : null
        }
        enableDensity={!embedded}
        refreshing={hostsQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => hostsQuery.refetch()}
      />
      <Drawer
        title={editing ? '编辑 Docker 主机' : '接入 Docker 主机'}
        size="large"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <DrawerFooter
            form={form}
            loading={createMutation.isPending}
            onCancel={() => setDrawerOpen(false)}
          />
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="status" label="状态">
              <Select options={HOST_STATUS_OPTIONS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="endpoint" label="Endpoint">
              <Input placeholder="tcp://10.0.0.10:2376" />
            </Form.Item>
            <Form.Item name="architecture" label="架构">
              <Select allowClear options={ARCHITECTURE_OPTIONS} />
            </Form.Item>
            <Form.Item name="agentId" label="Agent ID">
              <Input />
            </Form.Item>
            <Form.Item name="ipAddress" label="IP 地址">
              <Input />
            </Form.Item>
            <Form.Item name="environment" label="环境">
              <Input />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input />
            </Form.Item>
            <Form.Item name="team" label="团队">
              <Input />
            </Form.Item>
            <Form.Item name="virtualizationConnectionId" label="虚拟化连接 ID">
              <Input />
            </Form.Item>
            <Form.Item name="vmId" label="VM ID">
              <Input />
            </Form.Item>
            <Form.Item name="vmName" label="VM 名称">
              <Input />
            </Form.Item>
            <Form.Item name="cpuCoreCount" label="CPU 核数">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="memoryGiB" label="内存 GiB">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="diskGiB" label="磁盘 GiB">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="availablePortStart" label="端口池起始">
              <InputNumber min={1} max={65535} className="w-full" />
            </Form.Item>
            <Form.Item name="availablePortEnd" label="端口池结束">
              <InputNumber min={1} max={65535} className="w-full" />
            </Form.Item>
            <Form.Item name="dockerVersion" label="Docker 版本">
              <Input />
            </Form.Item>
            <Form.Item name="composeVersion" label="Compose 版本">
              <Input />
            </Form.Item>
          </div>
        </Form>
      </Drawer>
      <Drawer
        title="虚拟化快速构建 Docker 主机"
        size="large"
        open={quickDrawerOpen}
        onClose={() => setQuickDrawerOpen(false)}
        extra={
          <DrawerFooter
            form={quickForm}
            loading={quickCreateMutation.isPending}
            onCancel={() => setQuickDrawerOpen(false)}
            submitLabel="提交构建"
          />
        }
      >
        <Form
          form={quickForm}
          layout="vertical"
          onFinish={(values) => quickCreateMutation.mutate(values)}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item
              name="virtualizationConnectionId"
              label="虚拟化连接"
              rules={[{ required: true }]}
            >
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                loading={provisionOptions.loading}
                options={quickConnectionOptions}
                placeholder="选择 PVE 或 KubeVirt 连接"
                onChange={applyProvisionConnectionDefaults}
              />
            </Form.Item>
            <Form.Item name="imageId" label="镜像 / 模板" rules={[{ required: true }]}>
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                disabled={!selectedProvisionConnectionID}
                loading={provisionOptions.loading}
                options={quickImageOptions}
                placeholder={
                  selectedProvisionConnectionID ? '选择已同步镜像、ISO 或模板' : '先选择虚拟化连接'
                }
                onChange={applyProvisionImageDefaults}
              />
            </Form.Item>
            <Form.Item name="flavorId" label="规格">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                loading={provisionOptions.loading}
                options={quickFlavorOptions}
                placeholder="选择规格或手动填写资源"
              />
            </Form.Item>
            <Form.Item name="architecture" label="架构">
              <Select options={ARCHITECTURE_OPTIONS} />
            </Form.Item>
            {selectedProvisionProvider === 'kubevirt' ? (
              <>
                <Form.Item
                  name={['config', 'providerParams', 'networkType']}
                  label="KubeVirt 网络类型"
                >
                  <Select
                    options={[
                      { value: 'pod', label: 'Pod 默认网络' },
                      { value: 'multus', label: 'Multus' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="network"
                  label={
                    kubevirtQuickNetworkType === 'multus' ? 'NetworkAttachmentDefinition' : '网络'
                  }
                >
                  <Input
                    placeholder={
                      kubevirtQuickNetworkType === 'multus' ? 'namespace/nad-name' : 'pod'
                    }
                  />
                </Form.Item>
                {kubevirtQuickNetworkType === 'multus' ? (
                  <Form.Item
                    name={['config', 'providerParams', 'networkAttachmentDefinition']}
                    label="NAD 引用"
                  >
                    <Input placeholder="apps/docker-build-net" />
                  </Form.Item>
                ) : null}
                <Form.Item
                  name={['config', 'providerParams', 'interfaceModel']}
                  label="Interface Model"
                >
                  <Input placeholder="virtio" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'interfaceBinding']}
                  label="Interface Binding"
                >
                  <Select
                    allowClear
                    options={[
                      { value: 'bridge', label: 'bridge' },
                      { value: 'masquerade', label: 'masquerade' },
                      { value: 'sriov', label: 'sriov' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'interfaceName']}
                  label="Interface Name"
                >
                  <Input placeholder="net1" />
                </Form.Item>
              </>
            ) : (
              <Form.Item name="network" label="PVE 网桥">
                <Input placeholder="vmbr0" />
              </Form.Item>
            )}
            <Form.Item name="vmTemplateId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="environment" label="环境">
              <Input />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input />
            </Form.Item>
            <Form.Item name="team" label="团队">
              <Input />
            </Form.Item>
            <Form.Item name="cpuCoreCount" label="CPU 核数">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item name="memoryGiB" label="内存 GiB">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item name="diskGiB" label="磁盘 GiB">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item name="ttlSeconds" label="有效期秒数">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="availablePortStart" label="端口池起始">
              <InputNumber min={1} max={65535} className="w-full" />
            </Form.Item>
            <Form.Item name="availablePortEnd" label="端口池结束">
              <InputNumber min={1} max={65535} className="w-full" />
            </Form.Item>
            {selectedProvisionProvider === 'pve' ? (
              <>
                <Form.Item
                  name={['config', 'providerParams', 'snippetStorage']}
                  label="PVE Snippet Storage"
                >
                  <Input placeholder="local" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'controlPlaneBaseURL']}
                  label="控制面地址"
                >
                  <Input placeholder="http://10.0.3.x:8080" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'runtimeEndpoint']}
                  label="Agent Endpoint"
                >
                  <Input placeholder="http://__SOHA_VM_IP__:18080" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'agentInstallScript']}
                  label="Agent 安装脚本"
                >
                  <Input.TextArea rows={3} spellCheck={false} />
                </Form.Item>
              </>
            ) : null}
          </div>
          <Form.Item name="cloudInit" label="Cloud-init 用户数据">
            <TextArea rows={8} spellCheck={false} placeholder="#cloud-config" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

export function DockerHostsPage() {
  return <ManagementDataPage className="soha-docker-page" tableNode={<HostsTable />} />
}
