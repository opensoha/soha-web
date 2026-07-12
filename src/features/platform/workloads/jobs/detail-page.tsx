import { useState } from 'react'
import { Button, Card, Descriptions, List, Tag, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds, formatDateTime } from '@/utils/time'
import { buildWorkloadDetailPath } from '@/features/platform/workloads-model'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import { jobQueries } from './queries'
import type { JobDetail, Pod } from './types'
import '@/features/platform/workloads/styles.css'

function JobOverview({ detail }: { detail: JobDetail }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const podsQuery = useQuery(jobQueries.pods(toScopeKey(clusterId, detail.namespace), detail.name))
  const pods = podsQuery.data ?? []

  return (
    <div className="soha-detail-stack">
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? 'Job 状态' : 'Job Status'}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          items={[
            { key: 'completions', label: 'Completions', children: detail.completions ?? '-' },
            { key: 'parallelism', label: 'Parallelism', children: detail.parallelism ?? '-' },
            { key: 'succeeded', label: 'Succeeded', children: detail.succeeded ?? 0 },
            { key: 'failed', label: 'Failed', children: detail.failed ?? 0 },
            { key: 'active', label: 'Active', children: detail.active ?? 0 },
            { key: 'mode', label: 'Mode', children: detail.completionMode || '-' },
            {
              key: 'startTime',
              label: localeCode === 'zh_CN' ? '开始时间' : 'Start Time',
              children: detail.startTime ? formatDateTime(detail.startTime) : '-',
            },
            {
              key: 'completionTime',
              label: localeCode === 'zh_CN' ? '完成时间' : 'Completion Time',
              children: detail.completionTime ? formatDateTime(detail.completionTime) : '-',
            },
          ]}
        />
      </Card>
      <Card
        className="soha-detail-card soha-related-pod-card"
        size="small"
        title={localeCode === 'zh_CN' ? '关联 Pods' : 'Related Pods'}
      >
        <List
          className="soha-related-pod-list"
          dataSource={pods}
          loading={podsQuery.isLoading}
          rowKey={(record) => `${record.namespace}/${record.name}`}
          locale={{
            emptyText: (
              <ManagementState
                bordered={false}
                compact
                title={localeCode === 'zh_CN' ? '暂无关联 Pods' : 'No related Pods'}
              />
            ),
          }}
          renderItem={(pod: Pod) => (
            <List.Item className="soha-related-pod-item">
              <div className="soha-related-pod-line">
                <Tooltip title={pod.name}>
                  <Button
                    type="link"
                    className="soha-related-pod-name"
                    onClick={() =>
                      navigate(
                        buildWorkloadDetailPath('pods', pod.name, detail.namespace, pod.namespace),
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
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

function JobEventsTab({ detail, enabled }: { detail: JobDetail; enabled: boolean }) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const options = jobQueries.events(toScopeKey(clusterId, detail.namespace), detail.name)
  const eventsQuery = useQuery({ ...options, enabled: Boolean(options.enabled) && enabled })

  return (
    <ResourceEventsTimeline
      title={localeCode === 'zh_CN' ? 'Job 事件时间线' : 'Job Event Timeline'}
      events={eventsQuery.data ?? []}
      loading={eventsQuery.isLoading}
      emptyDescription={localeCode === 'zh_CN' ? '当前 Job 暂无事件' : 'No Job events'}
    />
  )
}

export function JobDetailPage() {
  const { localeCode } = useI18n()
  const [activeTabKey, setActiveTabKey] = useState('overview')

  return (
    <WorkloadDetailShell
      title="Job"
      resource="jobs"
      paramKey="jobName"
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      extraOverview={(detail) => <JobOverview detail={detail as unknown as JobDetail} />}
      extraTabPanes={(detail) => [
        {
          key: 'events',
          label: localeCode === 'zh_CN' ? '事件' : 'Events',
          children: (
            <JobEventsTab
              detail={detail as unknown as JobDetail}
              enabled={activeTabKey === 'events'}
            />
          ),
        },
      ]}
      yamlLast
    />
  )
}
