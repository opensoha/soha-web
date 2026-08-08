import { lazy, Suspense, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Space,
  Spin,
  Tabs,
  Tooltip,
  Typography,
} from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { getAIWorkbenchPathForMode, useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import { VirtualizationAdminTable } from '@/features/virtualization/shared/ui'
import {
  isAbnormalOperation,
  isStaleVirtualMachine,
  latestNonEmptyOperationMessage,
  operationKind,
  operationTime,
  stringifyRaw,
  virtualMachineDisplayStatus,
  virtualMachineObservation,
} from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type { VirtualizationOperation } from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const tableEllipsis = { showTitle: false } as const

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
  const { virtualizationModuleEnabled, canViewMetrics, canAccessConsole } =
    useVirtualizationPermissions()
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
  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: vm?.name ? `虚拟机 ${vm.name}` : '虚拟机详情',
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
            title="未找到虚拟机详情"
            description="目标虚拟机不存在，或当前账号无法访问该资源。"
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
            label: '概览',
            children: (
              <div className="soha-detail-stack">
                {latestAbnormalOperation ? (
                  <Alert
                    type="error"
                    showIcon
                    title={`最近异常任务：${operationKind(latestAbnormalOperation)}`}
                    description={latestNonEmptyOperationMessage(latestAbnormalOperation)}
                    action={
                      <Space>
                        <Button size="small" onClick={() => setActiveTab('operations')}>
                          查看任务历史
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
                          AI调查
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

                  <section className="soha-vrt-vm-detail-section">
                    <h2>运行与硬件</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label="位置">
                        {metadataValues(
                          [vm?.namespace, vm?.node].filter(Boolean) as string[],
                          'purple',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="CPU">
                        {vm?.cpu ? <MetadataTag label={`${vm.cpu} vCPU`} tone="purple" /> : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="内存">
                        {vm?.memoryMiB ? (
                          <MetadataTag label={`${vm.memoryMiB} MiB`} tone="cyan" />
                        ) : (
                          '-'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="磁盘">
                        {metadataValues(
                          [
                            vm?.diskGiB ? `${vm.diskGiB} GiB` : '',
                            observation.diskCount ? `${observation.diskCount} 块` : '',
                          ].filter(Boolean),
                          'gold',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="网卡">
                        {observation.networkInterfaceCount
                          ? `${observation.networkInterfaceCount} 个`
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="固件 / 机型">
                        {[observation.firmware, observation.machine].filter(Boolean).join(' / ') ||
                          '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="操作系统">
                        {observation.osType || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="规格">
                        {vm?.flavorName || vm?.flavorId || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="镜像">
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
                    <h2>网络与身份</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label="主机名">
                        {observation.hostname || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="FQDN">{observation.fqdn || '-'}</Descriptions.Item>
                      <Descriptions.Item label="IP">
                        {metadataValues(vm?.ipAddresses ?? [], 'cyan')}
                      </Descriptions.Item>
                      <Descriptions.Item label="网络">
                        {metadataValues(
                          observation.networks.length > 0
                            ? observation.networks
                            : vm?.network
                              ? [vm.network]
                              : [],
                          'blue',
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="网关">
                        {observation.gateway || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="DNS">
                        {metadataValues(observation.dnsServers, 'cyan')}
                      </Descriptions.Item>
                      <Descriptions.Item label="搜索域">
                        {metadataValues(observation.searchDomains, 'purple')}
                      </Descriptions.Item>
                      <Descriptions.Item label="DNS 策略">
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
                        title="未获取到运行地址"
                        description="静态 Cloud-Init 地址可直接识别；DHCP 地址需要 PVE 的 QEMU Guest Agent 正常运行后上报。"
                      />
                    ) : null}
                  </section>

                  <section className="soha-vrt-vm-detail-section">
                    <h2>初始化与来源</h2>
                    <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
                      <Descriptions.Item label="Cloud-Init">
                        {observation.cloudInitKnown
                          ? statusTag(
                              observation.cloudInitConfigured ? 'configured' : 'not configured',
                            )
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="初始化用户">
                        {observation.cloudInitUser || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="来源模式">
                        {observation.cloudInitSource || vm?.sourceMode || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="User Data">
                        {observation.cloudInitUserDataConfigured ? statusTag('configured') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="SSH Key">
                        {observation.sshKeysConfigured ? statusTag('configured') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="来源引用">{vm?.sourceRef || '-'}</Descriptions.Item>
                      <Descriptions.Item label="资产类型">
                        {detail?.image?.assetKind || detail?.image?.sourceKind || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="StorageClass / 存储">
                        {detail?.image
                          ? [detail.image.storageClass, detail.image.storage]
                              .filter(Boolean)
                              .join(' / ') || '-'
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="时间">
                        {formatDateTime(vm?.createdAt)} / {formatDateTime(vm?.updatedAt)}
                      </Descriptions.Item>
                    </Descriptions>
                  </section>
                </Card>
                <Card size="small" title="Provider 摘要" className="soha-management-panel-card">
                  <pre className="max-h-[520px] overflow-auto rounded border border-[var(--soha-border-color)] bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
                    {providerRaw || '暂无 provider raw 数据'}
                  </pre>
                </Card>
              </div>
            ),
          },
          {
            key: 'operations',
            label: '任务历史',
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
                      title: '类型',
                      render: (_value: unknown, record: VirtualizationOperation) =>
                        tableTooltipText(operationKind(record)),
                      ellipsis: tableEllipsis,
                      width: 150,
                    },
                    { title: '状态', dataIndex: 'status', render: statusTag, width: 120 },
                    {
                      title: '消息',
                      dataIndex: 'message',
                      render: (value: string) => tableTooltipText(value || '-'),
                      ellipsis: tableEllipsis,
                      width: 320,
                    },
                    {
                      title: '时间',
                      render: (_value: unknown, record: VirtualizationOperation) =>
                        tableTooltipText(formatDateTime(operationTime(record))),
                      ellipsis: tableEllipsis,
                      width: 180,
                    },
                    {
                      ...tableColumnPresets.action,
                      title: '操作',
                      render: () => (
                        <ManagementIconButton
                          aria-label="发起 AI 调查"
                          tooltip="AI调查"
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
            label: '日志',
            forceRender: true,
            children: (
              <Card size="small">
                <pre className="max-h-[520px] overflow-auto rounded border border-[var(--soha-border-color)] bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
                  {(detail?.logs ?? [])
                    .map(
                      (item) =>
                        `[${formatDateTime(item.createdAt)}] ${item.logLevel ?? 'info'} ${item.message}`,
                    )
                    .join('\n') || '暂无日志'}
                </pre>
              </Card>
            ),
          },
          canViewMetrics
            ? {
                key: 'metrics',
                label: '监控指标',
                children: isRunning ? (
                  activeTab === 'metrics' ? (
                    <Suspense
                      fallback={
                        <Card size="small">
                          <Spin description="正在加载监控指标..." />
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
                      title="VM 未运行"
                      description="VM 进入运行状态后才能采集指标数据。"
                    />
                  </Card>
                ),
              }
            : null,
          canAccessConsole
            ? {
                key: 'console',
                label: '控制台',
                children: isRunning ? (
                  <Suspense
                    fallback={
                      <Card size="small">
                        <Spin description="正在加载控制台..." />
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
                      title="VM 未运行"
                      description="VM 进入运行状态后才能访问控制台。"
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
