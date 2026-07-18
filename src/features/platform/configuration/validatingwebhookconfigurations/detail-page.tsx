import { useParams } from 'react-router-dom'
import { AdmissionWebhooks } from '../shared/detail-tables'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import type { ValidatingWebhookConfigurationResource } from './types'

export function ConfigurationValidatingWebhookConfigurationDetailPage() {
  const name = useParams().name as string
  return (
    <ConfigurationQueryDetailPage<ValidatingWebhookConfigurationResource>
      kind="validatingwebhookconfigurations"
      label="ValidatingWebhookConfiguration"
      name={name}
      overviewExtra={(detail) => [
        {
          key: 'Webhooks',
          value: Array.isArray(detail.webhooks) ? detail.webhooks.length : detail.webhooks,
        },
      ]}
      renderOverview={(detail) =>
        Array.isArray(detail.webhooks) ? <AdmissionWebhooks webhooks={detail.webhooks} /> : null
      }
      scopeMode="cluster"
    />
  )
}
