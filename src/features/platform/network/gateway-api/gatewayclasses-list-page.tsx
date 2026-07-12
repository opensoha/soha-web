import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { buildGatewayAPIRoutePath } from '../shared/paths'
import { NetworkResourceListPage } from '../shared/list-page'
import { gatewayAPIQueries } from './queries'
import type { GatewayClass } from './types'

export function NetworkGatewayClassesPage() {
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const query = useQuery(
    gatewayAPIQueries.list<GatewayClass>('gatewayclasses', toScopeKey(clusterId, null)),
  )
  const columns: TableColumnsType<GatewayClass> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(buildGatewayAPIRoutePath('gatewayclasses', value))}
        >
          {value}
        </Button>
      ),
    },
    { title: 'Controller', dataIndex: 'controllerName', render: (value?: string) => value || '-' },
    {
      title: 'Accepted',
      dataIndex: 'accepted',
      width: 120,
      render: (value?: string) => (value ? <StatusTag value={value} /> : '-'),
    },
    { title: 'Parameters', dataIndex: 'parametersRef', render: (value?: string) => value || '-' },
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
        sourceRoute: '/network/gateway-api/gatewayclasses',
        sourceTitle: 'GatewayClasses',
        entityKind: 'kubernetes.gatewayclass.list',
        entityName: 'GatewayClasses',
        clusterId: clusterId ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 GatewayClass，或未安装 Gateway API CRD',
        en_US: 'No GatewayClasses in this cluster, or Gateway API CRDs are not installed',
      }}
      kind="gatewayclasses"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      rowKey="name"
      searchPlaceholder={{
        zh_CN: '搜索 GatewayClass / controller',
        en_US: 'Search GatewayClass / controller',
      }}
      searchValues={(record) => [
        record.name,
        record.controllerName,
        record.accepted,
        record.parametersRef,
      ]}
    />
  )
}
