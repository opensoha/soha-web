import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  AutoComplete,
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
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
  SettingOutlined,
} from '@ant-design/icons'
import { hasAllowedAction, hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { useWorkbenchModuleEnabled } from '@/features/modules'
import { dockerApi, dockerKeys } from '@/features/docker'
import type { DockerQuickCreateHostInput } from '@/features/docker'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { createUUID } from '@/utils/uuid'
import { StepFormModal } from '@/components/step-form-modal'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import type { OperationalPlan } from '@opensoha/contracts/gen/ts/sohaapi'
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
  buildCreateVmPayload,
  buildRuntimeHostProvisionPayload,
  filterVmCreateFlavors,
  normalizePage,
  virtualMachineDisplayStatus,
  virtualMachineObservation,
  virtualizationPageSummary,
  providerLabel,
} from '@/features/virtualization/virtualization-model'
import type { VirtualMachineFormValues } from '@/features/virtualization/virtualization-model'
import { useTaskStream } from '@/features/virtualization/use-task-stream'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualMachine,
  CreateVirtualMachineInput,
  VirtualMachineDevice,
  VirtualMachineDiskChange,
  VirtualizationListParams,
  VirtualizationOperation,
  VirtualizationPage,
} from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const tableEllipsis = { showTitle: false } as const
const VM_CAPABILITIES = {
  cpu: 'vm.resource.cpu.resize',
  memory: 'vm.resource.memory.resize',
  diskAdd: 'vm.resource.disk.add',
  diskResize: 'vm.resource.disk.resize',
  networkAdd: 'vm.resource.network.add',
} as const

interface VirtualMachineResizeFormValues {
  cpu?: number
  memoryMiB?: number
  rootDiskId?: string
  rootDiskSizeGiB?: number
  disks?: VirtualMachineDiskChange[]
  networks?: Array<{ network: string; model?: string; add?: boolean }>
}

type PendingCreate =
  | { kind: 'vm'; idempotencyKey: string; payload: CreateVirtualMachineInput }
  | { kind: 'runtime'; idempotencyKey: string; payload: DockerQuickCreateHostInput }

function pveVMSourceRef(item: VirtualMachine) {
  return String(item.sourceRef || item.config?.sourceRef || item.config?.vmid || '').trim()
}

export function defaultRootDisk(
  disks: VirtualMachineDevice[],
  currentSizeGiB?: number,
): VirtualMachineDevice | undefined {
  const matchingSize = disks.filter((disk) => disk.sizeGiB === currentSizeGiB)
  return (
    matchingSize.find((disk) => /^(?:scsi|virtio|sata|ide)0$/i.test(disk.id)) ??
    matchingSize[0] ??
    disks.find((disk) => /^(?:scsi|virtio|sata|ide)0$/i.test(disk.id)) ??
    disks[0]
  )
}

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  return <StatusTag value={value} />
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

function providerTag(provider?: string) {
  return <MetadataTag label={providerLabel(provider)} tone={provider === 'pve' ? 'gold' : 'cyan'} />
}

function vmIdentity(record: VirtualMachine) {
  const hostname = virtualMachineObservation(record).hostname
  return (
    <span className="soha-vrt-vm-identity-copy">
      <Tooltip title={record.name} placement="topLeft">
        <Link
          className="soha-vrt-vm-name"
          to={`/compute/virtualization/vms/${encodeURIComponent(record.id)}`}
        >
          {record.name}
        </Link>
      </Tooltip>
      {hostname && hostname !== record.name ? <Text type="secondary">{hostname}</Text> : null}
    </span>
  )
}

function vmMetadataTags(
  values: Array<{ label: string; tone?: 'default' | 'blue' | 'cyan' | 'purple' | 'gold' }>,
) {
  if (values.length === 0) return <Text type="secondary">-</Text>
  return (
    <span className="soha-vrt-vm-tag-group">
      {values.map((item) => (
        <MetadataTag key={item.label} label={item.label} tone={item.tone} />
      ))}
    </span>
  )
}

function memoryLabel(memoryMiB?: number) {
  if (!memoryMiB) return ''
  return memoryMiB % 1024 === 0 ? `${memoryMiB / 1024} GiB` : `${memoryMiB} MiB`
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
  const taskStatus = task?.status ? <StatusTag value={task.status} /> : null
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
  const [createPlan, setCreatePlan] = useState<OperationalPlan | null>(null)
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null)
  const [pendingResizeTaskId, setPendingResizeTaskId] = useState<string | null>(null)
  const [resizeTarget, setResizeTarget] = useState<VirtualMachine | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VirtualMachine | null>(null)
  const [resizeStep, setResizeStep] = useState(0)
  const [resizeForm] = Form.useForm<VirtualMachineResizeFormValues>()
  const { virtualizationModuleEnabled, canCreateVMs } = useVirtualizationPermissions()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const { moduleEnabled: dockerModuleEnabled } = useWorkbenchModuleEnabled('docker')
  const canCreateRuntimeHosts =
    dockerModuleEnabled && hasPermission(permissionSnapshotQuery.data?.data, 'docker.hosts.create')
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const createProvider = Form.useWatch('provider', form) ?? 'kubevirt'
  const createSourceMode =
    Form.useWatch('sourceMode', form) ??
    (createProvider === 'pve' ? 'template_clone' : 'datasource_clone')
  const enableCloudInit = Form.useWatch('enableCloudInit', form) ?? false
  const registerRuntimeHost = Form.useWatch('registerRuntimeHost', form) ?? false
  const kubevirtNetworkType = Form.useWatch('kubevirtNetworkType', form) ?? 'pod'
  const selectedConnectionId = Form.useWatch('connectionId', form)
  const selectedFlavorId = Form.useWatch('flavorId', form)
  const { task: streamedTask, status: streamStatus } = useTaskStream(
    pendingTaskId,
    virtualizationModuleEnabled,
  )
  const { task: streamedResizeTask, status: resizeStreamStatus } = useTaskStream(
    pendingResizeTaskId,
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
  useEffect(() => {
    if (resizeStreamStatus !== 'done') return
    const success = streamedResizeTask?.status === 'completed'
    message[success ? 'success' : 'error'](
      success
        ? '虚拟机规格调整完成'
        : `虚拟机规格调整失败: ${streamedResizeTask?.message ?? '未知错误'}`,
    )
    setPendingResizeTaskId(null)
    void invalidateVirtualizationQueries(queryClient, [virtualizationKeys.all])
  }, [message, queryClient, resizeStreamStatus, streamedResizeTask])
  const cancelCreateMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.cancelOperation(queryClient), () =>
      message.info('已请求取消创建任务'),
    ),
  )
  const vmsQuery = useQuery(virtualizationQueries.vms(filters, virtualizationModuleEnabled))
  const clustersQuery = useQuery(virtualizationQueries.clusters(virtualizationModuleEnabled))
  const imagesQuery = useQuery(virtualizationQueries.imageOptions(virtualizationModuleEnabled))
  const flavorsQuery = useQuery(virtualizationQueries.flavors(virtualizationModuleEnabled))
  const pveCloneSourcesQuery = useQuery(
    virtualizationQueries.vms(
      { connectionId: selectedConnectionId, page: 1, pageSize: 500 },
      virtualizationModuleEnabled && createProvider === 'pve' && Boolean(selectedConnectionId),
    ),
  )
  const createPlanMutation = useMutation({
    ...virtualizationMutations.planCreateVm(),
    onSuccess: (plan, payload) => {
      setCreatePlan(plan)
      setPendingCreate({ kind: 'vm', idempotencyKey: createUUID(), payload })
      setDrawerOpen(false)
    },
    onError: (error) => void message.error(error.message),
  })
  const runtimePlanMutation = useMutation({
    mutationFn: dockerApi.planQuickCreateHost,
    onSuccess: (plan, payload) => {
      setCreatePlan(plan)
      setPendingCreate({ kind: 'runtime', idempotencyKey: createUUID(), payload })
      setDrawerOpen(false)
    },
    onError: (error) => void message.error(error.message),
  })
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
        setCreatePlan(null)
        setPendingCreate(null)
        setDrawerOpen(false)
        form.resetFields()
      },
    ),
  )
  const runtimeCreateMutation = useMutation({
    mutationFn: ({ payload, idempotencyKey }: Extract<PendingCreate, { kind: 'runtime' }>) =>
      dockerApi.quickCreateHost(payload, idempotencyKey),
    onSuccess: () => {
      message.success('虚拟机与运行时主机构建任务已提交')
      setCreatePlan(null)
      setPendingCreate(null)
      setDrawerOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: dockerKeys.all })
      void invalidateVirtualizationQueries(queryClient, [virtualizationKeys.all])
    },
    onError: (error) => void message.error(error.message),
  })
  const powerMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.powerVm(queryClient), () =>
      message.success('电源操作已提交'),
    ),
  )
  const resizeMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.resizeVm(queryClient),
      (operation) => {
        if (operation.id) {
          message.info('调整规格任务已提交，正在跟踪进度...')
          setPendingResizeTaskId(operation.id)
        } else {
          message.success('调整规格任务已提交')
        }
        setResizeTarget(null)
      },
    ),
  )
  const resizeDevicesQuery = useQuery(
    virtualizationQueries.vmDevices(resizeTarget?.id ?? '', Boolean(resizeTarget)),
  )
  const resizeDisks = Form.useWatch('disks', resizeForm) ?? []
  const selectedRootDiskId = Form.useWatch('rootDiskId', resizeForm)
  const discoveredDisks = (resizeDevicesQuery.data ?? []).filter((item) => item.kind === 'disk')
  const discoveredNetworks = (resizeDevicesQuery.data ?? []).filter(
    (item) => item.kind === 'network',
  )
  const selectedRootDisk = discoveredDisks.find((item) => item.id === selectedRootDiskId)
  useEffect(() => {
    if (!resizeTarget || discoveredDisks.length === 0 || resizeForm.getFieldValue('rootDiskId')) {
      return
    }
    const disk = defaultRootDisk(discoveredDisks, resizeTarget.diskGiB)
    if (!disk) return
    resizeForm.setFieldsValue({
      rootDiskId: disk.id,
      rootDiskSizeGiB: disk.sizeGiB ?? resizeTarget.diskGiB,
    })
  }, [discoveredDisks, resizeForm, resizeTarget])
  const clusters = clustersQuery.data ?? []
  const providerOptions = useMemo(
    () =>
      Array.from(new Set(clusters.map((item) => item.provider).filter(Boolean))).map((value) => ({
        value: value!,
        label: providerLabel(value),
      })),
    [clusters],
  )
  const defaultProvider =
    providerOptions.find((item) => item.value === 'kubevirt')?.value ?? providerOptions[0]?.value
  const images = normalizePage(imagesQuery.data, 1, 200).items
  const pveCloneSources = normalizePage(pveCloneSourcesQuery.data, 1, 500).items.filter(
    (item) =>
      item.provider === 'pve' &&
      item.connectionId === selectedConnectionId &&
      item.status !== 'deleted' &&
      pveVMSourceRef(item),
  )
  const flavors = flavorsQuery.data ?? []
  const compatibleFlavors = useMemo(
    () => filterVmCreateFlavors(flavors, createProvider, selectedConnectionId),
    [createProvider, flavors, selectedConnectionId],
  )
  useEffect(() => {
    if (selectedFlavorId && !compatibleFlavors.some((flavor) => flavor.id === selectedFlavorId)) {
      form.setFieldValue('flavorId', undefined)
    }
  }, [compatibleFlavors, form, selectedFlavorId])
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
  const discoveredStorageOptions = Array.from(
    new Set([
      ...pveStorageOptions.map((item) => item.value),
      ...discoveredDisks.map((item) => item.storage).filter(Boolean),
    ]),
  ).map((value) => ({ value, label: value }))
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
  const discoveredNetworkOptions = Array.from(
    new Set([
      ...discoveredNetworks.map((item) => item.network).filter(Boolean),
      ...pveBridgeOptions.map((item) => item.value),
    ]),
  ).map((value) => ({ value, label: value }))
  const vmPage = normalizePage(vmsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const selectedFlavor = compatibleFlavors.find((item) => item.id === selectedFlavorId)
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
      width: 210,
      render: (_value, record) => vmIdentity(record),
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      render: (value) => providerTag(value),
      width: 90,
    },
    {
      title: '连接',
      dataIndex: 'connectionName',
      render: (value, record) => tableTooltipText(value || record.connectionId || '-'),
      ellipsis: tableEllipsis,
      width: 160,
    },
    {
      title: '命名空间/节点',
      render: (_value, record) =>
        vmMetadataTags([
          ...(record.namespace ? [{ label: record.namespace, tone: 'purple' as const }] : []),
          ...(record.node ? [{ label: record.node, tone: 'blue' as const }] : []),
        ]),
      width: 160,
    },
    {
      title: '电源',
      dataIndex: 'powerState',
      render: (_value, record) => statusTag(virtualMachineDisplayStatus(record)),
      width: 100,
    },
    {
      title: '地址',
      dataIndex: 'ipAddresses',
      render: (value: string[]) =>
        vmMetadataTags([
          ...(value ?? [])
            .slice(0, 2)
            .map((address) => ({ label: address, tone: 'cyan' as const })),
          ...((value?.length ?? 0) > 2
            ? [{ label: `+${value.length - 2}`, tone: 'default' as const }]
            : []),
        ]),
      width: 200,
    },
    {
      title: '规格',
      render: (_value, record) =>
        record.flavorName
          ? vmMetadataTags([{ label: record.flavorName, tone: 'purple' }])
          : vmMetadataTags([
              ...(record.cpu ? [{ label: `${record.cpu} vCPU`, tone: 'purple' as const }] : []),
              ...(record.memoryMiB
                ? [{ label: memoryLabel(record.memoryMiB), tone: 'cyan' as const }]
                : []),
              ...(record.diskGiB
                ? [{ label: `${record.diskGiB} GiB`, tone: 'gold' as const }]
                : []),
            ]),
      width: 210,
    },
    {
      title: '镜像',
      dataIndex: 'bootImageName',
      render: (value, record) =>
        vmMetadataTags(
          value || record.bootImageId
            ? [{ label: String(value || record.bootImageId), tone: 'blue' }]
            : [],
        ),
      width: 200,
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
            {canPower('resize') ? (
              <ManagementIconButton
                aria-label="调整虚拟机规格"
                size="small"
                tooltip="调整规格"
                icon={<SettingOutlined />}
                onClick={() => {
                  setResizeTarget(record)
                  setResizeStep(0)
                  resizeForm.setFieldsValue({
                    cpu: record.cpu,
                    memoryMiB: record.memoryMiB,
                    rootDiskId: undefined,
                    rootDiskSizeGiB: undefined,
                    disks: [],
                    networks: [],
                  })
                }}
              />
            ) : null}
            {canPower('delete') ? (
              <ManagementIconButton
                aria-label="删除虚拟机"
                size="small"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteTarget(record)}
              />
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <ManagementDataPage
        className="soha-virtualization-page"
        beforeQuery={
          <Space orientation="vertical" className="soha-vrt-fill">
            <TaskProgressBanner
              task={streamedTask}
              status={streamStatus}
              title="正在创建虚拟机"
              onCancel={
                streamedTask?.id ? () => cancelCreateMutation.mutate(streamedTask.id) : undefined
              }
              cancelling={cancelCreateMutation.isPending}
            />
            <TaskProgressBanner
              task={streamedResizeTask}
              status={resizeStreamStatus}
              title="正在调整虚拟机规格"
            />
          </Space>
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
                <Select allowClear placeholder="全部 Provider" options={providerOptions} />
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
              canCreateVMs ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setCurrentStep(0)
                    form.resetFields()
                    form.setFieldValue('provider', defaultProvider)
                    form.setFieldValue(
                      'sourceMode',
                      defaultProvider === 'pve' ? 'template_clone' : 'datasource_clone',
                    )
                    form.setFieldValue('enableCloudInit', false)
                    form.setFieldValue('registerRuntimeHost', false)
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
            scroll={{ x: 1550 }}
            pagination={pageTablePagination(vmPage, setFilters)}
            paginationSummary={virtualizationPageSummary}
          />
        }
        afterTable={
          <StepFormModal
            title="创建虚拟机"
            current={currentStep}
            form={form}
            loading={createPlanMutation.isPending || runtimePlanMutation.isPending}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onCurrentChange={setCurrentStep}
            initialValues={{
              provider: defaultProvider,
              sourceMode: defaultProvider === 'pve' ? 'template_clone' : 'datasource_clone',
              kubevirtNetworkType: 'pod',
              kubevirtInterfaceBinding: 'bridge',
              enableCloudInit: false,
              registerRuntimeHost: false,
              runtimeAvailablePortStart: 20000,
              runtimeAvailablePortEnd: 39999,
              startAfterCreate: true,
            }}
            onFinish={(values) => {
              const vmPayload = buildCreateVmPayload(values)
              if (values.registerRuntimeHost) {
                runtimePlanMutation.mutate(buildRuntimeHostProvisionPayload(values, vmPayload))
                return
              }
              createPlanMutation.mutate(vmPayload)
            }}
            steps={[
              {
                title: '基础配置',
                fieldNames: [
                  'name',
                  'provider',
                  'connectionId',
                  'sourceMode',
                  'flavorId',
                  'bootImageId',
                  'templateId',
                ],
                children: (
                  <>
                    <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
                      <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
                        <Select
                          options={providerOptions}
                          onChange={(provider) =>
                            form.setFieldsValue({
                              connectionId: undefined,
                              sourceMode:
                                provider === 'pve' ? 'template_clone' : 'datasource_clone',
                              flavorId: undefined,
                              bootImageId: undefined,
                              templateId: undefined,
                            })
                          }
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
                        onChange={() =>
                          form.setFieldsValue({ bootImageId: undefined, templateId: undefined })
                        }
                        options={
                          createProvider === 'pve'
                            ? [
                                { value: 'template_clone', label: '模板克隆' },
                                { value: 'vm_clone', label: '虚拟机完整克隆' },
                                { value: 'iso_install', label: 'ISO 安装' },
                              ]
                            : [
                                { value: 'datasource_clone', label: 'DataSource 克隆' },
                                { value: 'pvc_clone', label: 'PVC 克隆' },
                              ]
                        }
                      />
                    </Form.Item>
                    <Form.Item name="flavorId" label="规格">
                      <Select
                        allowClear
                        placeholder="可选；未选择时使用下方计算规格"
                        showSearch={{ optionFilterProp: 'label' }}
                        options={compatibleFlavors
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
                      name={createSourceMode === 'vm_clone' ? 'templateId' : 'bootImageId'}
                      label={
                        createProvider === 'pve'
                          ? createSourceMode === 'iso_install'
                            ? '安装 ISO'
                            : createSourceMode === 'vm_clone'
                              ? '源虚拟机'
                              : '模板'
                          : '启动镜像'
                      }
                      rules={[{ required: true }]}
                    >
                      <Select
                        showSearch={{ optionFilterProp: 'label' }}
                        loading={createSourceMode === 'vm_clone' && pveCloneSourcesQuery.isLoading}
                        onChange={(sourceRef) => {
                          if (createSourceMode !== 'vm_clone') return
                          const source = pveCloneSources.find(
                            (item) => pveVMSourceRef(item) === sourceRef,
                          )
                          form.setFieldsValue({
                            node: source?.node,
                            pveBridge:
                              source?.network ||
                              (typeof selectedCluster?.config?.defaultBridge === 'string'
                                ? selectedCluster.config.defaultBridge
                                : undefined),
                          })
                        }}
                        options={
                          createSourceMode === 'vm_clone'
                            ? pveCloneSources.map((item) => ({
                                value: pveVMSourceRef(item),
                                label: `${item.name || pveVMSourceRef(item)} / 虚拟机（完整克隆）`,
                              }))
                            : images
                                .filter(
                                  (item) =>
                                    !createProvider ||
                                    item.provider === createProvider ||
                                    !item.provider,
                                )
                                .filter(
                                  (item) =>
                                    createProvider !== 'pve' ||
                                    (createSourceMode === 'iso_install'
                                      ? item.assetKind === 'iso' || item.sourceKind === 'iso'
                                      : item.assetKind === 'template' ||
                                        item.sourceKind === 'template'),
                                )
                                .map((item) => ({
                                  value: item.id,
                                  label: item.connectionName
                                    ? `${item.name} (${item.connectionName})`
                                    : item.name,
                                }))
                        }
                      />
                    </Form.Item>
                  </>
                ),
              },
              {
                title: '计算规格',
                fieldNames: ['cpu', 'memoryMiB', 'diskGiB'],
                children: (
                  <>
                    <Alert
                      className="soha-vrt-form-alert"
                      type="info"
                      showIcon
                      title="可保留规格模板值，也可在这里覆盖 CPU、内存和系统盘。"
                    />
                    <div className="soha-vrt-form-grid soha-vrt-form-grid--3">
                      <Form.Item name="cpu" label="CPU 核数">
                        <InputNumber min={1} precision={0} className="soha-vrt-fill" />
                      </Form.Item>
                      <Form.Item name="memoryMiB" label="内存 MiB">
                        <InputNumber min={128} step={128} precision={0} className="soha-vrt-fill" />
                      </Form.Item>
                      <Form.Item name="diskGiB" label="系统盘 GiB">
                        <InputNumber min={1} precision={0} className="soha-vrt-fill" />
                      </Form.Item>
                    </div>
                  </>
                ),
              },
              {
                title: '存储网络',
                children: (
                  <>
                    <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
                      <Form.Item name="namespace" label="命名空间">
                        <Input />
                      </Form.Item>
                      <Form.Item name="node" label="节点">
                        {createProvider === 'pve' ? (
                          <AutoComplete
                            allowClear
                            options={pveNodeOptions}
                            placeholder="选择或输入 PVE 节点"
                          />
                        ) : (
                          <Input disabled placeholder="当前由集群调度" />
                        )}
                      </Form.Item>
                    </div>
                    {createProvider === 'pve' ? (
                      <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
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
                          <>
                            <Form.Item name="pveIso" label="安装 ISO">
                              <Input placeholder="local:iso/ubuntu.iso" />
                            </Form.Item>
                            <Form.Item name="pveOsType" label="客体系统类型" initialValue="l26">
                              <Select
                                options={[
                                  { value: 'l26', label: 'Linux 2.6+ 内核' },
                                  { value: 'l24', label: 'Linux 2.4 内核' },
                                  { value: 'win11', label: 'Windows 11 / Server 2022' },
                                  { value: 'win10', label: 'Windows 10 / Server 2016-2019' },
                                  { value: 'other', label: '其他系统' },
                                ]}
                              />
                            </Form.Item>
                          </>
                        ) : (
                          <Alert
                            type="info"
                            showIcon
                            title="模板将作为系统盘来源，存储用于承载克隆后的磁盘。"
                          />
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
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
                              kubevirtNetworkType === 'multus'
                                ? 'NetworkAttachmentDefinition'
                                : '网络'
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
                      </>
                    )}
                  </>
                ),
              },
              {
                title: '附加资源',
                children: (
                  <Space orientation="vertical" className="soha-vrt-fill" size="large">
                    <Form.List name="disks">
                      {(fields, { add, remove }) => (
                        <Space orientation="vertical" className="soha-vrt-fill">
                          {fields.map(({ key, name }) => (
                            <div
                              key={key}
                              className="soha-vrt-form-grid soha-vrt-form-grid--disk-row"
                            >
                              <div className="soha-vrt-form-row-hint">系统自动分配磁盘标识</div>
                              <Form.Item
                                name={[name, 'storage']}
                                rules={[{ required: true, message: '请选择虚拟化存储' }]}
                              >
                                <Select
                                  showSearch
                                  placeholder="选择虚拟化存储"
                                  options={pveStorageOptions}
                                />
                              </Form.Item>
                              <Form.Item name={[name, 'sizeGiB']} rules={[{ required: true }]}>
                                <InputNumber min={1} addonAfter="GiB" />
                              </Form.Item>
                              <ManagementIconButton
                                aria-label="移除附加磁盘"
                                tooltip="移除"
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                              />
                            </div>
                          ))}
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() => add({ add: true })}
                            disabled={
                              !selectedCluster?.capabilities?.includes(VM_CAPABILITIES.diskAdd)
                            }
                          >
                            新增附加磁盘
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                    <Form.List name="networks">
                      {(fields, { add, remove }) => (
                        <Space orientation="vertical" className="soha-vrt-fill">
                          {fields.map(({ key, name }) => (
                            <div
                              key={key}
                              className="soha-vrt-form-grid soha-vrt-form-grid--network-row"
                            >
                              <div className="soha-vrt-form-row-hint">系统自动分配网卡标识</div>
                              <Form.Item name={[name, 'network']} rules={[{ required: true }]}>
                                <Select
                                  showSearch
                                  placeholder="选择虚拟化网络"
                                  options={pveBridgeOptions}
                                />
                              </Form.Item>
                              <Form.Item name={[name, 'model']}>
                                <Input placeholder="接口型号，如 virtio" />
                              </Form.Item>
                              <ManagementIconButton
                                aria-label="移除附加网卡"
                                tooltip="移除"
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                              />
                            </div>
                          ))}
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() => add({ add: true, model: 'virtio' })}
                            disabled={
                              !selectedCluster?.capabilities?.includes(VM_CAPABILITIES.networkAdd)
                            }
                          >
                            新增网卡
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                  </Space>
                ),
              },
              {
                title: 'Cloud-Init',
                fieldNames: [
                  'enableCloudInit',
                  'pveCloudInitUser',
                  'pveSnippetStorage',
                  'pveCloudInitSSHKeys',
                  'pveCICustom',
                  'cloudInit',
                  'registerRuntimeHost',
                  'runtimeControlPlaneBaseURL',
                  'runtimeEnvironment',
                  'runtimeAvailablePortStart',
                  'runtimeAvailablePortEnd',
                ],
                children: (
                  <>
                    <Form.Item
                      name="registerRuntimeHost"
                      label="同时接入为运行时主机"
                      tooltip={
                        canCreateRuntimeHosts
                          ? '创建 VM 后安装 Soha Agent，并登记到运行时主机。'
                          : '需要启用容器运行时模块并具备运行时主机创建权限。'
                      }
                      valuePropName="checked"
                    >
                      <Switch
                        disabled={!canCreateRuntimeHosts}
                        onChange={(checked) => {
                          if (checked) {
                            form.setFieldsValue({ enableCloudInit: false, startAfterCreate: true })
                          }
                        }}
                      />
                    </Form.Item>
                    {registerRuntimeHost ? (
                      <>
                        <Form.Item
                          name="runtimeControlPlaneBaseURL"
                          label="Soha 控制面地址"
                          rules={[
                            { required: true, message: '请输入虚拟机可访问的 Soha 控制面地址' },
                          ]}
                          tooltip="新虚拟机内的 Agent 使用此地址注册并回传任务。"
                        >
                          <Input placeholder="http://soha.internal:8080" />
                        </Form.Item>
                        <div className="soha-vrt-form-grid soha-vrt-form-grid--3">
                          <Form.Item name="runtimeEnvironment" label="运行环境">
                            <Input placeholder="dev / test" />
                          </Form.Item>
                          <Form.Item name="runtimeAvailablePortStart" label="端口池起始">
                            <InputNumber min={1} max={65535} className="soha-vrt-fill" />
                          </Form.Item>
                          <Form.Item name="runtimeAvailablePortEnd" label="端口池结束">
                            <InputNumber min={1} max={65535} className="soha-vrt-fill" />
                          </Form.Item>
                        </div>
                        <Collapse
                          ghost
                          size="small"
                          items={[
                            {
                              key: 'runtime-advanced',
                              label: '运行时高级设置',
                              children: (
                                <>
                                  {createProvider === 'pve' ? (
                                    <Form.Item
                                      name="runtimeSnippetStorage"
                                      label="PVE Snippet Storage"
                                    >
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
                                  ) : null}
                                  <Form.Item name="runtimeEndpoint" label="Agent 对外地址">
                                    <Input placeholder="http://__SOHA_VM_IP__:18080" />
                                  </Form.Item>
                                  <Form.Item
                                    name="runtimeAgentInstallScript"
                                    label="Agent 安装脚本"
                                  >
                                    <Input.TextArea rows={3} spellCheck={false} />
                                  </Form.Item>
                                  <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
                                    <Form.Item name="runtimeOwner" label="负责人">
                                      <Input />
                                    </Form.Item>
                                    <Form.Item name="runtimeTeam" label="团队">
                                      <Input />
                                    </Form.Item>
                                  </div>
                                  <Form.Item name="runtimeTTLSeconds" label="有效期秒数">
                                    <InputNumber min={0} className="soha-vrt-fill" />
                                  </Form.Item>
                                </>
                              ),
                            },
                          ]}
                        />
                      </>
                    ) : (
                      <>
                        <Form.Item
                          name="enableCloudInit"
                          label="启用 Cloud-Init"
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        {enableCloudInit ? (
                          <>
                            {createProvider === 'pve' ? (
                              <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
                                <Form.Item name="pveCloudInitUser" label="Cloud-Init 用户名">
                                  <Input placeholder="ubuntu" />
                                </Form.Item>
                                <Form.Item name="pveSnippetStorage" label="Snippet Storage">
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
                                <Form.Item name="pveCloudInitSSHKeys" label="SSH Keys">
                                  <Input.TextArea rows={3} placeholder="ssh-rsa AAAA..." />
                                </Form.Item>
                                <Form.Item name="pveCICustom" label="cicustom 引用">
                                  <Input placeholder="user=local:snippets/bootstrap.yaml" />
                                </Form.Item>
                              </div>
                            ) : null}
                            <Form.Item
                              name="cloudInit"
                              label={
                                createProvider === 'pve'
                                  ? 'Raw Cloud-Init user-data'
                                  : 'Cloud-Init userData'
                              }
                            >
                              <Input.TextArea rows={6} placeholder="#cloud-config" />
                            </Form.Item>
                          </>
                        ) : (
                          <Alert type="info" showIcon title="本次创建不使用 Cloud-Init" />
                        )}
                      </>
                    )}
                  </>
                ),
              },
              {
                title: '确认',
                children: (
                  <>
                    <Alert
                      showIcon
                      type="info"
                      title={
                        registerRuntimeHost
                          ? '确认创建虚拟机并接入运行时主机'
                          : '确认提交虚拟机创建任务'
                      }
                      description={
                        registerRuntimeHost
                          ? '虚拟机创建完成后将等待 Soha Agent 注册，运行时主机随后上线。'
                          : enableCloudInit
                            ? 'Cloud-Init 已启用，相关初始化配置将随创建任务提交。'
                            : 'Cloud-Init 未启用，本次仅提交虚拟机、存储和网络配置。'
                      }
                    />
                    <Form.Item
                      className="mt-4"
                      name="startAfterCreate"
                      label="创建后启动"
                      valuePropName="checked"
                    >
                      <Switch disabled={registerRuntimeHost} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
            submitText={registerRuntimeHost ? '生成创建与接入计划' : '提交创建'}
            width={820}
          />
        }
      />
      <Modal
        title={`删除虚拟机：${deleteTarget?.name ?? ''}`}
        open={Boolean(deleteTarget)}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: powerMutation.isPending }}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (!deleteTarget) return
          powerMutation.mutate(
            { id: deleteTarget.id, action: 'delete' },
            {
              onSuccess: () => setDeleteTarget(null),
              onError: (error) => void message.error(error.message),
            },
          )
        }}
        destroyOnHidden
      >
        <Alert
          showIcon
          type="warning"
          title="从 Provider 删除虚拟机"
          description={`将删除 ${deleteTarget?.name ?? ''} 及其 Provider 资源。此操作不会删除虚拟化连接。`}
        />
      </Modal>
      <OperationalPlanModal
        confirmText={pendingCreate?.kind === 'runtime' ? '确认创建并接入' : '确认创建'}
        loading={createMutation.isPending || runtimeCreateMutation.isPending}
        onCancel={() => {
          setCreatePlan(null)
          setPendingCreate(null)
          setDrawerOpen(true)
        }}
        onConfirm={() => {
          if (!pendingCreate) return
          if (pendingCreate.kind === 'runtime') {
            runtimeCreateMutation.mutate(pendingCreate)
            return
          }
          createMutation.mutate({
            payload: pendingCreate.payload,
            idempotencyKey: pendingCreate.idempotencyKey,
          })
        }}
        plan={createPlan}
        title={pendingCreate?.kind === 'runtime' ? '虚拟机与运行时主机创建计划' : '虚拟机创建计划'}
      />
      <StepFormModal
        title={`调整规格：${resizeTarget?.name ?? ''}`}
        current={resizeStep}
        form={resizeForm}
        loading={resizeMutation.isPending}
        open={Boolean(resizeTarget)}
        onClose={() => setResizeTarget(null)}
        onCurrentChange={setResizeStep}
        onFinish={(payload) => {
          const rootDiskChange =
            resizeTarget?.capabilities?.includes(VM_CAPABILITIES.diskResize) &&
            payload.rootDiskId &&
            payload.rootDiskSizeGiB &&
            payload.rootDiskSizeGiB > (selectedRootDisk?.sizeGiB ?? resizeTarget?.diskGiB ?? 0)
              ? [{ id: payload.rootDiskId, sizeGiB: payload.rootDiskSizeGiB, add: false }]
              : []
          const diskChanges = [
            ...rootDiskChange,
            ...(payload.disks ?? []).filter(
              (disk) => !rootDiskChange.some((root) => root.id === disk.id),
            ),
          ]
          resizeMutation.mutate({
            id: resizeTarget!.id,
            payload: {
              cpu: payload.cpu,
              memoryMiB: payload.memoryMiB,
              disks: resizeTarget?.capabilities?.some(
                (item) => item === VM_CAPABILITIES.diskAdd || item === VM_CAPABILITIES.diskResize,
              )
                ? diskChanges
                : undefined,
              networks: resizeTarget?.capabilities?.includes(VM_CAPABILITIES.networkAdd)
                ? payload.networks
                : undefined,
            },
          })
        }}
        submitText="提交调整"
        width={760}
        steps={[
          {
            title: '计算资源',
            fieldNames: ['cpu', 'memoryMiB'],
            children: (
              <>
                <Alert
                  className="soha-vrt-form-alert"
                  type="info"
                  showIcon
                  title="CPU 和内存可调高或调低，是否支持热变更由 Provider 决定。"
                />
                <div className="soha-vrt-form-grid soha-vrt-form-grid--2">
                  <Form.Item name="cpu" label="CPU 核数" rules={[{ required: true }]}>
                    <InputNumber
                      min={1}
                      precision={0}
                      className="soha-vrt-fill"
                      disabled={!resizeTarget?.capabilities?.includes(VM_CAPABILITIES.cpu)}
                    />
                  </Form.Item>
                  <Form.Item name="memoryMiB" label="内存 MiB" rules={[{ required: true }]}>
                    <InputNumber
                      min={128}
                      step={128}
                      precision={0}
                      className="soha-vrt-fill"
                      disabled={!resizeTarget?.capabilities?.includes(VM_CAPABILITIES.memory)}
                    />
                  </Form.Item>
                </div>
              </>
            ),
          },
          {
            title: '磁盘',
            children: (
              <>
                <Form.Item
                  name="rootDiskId"
                  label="系统盘设备"
                  rules={
                    resizeTarget?.capabilities?.includes(VM_CAPABILITIES.diskResize)
                      ? [{ required: true, message: '请选择要扩容的系统盘设备' }]
                      : []
                  }
                >
                  <Select
                    loading={resizeDevicesQuery.isFetching}
                    placeholder="选择实际启动盘设备"
                    options={discoveredDisks.map((item) => ({
                      value: item.id,
                      label: `${item.id}${item.sizeGiB ? ` (${item.sizeGiB} GiB)` : ''}`,
                    }))}
                    onChange={(id) => {
                      const disk = discoveredDisks.find((item) => item.id === id)
                      resizeForm.setFieldValue(
                        'rootDiskSizeGiB',
                        disk?.sizeGiB ?? resizeTarget?.diskGiB,
                      )
                    }}
                  />
                </Form.Item>
                <Form.Item name="rootDiskSizeGiB" label="系统盘目标容量 GiB">
                  <InputNumber
                    min={selectedRootDisk?.sizeGiB ?? resizeTarget?.diskGiB ?? 1}
                    precision={0}
                    className="soha-vrt-fill"
                    disabled={!resizeTarget?.capabilities?.includes(VM_CAPABILITIES.diskResize)}
                  />
                </Form.Item>
                <Form.List name="disks">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" className="soha-vrt-fill">
                      {fields.map(({ key, name }) => (
                        <div
                          key={key}
                          className="soha-vrt-form-grid soha-vrt-form-grid--resize-disk-row"
                        >
                          <Form.Item name={[name, 'add']} initialValue={true}>
                            <Select
                              options={[
                                { value: true, label: '新增磁盘' },
                                { value: false, label: '扩容磁盘' },
                              ]}
                            />
                          </Form.Item>
                          {resizeDisks[name]?.add === false ? (
                            <Form.Item name={[name, 'id']} rules={[{ required: true }]}>
                              <Select
                                placeholder="选择已有磁盘"
                                options={(resizeDevicesQuery.data ?? [])
                                  .filter((item) => item.kind === 'disk')
                                  .map((item) => ({
                                    value: item.id,
                                    label: `${item.id}${item.sizeGiB ? ` (${item.sizeGiB} GiB)` : ''}`,
                                  }))}
                              />
                            </Form.Item>
                          ) : (
                            <div className="soha-vrt-form-row-hint">系统自动分配磁盘标识</div>
                          )}
                          <Form.Item
                            name={[name, 'storage']}
                            rules={
                              resizeDisks[name]?.add === false
                                ? []
                                : [{ required: true, message: '请选择虚拟化存储' }]
                            }
                          >
                            {resizeDisks[name]?.add === false ? (
                              <div className="soha-vrt-form-row-hint">沿用原磁盘存储</div>
                            ) : (
                              <Select
                                showSearch
                                placeholder="选择虚拟化存储"
                                options={discoveredStorageOptions}
                                loading={resizeDevicesQuery.isFetching}
                              />
                            )}
                          </Form.Item>
                          <Form.Item name={[name, 'sizeGiB']} rules={[{ required: true }]}>
                            <InputNumber
                              min={
                                resizeDisks[name]?.add === false
                                  ? (discoveredDisks.find(
                                      (item) => item.id === resizeDisks[name]?.id,
                                    )?.sizeGiB ?? 1)
                                  : 1
                              }
                              precision={0}
                              addonAfter="GiB"
                            />
                          </Form.Item>
                          <ManagementIconButton
                            aria-label="移除磁盘变更"
                            tooltip="移除"
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </div>
                      ))}
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => add({ add: true })}
                        disabled={
                          !resizeTarget?.capabilities?.includes(VM_CAPABILITIES.diskAdd) &&
                          !resizeTarget?.capabilities?.includes(VM_CAPABILITIES.diskResize)
                        }
                      >
                        添加磁盘操作
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </>
            ),
          },
          {
            title: '网络',
            children: (
              <Form.List name="networks">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" className="soha-vrt-fill">
                    {fields.map(({ key, name }) => (
                      <div key={key} className="soha-vrt-form-grid soha-vrt-form-grid--network-row">
                        <div className="soha-vrt-form-row-hint">系统自动分配网卡标识</div>
                        <Form.Item name={[name, 'network']} rules={[{ required: true }]}>
                          <Select
                            showSearch
                            placeholder="选择虚拟化网络"
                            options={discoveredNetworkOptions}
                            loading={resizeDevicesQuery.isFetching}
                          />
                        </Form.Item>
                        <Form.Item name={[name, 'model']} initialValue="virtio">
                          <Input placeholder="接口型号" />
                        </Form.Item>
                        <ManagementIconButton
                          aria-label="移除网卡变更"
                          tooltip="移除"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </div>
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => add({ add: true, model: 'virtio' })}
                      disabled={!resizeTarget?.capabilities?.includes(VM_CAPABILITIES.networkAdd)}
                    >
                      新增网卡
                    </Button>
                  </Space>
                )}
              </Form.List>
            ),
          },
          {
            title: '确认',
            children: (
              <Alert
                showIcon
                type="warning"
                title="确认提交资源变更任务"
                description="磁盘不可缩容。关机要求、热插拔能力和具体限制由 Provider Adapter 执行并返回。"
              />
            ),
          },
        ]}
      />
    </>
  )
}
