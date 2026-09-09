import { Descriptions, Drawer, Tabs } from 'antd'
import type { TableColumnsType } from 'antd'
import type {
  EndpointDevice,
  EndpointDeviceOwnershipType,
  EndpointDeviceType,
  EndpointNetworkInterface,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import type { LocaleCode } from '@/i18n'
import { formatDateTime } from '@/utils/time'

const DEVICE_TYPE_LABELS: Record<EndpointDeviceType, [string, string]> = {
  desktop: ['台式机', 'Desktop'],
  laptop: ['笔记本', 'Laptop'],
  server: ['服务器', 'Server'],
  mobile: ['手机', 'Mobile'],
  tablet: ['平板', 'Tablet'],
  virtual: ['虚拟终端', 'Virtual'],
  unknown: ['未识别', 'Unknown'],
}

const OWNERSHIP_LABELS: Record<EndpointDeviceOwnershipType, [string, string]> = {
  company: ['公司设备', 'Company'],
  personal: ['个人设备', 'Personal'],
  temporary: ['临时办公设备', 'Temporary'],
  unassigned: ['未分类设备', 'Unassigned'],
}

function localeLabel(labels: [string, string], localeCode: LocaleCode) {
  return labels[localeCode === 'en_US' ? 1 : 0]
}

export function endpointDeviceTypeLabel(
  value: EndpointDeviceType | undefined,
  localeCode: LocaleCode,
) {
  return localeLabel(DEVICE_TYPE_LABELS[value ?? 'unknown'], localeCode)
}

export function endpointOwnershipLabel(
  value: EndpointDeviceOwnershipType | undefined,
  localeCode: LocaleCode,
) {
  return localeLabel(OWNERSHIP_LABELS[value ?? 'unassigned'], localeCode)
}

function join(values?: string[]) {
  return values?.join(', ') || '-'
}

export function EndpointDeviceDetailDrawer({
  device,
  onClose,
}: {
  device: EndpointDevice | null
  onClose: () => void
}) {
  const { localeCode, t } = useI18n()
  if (!device) return null

  const facts = device.reportedFacts
  const networkColumns: TableColumnsType<EndpointNetworkInterface> = [
    {
      title: t('networkAccess.device.interfaceName', '网卡名称'),
      dataIndex: 'name',
      width: 140,
      render: (value, record) => record.displayName || value,
    },
    {
      title: t('networkAccess.kind', '类型'),
      dataIndex: 'kind',
      width: 100,
      render: (value) => <MetadataTag label={value} />,
    },
    {
      title: t('networkAccess.status', '状态'),
      dataIndex: 'status',
      width: 90,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'MAC', dataIndex: 'macAddress', width: 160, render: (value) => value || '-' },
    { title: 'IPv4', dataIndex: 'ipv4Addresses', width: 180, render: join },
    { title: 'IPv6', dataIndex: 'ipv6Addresses', width: 240, render: join },
    { title: 'DNS', dataIndex: 'dnsServers', width: 180, render: join },
  ]

  const basicItems = [
    { key: 'id', label: t('networkAccess.device.id', '终端 ID'), children: device.id },
    {
      key: 'hostname',
      label: t('networkAccess.device.hostname', '主机名'),
      children: device.hostname || device.name,
    },
    {
      key: 'deviceType',
      label: t('networkAccess.device.type', '终端类型'),
      children: endpointDeviceTypeLabel(device.deviceType, localeCode),
    },
    {
      key: 'ownershipType',
      label: t('networkAccess.device.ownership', '设备归属'),
      children: endpointOwnershipLabel(device.ownershipType, localeCode),
    },
    { key: 'owner', label: t('networkAccess.owner', '用户'), children: device.ownerUserId },
    { key: 'site', label: t('networkAccess.siteId', '站点 ID'), children: device.siteId || '-' },
    {
      key: 'status',
      label: t('networkAccess.status', '状态'),
      children: <StatusTag value={device.status} />,
    },
    {
      key: 'posture',
      label: t('networkAccess.posture', '设备状态'),
      children: <StatusTag value={device.postureStatus} />,
    },
    {
      key: 'os',
      label: t('networkAccess.device.os', '操作系统'),
      children: join([facts?.osName, facts?.osVersion].filter(Boolean) as string[]),
    },
    {
      key: 'osBuild',
      label: t('networkAccess.device.osBuild', '系统构建'),
      children: facts?.osBuild || '-',
    },
    {
      key: 'architecture',
      label: t('networkAccess.device.architecture', '架构'),
      children: facts?.architecture || '-',
    },
    {
      key: 'manufacturer',
      label: t('networkAccess.device.manufacturer', '设备品牌'),
      children: facts?.manufacturer || '-',
    },
    {
      key: 'model',
      label: t('networkAccess.device.model', '设备型号'),
      children: facts?.model || '-',
    },
    {
      key: 'serial',
      label: t('networkAccess.device.serial', '序列号'),
      children: facts?.serialNumber || '-',
    },
    {
      key: 'agentVersion',
      label: t('networkAccess.device.agentVersion', 'Soha App 版本'),
      children: facts?.agentVersion || '-',
    },
    {
      key: 'lastSeenAt',
      label: t('networkAccess.device.lastSeen', '最近活跃'),
      children: formatDateTime(device.lastSeenAt),
    },
    {
      key: 'collectedAt',
      label: t('networkAccess.device.collectedAt', '信息采集时间'),
      children: formatDateTime(facts?.collectedAt),
    },
  ]

  return (
    <Drawer destroyOnHidden open size="large" title={device.name} onClose={onClose}>
      <Tabs
        items={[
          {
            key: 'basic',
            label: t('networkAccess.device.basic', '基本信息'),
            children: (
              <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={basicItems} />
            ),
          },
          {
            key: 'network',
            label: t('networkAccess.device.interfaces', '网卡信息'),
            children: (
              <AdminTable
                columnSettingPlacement="hidden"
                columns={networkColumns}
                dataSource={facts?.networkInterfaces ?? []}
                pagination={false}
                rowKey="name"
                scroll={{ x: 1100 }}
              />
            ),
          },
        ]}
      />
    </Drawer>
  )
}
