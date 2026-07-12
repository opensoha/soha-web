import type { ScopeKey } from '@/types'
import { networkKeys } from '../shared/keys'

function normalizeSelector(selector?: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(selector ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  )
}

export const serviceKeys = {
  all: networkKeys.resource('services'),
  lists: () => networkKeys.lists('services'),
  list: (scope: ScopeKey) => networkKeys.list('services', scope),
  details: () => networkKeys.details('services'),
  detail: (scope: ScopeKey, name: string) => networkKeys.detail('services', scope, name),
  backendPods: (scope: ScopeKey, name: string, selector?: Record<string, string>) =>
    [...serviceKeys.detail(scope, name), 'backend-pods', normalizeSelector(selector)] as const,
  metrics: (scope: ScopeKey, name: string) =>
    [...serviceKeys.detail(scope, name), 'metrics'] as const,
  events: (scope: ScopeKey, name: string, limit = 100) =>
    [...serviceKeys.detail(scope, name), 'events', { limit }] as const,
  yaml: (scope: ScopeKey, name: string) => networkKeys.yaml('services', scope, name),
}
