import { useParams } from 'react-router-dom'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import type { ValidatingWebhookConfigurationResource } from './types'

export function ConfigurationValidatingWebhookConfigurationDetailPage() {
  const name = useParams().name as string
  return (
    <ConfigurationListDetailPage<ValidatingWebhookConfigurationResource>
      kind="validatingwebhookconfigurations"
      label="ValidatingWebhookConfiguration"
      name={name}
      overviewExtra={(detail) => [{ key: 'Webhooks', value: detail.webhooks }]}
      scopeMode="cluster"
    />
  )
}
