import { lazy, Suspense, useState } from 'react'
import { Card, Descriptions, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import { useWorkloadDetailScope } from '@/features/platform/workloads/shared/detail-scope'
import {
  WorkloadPodsCard,
  WorkloadRelationsCard,
} from '@/features/platform/workloads/shared/workload-relations'
import { useI18n } from '@/i18n'
import { statefulSetQueries } from './queries'
import type { StatefulSetDetail } from './types'
import '@/features/platform/workloads/styles.css'

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

function StatefulSetOverview({ detail }: { detail: StatefulSetDetail }) {
  const { localeCode } = useI18n()
  return (
    <div className="soha-detail-stack">
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? 'StatefulSet 状态' : 'StatefulSet Status'}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          items={[
            { key: 'service', label: 'Service', children: detail.serviceName || '-' },
            {
              key: 'ready',
              label: localeCode === 'zh_CN' ? '就绪副本' : 'Ready',
              children: `${detail.readyReplicas ?? 0}/${detail.desiredReplicas ?? 0}`,
            },
            {
              key: 'current',
              label: localeCode === 'zh_CN' ? '当前副本' : 'Current',
              children: detail.currentReplicas ?? '-',
            },
            {
              key: 'strategy',
              label: localeCode === 'zh_CN' ? '更新策略' : 'Update Strategy',
              children: detail.updateStrategy || '-',
            },
            {
              key: 'currentRevision',
              label: 'Current Revision',
              children: detail.currentRevision || '-',
            },
            {
              key: 'updateRevision',
              label: 'Update Revision',
              children: detail.updateRevision || '-',
            },
          ]}
        />
      </Card>
      <WorkloadPodsCard pods={detail.pods} namespace={detail.namespace} />
      <WorkloadRelationsCard resources={detail.relatedResources} namespace={detail.namespace} />
    </div>
  )
}

export function StatefulSetDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const statefulSetName = params.statefulSetName as string
  const detailScope = useWorkloadDetailScope()
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const metricsOptions = statefulSetQueries.metrics(detailScope, statefulSetName)
  const metricsQuery = useQuery({
    ...metricsOptions,
    enabled: Boolean(metricsOptions.enabled) && activeTabKey === 'metrics',
  })
  const eventsOptions = statefulSetQueries.events(detailScope, statefulSetName)
  const eventsQuery = useQuery({
    ...eventsOptions,
    enabled: Boolean(eventsOptions.enabled) && activeTabKey === 'events',
  })

  return (
    <WorkloadDetailShell
      title="StatefulSet"
      resource="statefulsets"
      paramKey="statefulSetName"
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      extraOverview={(detail) => <StatefulSetOverview detail={detail as StatefulSetDetail} />}
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
                title={localeCode === 'zh_CN' ? 'StatefulSet 指标' : 'StatefulSet Metrics'}
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
              title={
                localeCode === 'zh_CN' ? 'StatefulSet 事件时间线' : 'StatefulSet Event Timeline'
              }
              events={eventsQuery.data ?? []}
              loading={eventsQuery.isLoading}
              emptyDescription={
                localeCode === 'zh_CN' ? '当前 StatefulSet 暂无事件' : 'No StatefulSet events'
              }
            />
          ),
        },
      ]}
      yamlLast
    />
  )
}
