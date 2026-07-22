import type {
  SystemIntegration,
  SystemIntegrationCreateRequest,
  SystemIntegrationUpdateRequest,
} from './types'

export interface GitLabFormValues {
  name: string
  description?: string
  enabled: boolean
  baseUrl: string
  groupId?: string
  perPage: number
  timeout: string
  token?: string
}

function configurationValue(item: SystemIntegration, key: string) {
  return item.configuration.find((field) => field.key === key)?.value ?? ''
}

export function gitLabFormValues(item?: SystemIntegration): GitLabFormValues {
  return {
    name: item?.name ?? 'GitLab',
    description: item?.description ?? '',
    enabled: item?.enabled ?? true,
    baseUrl: item ? configurationValue(item, 'base_url') : 'https://gitlab.com/api/v4',
    groupId: item ? configurationValue(item, 'group_id') : '',
    perPage: Number(item ? configurationValue(item, 'per_page') : '100') || 100,
    timeout: item ? configurationValue(item, 'timeout') || '15s' : '15s',
    token: '',
  }
}

function gitLabConfiguration(values: GitLabFormValues) {
  return [
    { key: 'base_url', value: values.baseUrl.trim() },
    { key: 'group_id', value: values.groupId?.trim() ?? '' },
    { key: 'per_page', value: String(values.perPage) },
    { key: 'timeout', value: values.timeout.trim() },
  ]
}

export function createGitLabIntegration(values: GitLabFormValues): SystemIntegrationCreateRequest {
  return {
    category: 'source_control',
    providerType: 'gitlab',
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    enabled: values.enabled,
    configuration: gitLabConfiguration(values),
    credentials: values.token?.trim() ? [{ key: 'token', value: values.token.trim() }] : undefined,
  }
}

export function updateGitLabIntegration(
  item: SystemIntegration,
  values: GitLabFormValues,
): SystemIntegrationUpdateRequest {
  return {
    expectedVersion: item.version,
    name: values.name.trim(),
    description: values.description?.trim() ?? '',
    enabled: values.enabled,
    configuration: gitLabConfiguration(values),
    credentials: values.token?.trim() ? [{ key: 'token', value: values.token.trim() }] : undefined,
  }
}
