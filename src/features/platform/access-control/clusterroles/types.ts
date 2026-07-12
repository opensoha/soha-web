import type { AccessControlDetailBase, AccessControlResourceRecord } from '../shared/types'

export interface ClusterRoleResource extends AccessControlResourceRecord {
  readonly aggregationRules: number
  readonly rules: number
}

export interface ClusterRoleDetail extends AccessControlDetailBase {
  readonly aggregationRules: number
  readonly ruleSummaries?: string[]
  readonly rules: number
}
