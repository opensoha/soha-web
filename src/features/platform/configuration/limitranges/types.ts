import type { ConfigurationDetailBase } from '../shared/types'

export interface LimitRangeRule {
  readonly type: string
  readonly min?: Record<string, string>
  readonly max?: Record<string, string>
  readonly default?: Record<string, string>
  readonly defaultRequest?: Record<string, string>
  readonly maxLimitRequestRatio?: Record<string, string>
}

export interface LimitRangeResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly limits: number
  readonly rules?: LimitRangeRule[]
}
