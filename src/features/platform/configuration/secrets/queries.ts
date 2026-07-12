import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { configurationKeys } from '../shared/keys'
import { hasConfigurationCluster, hasNamespacedConfigurationScope } from '../shared/scope'
import { getSecretDetail, listSecrets, secretKind } from './api'

export const secretQueries = {
  list: (scope: ScopeKey) =>
    queryOptions({
      queryKey: configurationKeys.list(secretKind, scope),
      queryFn: () => listSecrets(scope),
      enabled: hasConfigurationCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: configurationKeys.detail(secretKind, scope, name),
      queryFn: () => getSecretDetail({ scope, name }),
      enabled: hasNamespacedConfigurationScope(scope) && Boolean(name.trim()),
    }),
}
