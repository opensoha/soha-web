import type { IdentityPolicyFilters } from './types'

function normalizePositiveInteger(value?: number) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return undefined
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : undefined
}

export function normalizeIdentityPolicyFilters(
  filters: IdentityPolicyFilters = {},
): IdentityPolicyFilters {
  const query = filters.query?.trim()
  const status = filters.status?.trim() as IdentityPolicyFilters['status']
  const limit = normalizePositiveInteger(filters.limit)
  const offset = normalizePositiveInteger(filters.offset)
  return {
    ...(query ? { query } : {}),
    ...(status ? { status } : {}),
    ...(limit === undefined ? {} : { limit }),
    ...(offset === undefined ? {} : { offset }),
  }
}

export const identityPolicyKeys = {
  all: ['identity', 'policies'] as const,
  lists: () => [...identityPolicyKeys.all, 'list'] as const,
  list: (filters: IdentityPolicyFilters = {}) =>
    [...identityPolicyKeys.lists(), normalizeIdentityPolicyFilters(filters)] as const,
  details: () => [...identityPolicyKeys.all, 'detail'] as const,
  detail: (applicationId: string) =>
    [...identityPolicyKeys.details(), applicationId.trim()] as const,
}

export const identityPolicyMutationKeys = {
  update: [...identityPolicyKeys.all, 'mutation', 'update'] as const,
}
