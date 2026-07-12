import type { ConfigurationDetailBase } from '../shared/types'

export interface ResourceQuotaResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly hard?: Record<string, string>
  readonly scopes?: string[]
  readonly used?: Record<string, string>
}
