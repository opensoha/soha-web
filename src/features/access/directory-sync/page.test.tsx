/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { PermissionSnapshot } from '@/types'
import { DirectorySyncPage } from './page'

const state = vi.hoisted(() => ({
  snapshot: { permissionKeys: [], visibleMenuIds: [], visibleMenus: [] } as PermissionSnapshot,
  connections: [] as unknown[],
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  usePermissionSnapshot: () => ({ data: { data: state.snapshot }, isLoading: false }),
  hasPermission: (snapshot: PermissionSnapshot | undefined, key: string) =>
    snapshot?.permissionKeys.includes(key) ?? false,
}))

vi.mock('./api', () => ({
  directorySyncApi: {
    listConnections: vi.fn(() => Promise.resolve(state.connections)),
    listConflicts: vi.fn(() => Promise.resolve([])),
    listRuns: vi.fn(() => Promise.resolve([])),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    validateConnection: vi.fn(),
    preview: vi.fn(),
    startSync: vi.fn(),
    cancelSync: vi.fn(),
    resolveConflict: vi.fn(),
  },
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function renderPage() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <DirectorySyncPage />
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

describe('directory sync page', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })
  beforeEach(() => {
    state.connections = []
    state.snapshot = { permissionKeys: [], visibleMenuIds: [], visibleMenus: [] }
  })
  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    vi.clearAllMocks()
  })

  it('blocks users without directory view permission', async () => {
    await renderPage()
    expect(container.textContent).toContain('当前账号没有查看目录同步的权限。')
  })

  it('shows management actions according to directory permissions', async () => {
    state.snapshot.permissionKeys = ['access.directory.view', 'access.directory.manage']
    await renderPage()
    expect(container.textContent).toContain('新增目录连接')
    expect(container.textContent).toContain('关键词')
  })

  it('renders organizations as always enabled and people as disabled by default', async () => {
    state.snapshot.permissionKeys = ['access.directory.view']
    state.connections = [
      {
        id: 'dir-1',
        name: '飞书通讯录',
        providerType: 'feishu',
        enabled: true,
        capabilities: ['organizations'],
        status: 'healthy',
        policy: {
          syncOrganizations: true,
          syncPeople: false,
          mode: 'manual',
          provisionMode: 'review_before_link',
        },
      },
    ]
    await renderPage()
    expect(container.textContent).toContain('飞书通讯录')
    expect(container.textContent).toContain('已开启')
    expect(container.textContent).toContain('未开启')
  })
})
