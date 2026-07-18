import { useState } from 'react'
import { Card, Descriptions } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatDateTime } from '@/utils/time'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import {
  WorkloadPodsCard,
  WorkloadRelationsCard,
} from '@/features/platform/workloads/shared/workload-relations'
import { jobQueries } from './queries'
import type { JobDetail } from './types'
import '@/features/platform/workloads/styles.css'

function JobOverview({ detail }: { detail: JobDetail }) {
  const { localeCode } = useI18n()

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
      <WorkloadRelationsCard resources={detail.relatedResources} namespace={detail.namespace} />
      <WorkloadPodsCard pods={detail.pods} namespace={detail.namespace} />
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
