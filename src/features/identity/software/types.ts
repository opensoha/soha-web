export interface SoftwarePackage {
  id: string
  softwareId: string
  name: string
  description?: string
  publisher: string
  category?: string
  version: string
  platform: string
  arch: string
  fileName: string
  sizeBytes: number
  sha256: string
  downloadPath: string
  createdAt: string
  updatedAt: string
}

export interface SoftwarePackageListEnvelope {
  items: SoftwarePackage[]
  nextCursor?: string
}

export interface SoftwarePackageFilters {
  platform?: string
  arch?: string
}

export interface SoftwarePackageMetadataInput {
  softwareId: string
  name: string
  description?: string
  publisher: string
  category?: string
  version: string
  platform: string
  arch: string
}

export interface SoftwarePackageUploadInput extends SoftwarePackageMetadataInput {
  file: File
}

export interface SoftwarePackageURLImportInput extends SoftwarePackageMetadataInput {
  url: string
  fileName?: string
}

export type SoftwarePackagePublishInput =
  | ({ source: 'file' } & SoftwarePackageUploadInput)
  | ({ source: 'url' } & SoftwarePackageURLImportInput)

export interface SoftwareStorage {
  backend: string
  objectCount: number
  totalBytes: number
  items: SoftwarePackage[]
  nextCursor?: string
}

export interface SoftwareStorageEnvelope {
  data: SoftwareStorage
}
