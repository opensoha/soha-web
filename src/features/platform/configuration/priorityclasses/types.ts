import type { ConfigurationDetailBase } from '../shared/types'

export interface PriorityClassResource extends ConfigurationDetailBase {
  readonly description?: string
  readonly globalDefault: boolean
  readonly preemptionPolicy?: string
  readonly value: number
}
