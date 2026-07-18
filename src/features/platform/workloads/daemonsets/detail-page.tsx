import { lazy, Suspense, useState } from 'react'
import { Card, Descriptions, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { resolveWorkloadNamespace } from '@/features/platform/workloads-model'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import {
  WorkloadPodsCard,
  WorkloadRelationsCard,
} from '@/features/platform/workloads/shared/workload-relations'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { daemonSetQueries } from './queries'
import type { DaemonSetDetail } from './types'
import '@/features/platform/workloads/styles.css'

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

function DaemonSetOverview({ detail }: { detail: DaemonSetDetail }) {
  const { localeCode } = useI18n()
  return (
    <div className="soha-detail-stack">
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? 'DaemonSet 状态' : 'DaemonSet Status'}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          items={[
            { key: 'desired', label: 'Desired', children: detail.desiredNumber ?? '-' },
            { key: 'current', label: 'Current', children: detail.currentNumber ?? '-' },
            { key: 'ready', label: 'Ready', children: detail.readyNumber ?? '-' },
            { key: 'available', label: 'Available', children: detail.availableNumber ?? '-' },
            { key: 'updated', label: 'Updated', children: detail.updatedNumber ?? '-' },
            {
              key: 'strategy',
              label: localeCode === 'zh_CN' ? '更新策略' : 'Update Strategy',
              children: detail.updateStrategy || '-',
            },
          ]}
        />
      </Card>
      <WorkloadPodsCard pods={detail.pods} namespace={detail.namespace} />
      <WorkloadRelationsCard resources={detail.relatedResources} namespace={detail.namespace} />
    </div>
  )
}

export function DaemonSetDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const daemonSetName = params.daemonSetName as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = resolveWorkloadNamespace(namespace, searchParams.get('namespace'))
  const detailScope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const metricsOptions = daemonSetQueries.metrics(detailScope, daemonSetName)
  const metricsQuery = useQuery({
    ...metricsOptions,
    enabled: Boolean(metricsOptions.enabled) && activeTabKey === 'metrics',
  })
  const eventsOptions = daemonSetQueries.events(detailScope, daemonSetName)
  const eventsQuery = useQuery({
    ...eventsOptions,
    enabled: Boolean(eventsOptions.enabled) && activeTabKey === 'events',
  })

  return (
    <WorkloadDetailShell
      title="DaemonSet"
      resource="daemonsets"
      paramKey="daemonSetName"
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      extraOverview={(detail) => <DaemonSetOverview detail={detail as DaemonSetDetail} />}
      extraTabPanes={[
        {
          key: 'metrics',
          label: localeCode === 'zh_CN' ? '指标' : 'Metrics',
          children: (
            <Suspense
              fallback={
                <Card className="soha-detail-card">
                  <Spin size="large" />
                </Card>
              }
            >
              <ResourceMetricsPanel
                title={localeCode === 'zh_CN' ? 'DaemonSet 指标' : 'DaemonSet Metrics'}
                data={metricsQuery.data}
                loading={metricsQuery.isLoading}
              />
            </Suspense>
          ),
        },
        {
          key: 'events',
          label: localeCode === 'zh_CN' ? '事件' : 'Events',
          children: (
            <ResourceEventsTimeline
              title={localeCode === 'zh_CN' ? 'DaemonSet 事件时间线' : 'DaemonSet Event Timeline'}
              events={eventsQuery.data ?? []}
              loading={eventsQuery.isLoading}
              emptyDescription={
                localeCode === 'zh_CN' ? '当前 DaemonSet 暂无事件' : 'No DaemonSet events'
              }
            />
          ),
        },
      ]}
      yamlLast
    />
  )
}
