import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  ManifestFilter,
  ManifestPage,
  ManifestPackage,
  ManifestPackageInput,
  ManifestRevision,
} from './types'

const ROOT = '/delivery/manifest-packages'

async function unwrap<T>(request: Promise<ApiResponse<T>>) {
  const response = await request
  return response.data
}

function segment(value: string) {
  return encodeURIComponent(value.trim())
}

function listPath(filter: ManifestFilter = {}) {
  const search = new URLSearchParams()
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  return search.size > 0 ? `${ROOT}?${search.toString()}` : ROOT
}

export const manifestApi = {
  list: (filter: ManifestFilter = {}) =>
    unwrap(api.get<ApiResponse<ManifestPage>>(listPath(filter))),
  get: (id: string) => unwrap(api.get<ApiResponse<ManifestPackage>>(`${ROOT}/${segment(id)}`)),
  create: (input: ManifestPackageInput) =>
    unwrap(api.post<ApiResponse<ManifestPackage>>(ROOT, input)),
  update: (id: string, input: ManifestPackageInput) =>
    unwrap(api.put<ApiResponse<ManifestPackage>>(`${ROOT}/${segment(id)}`, input)),
  remove: async (id: string) => {
    await api.delete(`${ROOT}/${segment(id)}`)
  },
  publish: (id: string, note: string) =>
    unwrap(api.post<ApiResponse<ManifestPackage>>(`${ROOT}/${segment(id)}/publish`, { note })),
  revisions: (id: string) =>
    unwrap(api.get<ApiResponse<ManifestRevision[]>>(`${ROOT}/${segment(id)}/revisions`)),
}
