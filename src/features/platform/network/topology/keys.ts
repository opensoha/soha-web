import type { ScopeKey } from '@/types'
import { networkKeys } from '../shared/keys'
import { normalizeNetworkScope } from '../shared/scope'

export const topologyKeys = {
  all: [...networkKeys.all, 'topology'] as const,
  detail: (scope: ScopeKey) => [...topologyKeys.all, normalizeNetworkScope(scope)] as const,
}
