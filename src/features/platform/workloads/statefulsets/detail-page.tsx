import { lazy, Suspense, useState } from 'react'
import { Button, Card, Descriptions, Spin, Tag, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { StatusTag } from '@/components/status-tag'
import {
  buildWorkloadDetailPath,
  resolveWorkloadNamespace,
} from '@/features/platform/workloads-model'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import { statefulSetQueries } from './queries'
import type { StatefulSetDetail } from './types'
import '@/features/platform/workloads/styles.css'

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

function StatefulSetOverview({ detail }: { detail: StatefulSetDetail }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const selector = detail.selector ?? {}
  const podsQuery = useQuery(
    statefulSetQueries.pods(toScopeKey(clusterId, detail.namespace), detail.name, selector),
  )
  const pods = podsQuery.data ?? []

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
      <Card
        className="soha-detail-card soha-related-pod-card"
        size="small"
        title={localeCode === 'zh_CN' ? '关联 Pods' : 'Related Pods'}
      >
        <Spin spinning={podsQuery.isLoading}>
          <div className="soha-related-pod-list">
            {pods.length === 0 ? (
              <ManagementState
                bordered={false}
                compact
                title={localeCode === 'zh_CN' ? '暂无关联 Pods' : 'No related Pods'}
              />
            ) : null}
            {pods.map((pod) => (
              <div className="soha-related-pod-item" key={`${pod.namespace}/${pod.name}`}>
                <div className="soha-related-pod-line">
                  <Tooltip title={pod.name}>
                    <Button
                      type="link"
                      className="soha-related-pod-name"
                      onClick={() =>
                        navigate(
                          buildWorkloadDetailPath(
                            'pods',
                            pod.name,
                            detail.namespace,
                            pod.namespace,
                          ),
                        )
                      }
                    >
                      {pod.name}
                    </Button>
                  </Tooltip>
                  <StatusTag value={pod.phase} />
                  <Tag color="blue" className="soha-related-pod-tag">
                    {pod.namespace || detail.namespace || '-'}
                  </Tag>
                  <Tag color="cyan" className="soha-related-pod-tag">
                    {pod.podIp || '-'}
                  </Tag>
                  <Tag color="success" className="soha-related-pod-tag">
                    {`Ready ${pod.readyContainers || '-'}`}
                  </Tag>
                  <Tag
                    color={(pod.restarts ?? 0) > 0 ? 'warning' : 'default'}
                    className="soha-related-pod-tag"
                  >
                    {`${localeCode === 'zh_CN' ? '重启' : 'Restarts'} ${pod.restarts ?? 0}`}
                  </Tag>
                  <Tooltip title={pod.nodeName || '-'}>
                    <Tag color="purple" className="soha-related-pod-tag soha-related-pod-tag-node">
                      {pod.nodeName || '-'}
                    </Tag>
                  </Tooltip>
                  <Tag color="geekblue" className="soha-related-pod-tag">
                    {formatAgeSeconds(pod.ageSeconds)}
                  </Tag>
                </div>
              </div>
            ))}
          </div>
        </Spin>
      </Card>
    </div>
  )
}

export function StatefulSetDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const statefulSetName = params.statefulSetName as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = resolveWorkloadNamespace(namespace, searchParams.get('namespace'))
  const detailScope = toScopeKey(clusterId, detailNamespace)
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
