import type { ConfigurationDetailBase } from '../shared/types'

export interface LimitRangeResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly limits: number
}
