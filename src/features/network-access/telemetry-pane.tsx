import { useQuery } from '@tanstack/react-query'
import { Card, Space, Statistic, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { ApiOutlined, DownloadOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import type {
  NetworkProxyFlowSummary,
  NetworkTelemetryProducer,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { networkAccessQueries } from './queries'
import { TablePane } from './table-pane'

const FILTER = { limit: 100 } as const

interface NetworkTelemetryPaneProps {
  proxyOnly?: boolean
}

interface ProxyConnectionRow extends NetworkProxyFlowSummary {
  deviceId: string
  deviceName: string
  id: string
  ownerUserId: string
  profileName: string
}

export function NetworkProxyOverviewPane() {
  return <NetworkTelemetryPane proxyOnly />
}

export function NetworkTelemetryPane({ proxyOnly = false }: NetworkTelemetryPaneProps = {}) {
  const { t } = useI18n()
  const telemetry = useQuery(networkAccessQueries.telemetrySummary(FILTER))
  const summary = telemetry.data
  const window = summary
    ? `${formatDateTime(summary.from)} — ${formatDateTime(summary.to)}`
    : t('networkAccess.telemetry.lastHour', '最近 1 小时')
  const metrics = proxyOnly
    ? [
        {
          icon: <ApiOutlined />,
          label: t('networkAccess.proxyOverview.reports', '代理上报'),
          value: summary?.proxyFlowCount ?? 0,
          helper: `${new Set(summary?.proxyFlows.map((item) => item.producerId) ?? []).size} ${t('networkAccess.proxyOverview.endpoints', '个活跃终端')}`,
        },
        {
          icon: <UploadOutlined />,
          label: t('networkAccess.telemetry.upload', '上传'),
          value: `${(summary?.uploadBytes ?? 0).toLocaleString()} B`,
        },
        {
          icon: <DownloadOutlined />,
          label: t('networkAccess.telemetry.download', '下载'),
          value: `${(summary?.downloadBytes ?? 0).toLocaleString()} B`,
        },
        {
          icon: <ApiOutlined />,
          label: t('networkAccess.telemetry.connections', '活动连接'),
          value: summary?.activeConnections ?? 0,
        },
      ]
    : [
        {
          icon: <ApiOutlined />,
          label: t('networkAccess.telemetry.events', '遥测事件'),
          value: summary?.eventCount ?? 0,
          helper: `${t('networkAccess.telemetry.heartbeats', '心跳')} ${summary?.heartbeatCount ?? 0} · RADIUS ${summary?.radiusAccountingCount ?? 0}`,
        },
        {
          icon: <UploadOutlined />,
          label: t('networkAccess.telemetry.upload', '上传'),
          value: `${(summary?.uploadBytes ?? 0).toLocaleString()} B`,
        },
        {
          icon: <DownloadOutlined />,
          label: t('networkAccess.telemetry.download', '下载'),
          value: `${(summary?.downloadBytes ?? 0).toLocaleString()} B`,
        },
        {
          icon: <ApiOutlined />,
          label: t('networkAccess.telemetry.connections', '活动连接'),
          value: summary?.activeConnections ?? 0,
          helper: `${t('networkAccess.telemetry.proxyFlows', '代理流量组')} ${summary?.proxyFlowCount ?? 0}`,
        },
      ]

  const producerColumns: TableColumnsType<NetworkTelemetryProducer> = [
    { title: t('networkAccess.telemetry.producerId', '生产者 ID'), dataIndex: 'producerId' },
    {
      title: t('networkAccess.telemetry.producerKind', '类型'),
      dataIndex: 'producerKind',
      width: 150,
    },
    {
      title: t('networkAccess.telemetry.lastSeen', '最近上报'),
      dataIndex: 'lastSeenAt',
      width: 190,
      render: formatDateTime,
    },
    { title: t('networkAccess.telemetry.gaps', '序列缺口'), dataIndex: 'gapCount', width: 120 },
    {
      title: t('networkAccess.telemetry.regressions', '序列回退'),
      dataIndex: 'regressionCount',
      width: 120,
    },
  ]
  const proxyColumns: TableColumnsType<NetworkProxyFlowSummary> = [
    { title: t('networkAccess.telemetry.producerId', '生产者 ID'), dataIndex: 'producerId' },
    { title: t('networkAccess.telemetry.profileId', '配置 ID'), dataIndex: 'profileId' },
    { title: t('networkAccess.mode', '访问形态'), dataIndex: 'mode', width: 160 },
    {
      title: t('networkAccess.telemetry.selectedProxy', '代理节点'),
      dataIndex: 'selectedProxy',
    },
    {
      title: t('networkAccess.telemetry.upload', '上传'),
      dataIndex: 'uploadBytes',
      width: 110,
      render: (value: number) => `${value.toLocaleString()} B`,
    },
    {
      title: t('networkAccess.telemetry.download', '下载'),
      dataIndex: 'downloadBytes',
      width: 110,
      render: (value: number) => `${value.toLocaleString()} B`,
    },
    {
      title: t('networkAccess.telemetry.connections', '活动连接'),
      dataIndex: 'activeConnections',
      width: 120,
    },
    {
      title: t('networkAccess.telemetry.lastSeen', '最近上报'),
      dataIndex: 'lastOccurredAt',
      width: 190,
      render: formatDateTime,
    },
  ]

  if (telemetry.isError) return <ManagementState kind="error" />

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <ManagementTableToolbar>
        <Typography.Text type="secondary">{window}</Typography.Text>
        <ManagementIconButton
          aria-label={t('networkAccess.refresh', '刷新')}
          icon={<ReloadOutlined />}
          loading={telemetry.isFetching}
          tooltip={t('networkAccess.refresh', '刷新')}
          onClick={() => void telemetry.refetch()}
        />
      </ManagementTableToolbar>
      <div className="soha-overview-metric-grid">
        {metrics.map((metric) => (
          <Card key={metric.label} size="small" loading={telemetry.isLoading}>
            <Statistic title={metric.label} value={metric.value} prefix={metric.icon} />
            {metric.helper ? (
              <Typography.Text type="secondary">{metric.helper}</Typography.Text>
            ) : null}
          </Card>
        ))}
      </div>
      {!proxyOnly ? (
        <AdminTable
          columns={producerColumns}
          dataSource={summary?.producers ?? []}
          loading={telemetry.isLoading}
          localSorting
          rowKey="producerId"
          title={t('networkAccess.telemetry.producers', '遥测生产者')}
        />
      ) : null}
      <AdminTable
        columns={proxyColumns}
        dataSource={summary?.proxyFlows ?? []}
        loading={telemetry.isLoading}
        localSorting
        rowKey={(item) => `${item.producerId}:${item.profileId}:${item.mode}:${item.selectedProxy}`}
        title={
          proxyOnly
            ? t('networkAccess.proxyOverview.traffic', '代理流量')
            : t('networkAccess.telemetry.proxyFlows', '代理流量组')
        }
      />
    </Space>
  )
}

export function NetworkProxyConnectionsPane({
  canViewDevices,
  canViewProfiles,
}: {
  canViewDevices: boolean
  canViewProfiles: boolean
}) {
  const { t } = useI18n()
  const enabled = canViewDevices && canViewProfiles
  const telemetry = useQuery(networkAccessQueries.telemetrySummary(FILTER, enabled))
  const profiles = useQuery(networkAccessQueries.mihomoProfiles({ limit: 200 }, enabled))
  const devices = useQuery(networkAccessQueries.devices({ limit: 200 }, enabled))

  if (!enabled) {
    return (
      <ManagementState
        kind="no-permission"
        description={t(
          'networkAccess.proxyConnections.permission',
          '查看用户连接还需要代理隧道与终端资产查看权限。',
        )}
      />
    )
  }

  const profilesById = new Map((profiles.data ?? []).map((item) => [item.id, item]))
  const devicesById = new Map((devices.data ?? []).map((item) => [item.id, item]))
  const rows: ProxyConnectionRow[] = (telemetry.data?.proxyFlows ?? []).map((flow) => {
    const profile = profilesById.get(flow.profileId)
    const device = profile ? devicesById.get(profile.deviceId) : undefined
    return {
      ...flow,
      id: `${flow.producerId}:${flow.profileId}:${flow.mode}:${flow.selectedProxy}`,
      profileName: profile?.name ?? flow.profileId,
      deviceId: profile?.deviceId ?? '',
      deviceName: device?.name ?? profile?.deviceId ?? '-',
      ownerUserId: device?.ownerUserId ?? '-',
    }
  })
  const columns: TableColumnsType<ProxyConnectionRow> = [
    { title: t('networkAccess.owner', '用户'), dataIndex: 'ownerUserId' },
    { title: t('networkAccess.proxyConnections.endpoint', '终端'), dataIndex: 'deviceName' },
    { title: t('networkAccess.proxyConnections.profile', '代理配置'), dataIndex: 'profileName' },
    {
      title: t('networkAccess.telemetry.selectedProxy', '代理节点'),
      dataIndex: 'selectedProxy',
    },
    {
      title: t('networkAccess.telemetry.connections', '活动连接'),
      dataIndex: 'activeConnections',
      width: 120,
      render: (value: number) => (
        <Tag color={value > 0 ? 'green' : 'default'}>
          {value > 0
            ? t('networkAccess.proxyConnections.connected', '连接中')
            : t('networkAccess.proxyConnections.recent', '最近使用')}{' '}
          · {value}
        </Tag>
      ),
    },
    {
      title: t('networkAccess.telemetry.upload', '上传'),
      dataIndex: 'uploadBytes',
      width: 110,
      render: (value: number) => `${value.toLocaleString()} B`,
    },
    {
      title: t('networkAccess.telemetry.download', '下载'),
      dataIndex: 'downloadBytes',
      width: 110,
      render: (value: number) => `${value.toLocaleString()} B`,
    },
    {
      title: t('networkAccess.telemetry.lastSeen', '最近上报'),
      dataIndex: 'lastOccurredAt',
      width: 190,
      render: formatDateTime,
    },
  ]

  return (
    <TablePane
      columns={columns}
      items={rows}
      loading={telemetry.isLoading || profiles.isLoading || devices.isLoading}
      refreshing={telemetry.isFetching || profiles.isFetching || devices.isFetching}
      error={telemetry.isError || profiles.isError || devices.isError}
      onRefresh={() => {
        void telemetry.refetch()
        void profiles.refetch()
        void devices.refetch()
      }}
      searchPlaceholder={t(
        'networkAccess.proxyConnections.search',
        '搜索用户、终端、配置或代理节点',
      )}
      getSearchValues={(item) => [
        item.ownerUserId,
        item.deviceId,
        item.deviceName,
        item.profileId,
        item.profileName,
        item.selectedProxy,
        item.producerId,
      ]}
    />
  )
}
