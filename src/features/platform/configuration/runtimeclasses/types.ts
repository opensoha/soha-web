import type { ConfigurationDetailBase } from '../shared/types'

export interface RuntimeClassResource extends ConfigurationDetailBase {
  readonly handler: string
}
