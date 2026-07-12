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
import { daemonSetQueries } from './queries'
import type { DaemonSetDetail } from './types'
import '@/features/platform/workloads/styles.css'

const ResourceMetricsPanel = lazy(async () => {
  const mod = await import('@/components/resource-metrics-panel')
  return { default: mod.ResourceMetricsPanel }
})

function DaemonSetOverview({ detail }: { detail: DaemonSetDetail }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const selector = detail.selector ?? {}
  const podsQuery = useQuery(
    daemonSetQueries.pods(toScopeKey(clusterId, detail.namespace), detail.name, selector),
  )
  const pods = podsQuery.data ?? []

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
