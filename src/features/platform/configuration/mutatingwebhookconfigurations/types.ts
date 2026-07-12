import type { ConfigurationDetailBase } from '../shared/types'

export interface MutatingWebhookConfigurationResource extends ConfigurationDetailBase {
  readonly webhooks: number
}
