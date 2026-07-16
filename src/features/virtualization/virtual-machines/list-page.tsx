import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { StepFormModal } from '@/components/step-form-modal'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
} from '@/components/management-list'
import { virtualizationKeys } from '@/features/virtualization/keys'
import {
  invalidateVirtualizationQueries,
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import { VirtualizationAdminTable } from '@/features/virtualization/shared/ui'
import {
  STATUS_COLORS,
  VIRTUALIZATION_PROVIDER_OPTIONS,
  buildCreateVmPayload,
  normalizePage,
  virtualMachineDisplayStatus,
  virtualizationPageSummary,
} from '@/features/virtualization/virtualization-model'
import type { VirtualMachineFormValues } from '@/features/virtualization/virtualization-model'
import { useTaskStream } from '@/features/virtualization/use-task-stream'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualMachine,
  VirtualizationListParams,
  VirtualizationOperation,
  VirtualizationPage,
} from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const tableEllipsis = { showTitle: false } as const

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  const key = value.toLowerCase()
  return <Tag color={STATUS_COLORS[key] ?? 'default'}>{value}</Tag>
}

function tableTooltipText(value: unknown) {
  const text = String(value ?? '').trim() || '-'
  const content = <span className="soha-vrt-table-tooltip-text">{text}</span>
  if (text === '-') return content
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      {content}
    </Tooltip>
  )
}

function tableTooltipLink(value: unknown, to: string) {
  const text = String(value ?? '').trim() || '-'
  const content = (
    <Link className="soha-vrt-table-tooltip-text" to={to}>
      {text}
    </Link>
  )
  if (text === '-') return <span className="soha-vrt-table-tooltip-text">-</span>
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      {content}
    </Tooltip>
  )
}

interface TaskProgressBannerProps {
  task: VirtualizationOperation | null
  status: 'idle' | 'streaming' | 'done' | 'error'
  title: string
  onCancel?: () => void
  cancelling?: boolean
}

function TaskProgressBanner({
  task,
  status,
  title,
  onCancel,
  cancelling,
}: TaskProgressBannerProps) {
  if (status === 'idle' || status === 'done') return null
  const isError = status === 'error'
  const description =
    task?.message || (isError ? '与服务器的实时连接已断开' : '正在等待任务完成...')
  const taskStatus = task?.status ? (
    <Tag color={STATUS_COLORS[task.status] ?? 'blue'}>{task.status}</Tag>
  ) : null
  return (
    <Alert
      className="soha-vrt-task-banner"
      type={isError ? 'warning' : 'info'}
      showIcon
      icon={isError ? undefined : <Spin size="small" />}
      title={
        <Space>
          <span>{title}</span>
          {taskStatus}
        </Space>
      }
      description={description}
      action={
        onCancel && task?.id ? (
          <Button size="small" danger onClick={onCancel} loading={cancelling}>
            取消任务
          </Button>
        ) : null
      }
    />
  )
}

function pageTablePagination<T>(
  page: VirtualizationPage<T>,
  setFilters: React.Dispatch<React.SetStateAction<VirtualizationListParams>>,
) {
  return {
    current: page.page,
    pageSize: page.pageSize,
    total: page.total,
    onPageChange: (pageNumber: number) =>
      setFilters((current) => ({ ...current, page: pageNumber })),
    onPageSizeChange: (pageSize: number) =>
      setFilters((current) => ({ ...current, page: 1, pageSize })),
  }
}

export function VirtualizationVmsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [filters, setFilters] = useState<VirtualizationListParams>({ page: 1, pageSize: 10 })
  const [filterForm] = Form.useForm<VirtualizationListParams>()
  const [form] = Form.useForm<VirtualMachineFormValues>()
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const { virtualizationModuleEnabled, canManageVMs } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const createProvider = Form.useWatch('provider', form) ?? 'kubevirt'
  const createSourceMode =
    Form.useWatch('sourceMode', form) ??
    (createProvider === 'pve' ? 'template_clone' : 'datasource_clone')
  const kubevirtNetworkType = Form.useWatch('kubevirtNetworkType', form) ?? 'pod'
  const selectedConnectionId = Form.useWatch('connectionId', form)
  const { task: streamedTask, status: streamStatus } = useTaskStream(
    pendingTaskId,
    virtualizationModuleEnabled,
  )

  useEffect(() => {
    if (streamStatus === 'done') {
      const success = streamedTask?.status === 'completed'
      message[success ? 'success' : 'error'](
        success ? '虚拟机创建完成' : `虚拟机创建失败: ${streamedTask?.message ?? '未知错误'}`,
      )
      setPendingTaskId(null)
      void invalidateVirtualizationQueries(queryClient, [virtualizationKeys.all])
    }
  }, [streamStatus, streamedTask, message, queryClient])
  const cancelCreateMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.cancelOperation(queryClient), () =>
      message.info('已请求取消创建任务'),
    ),
  )
  const vmsQuery = useQuery(virtualizationQueries.vms(filters, virtualizationModuleEnabled))
  const clustersQuery = useQuery(virtualizationQueries.clusters(virtualizationModuleEnabled))
  const imagesQuery = useQuery(virtualizationQueries.imageOptions(virtualizationModuleEnabled))
  const flavorsQuery = useQuery(virtualizationQueries.flavors(virtualizationModuleEnabled))
  const createMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.createVm(queryClient),
      (operation) => {
        const taskId = operation.id
        if (taskId) {
          message.info('虚拟机创建任务已提交，正在跟踪进度...')
          setPendingTaskId(taskId)
        } else {
          message.success('虚拟机创建任务已提交')
        }
        setDrawerOpen(false)
        form.resetFields()
      },
    ),
  )
  const powerMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.powerVm(queryClient), () =>
      message.success('电源操作已提交'),
    ),
  )
  const clusters = clustersQuery.data ?? []
  const images = normalizePage(imagesQuery.data, 1, 200).items
  const flavors = flavorsQuery.data ?? []
  const selectedCluster = useMemo(
    () => clusters.find((item) => item.id === selectedConnectionId),
    [clusters, selectedConnectionId],
  )
  const pveCapabilityAssets = useMemo(
    () =>
      images.filter(
        (item) =>
          item.provider === 'pve' &&
          (!selectedConnectionId || item.connectionId === selectedConnectionId),
      ),
    [images, selectedConnectionId],
  )
  const pveNodeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            typeof selectedCluster?.config?.defaultNode === 'string'
              ? selectedCluster.config.defaultNode
              : '',
            ...pveCapabilityAssets.map((item) => item.node || ''),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value })),
    [pveCapabilityAssets, selectedCluster?.config?.defaultNode],
  )
  const pveStorageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            typeof selectedCluster?.config?.defaultStorage === 'string'
              ? selectedCluster.config.defaultStorage
              : '',
            ...pveCapabilityAssets
              .filter((item) => item.assetKind === 'storage' || item.sourceKind === 'storage')
              .map((item) => item.storage || item.name || ''),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value })),
    [pveCapabilityAssets, selectedCluster?.config?.defaultStorage],
  )
  const pveSnippetStorageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            typeof selectedCluster?.config?.defaultSnippetStorage === 'string'
              ? selectedCluster.config.defaultSnippetStorage
              : '',
            typeof selectedCluster?.config?.snippetStorage === 'string'
              ? selectedCluster.config.snippetStorage
              : '',
            ...pveCapabilityAssets
              .filter(
                (item) =>
                  (item.assetKind === 'storage' || item.sourceKind === 'storage') &&
                  (item.config?.supportsSnippets === true ||
                    item.config?.supportsSnippets === 'true' ||
                    String(item.config?.content || '')
                      .split(',')
                      .map((part) => part.trim())
                      .includes('snippets')),
              )
              .map((item) => item.storage || item.name || ''),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value })),
    [
      pveCapabilityAssets,
      selectedCluster?.config?.defaultSnippetStorage,
      selectedCluster?.config?.snippetStorage,
    ],
  )
  const pveBridgeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            typeof selectedCluster?.config?.defaultBridge === 'string'
              ? selectedCluster.config.defaultBridge
              : '',
            ...pveCapabilityAssets
              .filter((item) => item.assetKind === 'network' || item.sourceKind === 'network')
              .filter(
                (item) =>
                  item.config?.bridge === true ||
                  item.config?.bridge === 'true' ||
                  item.name?.startsWith('vmbr'),
              )
              .map((item) =>
                item.config?.network && typeof item.config.network === 'string'
                  ? item.config.network
                  : item.name || '',
              ),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value })),
    [pveCapabilityAssets, selectedCluster?.config?.defaultBridge],
  )
  const vmPage = normalizePage(vmsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const selectedFlavorId = Form.useWatch('flavorId', form)
  const selectedFlavor = flavors.find((item) => item.id === selectedFlavorId)
  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: '虚拟机列表',
    entityKind: 'virtualization.vm-list',
    entityName: '虚拟机列表',
    virtualizationConnectionId: selectedConnectionId,
    visibleFilters: {
      ...filters,
      createProvider,
      createSourceMode,
      kubevirtNetworkType,
    },
    pinnedData: {
      total: vmPage.total,
      pageItems: vmPage.items.length,
      clusterCount: clusters.length,
      imageCount: images.length,
      flavorCount: flavors.length,
      selectedFlavor: selectedFlavor?.name,
    },
  })
  const columns: ColumnsType<VirtualMachine> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 190,
      render: (value, record) =>
        tableTooltipLink(value, `/compute/virtualization/vms/${encodeURIComponent(record.id)}`),
      ellipsis: tableEllipsis,
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 120,
    },
    {
      title: '连接',
      dataIndex: 'connectionName',
      render: (value, record) => tableTooltipText(value || record.connectionId || '-'),
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      title: '命名空间/节点',
      render: (_value, record) =>
        tableTooltipText([record.namespace, record.node].filter(Boolean).join(' / ') || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      title: '电源',
      dataIndex: 'powerState',
      render: (_value, record) => statusTag(virtualMachineDisplayStatus(record)),
      width: 120,
    },
    {
      title: '规格',
      render: (_value, record) =>
        tableTooltipText(
          record.flavorName ||
            `${record.cpu ?? '-'}C / ${record.memoryMiB ?? '-'}MiB / ${record.diskGiB ?? '-'}GiB`,
        ),
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      title: '镜像',
      dataIndex: 'bootImageName',
      render: (value, record) => tableTooltipText(value || record.bootImageId || '-'),
      ellipsis: tableEllipsis,
      width: 220,
    },
    {
      title: '地址',
      dataIndex: 'ipAddresses',
      render: (value: string[]) => tableTooltipText(value?.join(', ') || '-'),
      ellipsis: tableEllipsis,
      width: 220,
    },
    {
      ...tableColumnPresets.datetime,
      title: '创建时间',
      dataIndex: 'createdAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      width: 130,
      render: (_value, record) => {
        if (!canManageVMs) return null
        const canPower = (action: string) => hasAllowedAction(record.allowedActions, action)
        return (
          <Space className="soha-row-action-icons">
            {canPower('start') ? (
              <ManagementIconButton
                aria-label="启动虚拟机"
                size="small"
                tooltip="启动"
                icon={<PlayCircleOutlined />}
                onClick={() => powerMutation.mutate({ id: record.id, action: 'start' })}
              />
            ) : null}
            {canPower('stop') ? (
              <ManagementIconButton
                aria-label="停止虚拟机"
                size="small"
                tooltip="停止"
                icon={<PoweroffOutlined />}
                onClick={() => powerMutation.mutate({ id: record.id, action: 'stop' })}
              />
            ) : null}
            {canPower('restart') ? (
              <ManagementIconButton
                aria-label="重启虚拟机"
                size="small"
                tooltip="重启"
                icon={<ReloadOutlined />}
                onClick={() => powerMutation.mutate({ id: record.id, action: 'restart' })}
              />
            ) : null}
            {canPower('delete') ? (
              <Popconfirm
                title="确认删除虚拟机？"
                onConfirm={() => powerMutation.mutate({ id: record.id, action: 'delete' })}
              >
                <ManagementIconButton
                  aria-label="删除虚拟机"
                  size="small"
                  tooltip="删除"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <ManagementDataPage
      className="soha-virtualization-page"
      beforeQuery={
        <TaskProgressBanner
          task={streamedTask}
          status={streamStatus}
          title="正在创建虚拟机"
          onCancel={
            streamedTask?.id ? () => cancelCreateMutation.mutate(streamedTask.id) : undefined
          }
          cancelling={cancelCreateMutation.isPending}
        />
      }
      query={{
        actions: (
          <ManagementQueryActions
            loading={vmsQuery.isFetching}
            onReset={() => {
              filterForm.resetFields()
              setFilters((current) => ({ page: 1, pageSize: current.pageSize ?? 10 }))
            }}
          />
        ),
        children: (
          <>
            <ManagementKeywordField label="关键字" placeholder="搜索名称、IP 或节点" />
            <ManagementQueryField minWidth={180} name="connectionId" label="连接" width={180}>
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                placeholder="全部连接"
                options={clusters.map((item) => ({ value: item.id, label: item.name }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={136} name="status" label="状态" width={136}>
              <Select
                allowClear
                placeholder="全部状态"
                options={['running', 'stopped', 'pending', 'failed'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={160} name="provider" label="Provider" width={160}>
              <Select
                allowClear
                placeholder="全部 Provider"
                options={VIRTUALIZATION_PROVIDER_OPTIONS}
              />
            </ManagementQueryField>
          </>
        ),
        collapsible: true,
        form: filterForm,
        onFinish: (values) => setFilters((current) => ({ ...current, ...values, page: 1 })),
        wrapperClassName: 'soha-vrt-query soha-vrt-vms-query',
      }}
      tableNode={
        <VirtualizationAdminTable
          rowKey="id"
          actions={
            canManageVMs ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCurrentStep(0)
                  form.resetFields()
                  setDrawerOpen(true)
                }}
              >
                创建虚拟机
              </Button>
            ) : null
          }
          refreshing={vmsQuery.isFetching}
          onRefresh={() => void vmsQuery.refetch()}
          loading={vmsQuery.isLoading}
          dataSource={vmPage.items}
          columns={columns}
          scroll={{ x: 1620 }}
          pagination={pageTablePagination(vmPage, setFilters)}
          paginationSummary={virtualizationPageSummary}
        />
      }
      afterTable={
        <StepFormModal
          title="创建虚拟机"
          current={currentStep}
          form={form}
          loading={createMutation.isPending}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onCurrentChange={setCurrentStep}
          initialValues={{
            provider: 'kubevirt',
            sourceMode: 'datasource_clone',
            kubevirtNetworkType: 'pod',
            kubevirtInterfaceBinding: 'bridge',
            startAfterCreate: true,
          }}
          onFinish={(values) => createMutation.mutate(buildCreateVmPayload(values))}
          steps={[
            {
              title: '创建配置',
              fieldNames: [
                'name',
                'provider',
                'connectionId',
                'sourceMode',
                'flavorId',
                'bootImageId',
              ],
              children: (
                <>
                  <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'kubevirt', label: 'KubeVirt' },
                          { value: 'pve', label: 'PVE' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="connectionId" label="连接" rules={[{ required: true }]}>
                      <Select
                        showSearch={{ optionFilterProp: 'label' }}
                        options={clusters
                          .filter((item) => !createProvider || item.provider === createProvider)
                          .map((item) => ({ value: item.id, label: item.name }))}
                      />
                    </Form.Item>
                  </div>
                  <Form.Item name="sourceMode" label="创建模式" rules={[{ required: true }]}>
                    <Select
                      options={
                        createProvider === 'pve'
                          ? [
                              { value: 'template_clone', label: '模板克隆' },
                              { value: 'iso_install', label: 'ISO 安装' },
                            ]
                          : [
                              { value: 'datasource_clone', label: 'DataSource 克隆' },
                              { value: 'pvc_clone', label: 'PVC 克隆' },
                            ]
                      }
                    />
                  </Form.Item>
                  <Form.Item name="flavorId" label="规格" rules={[{ required: true }]}>
                    <Select
                      showSearch={{ optionFilterProp: 'label' }}
                      options={flavors
                        .filter((item) => item.enabled !== false)
                        .map((item) => ({
                          value: item.id,
                          label: `${item.name} (${item.cpu}C / ${item.memoryMiB}MiB / ${item.diskGiB}GiB)`,
                        }))}
                    />
                  </Form.Item>
                  {selectedFlavor ? (
                    <Alert
                      className="mb-3"
                      type="info"
                      showIcon
                      title={`已选择 ${selectedFlavor.name}: ${selectedFlavor.cpu}C / ${selectedFlavor.memoryMiB}MiB / ${selectedFlavor.diskGiB}GiB`}
                    />
                  ) : null}
                  <Form.Item
                    name="bootImageId"
                    label={
                      createProvider === 'pve'
                        ? createSourceMode === 'iso_install'
                          ? '安装 ISO'
                          : '模板'
                        : '启动镜像'
                    }
                    rules={[{ required: true }]}
                  >
                    <Select
                      showSearch={{ optionFilterProp: 'label' }}
                      options={images
                        .filter(
                          (item) =>
                            !createProvider || item.provider === createProvider || !item.provider,
                        )
                        .filter(
                          (item) =>
                            createProvider !== 'pve' ||
                            (createSourceMode === 'iso_install'
                              ? item.assetKind === 'iso' || item.sourceKind === 'iso'
                              : item.assetKind === 'template' || item.sourceKind === 'template'),
                        )
                        .map((item) => ({
                          value: item.id,
                          label: item.connectionName
                            ? `${item.name} (${item.connectionName})`
                            : item.name,
                        }))}
                    />
                  </Form.Item>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Form.Item name="namespace" label="命名空间">
                      <Input />
                    </Form.Item>
                    <Form.Item name="node" label="节点">
                      {createProvider === 'pve' && pveNodeOptions.length > 0 ? (
                        <Select allowClear options={pveNodeOptions} />
                      ) : (
                        <Input
                          disabled={createProvider === 'kubevirt'}
                          placeholder={createProvider === 'kubevirt' ? '当前由集群调度' : undefined}
                        />
                      )}
                    </Form.Item>
                  </div>
                  {createProvider === 'kubevirt' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Form.Item name="kubevirtNetworkType" label="KubeVirt 网络类型">
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
                          kubevirtNetworkType === 'multus' ? 'NetworkAttachmentDefinition' : '网络'
                        }
                      >
                        <Input
                          placeholder={
                            kubevirtNetworkType === 'multus' ? 'namespace/nad-name' : 'pod'
                          }
                        />
                      </Form.Item>
                      {kubevirtNetworkType === 'multus' ? (
                        <Form.Item name="kubevirtNetworkAttachmentDefinition" label="NAD 引用">
                          <Input placeholder="apps/docker-build-net" />
                        </Form.Item>
                      ) : null}
                      <Form.Item name="kubevirtInterfaceModel" label="Interface Model">
                        <Input placeholder="virtio" />
                      </Form.Item>
                      <Form.Item name="kubevirtInterfaceBinding" label="Interface Binding">
                        <Select
                          allowClear
                          options={[
                            { value: 'bridge', label: 'bridge' },
                            { value: 'masquerade', label: 'masquerade' },
                            { value: 'sriov', label: 'sriov' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name="kubevirtInterfaceName" label="Interface Name">
                        <Input placeholder="net1" />
                      </Form.Item>
                    </div>
                  ) : (
                    <Form.Item name="network" label="网络">
                      <Input placeholder="vmbr0" />
                    </Form.Item>
                  )}
                  {createProvider === 'pve' ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Form.Item name="pveStorage" label="PVE 存储">
                          {pveStorageOptions.length > 0 ? (
                            <Select allowClear options={pveStorageOptions} />
                          ) : (
                            <Input placeholder="local-lvm" />
                          )}
                        </Form.Item>
                        <Form.Item name="pveBridge" label="PVE 网桥">
                          {pveBridgeOptions.length > 0 ? (
                            <Select
                              allowClear
                              options={pveBridgeOptions}
                              placeholder="选择已同步网桥"
                            />
                          ) : (
                            <Input placeholder="vmbr0" />
                          )}
                        </Form.Item>
                        {createSourceMode === 'iso_install' ? (
                          <Form.Item name="pveIso" label="安装 ISO">
                            <Input placeholder="local:iso/ubuntu.iso" />
                          </Form.Item>
                        ) : (
                          <Form.Item label="模板模式">
                            <Alert
                              type="info"
                              showIcon
                              title="当前将按模板克隆模式创建 VM，启动镜像字段会作为模板来源。"
                            />
                          </Form.Item>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Form.Item name="pveCloudInitUser" label="PVE Cloud-Init 用户名">
                          <Input placeholder="ubuntu" />
                        </Form.Item>
                        <Form.Item name="pveSnippetStorage" label="PVE Snippet Storage">
                          {pveSnippetStorageOptions.length > 0 ? (
                            <Select
                              allowClear
                              options={pveSnippetStorageOptions}
                              placeholder="选择支持 snippets 的存储"
                            />
                          ) : (
                            <Input placeholder="local" />
                          )}
                        </Form.Item>
                        <Form.Item name="pveCloudInitSSHKeys" label="PVE Cloud-Init SSH Keys">
                          <Input.TextArea rows={3} placeholder="ssh-rsa AAAA..." />
                        </Form.Item>
                        <Form.Item name="pveCICustom" label="PVE cicustom 引用">
                          <Input placeholder="user=local:snippets/docker-agent.yaml" />
                        </Form.Item>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Form.Item name="kubevirtStorageClass" label="StorageClass">
                        <Input placeholder="fast-ssd" />
                      </Form.Item>
                      {createSourceMode === 'pvc_clone' ? (
                        <Form.Item name="kubevirtDataVolumeName" label="PVC 名称">
                          <Input placeholder="existing-root-pvc" />
                        </Form.Item>
                      ) : (
                        <Form.Item name="kubevirtDataVolumeName" label="DataVolume 名称">
                          <Input placeholder="demo-rootdisk" />
                        </Form.Item>
                      )}
                    </div>
                  )}
                  <Form.Item
                    name="cloudInit"
                    label={
                      createProvider === 'pve'
                        ? 'PVE raw Cloud-Init user-data'
                        : 'Cloud Init userData'
                    }
                  >
                    <Input.TextArea rows={5} placeholder="#cloud-config" />
                  </Form.Item>
                  <Form.Item name="startAfterCreate" label="创建后启动" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
            {
              title: '确认创建',
              children: (
                <Alert
                  showIcon
                  type="info"
                  title="确认提交虚拟机创建任务"
                  description="PVE 模板克隆、raw cloud-init、Snippet Storage 与创建后启动配置将按上一步内容提交。"
                />
              ),
            },
          ]}
          submitText="提交创建"
          width={820}
        />
      }
    />
  )
}
