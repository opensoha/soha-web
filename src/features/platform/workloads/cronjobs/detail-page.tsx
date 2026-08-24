import { useState } from 'react'
import { Button, Card, Descriptions, Tag, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { ResourceEventsTimeline } from '@/components/resource-events-timeline'
import { BooleanTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds, formatDateTime } from '@/utils/time'
import { buildWorkloadDetailPath } from '@/features/platform/workloads-model'
import { WorkloadDetailShell } from '@/features/platform/workloads/shared/detail-shell'
import { WorkloadRelationsCard } from '@/features/platform/workloads/shared/workload-relations'
import { cronJobQueries } from './queries'
import type { CronJobChildJob, CronJobDetail } from './types'
import '@/features/platform/workloads/styles.css'

function CronJobOverview({ detail }: { detail: CronJobDetail }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const clusterId = usePlatformScopeStore((state) => state.clusterId)
  const jobs = detail.jobs ?? []

  return (
    <div className="soha-detail-stack">
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={localeCode === 'zh_CN' ? 'CronJob 调度' : 'CronJob Schedule'}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          items={[
            {
              key: 'schedule',
              label: localeCode === 'zh_CN' ? '调度计划' : 'Schedule',
              children: detail.schedule || '-',
            },
            {
              key: 'suspend',
              label: localeCode === 'zh_CN' ? '暂停' : 'Suspend',
              children: (
                <BooleanTag
                  value={detail.suspend}
                  trueLabel={localeCode === 'zh_CN' ? '是' : 'Yes'}
                  falseLabel={localeCode === 'zh_CN' ? '否' : 'No'}
                  trueColor="orange"
                  falseColor="green"
                />
              ),
            },
            {
              key: 'activeJobs',
              label: localeCode === 'zh_CN' ? '活跃' : 'Active',
              children: detail.activeJobs ?? 0,
            },
            {
              key: 'lastSchedule',
              label: localeCode === 'zh_CN' ? '上次调度' : 'Last Schedule',
              children: detail.lastScheduleTime ? formatDateTime(detail.lastScheduleTime) : '-',
            },
            {
              key: 'concurrency',
              label: localeCode === 'zh_CN' ? '并发策略' : 'Concurrency',
              children: detail.concurrencyPolicy || '-',
            },
            {
              key: 'timeZone',
              label: localeCode === 'zh_CN' ? '时区' : 'Time Zone',
              children: detail.timeZone || '-',
            },
          ]}
        />
      </Card>
      <Card
        className="soha-detail-card soha-related-pod-card"
        size="small"
        title={localeCode === 'zh_CN' ? '关联 Jobs' : 'Related Jobs'}
      >
        {jobs.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title={localeCode === 'zh_CN' ? '暂无关联 Jobs' : 'No related Jobs'}
          />
        ) : (
          <div className="soha-related-pod-list" role="list">
            {jobs.map((job: CronJobChildJob) => (
              <div
                className="soha-related-pod-item"
                key={`${job.namespace}/${job.name}`}
                role="listitem"
              >
                <div className="soha-related-pod-line">
                <Tooltip title={job.name}>
                  <Button
                    type="link"
                    className="soha-related-pod-name"
                    onClick={() =>
                      navigate(
                        buildWorkloadDetailPath(
                          'jobs',
                          job.name,
                          detail.namespace,
                          job.namespace,
                          clusterId,
                        ),
                      )
                    }
                  >
                    {job.name}
                  </Button>
                </Tooltip>
                <Tag color="blue" className="soha-related-pod-tag">
                  {job.namespace || detail.namespace || '-'}
                </Tag>
                <Tag color="success" className="soha-related-pod-tag">
                  {`${localeCode === 'zh_CN' ? '成功' : 'Succeeded'} ${job.succeeded ?? 0}`}
                </Tag>
                <Tag
                  color={(job.failed ?? 0) > 0 ? 'error' : 'default'}
                  className="soha-related-pod-tag"
                >
                  {`${localeCode === 'zh_CN' ? '失败' : 'Failed'} ${job.failed ?? 0}`}
                </Tag>
                <Tag
                  color={(job.active ?? 0) > 0 ? 'processing' : 'default'}
                  className="soha-related-pod-tag"
                >
                  {`${localeCode === 'zh_CN' ? '活跃' : 'Active'} ${job.active ?? 0}`}
                </Tag>
                <Tag color="geekblue" className="soha-related-pod-tag">
                  {formatAgeSeconds(job.ageSeconds)}
                </Tag>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <WorkloadRelationsCard resources={detail.relatedResources} namespace={detail.namespace} />
    </div>
  )
}

function CronJobEventsTab({ detail, enabled }: { detail: CronJobDetail; enabled: boolean }) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const options = cronJobQueries.events(toScopeKey(clusterId, detail.namespace), detail.name)
  const eventsQuery = useQuery({ ...options, enabled: Boolean(options.enabled) && enabled })

  return (
    <ResourceEventsTimeline
      title={localeCode === 'zh_CN' ? 'CronJob 事件时间线' : 'CronJob Event Timeline'}
      events={eventsQuery.data ?? []}
      loading={eventsQuery.isLoading}
      emptyDescription={localeCode === 'zh_CN' ? '当前 CronJob 暂无事件' : 'No CronJob events'}
    />
  )
}

export function CronJobDetailPage() {
  const { localeCode } = useI18n()
  const [activeTabKey, setActiveTabKey] = useState('overview')

  return (
    <WorkloadDetailShell
      title="CronJob"
      resource="cronjobs"
      paramKey="cronJobName"
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      extraOverview={(detail) => <CronJobOverview detail={detail as unknown as CronJobDetail} />}
      extraTabPanes={(detail) => [
        {
          key: 'events',
          label: localeCode === 'zh_CN' ? '事件' : 'Events',
          children: (
            <CronJobEventsTab
              detail={detail as unknown as CronJobDetail}
              enabled={activeTabKey === 'events'}
            />
          ),
        },
      ]}
      yamlLast
    />
  )
}
