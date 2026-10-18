import { ReadFeedback } from '@/components/request-feedback'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { useWorkloadDetailScope } from '@/features/platform/workloads/shared/detail-scope'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import {
  WorkloadPodsCard,
  WorkloadRelationsCard,
} from '@/features/platform/workloads/shared/workload-relations'
import '@/features/platform/workloads/styles.css'
import { useI18n } from '@/i18n'
import { readableQueryData } from '@/utils/query-feedback'
import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Spin } from 'antd'
import { lazy, Suspense, useState } from 'react'
import { useParams } from 'react-router-dom'
import { daemonSetQueries } from './queries'
import type { DaemonSetDetail } from './types'

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
            {
              key: 'desired',
              label: localeCode === 'zh_CN' ? '期望' : 'Desired',
              children: detail.desiredNumber ?? '-',
            },
            {
              key: 'current',
              label: localeCode === 'zh_CN' ? '当前' : 'Current',
              children: detail.currentNumber ?? '-',
            },
            {
              key: 'ready',
              label: localeCode === 'zh_CN' ? '就绪' : 'Ready',
              children: detail.readyNumber ?? '-',
            },
            {
              key: 'available',
              label: localeCode === 'zh_CN' ? '可用' : 'Available',
              children: detail.availableNumber ?? '-',
            },
            {
              key: 'updated',
              label: localeCode === 'zh_CN' ? '已更新' : 'Updated',
              children: detail.updatedNumber ?? '-',
            },
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
  const daemonSetName = params.daemonSetName as string
  const detailScope = useWorkloadDetailScope()
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const metricsOptions = daemonSetQueries.metrics(detailScope, daemonSetName)
  const metricsQuery = useQuery({
    ...metricsOptions,
    enabled: Boolean(metricsOptions.enabled) && activeTabKey === 'metrics',
  })
  const visibleMetricsQueryData =
    Boolean(metricsOptions.enabled) && activeTabKey === 'metrics'
      ? readableQueryData(metricsQuery)
      : undefined
  const eventsOptions = daemonSetQueries.events(detailScope, daemonSetName)
  const eventsQuery = useQuery({
    ...eventsOptions,
    enabled: Boolean(eventsOptions.enabled) && activeTabKey === 'events',
  })
  const visibleEventsQueryData =
    Boolean(eventsOptions.enabled) && activeTabKey === 'events'
      ? readableQueryData(eventsQuery)
      : undefined

  return (
    <>
      <ReadFeedback canRead={metricsQuery.isEnabled} query={metricsQuery} label="资源指标" />
      <ReadFeedback canRead={eventsQuery.isEnabled} query={eventsQuery} label="资源事件" />
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
                  data={visibleMetricsQueryData}
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
                events={visibleEventsQueryData ?? []}
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
    </>
  )
}
