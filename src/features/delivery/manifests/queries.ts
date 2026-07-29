import { queryOptions } from '@tanstack/react-query'
import { manifestApi } from './api'
import { manifestKeys, normalizeManifestFilter } from './keys'
import type { ManifestFilter } from './types'

export const manifestQueries = {
  list: (filter: ManifestFilter = {}, enabled = true) => {
    const normalized = normalizeManifestFilter(filter)
    return queryOptions({
      queryKey: manifestKeys.list(normalized),
      queryFn: () => manifestApi.list(normalized),
      enabled,
    })
  },
  detail: (id: string, enabled = true) =>
    queryOptions({
      queryKey: manifestKeys.detail(id),
      queryFn: () => manifestApi.get(id),
      enabled: enabled && Boolean(id.trim()),
    }),
  revisions: (id: string, enabled = true) =>
    queryOptions({
      queryKey: manifestKeys.revisions(id),
      queryFn: () => manifestApi.revisions(id),
      enabled: enabled && Boolean(id.trim()),
    }),
}
