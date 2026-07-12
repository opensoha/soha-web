import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { NetworkResourceListPage } from '../shared/list-page'
import { buildNetworkRoutePath } from '../shared/paths'
import { networkCoreQueries } from './queries'
import type { EndpointSlice } from './types'

export function NetworkEndpointSlicesPage() {
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const query = useQuery(
    networkCoreQueries.list<EndpointSlice>('endpointslices', toScopeKey(clusterId, namespace)),
  )
  const columns: TableColumnsType<EndpointSlice> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() => navigate(buildNetworkRoutePath('endpointslices', value, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    { title: 'Namespace', dataIndex: 'namespace', width: 160 },
    { title: 'Address Type', dataIndex: 'addressType', width: 130 },
    { title: 'Endpoints', dataIndex: 'endpoints', width: 110 },
    { title: 'Ports', dataIndex: 'ports', render: (value?: string[]) => value?.join(', ') || '-' },
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
        sourceRoute: '/network/endpointslices',
        sourceTitle: 'EndpointSlices',
        entityKind: 'kubernetes.endpointslice.list',
        entityName: 'EndpointSlices',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 EndpointSlice',
        en_US: 'No EndpointSlices in the current scope',
      }}
      kind="endpointslices"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 EndpointSlice / namespace / address type / port',
        en_US: 'Search EndpointSlice / namespace / address type / port',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.addressType,
        ...(record.ports ?? []),
      ]}
    />
  )
}
