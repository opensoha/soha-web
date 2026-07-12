import type { ResourceYAMLView, ScopeKey } from '@/types'

export type AccessControlKind =
  | 'serviceaccounts'
  | 'roles'
  | 'rolebindings'
  | 'clusterroles'
  | 'clusterrolebindings'

export type AccessControlScopeMode = 'cluster' | 'namespace'

export interface AccessControlTarget {
  readonly scope: ScopeKey
  readonly name: string
}

export interface AccessControlResourceRecord {
  readonly ageSeconds: number
  readonly allowedActions?: string[]
  readonly name: string
  readonly namespace?: string
}

export interface AccessControlDetailBase extends AccessControlResourceRecord {
  readonly annotations?: Record<string, string>
  readonly createdAt?: string
  readonly labels?: Record<string, string>
}

export interface AccessControlBindingRecord extends AccessControlResourceRecord {
  readonly roleRef: string
  readonly subjects?: string[]
}

export interface AccessControlSubject {
  readonly kind: string
  readonly label: string
  readonly name: string
  readonly namespace?: string
}

export interface CreateAccessControlVariables {
  readonly content: string
  readonly scope: ScopeKey
}

export interface UpdateAccessControlYAMLVariables extends AccessControlTarget {
  readonly content: string
}

export type AccessControlYAML = ResourceYAMLView
