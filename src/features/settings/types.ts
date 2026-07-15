import type { BrandingSettings } from '@/types'

export interface SettingsPageProps {
  embedded?: boolean
}

export interface LoginProviderSettings {
  id: string
  name: string
  type: string
  iconUrl: string
  enabled: boolean
  clientId: string
  clientSecret: string
  issuer: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  profileUrl: string
  redirectUrl: string
  frontendRedirectUrl: string
  scopes: string[]
  defaultRoles: string[]
  userIdField: string
  userNameField: string
  emailField: string
  phoneField: string
  avatarField: string
  roleField: string
  organizationField: string
  syncRolesOnLogin: boolean
  syncOrgsOnLogin: boolean
  roleSyncMode: string
  orgSyncMode: string
  metadataUrl: string
  entityId: string
  certificate: string
}

export interface IdentitySettings {
  providers: LoginProviderSettings[]
  defaultProviderId: string
  localPasswordLoginEnabled: boolean
}

export interface IdentitySettingsResponse {
  providers?: LoginProviderSettings[]
  defaultProviderId?: string
  localPasswordLoginEnabled?: boolean
}

export interface SaveIdentitySettingsInput {
  values: Record<string, unknown>
  successMessage?: string
}

export interface DataSourceCapability {
  id: string
  name: string
  sourceKind: string
  supportedBackends?: string[]
}

export type { BrandingSettings }
