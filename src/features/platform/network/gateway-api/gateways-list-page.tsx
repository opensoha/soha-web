import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { buildGatewayAPIRoutePath } from '../shared/paths'
import { NetworkResourceListPage } from '../shared/list-page'
import { renderNetworkTextList } from '../shared/renderers'
import { gatewayAPIQueries } from './queries'
import type { Gateway } from './types'

export function NetworkGatewaysPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const query = useQuery(
    gatewayAPIQueries.list<Gateway>('gateways', toScopeKey(clusterId, namespace)),
  )
  const columns: TableColumnsType<Gateway> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() => navigate(buildGatewayAPIRoutePath('gateways', value, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'GatewayClass',
      dataIndex: 'gatewayClass',
      width: 160,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Addresses',
      dataIndex: 'addresses',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
    { title: 'Listeners', dataIndex: 'listenerCount', width: 110 },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage
      buildAIPageContext={(items, searchKeyword) => ({
        sourceWorkbench: 'platform',
        sourceRoute: '/network/gateway-api/gateways',
        sourceTitle: 'Gateways',
        entityKind: 'kubernetes.gateway.list',
        entityName: 'Gateways',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 Gateway，或未安装 Gateway API CRD',
        en_US: 'No Gateways in the current scope, or Gateway API CRDs are not installed',
      }}
      kind="gateways"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 Gateway / namespace / class / address',
        en_US: 'Search gateway / namespace / class / address',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.gatewayClass,
        ...(record.addresses ?? []),
      ]}
    />
  )
}
