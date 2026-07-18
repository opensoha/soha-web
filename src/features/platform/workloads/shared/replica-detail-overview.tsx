import { Card, Descriptions, Space } from 'antd'
import { MetadataTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import type { Pod, WorkloadRelation } from '@/types'
import { WorkloadPodsCard, WorkloadRelationsCard } from './workload-relations'

export interface ReplicaDetailRecord {
  name: string
  namespace: string
  desiredReplicas: number
  readyReplicas: number
  availableReplicas: number
  currentReplicas?: number
  selector?: Record<string, string>
  pods?: Pod[]
  relatedResources?: WorkloadRelation[]
}

export function ReplicaDetailOverview({
  detail,
  title,
}: {
  detail: ReplicaDetailRecord
  title: string
}) {
  const { localeCode } = useI18n()
  const zh = localeCode === 'zh_CN'
  const selector = Object.entries(detail.selector ?? {})

  return (
    <div className="soha-detail-stack">
      <Card
        className="soha-detail-card soha-rollout-card"
        size="small"
        title={zh ? `${title} 状态` : `${title} Status`}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          items={[
            {
              key: 'ready',
              label: zh ? '就绪副本' : 'Ready',
              children: `${detail.readyReplicas}/${detail.desiredReplicas}`,
            },
            ...(detail.currentReplicas == null
              ? []
              : [
                  {
                    key: 'current',
                    label: zh ? '当前副本' : 'Current',
                    children: detail.currentReplicas,
                  },
                ]),
            {
              key: 'available',
              label: zh ? '可用副本' : 'Available',
              children: detail.availableReplicas,
            },
            {
              key: 'selector',
              label: 'Selector',
              children:
                selector.length === 0 ? (
                  '-'
                ) : (
                  <Space size={[4, 4]} wrap>
                    {selector.map(([key, value]) => (
                      <MetadataTag key={key} label={`${key}=${value}`} />
                    ))}
                  </Space>
                ),
            },
          ]}
        />
      </Card>
      <WorkloadPodsCard pods={detail.pods} namespace={detail.namespace} />
      <WorkloadRelationsCard resources={detail.relatedResources} namespace={detail.namespace} />
    </div>
  )
}
