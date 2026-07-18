import { useParams } from 'react-router-dom'
import { AdmissionWebhooks } from '../shared/detail-tables'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import type { MutatingWebhookConfigurationResource } from './types'

export function ConfigurationMutatingWebhookConfigurationDetailPage() {
  const name = useParams().name as string
  return (
    <ConfigurationQueryDetailPage<MutatingWebhookConfigurationResource>
      kind="mutatingwebhookconfigurations"
      label="MutatingWebhookConfiguration"
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
