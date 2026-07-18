import type { AdmissionWebhook, ConfigurationDetailBase } from '../shared/types'

export interface MutatingWebhookConfigurationResource extends ConfigurationDetailBase {
  readonly webhooks: number | AdmissionWebhook[]
}
