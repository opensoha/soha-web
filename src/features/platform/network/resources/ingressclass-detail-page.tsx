import { useState } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { BooleanTag } from '@/components/status-tag'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { networkCoreQueries } from './queries'
import type { IngressClass } from './types'

export function IngressClassDetailPage() {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const scope = toScopeKey(clusterId, null)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(
    networkCoreQueries.detail<IngressClass>('ingressclasses', scope, name, true),
  )
  const detail = query.data
  if (!clusterId)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
        />
      </div>
    )
  if (query.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'IngressClass 未找到' : 'IngressClass not found'}
        />
      </div>
    )
  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      clusterScoped
      detail={detail}
      kind="ingressclasses"
      label="IngressClass"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Controller', value: detail.controller || '-' },
        {
          key: 'Default',
          value: <BooleanTag value={detail.isDefault} trueLabel="Yes" falseLabel="No" />,
        },
        { key: 'Parameters', value: detail.parameters || '-' },
      ]}
      target={{ scope, name }}
    />
  )
}
