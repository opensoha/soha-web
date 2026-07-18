import type { AdmissionWebhook, ConfigurationDetailBase } from '../shared/types'

export interface ValidatingWebhookConfigurationResource extends ConfigurationDetailBase {
  readonly webhooks: number | AdmissionWebhook[]
}
