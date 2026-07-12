import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { ResourceQuotaResource } from './types'

export function ConfigurationResourceQuotaDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationListDetailPage<ResourceQuotaResource>
      kind="resourcequotas"
      label="ResourceQuota"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Scopes', value: detail.scopes?.join(', ') || '-' },
        { key: 'Hard', value: Object.keys(detail.hard ?? {}).length || '-' },
        { key: 'Used', value: Object.keys(detail.used ?? {}).length || '-' },
      ]}
    />
  )
}
