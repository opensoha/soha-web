import type { ConfigurationDetailBase } from '../shared/types'

export interface PodDisruptionBudgetResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly currentHealthy: number
  readonly desiredHealthy: number
  readonly disruptionsAllowed: number
  readonly maxUnavailable?: string
  readonly minAvailable?: string
}
