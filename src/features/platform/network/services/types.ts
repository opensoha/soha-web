import type { NetworkEvent, NetworkResourceRecord } from '../shared/types'

export interface Service extends NetworkResourceRecord {
  readonly namespace: string
  readonly type: string
  readonly clusterIp: string
  readonly ports: string[]
  readonly selector?: Record<string, string>
}

export interface ServiceBackendPod {
  readonly name: string
  readonly namespace: string
  readonly phase: string
  readonly readyContainers: string
  readonly restarts: number
  readonly nodeName?: string
  readonly podIp?: string
  readonly labels?: Record<string, string>
  readonly ageSeconds: number
}

export type ServiceEvent = NetworkEvent
