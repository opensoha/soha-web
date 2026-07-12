import { useState } from 'react'
import { Button, Card, Descriptions, List, Tag, Tooltip } from 'antd'
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
import { cronJobQueries } from './queries'
import type { CronJobChildJob, CronJobDetail } from './types'
import '@/features/platform/workloads/styles.css'

function CronJobOverview({ detail }: { detail: CronJobDetail }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId } = usePlatformScopeStore()
  const jobsQuery = useQuery(
    cronJobQueries.childJobs(toScopeKey(clusterId, detail.namespace), detail.name),
  )
  const jobs = jobsQuery.data ?? []

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
            { key: 'schedule', label: 'Schedule', children: detail.schedule || '-' },
            {
              key: 'suspend',
              label: localeCode === 'zh_CN' ? '暂停' : 'Suspend',
              children: (
                <BooleanTag
                  value={detail.suspend}
                  trueLabel="Yes"
                  falseLabel="No"
                  trueColor="orange"
                  falseColor="green"
                />
              ),
            },
            { key: 'activeJobs', label: 'Active', children: detail.activeJobs ?? 0 },
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
            { key: 'timeZone', label: 'Time Zone', children: detail.timeZone || '-' },
          ]}
        />
      </Card>
      <Card
        className="soha-detail-card soha-related-pod-card"
        size="small"
        title={localeCode === 'zh_CN' ? '关联 Jobs' : 'Related Jobs'}
      >
        <List
          className="soha-related-pod-list"
          dataSource={jobs}
          loading={jobsQuery.isLoading}
          rowKey={(record) => `${record.namespace}/${record.name}`}
          locale={{
            emptyText: (
              <ManagementState
                bordered={false}
                compact
                title={localeCode === 'zh_CN' ? '暂无关联 Jobs' : 'No related Jobs'}
              />
            ),
          }}
          renderItem={(job: CronJobChildJob) => (
            <List.Item className="soha-related-pod-item">
              <div className="soha-related-pod-line">
                <Tooltip title={job.name}>
                  <Button
                    type="link"
                    className="soha-related-pod-name"
                    onClick={() =>
                      navigate(
                        buildWorkloadDetailPath('jobs', job.name, detail.namespace, job.namespace),
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
                  {`Succeeded ${job.succeeded ?? 0}`}
                </Tag>
                <Tag
                  color={(job.failed ?? 0) > 0 ? 'error' : 'default'}
                  className="soha-related-pod-tag"
                >
                  {`Failed ${job.failed ?? 0}`}
                </Tag>
                <Tag
                  color={(job.active ?? 0) > 0 ? 'processing' : 'default'}
                  className="soha-related-pod-tag"
                >
                  {`Active ${job.active ?? 0}`}
                </Tag>
                <Tag color="geekblue" className="soha-related-pod-tag">
                  {formatAgeSeconds(job.ageSeconds)}
                </Tag>
              </div>
            </List.Item>
          )}
        />
      </Card>
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
