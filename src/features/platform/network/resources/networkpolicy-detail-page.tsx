import { useState } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { renderNetworkTextList } from '../shared/renderers'
import { resolveNetworkNamespace } from '../shared/scope'
import { networkCoreQueries } from './queries'
import type { NetworkPolicy } from './types'

export function NetworkPolicyDetailPage() {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const [searchParams] = useSearchParams()
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(networkCoreQueries.detail<NetworkPolicy>('networkpolicies', scope, name))
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
          description={localeCode === 'zh_CN' ? 'NetworkPolicy 未找到' : 'NetworkPolicy not found'}
        />
      </div>
    )
  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      detail={detail}
      kind="networkpolicies"
      label="NetworkPolicy"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Policy Types', value: renderNetworkTextList(detail.policyTypes) },
        { key: 'Ingress Rules', value: detail.ingressRules },
        { key: 'Egress Rules', value: detail.egressRules },
      ]}
      target={{ scope, name }}
    />
  )
}
