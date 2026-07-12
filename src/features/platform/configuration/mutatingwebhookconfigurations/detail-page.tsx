import { useParams } from 'react-router-dom'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import type { MutatingWebhookConfigurationResource } from './types'

export function ConfigurationMutatingWebhookConfigurationDetailPage() {
  const name = useParams().name as string
  return (
    <ConfigurationListDetailPage<MutatingWebhookConfigurationResource>
      kind="mutatingwebhookconfigurations"
      label="MutatingWebhookConfiguration"
      name={name}
      overviewExtra={(detail) => [{ key: 'Webhooks', value: detail.webhooks }]}
      scopeMode="cluster"
    />
  )
}
