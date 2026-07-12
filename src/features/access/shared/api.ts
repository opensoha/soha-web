import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  AccessApplicationOption,
  AccessIdentitySettings,
  AccessMutationValues,
  AccessPolicy,
  AccessRole,
  AccessScopeGrant,
  AccessTeam,
  AccessUpdateVariables,
  AccessUser,
} from './types'

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

async function discard(request: Promise<unknown>): Promise<void> {
  await request
}

function resourcePath(resource: string, id: string) {
  return `/${resource}/${encodeURIComponent(id)}`
}

export const accessApi = {
  users: {
    list: () => unwrap(api.get<ApiResponse<AccessUser[]>>('/access/users')),
    create: (values: AccessMutationValues) => discard(api.post('/access/users', values)),
    update: ({ id, values }: AccessUpdateVariables) =>
      discard(api.put(resourcePath('access/users', id), values)),
    delete: (id: string) => discard(api.delete(resourcePath('access/users', id))),
  },
  roles: {
    list: () => unwrap(api.get<ApiResponse<AccessRole[]>>('/access/roles')),
    create: (values: AccessMutationValues) => discard(api.post('/access/roles', values)),
    update: ({ id, values }: AccessUpdateVariables) =>
      discard(api.put(resourcePath('access/roles', id), values)),
    delete: (id: string) => discard(api.delete(resourcePath('access/roles', id))),
  },
  teams: {
    list: () => unwrap(api.get<ApiResponse<AccessTeam[]>>('/access/teams')),
    create: (values: AccessMutationValues) => discard(api.post('/access/teams', values)),
    update: ({ id, values }: AccessUpdateVariables) =>
      discard(api.put(resourcePath('access/teams', id), values)),
    delete: (id: string) => discard(api.delete(resourcePath('access/teams', id))),
  },
  policies: {
    list: () => unwrap(api.get<ApiResponse<AccessPolicy[]>>('/access/policies')),
    create: (values: AccessMutationValues) => discard(api.post('/access/policies', values)),
    update: ({ id, values }: AccessUpdateVariables) =>
      discard(api.put(resourcePath('access/policies', id), values)),
    delete: (id: string) => discard(api.delete(resourcePath('access/policies', id))),
  },
  scopeGrants: {
    list: () => unwrap(api.get<ApiResponse<AccessScopeGrant[]>>('/access/scope-grants')),
    create: (values: AccessMutationValues) => discard(api.post('/access/scope-grants', values)),
    update: ({ id, values }: AccessUpdateVariables) =>
      discard(api.put(resourcePath('access/scope-grants', id), values)),
    delete: (id: string) => discard(api.delete(resourcePath('access/scope-grants', id))),
  },
  dependencies: {
    applications: () => unwrap(api.get<ApiResponse<AccessApplicationOption[]>>('/applications')),
    loginProviders: async () => {
      const settings = await unwrap(
        api.get<ApiResponse<AccessIdentitySettings>>('/settings/identity'),
      )
      return Array.isArray(settings?.providers) ? settings.providers : []
    },
  },
}
