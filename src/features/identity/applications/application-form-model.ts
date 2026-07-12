import type {
  IdentityApplication,
  IdentityApplicationInput,
  IdentityApplicationStatus,
  IdentityAssignmentSubjectType,
  IdentityProviderType,
} from '../shared/types'

export interface IdentityApplicationFormValues {
  assignments: Array<{
    effect: 'allow'
    subjectId: string
    subjectType: IdentityAssignmentSubjectType
  }>
  category: string
  description: string
  featured: boolean
  iconUrl: string
  launchUrl: string
  name: string
  oidcClientId: string
  oidcRedirectUri: string
  oidcScopes: string[]
  portalVisible: boolean
  providerId: string
  providerType: IdentityProviderType
  slug: string
  sortOrder: number
  status: IdentityApplicationStatus
  tags: string[]
}

export const identityApplicationProviderTypeOptions: Array<{
  label: string
  value: IdentityProviderType
}> = [
  { label: 'Link', value: 'link' },
  { label: 'OIDC', value: 'oidc' },
  { label: 'Proxy', value: 'proxy' },
]

export const identityApplicationStatusOptions: Array<{
  label: string
  value: IdentityApplicationStatus
}> = [
  { label: 'Draft', value: 'draft' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Maintenance', value: 'maintenance' },
]

export const identityApplicationAssignmentSubjectOptions: Array<{
  label: string
  value: IdentityAssignmentSubjectType
}> = [
  { label: 'User', value: 'user' },
  { label: 'Role', value: 'role' },
  { label: 'Team', value: 'team' },
  { label: 'Tag', value: 'tag' },
]

export const identityApplicationOIDCScopeOptions = [
  { label: 'openid', value: 'openid' },
  { label: 'profile', value: 'profile' },
  { label: 'email', value: 'email' },
  { label: 'roles', value: 'roles' },
  { label: 'teams', value: 'teams' },
  { label: 'projects', value: 'projects' },
  { label: 'tags', value: 'tags' },
]

function compactStrings(values: string[] = []) {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const normalized = String(value ?? '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    result.push(normalized)
  })
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function metadataObject(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return isRecord(value) ? value : undefined
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const oidc = metadataObject(metadata, 'oidc')
  for (const key of keys) {
    const value = oidc?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function metadataStringList(metadata: Record<string, unknown> | undefined, keys: string[]) {
  const collect = (source?: Record<string, unknown>) => {
    const result: string[] = []
    keys.forEach((key) => {
      const value = source?.[key]
      if (typeof value === 'string') {
        result.push(...value.split(/[,\s]+/))
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') result.push(item)
        })
      }
    })
    return compactStrings(result)
  }
  const topLevel = collect(metadata)
  return topLevel.length ? topLevel : collect(metadataObject(metadata, 'oidc'))
}

export function defaultIdentityApplicationFormValues(): IdentityApplicationFormValues {
  return {
    assignments: [],
    category: '',
    description: '',
    featured: false,
    iconUrl: '',
    launchUrl: '',
    name: '',
    oidcClientId: '',
    oidcRedirectUri: '',
    oidcScopes: [],
    portalVisible: true,
    providerId: '',
    providerType: 'link',
    slug: '',
    sortOrder: 1000,
    status: 'draft',
    tags: [],
  }
}

export function identityApplicationFormValuesFor(
  application: IdentityApplication,
): IdentityApplicationFormValues {
  return {
    assignments: (application.assignments ?? []).map((assignment) => ({
      effect: 'allow',
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
    })),
    category: application.category ?? '',
    description: application.description ?? '',
    featured: application.featured,
    iconUrl: application.iconUrl ?? '',
    launchUrl: application.launchUrl ?? '',
    name: application.name,
    oidcClientId: metadataString(application.metadata, ['oidcClientId', 'clientId']),
    oidcRedirectUri: metadataString(application.metadata, ['oidcRedirectUri', 'redirectUri']),
    oidcScopes: metadataStringList(application.metadata, ['oidcScopes', 'scopes']),
    portalVisible: application.portalVisible,
    providerId: application.providerId ?? '',
    providerType: application.providerType,
    slug: application.slug,
    sortOrder: application.sortOrder,
    status: application.status,
    tags: application.tags ?? [],
  }
}

function metadataFromFormValues(
  values: IdentityApplicationFormValues,
  current?: IdentityApplication | null,
) {
  const metadata: Record<string, unknown> = { ...(current?.metadata ?? {}) }
  delete metadata.oidcClientId
  delete metadata.oidcRedirectUri
  delete metadata.oidcScopes

  if (values.providerType !== 'oidc') {
    delete metadata.oidc
    return metadata
  }

  const oidc: Record<string, unknown> = { ...(metadataObject(metadata, 'oidc') ?? {}) }
  const clientId = values.oidcClientId?.trim()
  const redirectUri = values.oidcRedirectUri?.trim()
  const scopes = compactStrings(values.oidcScopes ?? [])

  if (clientId) oidc.clientId = clientId
  else delete oidc.clientId
  if (redirectUri) oidc.redirectUri = redirectUri
  else delete oidc.redirectUri
  if (scopes.length) oidc.scopes = scopes
  else delete oidc.scopes

  if (Object.keys(oidc).length) metadata.oidc = oidc
  else delete metadata.oidc
  return metadata
}

export function buildIdentityApplicationInput(
  values: IdentityApplicationFormValues,
  current?: IdentityApplication | null,
): IdentityApplicationInput {
  return {
    assignments: (values.assignments ?? [])
      .filter((assignment) => String(assignment.subjectId ?? '').trim())
      .map((assignment) => ({
        effect: 'allow',
        subjectId: assignment.subjectId.trim(),
        subjectType: assignment.subjectType || 'role',
      })),
    category: values.category?.trim() ?? '',
    description: values.description?.trim() ?? '',
    featured: Boolean(values.featured),
    iconUrl: values.iconUrl?.trim() ?? '',
    launchUrl: values.launchUrl?.trim() ?? '',
    metadata: metadataFromFormValues(values, current),
    name: values.name.trim(),
    portalVisible: Boolean(values.portalVisible),
    providerId: current ? (values.providerId?.trim() ?? '') : '',
    providerType: values.providerType || 'link',
    slug: values.slug?.trim() ?? '',
    sortOrder: Number(values.sortOrder || 1000),
    status: values.status || 'draft',
    tags: compactStrings(values.tags),
  }
}
