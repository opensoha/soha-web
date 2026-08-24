import type { ScopeKey } from '@/types'

function scopeKey(scope: ScopeKey) {
  return { clusterId: scope.clusterId?.trim() ?? '', namespace: scope.namespace?.trim() ?? '' }
}

export const resourceInsightKeys = {
  all: ['platform-resource-insights'] as const,
  graph: (scope: ScopeKey, kind: string, name: string) =>
    [...resourceInsightKeys.all, 'graph', scopeKey(scope), kind.trim(), name.trim()] as const,
  posture: (scope: ScopeKey, limit: number) =>
    [...resourceInsightKeys.all, 'security-posture', scopeKey(scope), limit] as const,
}
