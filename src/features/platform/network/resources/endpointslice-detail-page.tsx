import { useState } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { resolveNetworkNamespace } from '../shared/scope'
import { networkCoreQueries } from './queries'
import type { EndpointSlice } from './types'

export function EndpointSliceDetailPage() {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const [searchParams] = useSearchParams()
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(networkCoreQueries.detail<EndpointSlice>('endpointslices', scope, name))
  const detail = query.data
  if (!clusterId || !detailNamespace)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  if (query.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'EndpointSlice 未找到' : 'EndpointSlice not found'}
        />
      </div>
    )
  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      detail={detail}
      kind="endpointslices"
      label="EndpointSlice"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Address Type', value: detail.addressType || '-' },
        { key: 'Endpoints', value: detail.endpoints },
        { key: 'Ports', value: detail.ports?.join(', ') || '-' },
      ]}
      target={{ scope, name }}
    />
  )
}
