import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { encodeAIContextForElement } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { buildNetworkRoutePath } from '../shared/paths'
import { NetworkResourceListPage } from '../shared/list-page'
import { serviceQueries } from './queries'
import type { Service } from './types'

export function NetworkServicesPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, namespace)
  const query = useQuery(serviceQueries.list(scope))
  const columns: TableColumnsType<Service> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() => navigate(buildNetworkRoutePath('services', value, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace' },
    { title: '类型', dataIndex: 'type' },
    { title: 'Cluster IP', dataIndex: 'clusterIp', render: (value: string) => value || '-' },
    { title: '端口', dataIndex: 'ports', render: (value: string[]) => value?.join(', ') || '-' },
    { title: 'Age', dataIndex: 'ageSeconds', render: (value: number) => formatAgeSeconds(value) },
  ]

  return (
    <NetworkResourceListPage
      buildAIPageContext={(items, searchKeyword) => ({
        sourceWorkbench: 'platform',
        sourceRoute: '/network/services',
        sourceTitle: localeCode === 'zh_CN' ? 'Services 列表' : 'Services',
        entityKind: 'kubernetes.service.list',
        entityName: 'Services',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        timeRangeMinutes: 60,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
        promptHint: '分析当前 Service 列表的类型、端口、ClusterIP、后端 Pod 和事件风险。',
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 Service',
        en_US: 'No services in the current scope',
      }}
      kind="services"
      noMatchDescription={{ zh_CN: '没有匹配的 Service', en_US: 'No matching services' }}
      onRow={(record) => ({
        'data-ai-context': encodeAIContextForElement({
          sourceWorkbench: 'platform',
          sourceRoute: buildNetworkRoutePath('services', record.name, record.namespace),
          sourceTitle: `Service ${record.name}`,
          entityKind: 'kubernetes.service',
          entityName: record.name,
          clusterId: clusterId ?? undefined,
          namespace: record.namespace,
          service: record.name,
          timeRangeMinutes: 60,
        }),
      })}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 Service / namespace / type / port',
        en_US: 'Search service / namespace / type / port',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.type,
        record.clusterIp,
        ...record.ports,
      ]}
    />
  )
}
