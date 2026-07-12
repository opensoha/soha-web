import type { IdentityApplicationFilters } from './types'

function normalizeFilter(value?: string) {
  return value?.trim() ?? ''
}

export const identityApplicationKeys = {
  all: ['identity', 'applications'] as const,
  lists: () => [...identityApplicationKeys.all, 'list'] as const,
  list: (filters: IdentityApplicationFilters) =>
    [
      ...identityApplicationKeys.lists(),
      {
        query: normalizeFilter(filters.query),
        status: normalizeFilter(filters.status),
      },
    ] as const,
}

export const identityProviderCapabilityKeys = {
  all: ['identity', 'provider-capabilities'] as const,
}

export const identityApplicationMutationKeys = {
  create: [...identityApplicationKeys.all, 'mutation', 'create'] as const,
  update: [...identityApplicationKeys.all, 'mutation', 'update'] as const,
  remove: [...identityApplicationKeys.all, 'mutation', 'delete'] as const,
}
