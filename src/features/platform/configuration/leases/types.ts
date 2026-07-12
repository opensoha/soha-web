import type { ConfigurationDetailBase } from '../shared/types'

export interface LeaseResource extends ConfigurationDetailBase {
  readonly namespace: string
  readonly acquireTime?: string
  readonly holderIdentity?: string
  readonly leaseDurationSeconds?: number
  readonly renewTime?: string
}
