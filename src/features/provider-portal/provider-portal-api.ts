import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

export type IdentityProviderType = 'link' | 'oidc' | 'proxy'
export type IdentityApplicationStatus = 'draft' | 'enabled' | 'disabled' | 'maintenance'
export type IdentityAssignmentSubjectType = 'user' | 'role' | 'team' | 'tag'

export interface IdentityPrincipal {
  userId: string
  userName: string
  email: string
  roles: string[]
  teams: string[]
  projects: string[]
  tags: string[]
  permissionKeys?: string[]
}

export interface IdentityApplicationAssignment {
  id?: string
  applicationId?: string
  subjectType: IdentityAssignmentSubjectType
  subjectId: string
  effect: 'allow'
  createdBy?: string
  createdAt?: string
}

export interface IdentityApplication {
  id: string
  slug: string
  name: string
  description?: string
  iconUrl?: string
  category?: string
  tags: string[]
  launchUrl?: string
  providerId?: string
  providerType: IdentityProviderType
  portalVisible: boolean
  featured: boolean
  sortOrder: number
  status: IdentityApplicationStatus
  metadata?: Record<string, unknown>
  assignments?: IdentityApplicationAssignment[]
  favorite?: boolean
  lastLaunchedAt?: string
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface IdentityApplicationInput {
 slug: string
 name: string
 description: string
  iconUrl: string
  category: string
  tags: string[]
  launchUrl: string
  providerId: string
  providerType: IdentityProviderType
  portalVisible: boolean
  featured: boolean
  sortOrder: number
  status: IdentityApplicationStatus
  metadata: Record<string, unknown>
 assignments: IdentityApplicationAssignment[]
}

export interface IdentityApplicationPolicy {
  applicationId: string
  applicationSlug: string
  applicationName: string
  category?: string
  providerId?: string
  providerType: IdentityProviderType
  portalVisible: boolean
  status: IdentityApplicationStatus
  assignments: IdentityApplicationAssignment[]
  updatedAt: string
}

export interface IdentityApplicationPolicyInput {
  assignments: IdentityApplicationAssignment[]
}

export interface IdentityApplicationLaunch {
 id: string
 applicationId: string
 applicationName?: string
  userId: string
  providerId?: string
  providerType: IdentityProviderType
  result: string
  reason?: string
  launchUrl?: string
  sourceIp?: string
  userAgent?: string
  createdAt: string
}

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
  categories: string[]
  security: PortalSecuritySummary
}

export interface PortalLaunchDecision {
  application: IdentityApplication
  launchUrl: string
  providerType: IdentityProviderType
  decision: string
}

export const providerPortalQueryKeys = {
  bootstrap: ['provider-portal', 'bootstrap'] as const,
  applications: ['provider-portal', 'applications'] as const,
  application: (applicationId: string) => ['provider-portal', 'applications', applicationId] as const,
  recent: ['provider-portal', 'recent'] as const,
  security: ['provider-portal', 'security'] as const,
}

export function getPortalBootstrap() {
  return api.get<ApiResponse<PortalBootstrap>>('/portal/bootstrap').then((res) => res.data)
}

export function listPortalApplications() {
  return api
    .get<ApiResponse<IdentityApplication[]>>('/portal/applications')
    .then((res) => res.data ?? [])
}

export function getPortalApplication(applicationId: string) {
  return api
    .get<ApiResponse<IdentityApplication>>(`/portal/applications/${encodeURIComponent(applicationId)}`)
    .then((res) => res.data)
}

export function launchPortalApplication(applicationId: string) {
  return api
    .post<ApiResponse<PortalLaunchDecision>>(
      `/portal/applications/${encodeURIComponent(applicationId)}/launch`,
    )
    .then((res) => res.data)
}

export function favoritePortalApplication(applicationId: string) {
  return api
    .post<ApiResponse<IdentityApplication>>(
      `/portal/applications/${encodeURIComponent(applicationId)}/favorite`,
    )
    .then((res) => res.data)
}

export function unfavoritePortalApplication(applicationId: string) {
  return api.delete<ApiResponse<{ status: string }>>(
    `/portal/applications/${encodeURIComponent(applicationId)}/favorite`,
  )
}

export function listPortalRecent(limit = 10) {
  return api
    .get<ApiResponse<IdentityApplicationLaunch[]>>(`/portal/recent?limit=${limit}`)
    .then((res) => res.data ?? [])
}

export function getPortalSecuritySummary() {
  return api.get<ApiResponse<PortalSecuritySummary>>('/portal/security').then((res) => res.data)
}
