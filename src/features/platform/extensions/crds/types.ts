export interface CRD {
  name: string
  group: string
  kind: string
  plural: string
  version: string
  versions?: string[]
  scope: string
  createdAt?: string
  ageSeconds?: number
}

export interface CRDResourceInstance {
  apiVersion?: string
  createdAt?: string
  ageSeconds?: number
  kind?: string
  labels?: Record<string, string>
  name: string
  namespace?: string
  status?: string
  summary?: Record<string, string | number | boolean | null>
}

export interface CRDApiGroupSummary {
  clusterCount: number
  crdCount: number
  crdNames: string[]
  crds: CRD[]
  group: string
  kindNames: string[]
  namespacedCount: number
  versions: string[]
}

export interface CustomResourceTarget {
  clusterId: string
  crd: CRD
  namespace?: string | null
  resourceName: string
}

export interface ApplyCustomResourceVariables {
  clusterId: string
  content: string
  crd: CRD
  mode: 'create' | 'edit'
  namespace?: string | null
  resourceName?: string
}
