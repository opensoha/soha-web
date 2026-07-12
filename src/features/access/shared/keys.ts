export const accessKeys = {
  all: ['access'] as const,
  users: () => [...accessKeys.all, 'users'] as const,
  userList: () => [...accessKeys.users(), 'list'] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  roleList: () => [...accessKeys.roles(), 'list'] as const,
  teams: () => [...accessKeys.all, 'teams'] as const,
  teamList: () => [...accessKeys.teams(), 'list'] as const,
  policies: () => [...accessKeys.all, 'policies'] as const,
  policyList: () => [...accessKeys.policies(), 'list'] as const,
  scopeGrants: () => [...accessKeys.all, 'scope-grants'] as const,
  scopeGrantList: () => [...accessKeys.scopeGrants(), 'list'] as const,
  dependencies: () => [...accessKeys.all, 'dependencies'] as const,
  applicationOptions: () => [...accessKeys.dependencies(), 'applications'] as const,
  loginProviders: () => [...accessKeys.dependencies(), 'login-providers'] as const,
}

export const accessMutationKeys = {
  users: (action: 'create' | 'delete' | 'update') =>
    [...accessKeys.users(), 'mutation', action] as const,
  roles: (action: 'create' | 'delete' | 'update') =>
    [...accessKeys.roles(), 'mutation', action] as const,
  teams: (action: 'create' | 'delete' | 'update') =>
    [...accessKeys.teams(), 'mutation', action] as const,
  policies: (action: 'create' | 'delete' | 'update') =>
    [...accessKeys.policies(), 'mutation', action] as const,
  scopeGrants: (action: 'create' | 'delete' | 'update') =>
    [...accessKeys.scopeGrants(), 'mutation', action] as const,
}
