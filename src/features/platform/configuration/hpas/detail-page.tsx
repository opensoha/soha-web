import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { HorizontalPodAutoscalerResource } from './types'

export function ConfigurationHPADetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationListDetailPage<HorizontalPodAutoscalerResource>
      kind="hpas"
      label="HorizontalPodAutoscaler"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Target', value: detail.targetRef || '-' },
        { key: 'Replicas', value: `${detail.currentReplicas}/${detail.desiredReplicas}` },
        { key: 'Min / Max', value: `${detail.minReplicas} / ${detail.maxReplicas}` },
      ]}
    />
  )
}
