import type {
  IdentityApplication,
  IdentityApplicationLaunch,
  IdentityPrincipal,
  IdentityProviderType,
} from '@/features/identity'

export interface PortalSecuritySummary {
  principal: IdentityPrincipal
  mfaEnabled: boolean
  linkedSources: string[]
  activeSession: number
  recentLoginAt?: string
}

export interface PortalBootstrap {
  principal: IdentityPrincipal
  applications: IdentityApplication[]
  favorites: IdentityApplication[]
  recent: IdentityApplicationLaunch[]
  security: PortalSecuritySummary
}

export interface PortalLaunchDecision {
  application: IdentityApplication
  launchUrl: string
  providerType: IdentityProviderType
  decision: string
}
