import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BooleanTag } from '@/components/status-tag'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { NetworkResourceListPage } from '../shared/list-page'
import { buildNetworkRoutePath } from '../shared/paths'
import { networkCoreQueries } from './queries'
import type { IngressClass } from './types'

export function NetworkIngressClassesPage() {
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const query = useQuery(
    networkCoreQueries.list<IngressClass>('ingressclasses', toScopeKey(clusterId, null)),
  )
  const columns: TableColumnsType<IngressClass> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(buildNetworkRoutePath('ingressclasses', value, ''))}
        >
          {value}
        </Button>
      ),
    },
    { title: 'Controller', dataIndex: 'controller' },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      width: 110,
      render: (value: boolean) => <BooleanTag value={value} trueLabel="Yes" falseLabel="No" />,
    },
    { title: 'Parameters', dataIndex: 'parameters', render: (value?: string) => value || '-' },
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
        sourceRoute: '/network/ingressclasses',
        sourceTitle: 'IngressClasses',
        entityKind: 'kubernetes.ingressclass.list',
        entityName: 'IngressClasses',
        clusterId: clusterId ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 IngressClass',
        en_US: 'No IngressClasses in this cluster',
      }}
      kind="ingressclasses"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      rowKey="name"
      searchPlaceholder={{
        zh_CN: '搜索 IngressClass / controller',
        en_US: 'Search IngressClass / controller',
      }}
      searchValues={(record) => [record.name, record.controller, record.parameters]}
    />
  )
}
