import type { NetworkResourceRecord } from '../shared/types'

export type NetworkCoreKind = 'endpointslices' | 'ingressclasses' | 'networkpolicies'

export interface EndpointSlice extends NetworkResourceRecord {
  readonly namespace: string
  readonly addressType: string
  readonly endpoints: number
  readonly ports?: string[]
}

export interface IngressClass extends NetworkResourceRecord {
  readonly controller: string
  readonly isDefault: boolean
  readonly parameters?: string
}

export interface NetworkPolicy extends NetworkResourceRecord {
  readonly namespace: string
  readonly policyTypes?: string[]
  readonly ingressRules: number
  readonly egressRules: number
}
