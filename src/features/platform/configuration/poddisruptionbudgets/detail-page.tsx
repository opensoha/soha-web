import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { PodDisruptionBudgetResource } from './types'

export function ConfigurationPDBDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationListDetailPage<PodDisruptionBudgetResource>
      kind="poddisruptionbudgets"
      label="PodDisruptionBudget"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Min Available', value: detail.minAvailable || '-' },
        { key: 'Max Unavailable', value: detail.maxUnavailable || '-' },
        { key: 'Healthy', value: `${detail.currentHealthy}/${detail.desiredHealthy}` },
        { key: 'Disruptions Allowed', value: detail.disruptionsAllowed },
      ]}
    />
  )
}
