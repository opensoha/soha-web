import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { ConfigurationListDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { LimitRangeResource } from './types'

export function ConfigurationLimitRangeDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationListDetailPage<LimitRangeResource>
      kind="limitranges"
      label="LimitRange"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [{ key: 'Limits', value: detail.limits }]}
    />
  )
}
