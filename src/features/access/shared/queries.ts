import { queryOptions } from '@tanstack/react-query'
import { accessApi } from './api'
import { accessKeys } from './keys'

export const accessQueries = {
  users: () =>
    queryOptions({
      queryKey: accessKeys.userList(),
      queryFn: accessApi.users.list,
    }),
  roles: () =>
    queryOptions({
      queryKey: accessKeys.roleList(),
      queryFn: accessApi.roles.list,
    }),
  teams: () =>
    queryOptions({
      queryKey: accessKeys.teamList(),
      queryFn: accessApi.teams.list,
    }),
  policies: () =>
    queryOptions({
      queryKey: accessKeys.policyList(),
      queryFn: accessApi.policies.list,
    }),
  scopeGrants: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.scopeGrantList(),
      queryFn: accessApi.scopeGrants.list,
      enabled,
    }),
  applicationOptions: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.applicationOptions(),
      queryFn: accessApi.dependencies.applications,
      enabled,
    }),
  loginProviders: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.loginProviders(),
      queryFn: accessApi.dependencies.loginProviders,
      enabled,
      retry: false,
    }),
}
