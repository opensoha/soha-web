import type { AccessControlDetailBase, AccessControlResourceRecord } from '../shared/types'

export interface ServiceAccountResource extends AccessControlResourceRecord {
  readonly namespace: string
  readonly automountServiceAccountToken: boolean
  readonly imagePullSecrets: number
  readonly secrets: number
}

export interface ServiceAccountDetail extends AccessControlDetailBase {
  readonly namespace: string
  readonly automountServiceAccountToken: boolean
  readonly imagePullSecrets?: string[]
  readonly secrets?: string[]
}
