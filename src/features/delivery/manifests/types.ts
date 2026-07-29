export type ManifestRenderer = 'raw_yaml' | 'kustomize'
export type ManifestStatus = 'draft' | 'published'

export interface ManifestFile {
  path: string
  content: string
}

export interface ManifestBinding {
  id?: string
  applicationEnvironmentId: string
  environmentKey: string
  clusterId: string
  namespace: string
  overlay?: Record<string, string>
  status?: string
}

export interface ManifestPackage {
  id: string
  name: string
  description?: string
  applicationId: string
  businessLineId?: string
  renderer: ManifestRenderer
  status: ManifestStatus
  currentRevision: number
  files: ManifestFile[]
  bindings: ManifestBinding[]
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface ManifestPackageInput {
  name: string
  description?: string
  applicationId: string
  businessLineId?: string
  renderer: ManifestRenderer
  files: ManifestFile[]
  bindings: ManifestBinding[]
}

export interface ManifestFilter {
  applicationId?: string
  clusterId?: string
  namespace?: string
  search?: string
  page?: number
  pageSize?: number
  limit?: number
}

export interface ManifestPage {
  items: ManifestPackage[]
  total: number
  page: number
  pageSize: number
}

export interface ManifestRevision {
  id: string
  packageId: string
  version: number
  digest: string
  note?: string
  files: ManifestFile[]
  bindings: ManifestBinding[]
  createdBy?: string
  createdAt: string
}
