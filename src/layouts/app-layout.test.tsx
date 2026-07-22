/** @vitest-environment jsdom */

import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLayout } from './app-layout'
import type { PermissionSnapshot } from '@/types'

const testState = vi.hoisted(() => ({
  auth: {
    clearAuth: vi.fn(),
    user: { userName: 'Admin', email: 'admin@example.com', roles: ['ops'] },
  },
  prefs: {
    currentWorkspace: 'resource' as string | null,
    localeCode: 'zh_CN',
    setCurrentWorkspace: vi.fn((workspace: string | null) => {
      testState.prefs.currentWorkspace = workspace
    }),
    setLocaleCode: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setThemeMode: vi.fn(),
    sidebarCollapsed: false,
    themeMode: 'light',
  },
  snapshot: {
    permissionKeys: [],
    visibleMenuIds: [],
    visibleMenus: [],
  } as PermissionSnapshot,
}))

vi.mock('@/features/auth/permission-snapshot', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/permission-snapshot')>(
    '@/features/auth/permission-snapshot',
  )
  return {
    ...actual,
    usePermissionSnapshot: () => ({
      data: { data: testState.snapshot },
      isLoading: false,
    }),
  }
})

vi.mock('@/features/settings', () => ({
  useBrandingSettings: () => ({
    data: {
      data: {
        appTitle: 'Soha',
        sidebarTitle: 'Soha',
        loginLogoUrl: '',
        expandedLogoUrl: '',
        collapsedLogoUrl: '',
        faviconUrl: '',
      },
    },
  }),
  getNormalizedBranding: (value: any) => ({
    appTitle: value?.appTitle || 'Soha',
    sidebarTitle: value?.sidebarTitle || 'Soha',
    loginLogoUrl: value?.loginLogoUrl || '',
    expandedLogoUrl: value?.expandedLogoUrl || '',
    collapsedLogoUrl: value?.collapsedLogoUrl || '',
    faviconUrl: value?.faviconUrl || '',
  }),
}))

vi.mock('@/features/announcements/announcement-center', () => ({
  AnnouncementBell: () => <div data-testid="announcement-bell">bell</div>,
}))

vi.mock('@/components/header-action-button', async () => {
  const { forwardRef } = await vi.importActual<typeof import('react')>('react')
  return {
    HeaderActionButton: forwardRef<HTMLButtonElement, any>(function HeaderActionButtonMock(
      { ariaLabel, className, icon, label, onClick, title },
      ref,
    ) {
      return (
        <button
          ref={ref}
          aria-label={ariaLabel}
          className={className}
          onClick={onClick}
          title={title}
        >
          {icon}
          {label || title}
        </button>
      )
    }),
  }
})

vi.mock('@/components/platform-scope-toolbar', () => ({
  PlatformScopeTrigger: ({ scopeMode }: { scopeMode?: string }) => (
    <div data-testid="platform-scope-trigger">{scopeMode}</div>
  ),
}))

vi.mock('@/features/platform/resource-creation/components/global-create-modal', () => ({
  GlobalResourceCreateModal: ({ onClose, open }: { onClose: () => void; open: boolean }) =>
    open ? (
      <div aria-label="创建资源" role="dialog">
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    ) : null,
}))

vi.mock('@/features/system/menu-icons', () => ({
  resolveMenuIcon: () => null,
}))

vi.mock('@/features/system/menu-schema', async () => {
  const actual = await vi.importActual<typeof import('@/features/system/menu-schema')>(
    '@/features/system/menu-schema',
  )
  return {
    ...actual,
    resolveMenuSectionLabel: (key: string) => key,
  }
})

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: (state: any) => unknown) => {
    const state = {
      clearAuth: testState.auth.clearAuth,
      isAuthenticated: () => true,
      user: testState.auth.user,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/stores/preferences-store', () => ({
  usePreferencesStore: (selector: (state: any) => unknown) =>
    selector({
      currentWorkspace: testState.prefs.currentWorkspace,
      localeCode: testState.prefs.localeCode,
      setCurrentWorkspace: testState.prefs.setCurrentWorkspace,
      setLocaleCode: testState.prefs.setLocaleCode,
      setSidebarCollapsed: testState.prefs.setSidebarCollapsed,
      setThemeMode: testState.prefs.setThemeMode,
      sidebarCollapsed: testState.prefs.sidebarCollapsed,
      themeMode: testState.prefs.themeMode,
    }),
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="page" data-pathname={location.pathname} data-search={location.search}>
      page
    </div>
  )
}

async function renderWithProviders(route: string, snapshotOverrides?: Partial<PermissionSnapshot>) {
  testState.snapshot = {
    ...testState.snapshot,
    ...snapshotOverrides,
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<LocationProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  return container
}

describe('app layout workspace navigation', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  beforeEach(() => {
    testState.auth.clearAuth.mockClear()
    testState.auth.user = { userName: 'Admin', email: 'admin@example.com', roles: ['ops'] }
    testState.prefs.currentWorkspace = 'resource'
    testState.prefs.localeCode = 'zh_CN'
    testState.prefs.sidebarCollapsed = false
    testState.prefs.setCurrentWorkspace.mockClear()
    testState.snapshot = {
      permissionKeys: [
        'workspace.resource.view',
        'workspace.application.view',
        'overview.view',
        'delivery.applications.view',
        'system.menus.view',
      ],
      visibleMenuIds: ['dashboard', 'builds', 'system', 'menus'],
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
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 3,
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
          sortOrder: 4,
          enabled: true,
        },
      ],
    }
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots = []
    for (const container of containers) {
      container.remove()
    }
    containers = []
    vi.clearAllMocks()
  })

  it('shows only the workbench switcher when only one business workspace is available', async () => {
    const container = await renderWithProviders('/', {
      permissionKeys: ['workspace.resource.view', 'overview.view', 'system.menus.view'],
      visibleMenuIds: ['dashboard', 'system', 'menus'],
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
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 3,
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
          sortOrder: 4,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe(
      'k8s工作台',
    )
    expect(container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent).toContain(
      'k8s工作台/platform/概览',
    )
    expect(container.querySelector('[data-testid="platform-scope-trigger"]')?.textContent).toBe(
      'cluster',
    )
    expect(container.querySelector('.soha-workspace-switcher-shell')).toBeNull()
  })

  it('places the permitted resource action before docs in the k8s header', async () => {
    const container = await renderWithProviders('/', {
      permissionKeys: ['workspace.resource.view', 'overview.view', 'platform.resource.create'],
    })

    const headerActions = container.querySelector('.soha-header-right')
    const createButton = headerActions?.querySelector<HTMLButtonElement>(
      '.soha-header-resource-create',
    )
    const docsButton = headerActions?.querySelector<HTMLButtonElement>('button[title="Docs"]')

    expect(createButton?.textContent).toContain('创建资源')
    expect(createButton?.nextElementSibling).toBe(docsButton)

    await act(async () => {
      createButton?.click()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="page"]')?.getAttribute('data-pathname')).toBe('/')
    expect(container.querySelector('[role="dialog"][aria-label="创建资源"]')).not.toBeNull()
  })

  it('opens the resource modal from the compatibility query and clears it on close', async () => {
    const container = await renderWithProviders('/?createResource=1', {
      permissionKeys: ['workspace.resource.view', 'overview.view', 'platform.resource.create'],
    })

    const dialog = container.querySelector('[role="dialog"][aria-label="创建资源"]')
    expect(dialog).not.toBeNull()
    expect(container.querySelector('[data-testid="page"]')?.getAttribute('data-search')).toBe(
      '?createResource=1',
    )

    await act(async () => {
      dialog?.querySelector<HTMLButtonElement>('button')?.click()
      await Promise.resolve()
    })
    expect(container.querySelector('[role="dialog"][aria-label="创建资源"]')).toBeNull()
    expect(container.querySelector('[data-testid="page"]')?.getAttribute('data-search')).toBe('')
  })

  it('hides resource creation without permission', async () => {
    const withoutPermission = await renderWithProviders('/')
    expect(withoutPermission.querySelector('.soha-header-resource-create')).toBeNull()
  })

  it('keeps resource creation global to the k8s workbench', async () => {
    const clusterPage = await renderWithProviders('/clusters', {
      permissionKeys: [
        'workspace.resource.view',
        'platform.clusters.view',
        'platform.resource.create',
      ],
    })
    expect(clusterPage.querySelector('.soha-header-resource-create')).not.toBeNull()
    expect(clusterPage.querySelector('[data-testid="platform-scope-trigger"]')).toBeNull()

    const applicationPage = await renderWithProviders('/applications', {
      permissionKeys: [
        'workspace.application.view',
        'delivery.applications.view',
        'platform.resource.create',
      ],
    })
    expect(applicationPage.querySelector('.soha-header-resource-create')).toBeNull()
  })

  it('does not render copyright inside the authenticated app shell', async () => {
    const container = await renderWithProviders('/')

    expect(container.querySelector('.soha-footer')).toBeNull()
    expect(container.textContent).not.toContain('© 2026 Soha 版权所有，由项目贡献者设计与开发。')
  })

  it('uses namespace scope in the k8s workbench header for namespaced routes', async () => {
    const container = await renderWithProviders('/workloads/overview', {
      permissionKeys: ['workspace.resource.view', 'platform.workloads.view', 'system.menus.view'],
      visibleMenuIds: ['workloads', 'workloads-overview', 'system', 'menus'],
      visibleMenus: [
        {
          id: 'workloads',
          path: '/workloads',
          labelZh: '工作负载',
          labelEn: 'Workloads',
          iconKey: 'boxes',
          section: 'platform',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'workloads-overview',
          parentId: 'workloads',
          path: '/workloads/overview',
          labelZh: '概览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'platform',
          sortOrder: 2,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 3,
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
          sortOrder: 4,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('[data-testid="platform-scope-trigger"]')?.textContent).toBe(
      'namespace',
    )
    expect(container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent).toContain(
      'k8s工作台/platform/工作负载/概览',
    )
  })

  it('filters the business menu by the current application workspace', async () => {
    const container = await renderWithProviders('/applications')

    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe(
      '应用交付工作台',
    )
    expect(container.querySelector('[data-testid="platform-scope-trigger"]')).toBeNull()
    expect(container.textContent).toContain('应用中心')
    expect(container.textContent).not.toContain('概览')
    expect(container.querySelector('.soha-nav-business')).not.toBeNull()
    expect(testState.prefs.setCurrentWorkspace).toHaveBeenCalledWith('application')
  })

  it('switches the left nav into system workspace mode while visiting system pages', async () => {
    const container = await renderWithProviders('/system/menus')

    expect(container.querySelector('.soha-workbench-switcher-shell')).not.toBeNull()
    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe('设置中心')
    expect(container.textContent).toContain('菜单管理')
    expect(container.textContent).not.toContain('概览')
    expect(container.querySelector('.soha-nav-business')?.className).toBe('soha-nav-business')
    const menuModifierClasses = Array.from(
      container.querySelector('.soha-nav-menu')?.classList ?? [],
    ).filter((className) => className.startsWith('soha-nav-menu--'))
    expect(menuModifierClasses).toEqual([])
    expect(container.querySelector('.soha-sider-topbar > button.soha-sider-brand')).not.toBeNull()
    expect(container.querySelector('button[aria-label="系统设置"]')).toBeNull()
    expect(testState.prefs.setCurrentWorkspace).not.toHaveBeenCalled()
  })

  it('renders account utilities in a dedicated personal settings workbench', async () => {
    const container = await renderWithProviders('/account/settings')

    expect(container.querySelector('.soha-sider')).not.toBeNull()
    expect(container.querySelector('.soha-shell')?.classList.contains('ant-layout-has-sider')).toBe(
      true,
    )
    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe('个人设置')
    expect(container.textContent).toContain('个人中心')
    expect(container.textContent).toContain('关于')
    expect(container.querySelector('.soha-header-sider-toggle')).not.toBeNull()
    expect(container.querySelector('.soha-account-brand')).toBeNull()
    expect(container.querySelector('[data-testid="platform-scope-trigger"]')).toBeNull()
    expect(container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent).toContain(
      '个人设置',
    )
    expect(testState.prefs.setCurrentWorkspace).not.toHaveBeenCalled()
  })

  it.each([
    ['/account/profile', '个人中心'],
    ['/about', '关于'],
  ])('keeps %s in the hidden account shell', async (route, breadcrumb) => {
    const container = await renderWithProviders(route)

    expect(container.querySelector('.soha-sider')).not.toBeNull()
    expect(container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent).toContain(
      breadcrumb,
    )
  })

  it('shows access-control pages as direct settings menu items', async () => {
    const container = await renderWithProviders('/settings/login', {
      permissionKeys: [
        'access.users.view',
        'access.roles.view',
        'access.groups.view',
        'access.policies.view',
        'access.directory.view',
        'identity.applications.view',
        'identity.providers.view',
        'identity.outposts.view',
        'identity.policies.view',
        'identity.audit.view',
        'system.announcements.view',
        'system.menus.view',
        'system.online-users.view',
        'system.operations.view',
        'system.audit.view',
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
        'identity-audit',
        'system',
        'announcements',
        'menus',
        'system-online-users',
        'operations',
        'audit',
        'settings',
        'account-profile',
        'settings-about',
        'settings-login',
        'settings-branding',
      ],
      visibleMenus: [
        {
          id: 'access',
          path: '/access',
          labelZh: '访问控制',
          labelEn: 'Access Control',
          iconKey: 'shield',
          section: 'admin',
          sortOrder: 240,
          enabled: true,
        },
        {
          id: 'access-users',
          parentId: 'access',
          path: '/access/users',
          labelZh: '用户',
          labelEn: 'Users',
          iconKey: 'user',
          section: 'users',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'access-roles',
          parentId: 'access',
          path: '/access/roles',
          labelZh: '角色',
          labelEn: 'Roles',
          iconKey: 'shield',
          section: 'users',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'access-teams',
          parentId: 'access',
          path: '/access/teams',
          labelZh: '组织',
          labelEn: 'Organizations',
          iconKey: 'users',
          section: 'users',
          sortOrder: 30,
          enabled: true,
        },
        {
          id: 'access-policies',
          parentId: 'access',
          path: '/access/policies',
          labelZh: '策略',
          labelEn: 'Policies',
          iconKey: 'shield',
          section: 'users',
          sortOrder: 40,
          enabled: true,
        },
        {
          id: 'identity',
          path: '/identity',
          labelZh: '身份',
          labelEn: 'Identity',
          iconKey: 'shield',
          section: 'admin',
          sortOrder: 220,
          enabled: true,
        },
        {
          id: 'identity-overview',
          parentId: 'identity',
          path: '/identity/overview',
          labelZh: '总览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: '',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'identity-applications',
          parentId: 'identity',
          path: '/identity/applications',
          labelZh: '应用目录',
          labelEn: 'Applications',
          iconKey: 'blocks',
          section: 'provider',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'identity-providers',
          parentId: 'identity',
          path: '/identity/providers',
          labelZh: 'Provider',
          labelEn: 'Providers',
          iconKey: 'shield',
          section: 'provider',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'identity-outposts',
          parentId: 'identity',
          path: '/identity/outposts',
          labelZh: 'Outpost',
          labelEn: 'Outposts',
          iconKey: 'radio-tower',
          section: 'provider',
          sortOrder: 30,
          enabled: true,
        },
        {
          id: 'identity-policies',
          parentId: 'identity',
          path: '/identity/policies',
          labelZh: '访问策略',
          labelEn: 'Policies',
          iconKey: 'shield',
          section: 'provider',
          sortOrder: 40,
          enabled: true,
        },
        {
          id: 'identity-audit',
          parentId: 'identity',
          path: '/identity/audit',
          labelZh: '审计',
          labelEn: 'Audit',
          iconKey: 'file-clock',
          section: 'operations',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 225,
          enabled: true,
        },
        {
          id: 'announcements',
          parentId: 'system',
          path: '/system/announcements',
          labelZh: '通知公告',
          labelEn: 'Announcements',
          iconKey: 'megaphone',
          section: 'operations',
          sortOrder: 30,
          enabled: true,
        },
        {
          id: 'menus',
          parentId: 'system',
          path: '/system/menus',
          labelZh: '菜单管理',
          labelEn: 'Menus',
          iconKey: 'menu-square',
          section: 'users',
          sortOrder: 50,
          enabled: true,
        },
        {
          id: 'system-online-users',
          parentId: 'system',
          path: '/system/online-users',
          labelZh: '在线用户',
          labelEn: 'Online Users',
          iconKey: 'users',
          section: 'operations',
          sortOrder: 40,
          enabled: true,
        },
        {
          id: 'operations',
          parentId: 'system',
          path: '/system/operations',
          labelZh: '操作日志',
          labelEn: 'Operations',
          iconKey: 'clipboard-list',
          section: 'operations',
          sortOrder: 50,
          enabled: true,
        },
        {
          id: 'audit',
          parentId: 'system',
          path: '/system/audit',
          labelZh: '审计日志',
          labelEn: 'Audit',
          iconKey: 'file-clock',
          section: 'operations',
          sortOrder: 60,
          enabled: true,
        },
        {
          id: 'settings',
          path: '/settings',
          labelZh: '设置中心',
          labelEn: 'Settings Center',
          iconKey: 'cog',
          section: 'admin',
          sortOrder: 260,
          enabled: true,
        },
        {
          id: 'account-profile',
          parentId: 'settings',
          path: '/account/profile',
          labelZh: '个人中心',
          labelEn: 'Profile',
          iconKey: 'user',
          section: 'account',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'settings-about',
          parentId: 'settings',
          path: '/settings/about',
          labelZh: '关于',
          labelEn: 'About',
          iconKey: 'info',
          section: 'account',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'settings-login',
          parentId: 'settings',
          path: '/settings/login',
          labelZh: '登陆设置',
          labelEn: 'Login Settings',
          iconKey: 'shield',
          section: 'users',
          sortOrder: 60,
          enabled: true,
        },
        {
          id: 'settings-branding',
          parentId: 'settings',
          path: '/settings/branding',
          labelZh: '品牌设置',
          labelEn: 'Branding Settings',
          iconKey: 'palette',
          section: 'operations',
          sortOrder: 70,
          enabled: true,
        },
      ],
    })

    const menu = container.querySelector('.soha-nav-menu')
    const menuText = menu?.textContent ?? ''
    expect(menuText).toContain('provider')
    expect(menuText).toContain('users')
    expect(menuText).toContain('operations')
    expect(menuText).toContain('总览')
    expect(menuText).not.toContain('个人中心')
    expect(menuText).not.toContain('关于')
    expect(menuText).toContain('应用目录')
    expect(menuText).toContain('用户')
    expect(menuText).toContain('角色')
    expect(menuText).toContain('组织')
    expect(menuText).toContain('策略')
    expect(menuText).toContain('目录同步')
    expect(menuText).toContain('登陆设置')
    expect(menuText).not.toContain('会话')
    expect(menuText).toContain('通知公告')
    expect(menuText).toContain('在线用户')
    expect(menuText).toContain('操作日志')
    expect(menuText).toContain('审计日志')
    expect(menuText).toContain('品牌设置')
    expect(menuText).not.toContain('访问控制')
    expect(menu?.querySelector('.ant-menu-submenu')).toBeNull()
  })

  it('renders the workbench switcher below the brand bar and above the business menu', async () => {
    const container = await renderWithProviders('/')
    const brandBar = container.querySelector('.soha-sider-topbar')
    const workbenchShell = container.querySelector('.soha-workbench-switcher-shell')
    const businessNav = container.querySelector('.soha-nav-business')

    expect(brandBar).not.toBeNull()
    expect(workbenchShell).not.toBeNull()
    expect(businessNav).not.toBeNull()
    expect(container.querySelector('.soha-workspace-switcher-shell')).toBeNull()
    expect(brandBar?.nextElementSibling).toBe(workbenchShell)
    expect(workbenchShell?.nextElementSibling).toBe(businessNav)
  })

  it('syncs the persisted workspace when navigating directly to resource pages', async () => {
    testState.prefs.currentWorkspace = 'application'

    await renderWithProviders('/workloads/pods', {
      permissionKeys: ['workspace.resource.view', 'platform.workloads.view', 'system.menus.view'],
      visibleMenuIds: ['workloads', 'system', 'menus'],
      visibleMenus: [
        {
          id: 'workloads',
          path: '/workloads',
          labelZh: '工作负载',
          labelEn: 'Workloads',
          iconKey: 'boxes',
          section: 'platform',
          sortOrder: 1,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 3,
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
          sortOrder: 4,
          enabled: true,
        },
      ],
    })

    expect(testState.prefs.setCurrentWorkspace).toHaveBeenCalledWith('resource')
  })

  it('renders ungrouped workbench menus without a group heading', async () => {
    const container = await renderWithProviders('/', {
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

    expect(container.textContent).toContain('概览')
    expect(container.textContent).toContain('工作负载')
    expect(container.textContent).not.toContain('platform')
    expect(container.querySelector('.ant-menu-item-group-title')).toBeNull()
  })

  it('shows AI workbench menus in the standard business sidebar when the AI workbench is active', async () => {
    const container = await renderWithProviders('/ai-workbench/chat', {
      permissionKeys: [
        'workspace.resource.view',
        'observe.ai.view',
        'observe.ai.chat',
        'observe.monitoring.view',
        'overview.view',
        'system.menus.view',
      ],
      visibleMenuIds: [
        'dashboard',
        'ai-workbench',
        'ai-workbench-chat',
        'ai-workbench-inspection',
        'ai-workbench-model-settings',
        'monitoring-workbench',
        'monitoring-workbench-overview',
        'system',
        'menus',
      ],
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
          id: 'ai-workbench',
          path: '/ai-workbench',
          labelZh: 'AI工作台',
          labelEn: 'AI Workbench',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 15,
          enabled: true,
        },
        {
          id: 'ai-workbench-chat',
          parentId: 'ai-workbench',
          path: '/ai-workbench/chat',
          labelZh: '通用聊天',
          labelEn: 'Chat',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 16,
          enabled: true,
        },
        {
          id: 'ai-workbench-inspection',
          parentId: 'ai-workbench',
          path: '/ai-workbench/inspection',
          labelZh: '巡检',
          labelEn: 'Inspection',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 19,
          enabled: true,
        },
        {
          id: 'ai-workbench-model-settings',
          parentId: 'ai-workbench',
          path: '/ai-workbench/model-settings',
          labelZh: '模型设置',
          labelEn: 'Model Settings',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'monitoring-workbench',
          path: '/monitoring-workbench',
          labelZh: '监控工作台',
          labelEn: 'Monitoring Workbench',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 60,
          enabled: true,
        },
        {
          id: 'monitoring-workbench-overview',
          parentId: 'monitoring-workbench',
          path: '/monitoring-workbench/overview',
          labelZh: '总览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 61,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 99,
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
          sortOrder: 100,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe('AI工作台')
    expect(container.querySelector('.soha-nav-business')).not.toBeNull()
    expect(container.textContent).toContain('通用聊天')
    expect(container.textContent).toContain('巡检')
    expect(container.textContent).not.toContain('监控工作台')
    expect(container.textContent).not.toContain('系统管理')
    expect(container.textContent).not.toContain('AI Gateway')
  })

  it('shows Gateway children inside the unified AI workbench sidebar', async () => {
    const container = await renderWithProviders('/ai-gateway/manifest', {
      permissionKeys: [
        'workspace.resource.view',
        'ai.gateway.view',
        'ai.gateway.manage',
        'ai.gateway.relay.view',
        'observe.ai.view',
        'observe.ai.chat',
        'observe.monitoring.view',
        'overview.view',
        'system.menus.view',
      ],
      visibleMenuIds: [
        'dashboard',
        'ai-workbench',
        'ai-workbench-chat',
        'ai-workbench-inspection',
        'ai-workbench-model-settings',
        'ai-gateway-manifest',
        'ai-gateway-clients',
        'ai-gateway-tokens',
        'ai-gateway-governance',
        'ai-gateway-call-logs',
        'monitoring-workbench',
        'monitoring-workbench-overview',
        'system',
        'menus',
      ],
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
          id: 'ai-workbench',
          path: '/ai-workbench',
          labelZh: 'AI工作台',
          labelEn: 'AI Workbench',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 15,
          enabled: true,
        },
        {
          id: 'ai-workbench-chat',
          parentId: 'ai-workbench',
          path: '/ai-workbench/chat',
          labelZh: '通用聊天',
          labelEn: 'Chat',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 16,
          enabled: true,
        },
        {
          id: 'ai-workbench-inspection',
          parentId: 'ai-workbench',
          path: '/ai-workbench/inspection',
          labelZh: '巡检',
          labelEn: 'Inspection',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 19,
          enabled: true,
        },
        {
          id: 'ai-workbench-model-settings',
          parentId: 'ai-workbench',
          path: '/ai-workbench/model-settings',
          labelZh: '模型设置',
          labelEn: 'Model Settings',
          iconKey: 'bot',
          section: 'ops',
          sortOrder: 20,
          enabled: true,
        },
        {
          id: 'ai-gateway-manifest',
          parentId: 'ai-workbench',
          path: '/ai-gateway/manifest',
          labelZh: '能力清单',
          labelEn: 'Manifest',
          iconKey: 'shield',
          section: 'ops',
          sortOrder: 23,
          enabled: true,
        },
        {
          id: 'ai-gateway-clients',
          parentId: 'ai-workbench',
          path: '/ai-gateway/clients',
          labelZh: 'AI Clients',
          labelEn: 'AI Clients',
          iconKey: 'link',
          section: 'ops',
          sortOrder: 24,
          enabled: true,
        },
        {
          id: 'ai-gateway-tokens',
          parentId: 'ai-workbench',
          path: '/ai-gateway/tokens',
          labelZh: 'Tokens',
          labelEn: 'Tokens',
          iconKey: 'key',
          section: 'ops',
          sortOrder: 25,
          enabled: true,
        },
        {
          id: 'ai-gateway-governance',
          parentId: 'ai-workbench',
          path: '/ai-gateway/governance',
          labelZh: 'Governance',
          labelEn: 'Governance',
          iconKey: 'shield',
          section: 'ops',
          sortOrder: 26,
          enabled: true,
        },
        {
          id: 'ai-gateway-call-logs',
          parentId: 'ai-workbench',
          path: '/ai-gateway/call-logs',
          labelZh: '调用日志',
          labelEn: 'Call Logs',
          iconKey: 'history',
          section: 'ops',
          sortOrder: 27,
          enabled: true,
        },
        {
          id: 'monitoring-workbench',
          path: '/monitoring-workbench',
          labelZh: '监控工作台',
          labelEn: 'Monitoring Workbench',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 60,
          enabled: true,
        },
        {
          id: 'monitoring-workbench-overview',
          parentId: 'monitoring-workbench',
          path: '/monitoring-workbench/overview',
          labelZh: '总览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 61,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 99,
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
          sortOrder: 100,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('.soha-workbench-switcher__label')?.textContent).toBe('AI工作台')
    expect(container.querySelector('.soha-nav-business')).not.toBeNull()
    const businessMenu = container.querySelector('.soha-nav-menu')
    expect(businessMenu?.querySelector('.ant-menu-submenu')).toBeNull()
    expect(businessMenu?.textContent).not.toContain('AI Gateway')
    expect(businessMenu?.textContent).toContain('能力清单')
    expect(businessMenu?.textContent).toContain('Tokens')
    expect(businessMenu?.textContent).toContain('Governance')
    expect(businessMenu?.textContent).toContain('调用日志')
    expect(container.textContent).not.toContain('AI Gateway')
    expect(container.textContent).toContain('通用聊天')
    expect(container.textContent).toContain('巡检')
    expect(container.textContent).not.toContain('系统管理')
  })

  it('does not repeat flattened workbench root menu in breadcrumbs', async () => {
    const container = await renderWithProviders('/compute/overview', {
      permissionKeys: [
        'workspace.resource.view',
        'overview.view',
        'virtualization.overview.view',
        'virtualization.vms.view',
        'system.menus.view',
      ],
      visibleMenuIds: [
        'dashboard',
        'compute-workbench',
        'compute-workbench-overview',
        'virtualization-workbench',
        'virtualization-workbench-vms',
        'system',
        'menus',
      ],
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
          id: 'compute-workbench',
          path: '/compute',
          labelZh: '计算资源工作台',
          labelEn: 'Compute Workbench',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'compute-workbench-overview',
          parentId: 'compute-workbench',
          path: '/compute/overview',
          labelZh: '总览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 11,
          enabled: true,
        },
        {
          id: 'virtualization-workbench',
          parentId: 'compute-workbench',
          path: '/compute/virtualization',
          labelZh: '虚拟化',
          labelEn: 'Virtualization',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 12,
          enabled: true,
        },
        {
          id: 'virtualization-workbench-vms',
          parentId: 'virtualization-workbench',
          path: '/compute/virtualization/vms',
          labelZh: '虚拟机',
          labelEn: 'Virtual Machines',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 12,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 99,
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
          sortOrder: 100,
          enabled: true,
        },
      ],
    })

    const breadcrumbText =
      container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent ?? ''
    expect(breadcrumbText).toContain('计算资源工作台/总览')
    expect(breadcrumbText.match(/计算资源工作台/g) ?? []).toHaveLength(1)
  })

  it('renders breadcrumb ancestry for nested route content', async () => {
    const container = await renderWithProviders('/compute/virtualization/vms/vm-1', {
      permissionKeys: [
        'workspace.resource.view',
        'overview.view',
        'virtualization.overview.view',
        'virtualization.vms.view',
        'system.menus.view',
      ],
      visibleMenuIds: [
        'dashboard',
        'compute-workbench',
        'compute-workbench-overview',
        'virtualization-workbench',
        'virtualization-workbench-vms',
        'system',
        'menus',
      ],
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
          id: 'compute-workbench',
          path: '/compute',
          labelZh: '计算资源工作台',
          labelEn: 'Compute Workbench',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 10,
          enabled: true,
        },
        {
          id: 'compute-workbench-overview',
          parentId: 'compute-workbench',
          path: '/compute/overview',
          labelZh: '总览',
          labelEn: 'Overview',
          iconKey: 'gauge',
          section: 'ops',
          sortOrder: 11,
          enabled: true,
        },
        {
          id: 'virtualization-workbench',
          parentId: 'compute-workbench',
          path: '/compute/virtualization',
          labelZh: '虚拟化',
          labelEn: 'Virtualization',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 12,
          enabled: true,
        },
        {
          id: 'virtualization-workbench-vms',
          parentId: 'virtualization-workbench',
          path: '/compute/virtualization/vms',
          labelZh: '虚拟机',
          labelEn: 'Virtual Machines',
          iconKey: 'server',
          section: 'ops',
          sortOrder: 12,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 99,
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
          sortOrder: 100,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent).toContain(
      '虚拟化/虚拟机/vm-1',
    )
  })

  it('adds the list route and resource name to dynamic detail breadcrumbs', async () => {
    const container = await renderWithProviders('/workloads/pods/alidns-webhook-f7645fd4b-lkvn8', {
      permissionKeys: ['workspace.resource.view', 'platform.workloads.view'],
      visibleMenuIds: ['workloads'],
      visibleMenus: [
        {
          id: 'workloads',
          path: '/workloads',
          labelZh: '工作负载',
          labelEn: 'Workloads',
          iconKey: 'boxes',
          section: 'platform',
          sortOrder: 1,
          enabled: true,
        },
      ],
    })

    const breadcrumbText =
      container.querySelector('.soha-header-main .ant-breadcrumb')?.textContent ?? ''
    expect(breadcrumbText).toContain('工作负载/Pods/alidns-webhook-f7645fd4b-lkvn8')
    expect(breadcrumbText).not.toContain('Pod Detail')
  })

  it('keeps settings out of the header and routes system navigation through the main sidebar', async () => {
    const container = await renderWithProviders('/', {
      permissionKeys: [
        'workspace.resource.view',
        'overview.view',
        'settings.identity.view',
        'system.menus.view',
      ],
      visibleMenuIds: ['dashboard', 'settings', 'system', 'menus'],
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
          id: 'settings',
          path: '/settings',
          labelZh: '设置中心',
          labelEn: 'Settings',
          iconKey: 'settings',
          section: 'admin',
          sortOrder: 2,
          enabled: true,
        },
        {
          id: 'system',
          path: '/system',
          labelZh: '系统管理',
          labelEn: 'System',
          iconKey: 'panels-top-left',
          section: 'admin',
          sortOrder: 3,
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
          sortOrder: 4,
          enabled: true,
        },
      ],
    })

    expect(container.querySelector('button[aria-label="系统设置"]')).toBeNull()
    expect(container.querySelector('.soha-nav-business')).not.toBeNull()
  })

  it('opens personal settings from the avatar dropdown', async () => {
    const container = await renderWithProviders('/')
    const userButton = container.querySelector('.soha-user-trigger') as HTMLButtonElement | null
    expect(userButton).not.toBeNull()

    await act(async () => {
      userButton?.click()
      await Promise.resolve()
    })

    const settingsItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find(
      (item) => item.textContent?.includes('个人设置'),
    ) as HTMLElement | undefined
    expect(settingsItem).not.toBeUndefined()

    await act(async () => {
      settingsItem?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="page"]')?.getAttribute('data-pathname')).toBe(
      '/account/settings',
    )
    expect(testState.auth.clearAuth).not.toHaveBeenCalled()
  })

  it('does not expose profile and about as separate avatar actions', async () => {
    const container = await renderWithProviders('/')
    const userButton = container.querySelector('.soha-user-trigger') as HTMLButtonElement | null

    await act(async () => {
      userButton?.click()
      await Promise.resolve()
    })

    expect(
      Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some((item) =>
        item.textContent?.includes('个人中心'),
      ),
    ).toBe(false)
    expect(
      Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some((item) =>
        item.textContent?.includes('关于'),
      ),
    ).toBe(false)
    expect(testState.auth.clearAuth).not.toHaveBeenCalled()
  })

  it('opens password change from the avatar dropdown', async () => {
    const container = await renderWithProviders('/')
    const userButton = container.querySelector('.soha-user-trigger') as HTMLButtonElement | null
    expect(userButton).not.toBeNull()

    await act(async () => {
      userButton?.click()
      await Promise.resolve()
    })

    const passwordItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find(
      (item) => item.textContent?.includes('修改密码'),
    ) as HTMLElement | undefined
    expect(passwordItem).not.toBeUndefined()

    await act(async () => {
      passwordItem?.click()
      await Promise.resolve()
    })

    const page = container.querySelector('[data-testid="page"]')
    expect(page?.getAttribute('data-pathname')).toBe('/account/profile')
    expect(page?.getAttribute('data-search')).toBe('?changePassword=1')
    expect(testState.auth.clearAuth).not.toHaveBeenCalled()
  })

  it('shows portal and personal settings in the avatar dropdown', async () => {
    const container = await renderWithProviders('/', {
      permissionKeys: [...testState.snapshot.permissionKeys, 'identity.portal.view'],
      visibleMenuIds: [...testState.snapshot.visibleMenuIds, 'home-workbench'],
      visibleMenus: [
        ...testState.snapshot.visibleMenus,
        {
          id: 'home-workbench',
          path: '/portal',
          labelZh: '首页',
          labelEn: 'Home',
          iconKey: 'home',
          section: '',
          sortOrder: 1,
          enabled: true,
        },
      ],
    })
    const userButton = container.querySelector('.soha-user-trigger') as HTMLButtonElement | null
    expect(userButton).not.toBeNull()

    await act(async () => {
      userButton?.click()
      await Promise.resolve()
    })

    const portalItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find(
      (item) => item.textContent?.includes('门户首页'),
    ) as HTMLElement | undefined
    expect(portalItem).not.toBeUndefined()
    expect(
        Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some((item) =>
        item.textContent?.includes('个人设置'),
      ),
    ).toBe(true)

    await act(async () => {
      portalItem?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="page"]')?.getAttribute('data-pathname')).toBe(
      '/portal',
    )
    expect(testState.auth.clearAuth).not.toHaveBeenCalled()
  })

  it('hides the portal shortcut when the home workbench menu is disabled', async () => {
    const container = await renderWithProviders('/')
    const userButton = container.querySelector('.soha-user-trigger') as HTMLButtonElement | null

    await act(async () => {
      userButton?.click()
      await Promise.resolve()
    })

    expect(
      Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some((item) =>
        item.textContent?.includes('门户首页'),
      ),
    ).toBe(false)
  })
})
