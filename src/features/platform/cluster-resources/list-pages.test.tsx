/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClusterNamespacesPage } from './namespaces-list-page'
import { ClusterNodesPage } from './nodes-list-page'

const testState = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: null as string | null,
    namespace: null as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(async (path: string) => ({ data: testState.responses[path] ?? [] })),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))
vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))
vi.mock('@/features/copilot', () => ({ useAIPageContext: vi.fn() }))
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))
vi.mock('@/features/platform/node-resource-utils', () => ({
  NodeResourcePanel: () => <div>node-resource-panel</div>,
  parseStringMap: () => ({}),
  parseTaints: () => [],
  stringifyMap: () => '{}',
  stringifyTaints: () => '[]',
}))
vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ dataSource = [] }: { dataSource?: unknown[] }) => (
    <div data-testid="admin-table">{dataSource.length}</div>
  ),
}))
vi.mock('@/components/management-list', () => ({
  ManagementDensityButton: () => null,
  ManagementDetailHeader: ({ title }: { title?: ReactNode }) => <h1>{title}</h1>,
  ManagementIconButton: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <button aria-label={ariaLabel} />
  ),
  ManagementRefreshButton: () => null,
  ManagementState: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

const mountedRoots: Root[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.responses = {}
  testState.scope.clusterId = null
  testState.scope.namespace = null
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function renderPage(page: ReactNode) {
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
          <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            {page}
          </MemoryRouter>
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

describe('cluster resource list pages', () => {
  it('keeps both list queries disabled until a cluster is selected', async () => {
    const nodes = await renderPage(<ClusterNodesPage />)
    expect(nodes.textContent).toContain('Please select a cluster')
    expect(apiMocks.get).not.toHaveBeenCalled()

    const namespaces = await renderPage(<ClusterNamespacesPage />)
    expect(namespaces.textContent).toContain('Select a cluster')
    expect(apiMocks.get).not.toHaveBeenCalled()
  })

  it('renders unwrapped node and namespace data from canonical cluster paths', async () => {
    testState.scope.clusterId = 'cluster-a'
    testState.responses['/clusters/cluster-a/infrastructure/nodes'] = [{ name: 'node-a' }]
    testState.responses['/clusters/cluster-a/namespaces'] = [{ name: 'team-a' }]

    const nodes = await renderPage(<ClusterNodesPage />)
    const namespaces = await renderPage(<ClusterNamespacesPage />)

    expect(nodes.querySelector('[data-testid="admin-table"]')?.textContent).toBe('1')
    expect(namespaces.querySelector('[data-testid="admin-table"]')?.textContent).toBe('1')
    expect(apiMocks.get).toHaveBeenCalledWith('/clusters/cluster-a/infrastructure/nodes')
    expect(apiMocks.get).toHaveBeenCalledWith('/clusters/cluster-a/namespaces')
  })
})
