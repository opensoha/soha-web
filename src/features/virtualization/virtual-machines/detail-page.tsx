import { lazy, Suspense, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Flex,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tooltip,
  Typography,
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { ComputeRelationsPanel } from '@/features/compute'
import { getAIWorkbenchPathForMode, useAIPageContext } from '@/features/copilot'
import { localeText, useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { virtualizationQueries } from '@/features/virtualization/queries'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import { VirtualizationAdminTable } from '@/features/virtualization/shared/ui'
import {
  isAbnormalOperation,
  isStaleVirtualMachine,
  latestNonEmptyOperationMessage,
  operationKindLabel,
  operationTime,
  stringifyRaw,
  virtualMachineDisplayStatus,
  virtualMachineObservation,
} from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type { VirtualizationOperation } from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const tableEllipsis = { showTitle: false } as const

const SOURCE_MODE_LABELS: Record<string, string> = {
  cloudInitNoCloud: 'Cloud-Init NoCloud',
  datasource_clone: 'DataSource 克隆',
  iso_install: 'ISO 安装',
  pvc_clone: 'PVC 克隆',
  template_clone: '模板克隆',
  vm_clone: '虚拟机完整克隆',
}

const ASSET_KIND_LABELS: Record<string, string> = {
  datasource: 'DataSource',
  image: '镜像',
  iso: 'ISO',
  storage: '存储',
  template: '模板',
}

function displayValue(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : '-'
}

const VMConsole = lazy(() =>
  import('../vm-console').then((module) => ({ default: module.VMConsole })),
)

const VMMetricsPanel = lazy(() =>
  import('./metrics-panel').then((module) => ({ default: module.VMMetricsPanel })),
)

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  return <StatusTag value={value} />
}

function metadataValues(
  values: string[],
  tone: 'default' | 'blue' | 'cyan' | 'purple' | 'gold' = 'default',
) {
  if (values.length === 0) return <Text type="secondary">-</Text>
  return (
    <Flex gap={4} wrap>
      {values.map((value) => (
        <MetadataTag key={value} label={value} tone={tone} />
      ))}
    </Flex>
  )
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

function buildInvestigationPath(params: {
  clusterId?: string
  namespace?: string
  workload?: string
  connectionId?: string
  vmId?: string
  provider?: string
  timeRangeMinutes?: number
}) {
  const search = new URLSearchParams()
  search.set('mode', 'root_cause')
  search.set('timeRangeMinutes', String(params.timeRangeMinutes ?? 60))
  if (params.clusterId) search.set('clusterId', params.clusterId)
  if (params.namespace) search.set('namespace', params.namespace)
  if (params.workload) search.set('workload', params.workload)
  if (params.connectionId) search.set('connectionId', params.connectionId)
  if (params.vmId) search.set('vmId', params.vmId)
  if (params.provider) search.set('provider', params.provider)
  return getAIWorkbenchPathForMode('root_cause', search)
}

export function VirtualizationVmDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const vmId = id ?? decodeURIComponent(pathParts[pathParts.length - 1] ?? '')
  const {
    virtualizationModuleEnabled,
    canAccessConsole,
    canCreateVMs,
    canDeleteVMs,
    canPowerVMs,
    canViewMetrics,
  } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const { localeCode } = useI18n()
  const [metricsRange, setMetricsRange] = useState(60)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('focus') === 'operations' || params.get('focus') === 'logs') {
      return params.get('focus') || 'operations'
    }
    return 'overview'
  })
  const detailQuery = useQuery(
    virtualizationQueries.vmDetail(vmId, virtualizationModuleEnabled && Boolean(vmId)),
  )
  const detail = detailQuery.data
  const vm = detail?.vm
  const observation = virtualMachineObservation(vm)
  const providerRaw = stringifyRaw(detail?.providerRaw)
  const sortedOperations = useMemo(() => {
    const records = [...(detail?.operations ?? [])]
    return records.sort((left, right) => {
      const leftAbnormal = isAbnormalOperation(left.status) ? 0 : 1
      const rightAbnormal = isAbnormalOperation(right.status) ? 0 : 1
      if (leftAbnormal !== rightAbnormal) return leftAbnormal - rightAbnormal
      return (operationTime(right) || '').localeCompare(operationTime(left) || '')
    })
  }, [detail?.operations])
  const latestAbnormalOperation = sortedOperations.find((item) => isAbnormalOperation(item.status))

  const vmDisplayStatus = virtualMachineDisplayStatus(vm)
  const isRunning =
    !isStaleVirtualMachine(vm) && (vm?.powerState === 'running' || vm?.status === 'running')
  const powerMutation = useMutation({
    ...withVirtualizationMutationSuccess(
      virtualizationMutations.powerVm(queryClient),
      (_operation, variables) => {
        message.success(
          variables.action === 'delete'
            ? localeText(localeCode, '删除任务已提交', 'Delete task submitted')
            : localeText(localeCode, '电源操作已提交', 'Power operation submitted'),
        )
        if (variables.action === 'delete') navigate('/compute/virtualization/vms')
      },
    ),
    onError: (error) => void message.error(error.message),
  })
  const canRunAction = (action: string) =>
    canPowerVMs && hasAllowedAction(vm?.allowedActions, action)
  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: vm?.name
      ? localeText(localeCode, `虚拟机 ${vm.name}`, `Virtual machine ${vm.name}`)
      : localeText(localeCode, '虚拟机详情', 'Virtual machine details'),
    entityKind: 'virtualization.vm',
    entityName: vm?.name ?? vmId,
    virtualizationConnectionId: vm?.connectionId,
    vmId,
    namespace: vm?.namespace,
    node: vm?.node,
    timeRangeMinutes: metricsRange,
    visibleFilters: {
      tab: activeTab,
      metricsRange,
    },
    pinnedData: {
      status: vmDisplayStatus,
      provider: vm?.provider,
      operationCount: sortedOperations.length,
      latestAbnormalOperationId: latestAbnormalOperation?.id,
      latestAbnormalOperationStatus: latestAbnormalOperation?.status,
    },
  })

  return (
    <div className="soha-page soha-virtualization-page">
      {!vm && !detailQuery.isLoading ? (
        <Card size="small" variant="outlined" className="soha-management-panel-card">
          <ManagementState
            compact
            kind="not-found"
            title={localeText(localeCode, '未找到虚拟机详情', 'Virtual machine not found')}
            description={localeText(
              localeCode,
              '目标虚拟机不存在，或当前账号无法访问该资源。',
              'The virtual machine does not exist or your account cannot access it.',
            )}
          />
        </Card>
      ) : null}
      <Tabs
        activeKey={activeTab}
        className="soha-resource-tabs soha-workload-detail-tabs"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        onChange={setActiveTab}
        size="small"
        tabBarGutter={18}
        items={[
          {
            key: 'overview',
            label: localeText(localeCode, '概览', 'Overview'),
            children: (
              <div className="soha-detail-stack">
                {latestAbnormalOperation ? (
                  <Alert
                    type="error"
                    showIcon
                    title={localeText(
                      localeCode,
                      `最近异常任务：${operationKindLabel(latestAbnormalOperation, localeCode)}`,
                      `Latest failed task: ${operationKindLabel(latestAbnormalOperation, localeCode)}`,
                    )}
                    description={latestNonEmptyOperationMessage(latestAbnormalOperation)}
                    action={
                      <Space>
                        <Button size="small" onClick={() => setActiveTab('operations')}>
                          {localeText(localeCode, '查看任务历史', 'View task history')}
                        </Button>
                        <Button
                          size="small"
                          onClick={() =>
                            navigate(
                              buildInvestigationPath({
                                connectionId: vm?.connectionId,
                                vmId: vm?.id,
                                namespace: vm?.namespace,
                                workload: vm?.name,
                                timeRangeMinutes: 60,
                              }),
                            )
                          }
                        >
                          {localeText(localeCode, 'AI调查', 'AI investigation')}
                        </Button>
                      </Space>
                    }
                  />
                ) : null}
                <Card
                  size="small"
                  variant="outlined"
                  className="soha-management-panel-card soha-vrt-vm-detail-card"
                  loading={detailQuery.isLoading}
                >
                  <div className="soha-vrt-vm-detail-identity">
                    <div className="soha-vrt-vm-detail-title">
                      <strong>{vm?.name ?? '-'}</strong>
                      <Text type="secondary">{vm?.id ?? '-'}</Text>
                    </div>
                    <Flex className="soha-vrt-vm-detail-tags" gap={6} wrap>
                      <MetadataTag
                        label={
                          vm?.provider === 'pve'
                            ? 'PVE'
                            : vm?.provider === 'kubevirt'
                              ? 'KubeVirt'
                              : vm?.provider || '-'
                        }
                        tone={vm?.provider === 'pve' ? 'gold' : 'cyan'}
                      />
                      {statusTag(vmDisplayStatus)}
                      {vm?.connectionName || vm?.connectionId ? (
                        <MetadataTag label={vm.connectionName || vm.connectionId} tone="blue" />
                      ) : null}
                    </Flex>
                  </div>
                  {vm ? (
                    <Flex className="soha-vrt-vm-detail-actions" gap={8} wrap>
                      {canRunAction('start') ? (
                        <Button
                          icon={<PlayCircleOutlined />}
                          loading={powerMutation.isPending}
                          onClick={() => powerMutation.mutate({ id: vm.id, action: 'start' })}
                        >
                          {localeText(localeCode, '启动', 'Start')}
                        </Button>
                      ) : null}
                      {canRunAction('stop') ? (
                        <Popconfirm
                          title={localeText(
                            localeCode,
                            '确认停止虚拟机？',
                            'Stop this virtual machine?',
                          )}
                          onConfirm={() => powerMutation.mutate({ id: vm.id, action: 'stop' })}
                        >
                          <Button icon={<PoweroffOutlined />} loading={powerMutation.isPending}>
                            {localeText(localeCode, '停止', 'Stop')}
                          </Button>
                        </Popconfirm>
                      ) : null}
                      {canRunAction('restart') ? (
                        <Popconfirm
                          title={localeText(
                            localeCode,
                            '确认重启虚拟机？',
                            'Restart this virtual machine?',
                          )}
                          onConfirm={() => powerMutation.mutate({ id: vm.id, action: 'restart' })}
                        >
                          <Button icon={<ReloadOutlined />} loading={powerMutation.isPending}>
                            {localeText(localeCode, '重启', 'Restart')}
                          </Button>
                        </Popconfirm>
                      ) : null}
                      {canCreateVMs && vm.provider === 'pve' ? (
                        <Button
                          icon={<CopyOutlined />}
                          onClick={() =>
                            navigate(
                              `/compute/virtualization/vms?clone=${encodeURIComponent(vm.id)}`,
                            )
                          }
                        >
                          {localeText(localeCode, '克隆', 'Clone')}
                        </Button>
                      ) : null}
                      {canDeleteVMs && hasAllowedAction(vm.allowedActions, 'delete') ? (
                        <Popconfirm
                          title={localeText(
                            localeCode,
                            '确认删除虚拟机？',
                            'Delete this virtual machine?',
                          )}
                          description={localeText(
                            localeCode,
                            '该操作会删除 Provider 中的虚拟机资源，且无法撤销。',
                            'This permanently deletes the virtual machine from the provider.',
                          )}
                          onConfirm={() => powerMutation.mutate({ id: vm.id, action: 'delete' })}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={powerMutation.isPending}
                          >
                            {localeText(localeCode, '删除', 'Delete')}
                          </Button>
                        </Popconfirm>
                      ) : null}
                    </Flex>
                  ) : null}

                  <section className="soha-vrt-vm-detail-section">
                    <h2>{localeText(localeCode, '运行与硬件', 'Runtime and hardware')}</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label={localeText(localeCode, '位置', 'Location')}>
                        {metadataValues(
                          [vm?.namespace, vm?.node].filter(Boolean) as string[],
                          'purple',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="CPU">
                        {vm?.cpu ? <MetadataTag label={`${vm.cpu} vCPU`} tone="purple" /> : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '内存', 'Memory')}>
                        {vm?.memoryMiB ? (
                          <MetadataTag label={`${vm.memoryMiB} MiB`} tone="cyan" />
                        ) : (
                          '-'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '磁盘', 'Disk')}>
                        {metadataValues(
                          [
                            vm?.diskGiB ? `${vm.diskGiB} GiB` : '',
                            observation.diskCount
                              ? localeText(
                                  localeCode,
                                  `${observation.diskCount} 块`,
                                  `${observation.diskCount} disks`,
                                )
                              : '',
                          ].filter(Boolean),
                          'gold',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(localeCode, '网卡', 'Network interfaces')}
                      >
                        {observation.networkInterfaceCount
                          ? localeText(
                              localeCode,
                              `${observation.networkInterfaceCount} 个`,
                              `${observation.networkInterfaceCount}`,
                            )
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(localeCode, '固件 / 机型', 'Firmware / Machine')}
                      >
                        {[observation.firmware, observation.machine].filter(Boolean).join(' / ') ||
                          '-'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(localeCode, '操作系统', 'Operating system')}
                      >
                        {observation.osType || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '规格', 'Flavor')}>
                        {vm?.flavorName || vm?.flavorId || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '镜像', 'Image')}>
                        {metadataValues(
                          [
                            detail?.image?.name || vm?.bootImageName || vm?.bootImageId || '',
                          ].filter(Boolean),
                          'blue',
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  </section>

                  <section className="soha-vrt-vm-detail-section">
                    <h2>{localeText(localeCode, '网络与身份', 'Network and identity')}</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label={localeText(localeCode, '主机名', 'Hostname')}>
                        {observation.hostname || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="FQDN">{observation.fqdn || '-'}</Descriptions.Item>
                      <Descriptions.Item label="IP">
                        {metadataValues(vm?.ipAddresses ?? [], 'cyan')}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '网络', 'Network')}>
                        {metadataValues(
                          observation.networks.length > 0
                            ? observation.networks
                            : vm?.network
                              ? [vm.network]
                              : [],
                          'blue',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '网关', 'Gateway')}>
                        {observation.gateway || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="DNS">
                        {metadataValues(observation.dnsServers, 'cyan')}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '搜索域', 'Search domains')}>
                        {metadataValues(observation.searchDomains, 'purple')}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, 'DNS 策略', 'DNS policy')}>
                        {observation.dnsPolicy || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Guest Agent">
                        {vm?.provider === 'pve' && observation.guestAgentKnown
                          ? statusTag(observation.guestAgentEnabled ? 'enabled' : 'disabled')
                          : '-'}
                      </Descriptions.Item>
                    </Descriptions>
                    {!vm?.ipAddresses?.length && vm?.provider === 'pve' ? (
                      <Alert
                        className="soha-vrt-vm-address-alert"
                        type="warning"
                        showIcon
                        title={localeText(
                          localeCode,
                          '未获取到运行地址',
                          'Runtime address unavailable',
                        )}
                        description={localeText(
                          localeCode,
                          '静态 Cloud-Init 地址可直接识别；DHCP 地址需要 PVE 的 QEMU Guest Agent 正常运行后上报。',
                          'Static Cloud-Init addresses are detected directly. DHCP addresses require a running PVE QEMU Guest Agent.',
                        )}
                      />
                    ) : null}
                  </section>

                  <section className="soha-vrt-vm-detail-section">
                    <h2>{localeText(localeCode, '初始化与来源', 'Initialization and source')}</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label="Cloud-Init">
                        {observation.cloudInitKnown
                          ? statusTag(
                              observation.cloudInitConfigured ? 'configured' : 'not configured',
                            )
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(localeCode, '初始化用户', 'Initialization user')}
                      >
                        {observation.cloudInitUser || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '来源模式', 'Source mode')}>
                        {displayValue(
                          observation.cloudInitSource || vm?.sourceMode,
                          SOURCE_MODE_LABELS,
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="User Data">
                        {observation.cloudInitUserDataConfigured ? statusTag('configured') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="SSH Key">
                        {observation.sshKeysConfigured ? statusTag('configured') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(localeCode, '来源引用', 'Source reference')}
                      >
                        {vm?.sourceRef || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '资产类型', 'Asset type')}>
                        {displayValue(
                          detail?.image?.assetKind || detail?.image?.sourceKind,
                          ASSET_KIND_LABELS,
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={localeText(
                          localeCode,
                          'StorageClass / 存储',
                          'StorageClass / Storage',
                        )}
                      >
                        {detail?.image
                          ? [detail.image.storageClass, detail.image.storage]
                              .filter(Boolean)
                              .join(' / ') || '-'
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={localeText(localeCode, '时间', 'Time')}>
                        {formatDateTime(vm?.createdAt)} / {formatDateTime(vm?.updatedAt)}
                      </Descriptions.Item>
                    </Descriptions>
                  </section>
                </Card>
                <Collapse
                  size="small"
                  items={[
                    {
                      key: 'provider',
                      label: localeText(localeCode, '高级信息', 'Advanced information'),
                      children: (
                        <pre className="max-h-[520px] overflow-auto bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
                          {providerRaw ||
                            localeText(localeCode, '暂无提供方原始数据', 'No raw provider data')}
                        </pre>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'relations',
            label: localeText(localeCode, '资源关系', 'Relations'),
            children: (
              <Card size="small">
                <ComputeRelationsPanel domain="virtualization" kind="vm" resourceId={vmId} />
              </Card>
            ),
          },
          {
            key: 'operations',
            label: localeText(localeCode, '任务历史', 'Task history'),
            forceRender: true,
            children: (
              <Card size="small">
                <VirtualizationAdminTable
                  rowKey="id"
                  dataSource={sortedOperations}
                  pageSize={10}
                  enableDensity={false}
                  showColumnSettings={false}
                  showRefresh={false}
                  columns={[
                    {
                      title: localeText(localeCode, '类型', 'Type'),
                      render: (_value: unknown, record: VirtualizationOperation) =>
                        tableTooltipText(operationKindLabel(record, localeCode)),
                      ellipsis: tableEllipsis,
                      width: 150,
                    },
                    {
                      title: localeText(localeCode, '状态', 'Status'),
                      dataIndex: 'status',
                      render: statusTag,
                      width: 120,
                    },
                    {
                      title: localeText(localeCode, '消息', 'Message'),
                      dataIndex: 'message',
                      render: (value: string) => tableTooltipText(value || '-'),
                      ellipsis: tableEllipsis,
                      width: 320,
                    },
                    {
                      title: localeText(localeCode, '时间', 'Time'),
                      render: (_value: unknown, record: VirtualizationOperation) =>
                        tableTooltipText(formatDateTime(operationTime(record))),
                      ellipsis: tableEllipsis,
                      width: 180,
                    },
                    {
                      ...tableColumnPresets.action,
                      title: localeText(localeCode, '操作', 'Actions'),
                      render: () => (
                        <ManagementIconButton
                          aria-label={localeText(
                            localeCode,
                            '发起 AI 调查',
                            'Start AI investigation',
                          )}
                          tooltip={localeText(localeCode, 'AI调查', 'AI investigation')}
                          icon={<PlayCircleOutlined />}
                          size="small"
                          onClick={() =>
                            navigate(
                              buildInvestigationPath({
                                connectionId: vm?.connectionId,
                                vmId: vm?.id,
                                namespace: vm?.namespace,
                                workload: vm?.name,
                                timeRangeMinutes: 60,
                              }),
                            )
                          }
                        />
                      ),
                      width: 100,
                    },
                  ]}
                  scroll={{ x: 870 }}
                />
              </Card>
            ),
          },
          {
            key: 'logs',
            label: localeText(localeCode, '日志', 'Logs'),
            forceRender: true,
            children: (
              <Card size="small">
                <pre className="max-h-[520px] overflow-auto bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
                  {(detail?.logs ?? [])
                    .map(
                      (item) =>
                        `[${formatDateTime(item.createdAt)}] ${item.logLevel ?? 'info'} ${item.message}`,
                    )
                    .join('\n') || localeText(localeCode, '暂无日志', 'No logs')}
                </pre>
              </Card>
            ),
          },
          canViewMetrics
            ? {
                key: 'metrics',
                label: localeText(localeCode, '监控指标', 'Metrics'),
                children: isRunning ? (
                  activeTab === 'metrics' ? (
                    <Suspense
                      fallback={
                        <Card size="small">
                          <Spin
                            description={localeText(
                              localeCode,
                              '正在加载监控指标...',
                              'Loading metrics...',
                            )}
                          />
                        </Card>
                      }
                    >
                      <VMMetricsPanel
                        range={metricsRange}
                        vmId={vmId}
                        onRangeChange={setMetricsRange}
                      />
                    </Suspense>
                  ) : null
                ) : (
                  <Card size="small">
                    <ManagementState
                      bordered={false}
                      compact
                      kind="unsupported"
                      title={localeText(localeCode, 'VM 未运行', 'VM is not running')}
                      description={localeText(
                        localeCode,
                        'VM 进入运行状态后才能采集指标数据。',
                        'Metrics are available while the VM is running.',
                      )}
                    />
                  </Card>
                ),
              }
            : null,
          canAccessConsole
            ? {
                key: 'console',
                label: localeText(localeCode, '控制台', 'Console'),
                children: isRunning ? (
                  <Suspense
                    fallback={
                      <Card size="small">
                        <Spin
                          description={localeText(
                            localeCode,
                            '正在加载控制台...',
                            'Loading console...',
                          )}
                        />
                      </Card>
                    }
                  >
                    <VMConsole vmId={vmId} />
                  </Suspense>
                ) : (
                  <Card size="small">
                    <ManagementState
                      bordered={false}
                      compact
                      kind="unsupported"
                      title={localeText(localeCode, 'VM 未运行', 'VM is not running')}
                      description={localeText(
                        localeCode,
                        'VM 进入运行状态后才能访问控制台。',
                        'The console is available while the VM is running.',
                      )}
                    />
                  </Card>
                ),
              }
            : null,
        ].filter((item): item is NonNullable<typeof item> => item !== null)}
      />
    </div>
  )
}
