import type { ConfigurationDetailBase } from '../shared/types'
import type { WorkloadCondition } from '@/types'

export interface HorizontalPodAutoscalerMetric {
  readonly type: string
  readonly name?: string
  readonly target?: string
  readonly current?: string
}

export interface HorizontalPodAutoscalerResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly currentReplicas: number
  readonly desiredReplicas: number
  readonly maxReplicas: number
  readonly minReplicas: number
  readonly targetRef: string
  readonly metrics?: HorizontalPodAutoscalerMetric[]
  readonly conditions?: WorkloadCondition[]
}
