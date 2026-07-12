import type { ConfigurationDetailBase } from '../shared/types'

export interface HorizontalPodAutoscalerResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly currentReplicas: number
  readonly desiredReplicas: number
  readonly maxReplicas: number
  readonly minReplicas: number
  readonly targetRef: string
}
