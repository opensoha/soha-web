/** @vitest-environment jsdom */

import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { usePreferencesStore } from '@/stores/preferences-store'
import { SohaProviderPortalPage } from './page'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

const announcementMocks = vi.hoisted(() => ({
  useAnnouncementInbox: vi.fn(),
}))

const permissionMocks = vi.hoisted(() => ({
  snapshot: {
    permissionKeys: [
      'identity.applications.view',
      'identity.portal.view',
      'observe.monitoring.view',
      'workspace.resource.view',
    ],
    visibleMenuIds: ['home-workbench', 'monitoring-workbench', 'monitoring-workbench-overview'],
    visibleMenus: [
      {
        id: 'home-workbench',
        path: '/portal',
        labelEn: 'Home',
        labelZh: '首页',
        iconKey: 'home',
        sortOrder: 0,
      },
      {
        id: 'monitoring-workbench',
        path: '/monitoring-workbench',
        labelEn: 'Observability Workbench',
        labelZh: '可观测性工作台',
        iconKey: 'gauge',
        sortOrder: 50,
      },
      {
        id: 'monitoring-workbench-overview',
        parentId: 'monitoring-workbench',
        path: '/monitoring-workbench/overview',
        labelEn: 'Overview',
        labelZh: '总览',
        iconKey: 'gauge',
        sortOrder: 51,
      },
    ],
  },
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))
vi.mock('@/features/announcements', () => ({
  useAnnouncementInbox: announcementMocks.useAnnouncementInbox,
}))
vi.mock('@/features/auth', () => ({
  hasPermission: (_snapshot: unknown, permissionKey?: string) =>
    !permissionKey || permissionMocks.snapshot.permissionKeys.includes(permissionKey),
  usePermissionSnapshot: () => ({
    data: { data: permissionMocks.snapshot },
  }),
}))

const application = {
  id: 'app-1',
  slug: 'console',
  name: 'Operations Console',
  description: 'Manage production services',
  tags: ['production'],
  providerType: 'link',
  portalVisible: true,
  featured: true,
  favorite: true,
  sortOrder: 1,
  status: 'enabled',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const secondaryApplication = {
  ...application,
  id: 'app-2',
  slug: 'builds',
  name: 'Build Dashboard',
  description: 'Review build activity',
  tags: ['internal'],
  featured: false,
  favorite: false,
  sortOrder: 2,
}

const bootstrap = {
  principal: {
    userId: 'user-1',
    userName: 'admin',
    email: 'admin@example.test',
    roles: ['admin'],
    teams: [],
    projects: [],
    tags: [],
  },
  applications: [application, secondaryApplication],
  favorites: [application],
  recent: [],
  security: {
    principal: {
      userId: 'user-1',
      userName: 'admin',
      email: 'admin@example.test',
      roles: ['admin'],
      teams: [],
      projects: [],
      tags: [],
    },
    mfaEnabled: true,
    linkedSources: ['oidc'],
    activeSession: 1,
  },
}

const mountedRoots: Root[] = []

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

beforeEach(() => {
  vi.clearAllMocks()
  permissionMocks.snapshot.permissionKeys = [
    'identity.applications.view',
    'identity.portal.view',
    'observe.monitoring.view',
    'workspace.resource.view',
  ]
  usePreferencesStore.setState({ localeCode: 'en_US' })
  apiMocks.get.mockResolvedValue({ data: bootstrap })
  announcementMocks.useAnnouncementInbox.mockReturnValue({
    data: { data: { items: [], unreadCount: 0 } },
    isLoading: false,
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  usePreferencesStore.setState({ localeCode: 'zh_CN' })
  document.body.innerHTML = ''
})

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/portal']}>
            <I18nProvider>
              <SohaProviderPortalPage />
            </I18nProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await flushAsyncWork()
  return container
}

describe('Provider Portal catalog page', () => {
  it('renders the application workspace without legacy portal chrome', async () => {
    const container = await renderPage()

    expect(apiMocks.get).toHaveBeenCalledWith('/portal/bootstrap')
    expect(announcementMocks.useAnnouncementInbox).toHaveBeenCalledWith(10, true)
    expect(container.textContent).toContain('Operations Console')
    expect(container.textContent).toContain('Available')
    expect(container.querySelector('.soha-portal-header')).toBeNull()
    expect(container.querySelector('.soha-portal-shortcuts')).toBeNull()
    expect(container.querySelector('.soha-portal-toolbar')).toBeNull()
    expect(container.querySelector('.soha-portal-apps-toolbar')).toBeNull()
    expect(container.querySelector('.soha-portal-app-tag-filter')).toBeNull()
    expect(container.querySelector('.soha-portal-app-toolbar')).not.toBeNull()
    expect(container.querySelector('.soha-portal-app-toolbar .soha-portal-search')).not.toBeNull()
    expect(
      container.querySelector('button[aria-label="Switch application card size"]'),
    ).not.toBeNull()
    expect(container.querySelector('.soha-portal-category')).toBeNull()
    expect(container.querySelector('.soha-portal-mode')).toBeNull()
    expect(container.querySelector('.soha-portal-announcements')).toBeNull()
    expect(container.querySelectorAll('.soha-portal-side-panel')).toHaveLength(3)
    expect(container.querySelector('button[aria-label="Collapse sidebar"]')).not.toBeNull()
  })

  it('renders accessible workbench links between the user and recent side panels', async () => {
    const container = await renderPage()

    await vi.waitFor(() => {
      expect(container.querySelector('.soha-portal-workbenches')).not.toBeNull()
    })
    const workbenches = container.querySelector('.soha-portal-workbenches')
    const sidePanels = [...container.querySelectorAll('.soha-portal-side-panel')]
    const observabilityLink = container.querySelector(
      'a[aria-label="Open Observability Workbench"]',
    )

    expect(workbenches).not.toBeNull()
    expect(sidePanels).toHaveLength(3)
    expect(sidePanels[1]).toBe(workbenches)
    expect(observabilityLink?.getAttribute('href')).toBe('/monitoring-workbench/overview')
    expect(container.textContent).not.toContain('Settings Center')
  })

  it('renders autoplay announcements and a horizontally collapsible sidebar', async () => {
    const intervalSpy = vi.spyOn(window, 'setInterval')
    announcementMocks.useAnnouncementInbox.mockReturnValue({
      data: {
        data: {
          items: Array.from({ length: 5 }, (_, index) => ({
            id: `notice-${index + 1}`,
            title: `Notice ${index + 1}`,
            summary: `Announcement ${index + 1} summary`,
            content: `Announcement ${index + 1} content`,
            level: 'info',
            status: 'published',
            audience: 'all',
            sticky: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isRead: index > 0,
          })),
          unreadCount: 1,
        },
      },
      isLoading: false,
    })
    const container = await renderPage()

    expect(container.querySelectorAll('.soha-portal-announcement-item')).toHaveLength(5)
    expect(
      container.querySelector('.soha-portal-announcement-track')?.getAttribute('data-active-index'),
    ).toBe('0')
    expect(container.querySelector('.soha-portal-announcement-controls')).toBeNull()
    expect(container.querySelector('.soha-portal-announcement-page-indicator')).toBeNull()
    expect(container.textContent).toContain('Notice 5')
    expect(container.textContent).toContain('Announcement 5 content')

    const intervalCall = intervalSpy.mock.calls.find(([, delay]) => delay === 6000)
    expect(intervalCall).toBeDefined()
    await act(async () => (intervalCall?.[0] as () => void)())
    expect(
      container.querySelector('.soha-portal-announcement-track')?.getAttribute('data-active-index'),
    ).toBe('1')
    intervalSpy.mockRestore()

    const collapseSidebarButton = container.querySelector('button[aria-label="Collapse sidebar"]')
    await act(async () =>
      collapseSidebarButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
    expect(container.querySelector('.soha-portal-workspace')?.className).toContain(
      'is-side-collapsed',
    )
    expect(container.querySelector('.soha-portal-side')).toBeNull()
    expect(container.querySelectorAll('.soha-portal-side-panel')).toHaveLength(0)

    const expandSidebarButton = container.querySelector(
      '.soha-portal-view-actions button[aria-label="Expand sidebar"]',
    )
    await act(async () =>
      expandSidebarButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
    expect(container.querySelector('.soha-portal-workspace')?.className).not.toContain(
      'is-side-collapsed',
    )
    expect(container.querySelector('.soha-portal-side')).not.toBeNull()
    expect(container.querySelectorAll('.soha-portal-side-panel')).toHaveLength(3)
  })

  it('switches application card density and filters by tag', async () => {
    const container = await renderPage()

    const densityButton = container.querySelector(
      'button[aria-label="Switch application card size"]',
    )
    expect(container.querySelector('.soha-portal-app-grid')?.className).toContain('is-large')
    await act(async () => densityButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('.soha-portal-app-grid')?.className).toContain('is-small')
    expect(container.querySelectorAll('.soha-portal-app-card.is-small')).toHaveLength(2)
    expect(
      container.querySelectorAll('.soha-portal-app-card.is-small .soha-portal-app-compact-body'),
    ).toHaveLength(0)
    expect(
      container.querySelectorAll(
        '.soha-portal-app-card.is-small .ant-card-extra button[aria-label^="Open "]',
      ),
    ).toHaveLength(0)
    await act(async () => densityButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('.soha-portal-app-grid')?.className).toContain('is-medium')
    await act(async () => densityButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('.soha-portal-app-grid')?.className).toContain('is-large')

    const internalGroup = [
      ...container.querySelectorAll('.soha-portal-group-menu .ant-menu-item'),
    ].find((item) => item.textContent?.trim() === 'internal')
    await act(async () => internalGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushAsyncWork()

    const visibleCards = [...container.querySelectorAll('.soha-portal-app-card')]
    expect(visibleCards).toHaveLength(1)
    expect(visibleCards[0]?.textContent).toContain('Build Dashboard')
    expect(visibleCards[0]?.textContent).not.toContain('Operations Console')
  })

  it('renders application groups as the fixed first workspace column', async () => {
    const container = await renderPage()

    const workspace = container.querySelector('.soha-portal-workspace')
    const groupNavigation = container.querySelector('.soha-portal-group-nav')
    expect(workspace?.children[0]).toBe(groupNavigation)
    expect(workspace?.children[1]).toBe(container.querySelector('.soha-portal-apps'))
    expect(workspace?.children[2]).toBe(container.querySelector('.soha-portal-side'))
    expect(container.textContent).toContain('Application groups')
    expect(container.querySelector('.soha-portal-tag-filter-tabs')).toBeNull()
    expect(container.querySelector('button[aria-label="Switch to grouped view"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Switch to tab view"]')).toBeNull()

    await act(async () =>
      container
        .querySelector('button[aria-label="Collapse application groups"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
    expect(workspace?.className).toContain('is-group-collapsed')
    expect(container.querySelector('.soha-portal-group-nav')).toBeNull()
    expect(container.querySelector('.soha-portal-group-menu')).toBeNull()
    expect(
      container.querySelector(
        '.soha-portal-app-toolbar button[aria-label="Expand application groups"]',
      ),
    ).not.toBeNull()
    expect(workspace?.children[0]).toBe(container.querySelector('.soha-portal-apps'))

    await act(async () =>
      container
        .querySelector('button[aria-label="Expand application groups"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
    expect(workspace?.className).not.toContain('is-group-collapsed')
    expect(workspace?.children[0]).toBe(container.querySelector('.soha-portal-group-nav'))
    expect(container.querySelector('.soha-portal-group-menu')).not.toBeNull()

    const internalGroup = [
      ...container.querySelectorAll('.soha-portal-group-menu .ant-menu-item'),
    ].find((item) => item.textContent?.trim() === 'internal')
    await act(async () => internalGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushAsyncWork()

    const visibleCards = [...container.querySelectorAll('.soha-portal-app-card')]
    expect(visibleCards).toHaveLength(1)
    expect(visibleCards[0]?.textContent).toContain('Build Dashboard')
  })

  it('launches an enabled application when its card is clicked', async () => {
    apiMocks.post.mockImplementation(() => new Promise(() => {}))
    const container = await renderPage()

    await act(async () =>
      container
        .querySelector('.soha-portal-app-card .soha-portal-app-title')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )

    expect(apiMocks.post).toHaveBeenCalledWith('/portal/applications/app-1/launch')
  })

  it('hides application details without the identity application permission', async () => {
    permissionMocks.snapshot.permissionKeys = []
    const container = await renderPage()

    expect(container.textContent).not.toContain('Details')
    expect(container.querySelectorAll('.soha-portal-app-actions button')).toHaveLength(2)
  })

  it('renders the portal home from the global Chinese dictionary', async () => {
    usePreferencesStore.setState({ localeCode: 'zh_CN' })
    const container = await renderPage()

    expect(container.textContent).not.toContain('标签')
    expect(container.textContent).toContain('全部')
    expect(container.textContent).not.toContain('全部标签')
    expect(container.querySelector('button[aria-label="切换应用卡片尺寸"]')).not.toBeNull()
  })
})
