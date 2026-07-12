/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstalledPluginsPage } from './installed/list-page'
import { PluginMarketplacePage } from './marketplace/list-page'

const apiGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(),
    get: apiGetMock,
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth')
  return {
    ...actual,
    usePermissionSnapshot: () => ({
      data: {
        data: {
          permissionKeys: ['plugin.view', 'plugin.install', 'plugin.manage'],
          visibleMenuIds: [],
          visibleMenus: [],
        },
      },
    }),
  }
})

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    dataSource,
    title,
  }: {
    dataSource: Array<{ name?: string }>
    title?: ReactNode
  }) => (
    <section>
      <h2>{title}</h2>
      {dataSource.map((item) => (
        <div key={item.name}>{item.name}</div>
      ))}
    </section>
  ),
}))

vi.mock('@/components/management-list', () => ({
  ManagementDetailHeader: ({ title }: { title?: ReactNode }) => <h1>{title}</h1>,
  ManagementIconButton: () => null,
  ManagementState: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ManagementToolbarSearch: () => null,
}))

const mountedRoots: Root[] = []

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})
beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function renderPage(node: ReactNode, route: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return container
}

describe('plugin list page data boundaries', () => {
  it('loads marketplace data through the feature API', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: [
        {
          id: 'plugin-market',
          name: 'Marketplace Plugin',
          publisher: 'Soha',
          type: 'skill',
          version: '1.0.0',
          source: 'static',
          installed: false,
          manifest: {},
        },
      ],
    })

    const container = await renderPage(<PluginMarketplacePage />, '/plugins/marketplace')
    expect(apiGetMock).toHaveBeenCalledWith('/plugins/marketplace')
    expect(container.textContent).toContain('Marketplace Plugin')
  })

  it('loads installed data through a separate page leaf', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: [
        {
          id: 'plugin-installed',
          name: 'Installed Plugin',
          publisher: 'Soha',
          type: 'skill',
          version: '1.0.0',
          status: 'enabled',
          checksumStatus: 'verified',
          manifest: {},
        },
      ],
    })

    const container = await renderPage(<InstalledPluginsPage />, '/plugins/installed')
    expect(apiGetMock).toHaveBeenCalledWith('/plugins/installed')
    expect(container.textContent).toContain('Installed Plugin')
  })
})
