import type { ResourceYAMLView, ScopeKey } from '@/types'

export type ConfigurationKind =
  | 'configmaps'
  | 'secrets'
  | 'resourcequotas'
  | 'limitranges'
  | 'hpas'
  | 'poddisruptionbudgets'
  | 'priorityclasses'
  | 'runtimeclasses'
  | 'leases'
  | 'mutatingwebhookconfigurations'
  | 'validatingwebhookconfigurations'

export type ConfigurationScopeMode = 'cluster' | 'namespace'

export interface ConfigurationTarget {
  readonly scope: ScopeKey
  readonly name: string
}

export interface ConfigurationResourceRecord {
  readonly name: string
  readonly namespace?: string
  readonly ageSeconds: number
  readonly allowedActions?: string[]
}

export interface ConfigurationDetailBase extends ConfigurationResourceRecord {
  readonly createdAt?: string
  readonly labels?: Record<string, string>
  readonly annotations?: Record<string, string>
}

export interface ConfigurationReference {
  readonly kind: string
  readonly name: string
  readonly namespace: string
  readonly path: string
}

export interface CreateConfigurationVariables {
  readonly scope: ScopeKey
  readonly content: string
}

export interface UpdateConfigurationDataVariables<TPayload> {
  readonly target: ConfigurationTarget
  readonly payload: TPayload
}

export interface UpdateConfigurationYAMLVariables extends ConfigurationTarget {
  readonly content: string
}

export type ConfigurationYAML = ResourceYAMLView
