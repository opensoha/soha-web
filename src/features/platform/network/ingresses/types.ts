import type { NetworkResourceRecord } from '../shared/types'

export interface Ingress extends NetworkResourceRecord {
  readonly namespace: string
  readonly className?: string
  readonly hosts: string[]
  readonly address: string
  readonly backendServices?: string[]
}
