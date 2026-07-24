import { describe, expect, it, vi } from 'vitest'
import { accessRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  users: () => null,
  roles: () => null,
  teams: () => null,
  policies: () => null,
  directorySync: () => null,
  scopeGrants: () => null,
}))

vi.mock('./users/page', () => ({ AccessUsersPage: routePages.users }))
vi.mock('./roles/page', () => ({ AccessRolesPage: routePages.roles }))
vi.mock('./teams/page', () => ({ AccessTeamsPage: routePages.teams }))
vi.mock('./policies/page', () => ({ AccessPoliciesPage: routePages.policies }))
vi.mock('./directory-sync/page', () => ({ DirectorySyncPage: routePages.directorySync }))
vi.mock('./scope-grants/page', () => ({ AccessScopeGrantsPage: routePages.scopeGrants }))

describe('access route manifest', () => {
  it('maps all access routes to distinct leaf modules', async () => {
    const expectedPages = new Map([
      ['access-users', routePages.users],
      ['access-roles', routePages.roles],
      ['access-teams', routePages.teams],
      ['access-policies', routePages.policies],
      ['access-directory-sync', routePages.directorySync],
      ['access-scope-grants', routePages.scopeGrants],
    ])

    const loadedPages = await Promise.all(
      accessRoutes.map(async (route) => {
        const module = await route.load()
        expect(module.default).toBe(expectedPages.get(route.meta.id))
        return module.default
      }),
    )

    expect(loadedPages).toHaveLength(6)
    expect(new Set(loadedPages).size).toBe(6)
  })

  it('preserves access paths, permissions, and navigation metadata', () => {
    expect(
      accessRoutes.map((route) => ({
        id: route.meta.id,
        navVisible: route.meta.navVisible,
        path: route.meta.path,
        permissionKey: route.meta.permissionKey,
      })),
    ).toEqual([
      {
        id: 'access-users',
        navVisible: true,
        path: '/access/users',
        permissionKey: 'access.users.view',
      },
      {
        id: 'access-roles',
        navVisible: true,
        path: '/access/roles',
        permissionKey: 'access.roles.view',
      },
      {
        id: 'access-teams',
        navVisible: true,
        path: '/access/teams',
        permissionKey: 'access.groups.view',
      },
      {
        id: 'access-policies',
        navVisible: true,
        path: '/access/policies',
        permissionKey: 'access.policies.view',
      },
      {
        id: 'access-directory-sync',
        navVisible: true,
        path: '/access/directory-sync',
        permissionKey: 'access.directory.view',
      },
      {
        id: 'access-scope-grants',
        navVisible: false,
        path: '/access/scope-grants',
        permissionKey: 'access.scope-grants.view',
      },
    ])
  })
})
