import { api } from '@/services/api-client'
import type {
  SoftwarePackage,
  SoftwarePackageFilters,
  SoftwarePackageListEnvelope,
  SoftwarePackagePublishInput,
  SoftwarePackageUploadInput,
  SoftwarePackageURLImportInput,
  SoftwareStorage,
  SoftwareStorageEnvelope,
} from './types'

export async function listSoftwarePackages(
  filters: SoftwarePackageFilters,
): Promise<SoftwarePackageListEnvelope> {
  const params = new URLSearchParams()
  if (filters.platform?.trim()) params.set('platform', filters.platform.trim())
  if (filters.arch?.trim()) params.set('arch', filters.arch.trim())
  params.set('limit', '200')
  return api.getEnvelope<SoftwarePackageListEnvelope>(`/software/packages?${params}`)
}

export async function uploadSoftwarePackage(
  input: SoftwarePackageUploadInput,
): Promise<SoftwarePackage> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (key === 'file') continue
    if (typeof value === 'string' && value.trim()) formData.append(key, value.trim())
  }
  formData.append('file', input.file)
  const response = await api.upload<{ data: SoftwarePackage }>('/software/packages', formData)
  return response.data
}

export async function importSoftwarePackage(
  input: SoftwarePackageURLImportInput,
): Promise<SoftwarePackage> {
  const response = await api.post<{ data: SoftwarePackage }>('/software/packages/import', input)
  return response.data
}

export function publishSoftwarePackage(input: SoftwarePackagePublishInput) {
  const { source, ...payload } = input
  return source === 'file'
    ? uploadSoftwarePackage(payload as SoftwarePackageUploadInput)
    : importSoftwarePackage(payload as SoftwarePackageURLImportInput)
}

export async function getSoftwareStorage(): Promise<SoftwareStorage> {
  const response = await api.getEnvelope<SoftwareStorageEnvelope>('/software/storage?limit=200')
  return response.data
}

export async function deleteSoftwarePackage(packageId: string): Promise<void> {
  await api.delete(`/software/packages/${encodeURIComponent(packageId)}`)
}
