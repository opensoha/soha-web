import { queryOptions } from '@tanstack/react-query'
import { accessApi } from './api'
import { accessKeys } from './keys'

export const accessQueries = {
  users: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.userList(),
      queryFn: accessApi.users.list,
      enabled,
    }),
  roles: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.roleList(),
      queryFn: accessApi.roles.list,
      enabled,
    }),
  teams: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.teamList(),
      queryFn: accessApi.teams.list,
      enabled,
    }),
  policies: (enabled = true) =>
    queryOptions({
      queryKey: accessKeys.policyList(),
      queryFn: accessApi.policies.list,
      enabled,
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
