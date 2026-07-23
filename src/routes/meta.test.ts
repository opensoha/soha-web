import { describe, expect, it } from 'vitest'
import type { PermissionSnapshot, RouteMeta } from '@/types'
import {
  canAccessRoute,
  filterSidebarNavByWorkbench,
  filterSidebarNavByWorkspace,
  findFirstAccessiblePathForWorkbench,
  findFirstAccessiblePathForWorkspace,
  findLandingPath,
  findPreferredWorkspace,
  getAccessibleSidebarNav,
  getAccessibleWorkbenchIds,
  getAccessibleWorkspaces,
  getMenuWorkbenchId,
  getRouteScopeMode,
  getRouteWorkbenchId,
  getRouteWorkspace,
  routeMeta,
} from './meta'

function buildSnapshot(overrides?: Partial<PermissionSnapshot>): PermissionSnapshot {
  return {
    permissionKeys: [],
    visibleMenuIds: [],
    visibleMenus: [],
    ...overrides,
  }
}

function getRoute(id: string): RouteMeta {
  const route = routeMeta.find((item) => item.id === id)
  if (!route) {
    throw new Error(`missing route meta: ${id}`)
  }
  return route
}

describe('access route authorization', () => {
  it('requires the enabled internal workbench menu binding for the portal', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['identity.portal.view'],
      visibleMenuIds: ['home-workbench'],
      visibleMenus: [{ id: 'home-workbench', path: '/portal' }],
    })

    expect(canAccessRoute(getRoute('provider-portal'), snapshot)).toBe(true)
    expect(getAccessibleWorkbenchIds(snapshot)).toContain('home')
    expect(
      canAccessRoute(
        getRoute('provider-portal'),
        buildSnapshot({ permissionKeys: ['identity.portal.view'] }),
      ),
    ).toBe(false)
    expect(findLandingPath(snapshot)).toBe('/portal')
  })

  it('allows the access parent route when any visible child permission is present', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['access.roles.view'],
      visibleMenuIds: ['access-roles'],
      visibleMenus: [{ id: 'access-roles', path: '/access/roles' }],
    })

    expect(canAccessRoute(getRoute('access'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('access-roles'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('access-users'), snapshot)).toBe(false)
  })

  it('keeps directory sync reachable while an older snapshot lacks its seeded menu', () => {
    const allowedSnapshot = buildSnapshot({
      permissionKeys: ['access.directory.view'],
      visibleMenuIds: ['access'],
      visibleMenus: [{ id: 'access', path: '/access' }],
    })
    const deniedSnapshot = buildSnapshot({
      visibleMenuIds: ['access'],
      visibleMenus: [{ id: 'access', path: '/access' }],
    })

    expect(canAccessRoute(getRoute('access-directory-sync'), allowedSnapshot)).toBe(true)
    expect(canAccessRoute(getRoute('access-directory-sync'), deniedSnapshot)).toBe(false)
    expect(
      filterSidebarNavByWorkbench(
        filterSidebarNavByWorkspace(getAccessibleSidebarNav(allowedSnapshot), 'system'),
        'settings',
      ).some((item) => item.id === 'access-directory-sync'),
    ).toBe(true)
  })

  it('keeps account utilities independent from admin settings menu bindings', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['settings.identity.view', 'settings.branding.view'],
      visibleMenuIds: ['settings', 'settings-login', 'settings-branding'],
      visibleMenus: [
        { id: 'settings', path: '/settings' },
        { id: 'settings-login', parentId: 'settings', path: '/settings/login' },
        {
          id: 'settings-branding',
          parentId: 'settings',
          path: '/settings/branding',
        },
      ],
    })

    expect(canAccessRoute(getRoute('settings'))).toBe(false)
    expect(canAccessRoute(getRoute('account-settings'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('account-profile'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('about'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('settings-login'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('settings-branding'), snapshot)).toBe(true)
  })

  it('treats settings center as a workbench with access-control, system, and setting menus', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'access.users.view',
        'access.roles.view',
        'access.groups.view',
        'access.policies.view',
        'identity.applications.view',
        'identity.providers.view',
        'identity.outposts.view',
        'identity.policies.view',
        'identity.audit.view',
        'system.online-users.view',
        'system.announcements.view',
        'system.menus.view',
        'system.audit.view',
        'system.operations.view',
        'settings.identity.view',
        'settings.branding.view',
      ],
      visibleMenuIds: [
        'access',
        'access-users',
        'access-roles',
        'access-teams',
        'access-policies',
        'identity',
        'identity-overview',
        'identity-applications',
        'identity-providers',
        'identity-outposts',
        'identity-policies',
        'system',
        'system-online-users',
        'announcements',
        'menus',
        'audit',
        'operations',
        'settings',
        'account-profile',
        'settings-about',
        'settings-login',
        'settings-branding',
      ],
      visibleMenus: [
        { id: 'access', path: '/access', section: 'admin', sortOrder: 240 },
        { id: 'access-users', path: '/access/users', section: 'users', sortOrder: 10 },
        { id: 'access-roles', path: '/access/roles', section: 'users', sortOrder: 20 },
        { id: 'access-teams', path: '/access/teams', section: 'users', sortOrder: 30 },
        { id: 'access-policies', path: '/access/policies', section: 'users', sortOrder: 40 },
        { id: 'identity', path: '/identity', section: 'admin', sortOrder: 220 },
        {
          id: 'identity-overview',
          parentId: 'identity',
          path: '/identity/overview',
          section: '',
          sortOrder: 1,
        },
        {
          id: 'identity-applications',
          parentId: 'identity',
          path: '/identity/applications',
          section: 'provider',
          sortOrder: 10,
        },
        {
          id: 'identity-providers',
          parentId: 'identity',
          path: '/identity/providers',
          section: 'provider',
          sortOrder: 20,
        },
        {
          id: 'identity-outposts',
          parentId: 'identity',
          path: '/identity/outposts',
          section: 'provider',
          sortOrder: 30,
        },
        {
          id: 'identity-policies',
          parentId: 'identity',
          path: '/identity/policies',
          section: 'provider',
          sortOrder: 40,
        },
        { id: 'system', path: '/system', section: 'admin', sortOrder: 225 },
        {
          id: 'system-online-users',
          parentId: 'system',
          path: '/system/online-users',
          section: 'operations',
          sortOrder: 40,
        },
        {
          id: 'announcements',
          parentId: 'system',
          path: '/system/announcements',
          section: 'operations',
          sortOrder: 30,
        },
        { id: 'menus', parentId: 'system', path: '/system/menus', section: 'users', sortOrder: 50 },
        {
          id: 'audit',
          parentId: 'system',
          path: '/system/audit',
          section: 'operations',
          sortOrder: 60,
        },
        {
          id: 'operations',
          parentId: 'system',
          path: '/system/operations',
          section: 'operations',
          sortOrder: 50,
        },
        { id: 'settings', path: '/settings', section: 'admin', sortOrder: 260 },
        {
          id: 'account-profile',
          parentId: 'settings',
          path: '/account/profile',
          section: 'account',
          sortOrder: 10,
        },
        {
          id: 'settings-about',
          parentId: 'settings',
          path: '/settings/about',
          section: 'account',
          sortOrder: 20,
        },
        {
          id: 'settings-login',
          parentId: 'settings',
          path: '/settings/login',
          section: 'users',
          sortOrder: 60,
        },
        {
          id: 'settings-branding',
          parentId: 'settings',
          path: '/settings/branding',
          section: 'operations',
          sortOrder: 70,
        },
      ],
    })

    const systemNav = filterSidebarNavByWorkspace(getAccessibleSidebarNav(snapshot), 'system')
    const settingsNav = filterSidebarNavByWorkbench(systemNav, 'settings')

    expect(getRouteWorkbenchId(getRoute('settings-login'))).toBe('settings')
    expect(getRouteWorkbenchId(getRoute('identity-providers'))).toBe('security')
    expect(getRouteWorkbenchId(getRoute('provider-portal'))).toBe('home')
    expect(getRouteWorkbenchId(getRoute('account-settings'))).toBeNull()
    expect(getRouteWorkbenchId(getRoute('account-profile'))).toBeNull()
    expect(getRouteWorkbenchId(getRoute('about'))).toBeNull()
    expect(getRouteWorkbenchId(getRoute('access-users'))).toBe('settings')
    expect(getRouteWorkbenchId(getRoute('system-menus'))).toBe('settings')
    expect(getMenuWorkbenchId({ id: 'settings-login', path: '/settings/login' })).toBe('settings')
    expect(getMenuWorkbenchId({ id: 'access', path: '/access' })).toBe('settings')
    expect(getMenuWorkbenchId({ id: 'menus', path: '/system/menus' })).toBe('settings')
    expect(getAccessibleWorkbenchIds(snapshot)).toContain('settings')
    expect(findFirstAccessiblePathForWorkbench('settings', snapshot)).toBe('/settings/login')
    expect(settingsNav.map((item) => item.id)).toEqual([
      'access-users',
      'access-roles',
      'access-teams',
      'access-policies',
      'menus',
      'settings-login',
      'announcements',
      'system-online-users',
      'operations',
      'audit',
      'settings-branding',
    ])
    expect(settingsNav.find((item) => item.id === 'access')).toBeUndefined()
    expect(settingsNav.find((item) => item.id === 'access-users')?.children).toBeUndefined()
  })

  it('does not expose settings center without a navigable settings route', () => {
    const resourceOnlySnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'overview.view'],
      visibleMenuIds: ['dashboard'],
      visibleMenus: [{ id: 'dashboard', path: '/' }],
    })
    const hiddenSettingsOnlySnapshot = buildSnapshot({
      permissionKeys: ['settings.ai.view'],
      visibleMenuIds: ['settings'],
      visibleMenus: [{ id: 'settings', path: '/settings' }],
    })

    expect(canAccessRoute(getRoute('system'), resourceOnlySnapshot)).toBe(false)
    expect(getAccessibleWorkbenchIds(resourceOnlySnapshot)).not.toContain('settings')
    expect(getAccessibleWorkbenchIds(hiddenSettingsOnlySnapshot)).not.toContain('settings')
    expect(findFirstAccessiblePathForWorkbench('settings', hiddenSettingsOnlySnapshot)).toBeNull()
  })

  it('allows account utilities without exposing the settings workbench', () => {
    const snapshot = buildSnapshot()

    expect(canAccessRoute(getRoute('account-settings'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('account-profile'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('about'), snapshot)).toBe(true)
    expect(getAccessibleWorkbenchIds(snapshot)).not.toContain('settings')
    expect(findFirstAccessiblePathForWorkbench('settings', snapshot)).toBeNull()
  })

  it('keeps the access parent route blocked when the access menu binding is missing', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['access.roles.view'],
      visibleMenuIds: [],
      visibleMenus: [],
    })

    expect(canAccessRoute(getRoute('access'), snapshot)).toBe(false)
    expect(canAccessRoute(getRoute('access-roles'), snapshot)).toBe(false)
  })

  it('allows scope-grants direct routing from its dedicated view permission', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['access.scope-grants.view'],
    })

    expect(canAccessRoute(getRoute('access-scope-grants'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('access'), snapshot)).toBe(false)
  })

  it('allows RBAC platform child routes from visible menu bindings without a dedicated permission key', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view'],
      visibleMenuIds: ['platform-access-control'],
      visibleMenus: [{ id: 'platform-access-control', path: '/platform-access-control' }],
    })

    expect(canAccessRoute(getRoute('platform-access-control'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('platform-access-control-clusterroles'), snapshot)).toBe(true)
  })

  it('inherits RBAC list access for hidden detail routes', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view'],
      visibleMenuIds: ['platform-access-control'],
      visibleMenus: [{ id: 'platform-access-control', path: '/platform-access-control' }],
    })

    expect(
      canAccessRoute(getRoute('platform-access-control-serviceaccount-detail'), snapshot),
    ).toBe(true)
    expect(canAccessRoute(getRoute('platform-access-control-rolebinding-detail'), snapshot)).toBe(
      true,
    )
  })

  it('blocks RBAC platform child routes when the RBAC menu binding is missing', () => {
    const snapshot = buildSnapshot({
      visibleMenuIds: [],
      visibleMenus: [],
    })

    expect(canAccessRoute(getRoute('platform-access-control'), snapshot)).toBe(false)
    expect(canAccessRoute(getRoute('platform-access-control-rolebindings'), snapshot)).toBe(false)
  })

  it('builds sidebar nav from visible menu tree instead of flattening children', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['system.menus.view', 'system.audit.view'],
      visibleMenuIds: ['system', 'menus', 'audit'],
      visibleMenus: [
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'audit',
          parentId: 'system',
          path: '/system/audit',
          labelZh: '审计日志',
          labelEn: 'Audit',
          iconKey: 'file-clock',
          section: 'admin',
          sortOrder: 2,
          enabled: true,
        },
        {
          id: 'menus',
          parentId: 'system',
          path: '/system/menus',
          labelZh: '菜单管理',
          labelEn: 'Menus',
          iconKey: 'menu-square',
          section: 'admin',
          sortOrder: 1,
          enabled: true,
        },
      ],
    })

    const nav = getAccessibleSidebarNav(snapshot)
    expect(nav).toHaveLength(1)
    expect(nav[0].id).toBe('system')
    expect(nav[0].children?.map((item) => item.id)).toEqual(['menus', 'audit'])
  })

  it('orders runtime roots by backend section and preserves backend icon keys', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'system.menus.view',
      ],
      visibleMenuIds: ['builds', 'system', 'menus'],
      visibleMenus: [
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 50,
          enabled: true,
        },
        {
          id: 'menus',
          parentId: 'system',
          path: '/system/menus',
          labelZh: '菜单管理',
          labelEn: 'Menus',
          iconKey: 'menu-square',
          section: 'admin',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'builds',
          path: '/applications',
          labelZh: '应用中心',
          labelEn: 'Applications',
          iconKey: 'blocks',
          section: 'deliver',
          sortOrder: 5,
          enabled: true,
        },
      ],
    })

    const nav = getAccessibleSidebarNav(snapshot)
    expect(nav.map((item) => item.id)).toEqual(['builds', 'system'])
    expect(nav[0].iconKey).toBe('blocks')
    expect(nav[1].iconKey).toBe('panels-top-left')
  })

  it('derives route workspace ownership for application, resource, and system routes', () => {
    expect(getRouteWorkspace(getRoute('applications'))).toBe('application')
    expect(getRouteWorkspace(getRoute('delivery-onboarding'))).toBe('application')
    expect(getRouteWorkspace(getRoute('delivery-testing'))).toBe('application')
    expect(getRouteWorkspace(getRoute('delivery-analysis'))).toBe('application')
    expect(getRouteWorkspace(getRoute('workloads-pods'))).toBe('resource')
    expect(getRouteWorkspace(getRoute('system-menus'))).toBe('system')
    expect(getRouteWorkspace(getRoute('account-settings'))).toBeNull()
    expect(getRouteWorkspace(getRoute('account-profile'))).toBeNull()
    expect(getRouteWorkspace(getRoute('about'))).toBeNull()
  })

  it('requires workspace permissions for business routes', () => {
    const appSnapshot = buildSnapshot({
      permissionKeys: ['delivery.applications.view'],
      visibleMenuIds: ['builds'],
      visibleMenus: [{ id: 'builds', path: '/applications' }],
    })
    const resourceSnapshot = buildSnapshot({
      permissionKeys: ['platform.workloads.view'],
      visibleMenuIds: ['workloads'],
      visibleMenus: [{ id: 'workloads', path: '/workloads' }],
    })

    expect(canAccessRoute(getRoute('applications'), appSnapshot)).toBe(false)
    expect(canAccessRoute(getRoute('workloads'), resourceSnapshot)).toBe(false)
  })

  it('filters business and system sidebar trees by workspace', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'workspace.resource.view',
        'delivery.applications.view',
        'delivery.application-environments.view',
        'system.menus.view',
      ],
      visibleMenuIds: ['builds', 'application-environments', 'system', 'menus'],
      visibleMenus: [
        {
          id: 'builds',
          path: '/applications',
          labelZh: '应用中心',
          labelEn: 'Applications',
          iconKey: 'blocks',
          section: 'deliver',
          sortOrder: 5,
          enabled: true,
        },
        {
          id: 'application-environments',
          path: '/application-environments',
          labelZh: '应用环境绑定',
          labelEn: 'Application Bindings',
          iconKey: 'blocks',
          section: 'catalog',
          sortOrder: 99,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 50,
          enabled: true,
        },
        {
          id: 'menus',
          parentId: 'system',
          path: '/system/menus',
          labelZh: '菜单管理',
          labelEn: 'Menus',
          iconKey: 'menu-square',
          section: 'admin',
          sortOrder: 10,
          enabled: true,
        },
      ],
    })

    const nav = getAccessibleSidebarNav(snapshot)
    const applicationNav = filterSidebarNavByWorkspace(nav, 'application')
    const systemNav = filterSidebarNavByWorkspace(nav, 'system')

    expect(applicationNav.map((item) => item.id)).toEqual(['builds', 'application-environments'])
    expect(applicationNav[0].section).toBe('delivery')
    expect(applicationNav[1].section).toBe('delivery-platform')
    expect(systemNav.map((item) => item.id)).toEqual(['system'])
  })

  it('pins application center to the first delivery workbench menu row', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'delivery.application-environments.view',
        'delivery.release-board.view',
      ],
      visibleMenuIds: ['release-board', 'application-environments', 'builds'],
      visibleMenus: [
        {
          id: 'release-board',
          path: '/release-board',
          labelZh: '构建发布',
          labelEn: 'Build & Release',
          iconKey: 'activity',
          section: 'deliver',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'application-environments',
          path: '/application-environments',
          labelZh: '应用环境绑定',
          labelEn: 'Application Bindings',
          iconKey: 'blocks',
          section: 'deliver',
          sortOrder: 2,
          enabled: true,
        },
        {
          id: 'builds',
          path: '/applications',
          labelZh: '应用中心',
          labelEn: 'Applications',
          iconKey: 'blocks',
          section: 'deliver',
          sortOrder: 99,
          enabled: true,
        },
      ],
    })

    const deliveryNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(getAccessibleSidebarNav(snapshot), 'application'),
      'delivery',
    )

    expect(deliveryNav.map((item) => item.id)).toEqual([
      'builds',
      'release-board',
      'application-environments',
    ])
    expect(deliveryNav.map((item) => item.section)).toEqual([
      'delivery',
      'delivery',
      'delivery-platform',
    ])
  })

  it('groups delivery workbench menus by user task while accepting legacy backend sections', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'delivery.release-board.view',
        'delivery.release-bundles.view',
        'delivery.execution-tasks.view',
        'delivery.workflows.view',
        'delivery.releases.view',
        'delivery.workflow-templates.view',
      ],
      visibleMenuIds: [
        'builds',
        'delivery-onboarding',
        'release-board',
        'delivery-testing',
        'delivery-analysis',
        'release-bundles',
        'execution-tasks',
        'workflows',
        'releases',
        'workflow-templates',
      ],
      visibleMenus: [
        { id: 'workflow-templates', path: '/workflow-templates', section: 'deliver', sortOrder: 1 },
        {
          id: 'execution-tasks',
          path: '/delivery/execution-tasks',
          section: 'deliver',
          sortOrder: 2,
        },
        { id: 'releases', path: '/releases', section: 'deliver', sortOrder: 3 },
        {
          id: 'release-bundles',
          path: '/delivery/release-bundles',
          section: 'deliver',
          sortOrder: 4,
        },
        { id: 'release-board', path: '/release-board', section: 'deliver', sortOrder: 5 },
        { id: 'workflows', path: '/workflows', section: 'deliver', sortOrder: 6 },
        { id: 'delivery-analysis', path: '/delivery/analysis', section: 'deliver', sortOrder: 7 },
        { id: 'delivery-testing', path: '/delivery/testing', section: 'deliver', sortOrder: 8 },
        {
          id: 'delivery-onboarding',
          path: '/delivery/onboarding',
          section: 'deliver',
          sortOrder: 9,
        },
        { id: 'builds', path: '/applications', section: 'deliver', sortOrder: 99 },
      ],
    })

    const deliveryNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(getAccessibleSidebarNav(snapshot), 'application'),
      'delivery',
    )

    expect(deliveryNav.map((item) => `${item.id}:${item.section}`)).toEqual([
      'builds:delivery',
      'delivery-onboarding:delivery',
      'release-board:delivery',
      'delivery-testing:delivery',
      'delivery-analysis:delivery',
      'release-bundles:delivery-records',
      'execution-tasks:delivery-records',
      'workflows:delivery-records',
      'releases:delivery-records',
      'workflow-templates:delivery-platform',
    ])
  })

  it('matches delivery navigation to tester, readonly, and operator responsibilities', () => {
    const testerSnapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'delivery.application-services.view',
        'delivery.application-environments.view',
        'delivery.release-bundles.view',
        'delivery.execution-tasks.view',
      ],
      visibleMenuIds: [
        'builds',
        'delivery-testing',
        'delivery-analysis',
        'release-bundles',
        'execution-tasks',
      ],
      visibleMenus: [
        { id: 'builds', path: '/applications', section: 'delivery', sortOrder: 10 },
        { id: 'delivery-testing', path: '/delivery/testing', section: 'delivery', sortOrder: 40 },
        { id: 'delivery-analysis', path: '/delivery/analysis', section: 'delivery', sortOrder: 50 },
        {
          id: 'release-bundles',
          path: '/delivery/release-bundles',
          section: 'delivery-records',
          sortOrder: 10,
        },
        {
          id: 'execution-tasks',
          path: '/delivery/execution-tasks',
          section: 'delivery-records',
          sortOrder: 20,
        },
      ],
    })
    const readonlySnapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'delivery.application-services.view',
        'delivery.application-environments.view',
        'delivery.release-board.view',
        'delivery.release-bundles.view',
        'delivery.execution-tasks.view',
        'delivery.workflows.view',
        'delivery.releases.view',
      ],
      visibleMenuIds: [
        'builds',
        'delivery-testing',
        'delivery-analysis',
        'release-bundles',
        'execution-tasks',
        'workflows',
        'releases',
      ],
      visibleMenus: [
        { id: 'builds', path: '/applications', section: 'delivery', sortOrder: 10 },
        { id: 'delivery-testing', path: '/delivery/testing', section: 'delivery', sortOrder: 40 },
        { id: 'delivery-analysis', path: '/delivery/analysis', section: 'delivery', sortOrder: 50 },
        {
          id: 'release-bundles',
          path: '/delivery/release-bundles',
          section: 'delivery-records',
          sortOrder: 10,
        },
        {
          id: 'execution-tasks',
          path: '/delivery/execution-tasks',
          section: 'delivery-records',
          sortOrder: 20,
        },
        { id: 'workflows', path: '/workflows', section: 'delivery-records', sortOrder: 30 },
        { id: 'releases', path: '/releases', section: 'delivery-records', sortOrder: 40 },
      ],
    })
    const operatorSnapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'delivery.application-environments.view',
        'delivery.release-board.view',
        'delivery.build-templates.view',
        'delivery.workflow-templates.view',
        'delivery.registries.view',
      ],
      visibleMenuIds: [
        'builds',
        'release-board',
        'application-environments',
        'build-templates',
        'workflow-templates',
        'registries',
      ],
      visibleMenus: [
        { id: 'builds', path: '/applications', section: 'delivery', sortOrder: 10 },
        { id: 'release-board', path: '/release-board', section: 'delivery', sortOrder: 30 },
        {
          id: 'build-templates',
          path: '/build-templates',
          section: 'delivery-platform',
          sortOrder: 20,
        },
        {
          id: 'workflow-templates',
          path: '/workflow-templates',
          section: 'delivery-platform',
          sortOrder: 30,
        },
        {
          id: 'application-environments',
          path: '/application-environments',
          section: 'delivery-platform',
          sortOrder: 50,
        },
        { id: 'registries', path: '/registries', section: 'delivery-platform', sortOrder: 70 },
      ],
    })

    const testerNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(getAccessibleSidebarNav(testerSnapshot), 'application'),
      'delivery',
    )
    const readonlyNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(getAccessibleSidebarNav(readonlySnapshot), 'application'),
      'delivery',
    )
    const operatorNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(getAccessibleSidebarNav(operatorSnapshot), 'application'),
      'delivery',
    )

    expect(testerNav.map((item) => item.id)).toEqual([
      'builds',
      'delivery-testing',
      'delivery-analysis',
      'release-bundles',
      'execution-tasks',
    ])
    expect(canAccessRoute(getRoute('release-board'), testerSnapshot)).toBe(false)
    expect(canAccessRoute(getRoute('delivery-onboarding'), testerSnapshot)).toBe(false)
    expect(canAccessRoute(getRoute('build-templates'), testerSnapshot)).toBe(false)

    expect(readonlyNav.map((item) => item.id)).toEqual([
      'builds',
      'delivery-testing',
      'delivery-analysis',
      'release-bundles',
      'execution-tasks',
      'workflows',
      'releases',
    ])
    expect(canAccessRoute(getRoute('release-board'), readonlySnapshot)).toBe(false)
    expect(canAccessRoute(getRoute('application-environments'), readonlySnapshot)).toBe(false)
    expect(canAccessRoute(getRoute('workflow-templates'), readonlySnapshot)).toBe(false)

    expect(operatorNav.map((item) => item.id)).toEqual([
      'builds',
      'release-board',
      'build-templates',
      'workflow-templates',
      'application-environments',
      'registries',
    ])
    expect(canAccessRoute(getRoute('application-environments'), operatorSnapshot)).toBe(true)
    expect(canAccessRoute(getRoute('workflow-templates'), operatorSnapshot)).toBe(true)
  })

  it('preserves empty backend menu sections inside a workbench', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'overview.view', 'platform.workloads.view'],
      visibleMenuIds: ['dashboard', 'workloads'],
      visibleMenus: [
        {
          id: 'dashboard',
          path: '/',
          labelZh: '概览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: '',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'workloads',
          path: '/workloads',
          labelZh: '工作负载',
          labelEn: 'Workloads',
          iconKey: 'boxes',
          section: '',
          sortOrder: 2,
          enabled: true,
        },
      ],
    })

    const nav = getAccessibleSidebarNav(snapshot)
    const platformNav = filterSidebarNavByWorkbench(
      filterSidebarNavByWorkspace(nav, 'resource'),
      'platform',
    )

    expect(platformNav.map((item) => item.id)).toEqual(['dashboard', 'workloads'])
    expect(platformNav.every((item) => item.section === '')).toBe(true)
  })

  it('filters canonical resource menus by unified workbench ownership', () => {
    const visibleMenus = [
      { id: 'dashboard', path: '/' },
      { id: 'compute-workbench', path: '/compute' },
      {
        id: 'virtualization-workbench',
        parentId: 'compute-workbench',
        path: '/compute/virtualization',
      },
      {
        id: 'virtualization-workbench-vms',
        parentId: 'virtualization-workbench',
        path: '/compute/virtualization/vms',
      },
      { id: 'docker-workbench', parentId: 'compute-workbench', path: '/compute/runtimes' },
      {
        id: 'docker-workbench-projects',
        parentId: 'docker-workbench',
        path: '/compute/runtimes/projects',
      },
      { id: 'ai-workbench', path: '/ai-workbench' },
      {
        id: 'ai-workbench-chat',
        parentId: 'ai-workbench',
        path: '/ai-workbench/chat',
      },
      {
        id: 'ai-gateway-manifest',
        parentId: 'ai-workbench',
        path: '/ai-gateway/manifest',
      },
      { id: 'monitoring-workbench', path: '/monitoring-workbench' },
      {
        id: 'monitoring-workbench-overview',
        parentId: 'monitoring-workbench',
        path: '/monitoring-workbench/overview',
      },
    ]
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.resource.view',
        'overview.view',
        'virtualization.vms.view',
        'docker.projects.view',
        'observe.ai.chat',
        'ai.gateway.view',
        'observe.monitoring.view',
      ],
      visibleMenuIds: visibleMenus.map((item) => item.id),
      visibleMenus,
    })

    const resourceNav = filterSidebarNavByWorkspace(getAccessibleSidebarNav(snapshot), 'resource')
    expect(filterSidebarNavByWorkbench(resourceNav, 'platform').map((item) => item.id)).toEqual([
      'dashboard',
    ])
    expect(filterSidebarNavByWorkbench(resourceNav, 'ai').map((item) => item.id)).toEqual([
      'ai-workbench-chat',
      'ai-gateway-manifest',
    ])
    expect(filterSidebarNavByWorkbench(resourceNav, 'compute').map((item) => item.id)).toEqual([
      'docker-workbench',
      'virtualization-workbench',
    ])
    expect(filterSidebarNavByWorkbench(resourceNav, 'monitoring').map((item) => item.id)).toEqual([
      'monitoring-workbench-overview',
    ])
  })

  it('derives menu workbench ownership from route mappings', () => {
    expect(getMenuWorkbenchId({ id: 'dashboard', path: '/' })).toBe('platform')
    expect(
      getMenuWorkbenchId({
        id: 'ai-workbench-inspection',
        path: '/ai-workbench/inspection',
      }),
    ).toBe('ai')
    expect(
      getMenuWorkbenchId({
        id: 'monitoring-workbench-rules',
        path: '/monitoring-workbench/rules',
      }),
    ).toBe('monitoring')
    expect(
      getMenuWorkbenchId({
        id: 'monitoring-workbench-integrations',
        path: '/monitoring-workbench/integrations',
      }),
    ).toBe('monitoring')
    expect(
      getMenuWorkbenchId({
        id: 'virtualization-workbench-vms',
        path: '/compute/virtualization/vms',
      }),
    ).toBe('compute')
    expect(
      getMenuWorkbenchId({
        id: 'virtualization-workbench-sync',
        path: '/compute/tasks/sync',
      }),
    ).toBe('compute')
    expect(
      getMenuWorkbenchId({
        id: 'docker-workbench-projects',
        path: '/compute/runtimes/projects',
      }),
    ).toBe('compute')
    expect(
      getMenuWorkbenchId({
        id: 'ai-gateway-governance',
        path: '/ai-gateway/governance',
      }),
    ).toBe('ai')
    expect(
      getMenuWorkbenchId({
        id: 'settings-extensions-marketplace',
        path: '/plugins/marketplace',
      }),
    ).toBe('settings')
    expect(getMenuWorkbenchId({ id: 'menus', path: '/system/menus' })).toBe('settings')
  })

  it('exposes plugins through the settings extensions group', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['plugin.view'],
      visibleMenuIds: ['settings-extensions', 'settings-extensions-marketplace'],
      visibleMenus: [
        { id: 'settings-extensions', path: '/settings/extensions' },
        {
          id: 'settings-extensions-marketplace',
          parentId: 'settings-extensions',
          path: '/plugins/marketplace',
        },
      ],
    })

    expect(getRouteWorkbenchId(getRoute('plugins-marketplace'))).toBe('settings')
    expect(getRouteWorkspace(getRoute('plugins-marketplace'))).toBe('system')
    expect(canAccessRoute(getRoute('plugins-marketplace'), snapshot)).toBe(true)
    expect(findFirstAccessiblePathForWorkbench('settings', snapshot)).toBe('/plugins/marketplace')
    expect(getAccessibleWorkbenchIds(snapshot)).toContain('settings')
  })

  it('gates Knowledge Center and Context Inspector independently', () => {
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.knowledge.view', 'ai.context.inspect'],
      visibleMenuIds: [
        'ai-workbench',
        'ai-workbench-overview',
        'ai-workbench-knowledge',
        'ai-workbench-context',
      ],
      visibleMenus: [
        { id: 'ai-workbench', path: '/ai-workbench' },
        { id: 'ai-workbench-overview', parentId: 'ai-workbench', path: '/ai-workbench/overview' },
        { id: 'ai-workbench-knowledge', parentId: 'ai-workbench', path: '/ai-workbench/knowledge' },
        { id: 'ai-workbench-context', parentId: 'ai-workbench', path: '/ai-workbench/context' },
      ],
    })

    expect(canAccessRoute(getRoute('ai-workbench-knowledge'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('ai-workbench-context'), snapshot)).toBe(true)
    expect(canAccessRoute(getRoute('ai-workbench-chat'), snapshot)).toBe(false)
    expect(getRouteWorkbenchId(getRoute('ai-workbench-context'))).toBe('ai')
  })

  it('gates Evaluation with dedicated view and manage permissions', () => {
    const visibleMenus = [
      { id: 'ai-workbench', path: '/ai-workbench' },
      {
        id: 'ai-workbench-evaluations',
        parentId: 'ai-workbench',
        path: '/ai-workbench/evaluations',
      },
    ]
    const visibleMenuIds = visibleMenus.map((item) => item.id)
    const borrowedPermissionSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.context.inspect', 'ai.knowledge.view'],
      visibleMenuIds,
      visibleMenus,
    })
    const viewSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.evaluations.view'],
      visibleMenuIds,
      visibleMenus,
    })

    expect(canAccessRoute(getRoute('ai-workbench-evaluations'), borrowedPermissionSnapshot)).toBe(
      false,
    )
    expect(canAccessRoute(getRoute('ai-workbench-evaluations'), viewSnapshot)).toBe(true)
  })

  it('requires resource workspace, AI Gateway view permission, and menu binding', () => {
    const route = getRoute('ai-gateway-manifest')
    const parentRoute = getRoute('ai-workbench')
    const allowedSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.gateway.view'],
      visibleMenuIds: ['ai-workbench', 'ai-gateway-manifest'],
      visibleMenus: [
        {
          id: 'ai-workbench',
          path: '/ai-workbench',
        },
        {
          id: 'ai-gateway-manifest',
          parentId: 'ai-workbench',
          path: '/ai-gateway/manifest',
        },
      ],
    })

    expect(getRouteWorkspace(route)).toBe('resource')
    expect(getRouteWorkbenchId(route)).toBe('ai')
    expect(getRouteScopeMode(route)).toBe('passive')
    expect(canAccessRoute(route, allowedSnapshot)).toBe(true)
    expect(parentRoute.redirectTo).toBe('/ai-workbench/overview')
    expect(canAccessRoute(parentRoute, allowedSnapshot)).toBe(true)
    expect(findFirstAccessiblePathForWorkbench('ai', allowedSnapshot)).toBe('/ai-gateway/manifest')

    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['ai.gateway.view'],
          visibleMenuIds: ['ai-workbench', 'ai-gateway-manifest'],
          visibleMenus: [
            {
              id: 'ai-workbench',
              path: '/ai-workbench',
            },
            {
              id: 'ai-gateway-manifest',
              parentId: 'ai-workbench',
              path: '/ai-gateway/manifest',
            },
          ],
        }),
      ),
    ).toBe(false)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view'],
          visibleMenuIds: ['ai-workbench', 'ai-gateway-manifest'],
          visibleMenus: [
            {
              id: 'ai-workbench',
              path: '/ai-workbench',
            },
            {
              id: 'ai-gateway-manifest',
              parentId: 'ai-workbench',
              path: '/ai-gateway/manifest',
            },
          ],
        }),
      ),
    ).toBe(false)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view', 'ai.gateway.view'],
          visibleMenuIds: [],
          visibleMenus: [],
        }),
      ),
    ).toBe(false)
  })

  it('allows AI Gateway token routing from invoke-only permission', () => {
    const tokenRoute = getRoute('ai-gateway-tokens')
    const parentRoute = getRoute('ai-workbench')
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.gateway.invoke'],
      visibleMenuIds: ['ai-workbench', 'ai-gateway-tokens'],
      visibleMenus: [
        {
          id: 'ai-workbench',
          path: '/ai-workbench',
        },
        {
          id: 'ai-gateway-tokens',
          parentId: 'ai-workbench',
          path: '/ai-gateway/tokens',
        },
      ],
    })

    expect(canAccessRoute(tokenRoute, snapshot)).toBe(true)
    expect(canAccessRoute(parentRoute, snapshot)).toBe(true)
    expect(findFirstAccessiblePathForWorkbench('ai', snapshot)).toBe('/ai-gateway/tokens')
    expect(canAccessRoute(getRoute('ai-gateway-manifest'), snapshot)).toBe(false)
  })

  it('exposes AI Gateway model relay under the unified AI workbench', () => {
    const relayRoute = getRoute('ai-gateway-relay')
    const viewSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.gateway.relay.view'],
      visibleMenuIds: ['ai-workbench', 'ai-gateway-relay'],
      visibleMenus: [
        { id: 'ai-workbench', path: '/ai-workbench' },
        {
          id: 'ai-gateway-relay',
          parentId: 'ai-workbench',
          path: '/ai-gateway/relay',
        },
      ],
    })
    expect(getRouteWorkbenchId(relayRoute)).toBe('ai')
    expect(canAccessRoute(relayRoute, viewSnapshot)).toBe(true)
  })

  it('requires AI Gateway manage permission for call logs', () => {
    const route = getRoute('ai-gateway-call-logs')
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'ai.gateway.manage'],
      visibleMenuIds: ['ai-workbench', 'ai-gateway-call-logs'],
      visibleMenus: [
        {
          id: 'ai-workbench',
          path: '/ai-workbench',
        },
        {
          id: 'ai-gateway-call-logs',
          parentId: 'ai-workbench',
          path: '/ai-gateway/call-logs',
        },
      ],
    })

    expect(getRouteWorkbenchId(route)).toBe('ai')
    expect(canAccessRoute(route, snapshot)).toBe(true)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view', 'ai.gateway.view'],
          visibleMenuIds: ['ai-workbench', 'ai-gateway-call-logs'],
          visibleMenus: snapshot.visibleMenus,
        }),
      ),
    ).toBe(false)
  })

  it('requires virtualization workspace permission, route permission, and menu binding', () => {
    const route = getRoute('virtualization-workbench-vms')
    const allowedSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'virtualization.vms.view'],
      visibleMenuIds: ['virtualization-workbench-vms'],
      visibleMenus: [
        {
          id: 'virtualization-workbench-vms',
          parentId: 'virtualization-workbench',
          path: '/compute/virtualization/vms',
        },
      ],
    })

    expect(getRouteWorkspace(route)).toBe('resource')
    expect(getRouteWorkbenchId(route)).toBe('compute')
    expect(getRouteScopeMode(route)).toBe('passive')
    expect(canAccessRoute(route, allowedSnapshot)).toBe(true)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view', 'virtualization.vms.view'],
          visibleMenuIds: [],
          visibleMenus: [],
        }),
      ),
    ).toBe(false)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view'],
          visibleMenuIds: ['virtualization-workbench-vms'],
          visibleMenus: [
            {
              id: 'virtualization-workbench-vms',
              parentId: 'virtualization-workbench',
              path: '/compute/virtualization/vms',
            },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('maps virtualization sync into the compute resource management group', () => {
    const route = getRoute('compute-workbench-tasks-sync')
    const snapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'virtualization.sync.view'],
      visibleMenuIds: ['compute-workbench-tasks-sync'],
      visibleMenus: [
        {
          id: 'compute-workbench-tasks-sync',
          parentId: 'compute-workbench',
          path: '/compute/tasks/sync',
        },
      ],
    })

    expect(route.menuId).toBe('compute-workbench-tasks-sync')
    expect(route.permissionKeysAny).toContain('virtualization.sync.view')
    expect(getRouteWorkbenchId(route)).toBe('compute')
    expect(getRouteScopeMode(route)).toBe('passive')
    expect(canAccessRoute(route, snapshot)).toBe(true)
  })

  it('requires Docker workspace permission, route permission, and menu binding', () => {
    const route = getRoute('docker-workbench-projects')
    const allowedSnapshot = buildSnapshot({
      permissionKeys: ['workspace.resource.view', 'docker.projects.view'],
      visibleMenuIds: ['docker-workbench-projects'],
      visibleMenus: [
        {
          id: 'docker-workbench-projects',
          parentId: 'docker-workbench',
          path: '/compute/runtimes/projects',
        },
      ],
    })

    expect(getRouteWorkspace(route)).toBe('resource')
    expect(getRouteWorkbenchId(route)).toBe('compute')
    expect(getRouteScopeMode(route)).toBe('passive')
    expect(canAccessRoute(route, allowedSnapshot)).toBe(true)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view', 'docker.projects.view'],
          visibleMenuIds: [],
          visibleMenus: [],
        }),
      ),
    ).toBe(false)
    expect(
      canAccessRoute(
        route,
        buildSnapshot({
          permissionKeys: ['workspace.resource.view'],
          visibleMenuIds: ['docker-workbench-projects'],
          visibleMenus: [
            {
              id: 'docker-workbench-projects',
              parentId: 'docker-workbench',
              path: '/compute/runtimes/projects',
            },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('resolves accessible workspaces and preferred landing path', () => {
    const snapshot = buildSnapshot({
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'workspace.resource.view',
        'overview.view',
      ],
      visibleMenuIds: ['builds', 'dashboard'],
      visibleMenus: [
        {
          id: 'dashboard',
          path: '/',
          labelZh: '概览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'platform',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'builds',
          path: '/applications',
          labelZh: '应用中心',
          labelEn: 'Applications',
          iconKey: 'blocks',
          section: 'deliver',
          sortOrder: 2,
          enabled: true,
        },
      ],
    })

    expect(getAccessibleWorkspaces(snapshot)).toEqual(['application', 'resource'])
    expect(findPreferredWorkspace(snapshot, 'application', ['ops'])).toBe('application')
    expect(findPreferredWorkspace(snapshot, null, ['developer'])).toBe('application')
    expect(findFirstAccessiblePathForWorkspace('application', snapshot)).toBe('/applications')
    expect(findFirstAccessiblePathForWorkspace('resource', snapshot)).toBe('/')
    expect(findLandingPath(snapshot, 'application', ['ops'])).toBe('/applications')
  })

  it('derives cluster scope for dashboard and cluster-scoped platform pages', () => {
    expect(getRouteScopeMode(getRoute('overview'))).toBe('cluster')
    expect(getRouteScopeMode(getRoute('storage-pv'))).toBe('cluster')
    expect(getRouteScopeMode(getRoute('network-ingressclasses'))).toBe('cluster')
    expect(getRouteScopeMode(getRoute('network-gateway-api-gatewayclasses'))).toBe('cluster')
    expect(getRouteScopeMode(getRoute('network-gateway-api-httproutes'))).toBe('namespace')
  })

  it('derives namespace scope for namespaced platform pages and detail routes', () => {
    expect(getRouteScopeMode(getRoute('workloads-pods'))).toBe('namespace')
    expect(getRouteScopeMode(getRoute('network-service-detail'))).toBe('namespace')
    expect(getRouteScopeMode(getRoute('platform-access-control-rolebindings'))).toBe('namespace')
  })

  it('derives passive and hidden scope modes for non-platform workspaces', () => {
    expect(getRouteScopeMode(getRoute('applications'))).toBe('passive')
    expect(getRouteScopeMode(getRoute('system-menus'))).toBe('passive')
    expect(getRouteScopeMode(getRoute('login'))).toBe('hidden')
  })
})
