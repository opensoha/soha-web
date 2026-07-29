import type { ManifestFilter } from './types'

const ROOT = ['delivery', 'manifests'] as const

export function normalizeManifestFilter(filter: ManifestFilter = {}): ManifestFilter {
  return {
    applicationId: filter.applicationId?.trim() || undefined,
    clusterId: filter.clusterId?.trim() || undefined,
    namespace: filter.namespace?.trim() || undefined,
    search: filter.search?.trim() || undefined,
    page: filter.page && filter.page > 0 ? filter.page : undefined,
    pageSize: filter.pageSize && filter.pageSize > 0 ? filter.pageSize : undefined,
    limit: filter.limit,
  }
}

export const manifestKeys = {
  all: ROOT,
  lists: [...ROOT, 'list'] as const,
  list: (filter: ManifestFilter = {}) =>
    [...ROOT, 'list', normalizeManifestFilter(filter)] as const,
  details: [...ROOT, 'detail'] as const,
  detail: (id: string) => [...ROOT, 'detail', id.trim()] as const,
  revisions: (id: string) => [...ROOT, 'detail', id.trim(), 'revisions'] as const,
}
