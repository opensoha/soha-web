import type { NetworkResourceRecord } from '../shared/types'

export type GatewayAPIKind =
  | 'gatewayclasses'
  | 'gateways'
  | 'httproutes'
  | 'backendtlspolicies'
  | 'grpcroutes'
  | 'referencegrants'

export interface GatewayClass extends NetworkResourceRecord {
  readonly controllerName: string
  readonly accepted?: string
  readonly parametersRef?: string
}

export interface Gateway extends NetworkResourceRecord {
  readonly namespace: string
  readonly gatewayClass?: string
  readonly addresses?: string[]
  readonly listenerCount: number
}

export interface HTTPRoute extends NetworkResourceRecord {
  readonly namespace: string
  readonly hostnames?: string[]
  readonly parentRefs?: string[]
  readonly backendServices?: string[]
}

export interface BackendTLSPolicy extends NetworkResourceRecord {
  readonly namespace: string
  readonly targetRefs?: string[]
  readonly hostname?: string
  readonly caCertificateRefs?: string[]
  readonly wellKnownCACertificates?: string
}

export interface GRPCRoute extends NetworkResourceRecord {
  readonly namespace: string
  readonly hostnames?: string[]
  readonly parentRefs?: string[]
  readonly backendServices?: string[]
  readonly ruleCount: number
}

export interface ReferenceGrant extends NetworkResourceRecord {
  readonly namespace: string
  readonly from?: string[]
  readonly to?: string[]
}
