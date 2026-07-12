/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClusterDetailPage } from './detail-page'

const storeMocks = vi.hoisted(() => ({ setClusterId: vi.fn() }))
const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path.endsWith('/detail')) {
      return {
        data: {
          summary: {
            id: 'cluster-a',
            name: 'Primary',
            region: 'gke',
            environment: 'prod',
            labels: { owner: 'platform' },
            connectionMode: 'agent',
            version: 'v1.30',
            capabilities: ['metrics'],
            health: { status: 'healthy' },
          },
          diagnostics: {
            syncStrategy: 'watch',
            cacheStatus: 'ready',
            connectionState: 'connected',
          },
          connection: {
            mode: 'agent',
            credentialType: 'token',
            sourceType: 'agent',
            usesInformerCache: true,
          },
          monitoring: { prometheus: { baseUrl: 'http://prometheus', hasBearerToken: true } },
        },
      }
    }
    return {
      data: [
        {
          name: 'node-a',
          status: 'Ready',
          roles: ['worker'],
          podCount: 12,
          ageSeconds: 60,
        },
      ],
    }
  }),
)

vi.mock('@/services/api-client', () => ({ api: { get: apiGetMock } }))
vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: (selector: (state: typeof storeMocks) => unknown) => selector(storeMocks),
}))
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))
vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))
vi.mock('@/components/management-list', () => ({
  ManagementDetailHeader: ({
    actions,
    description,
    title,
  }: {
    actions?: ReactNode
    description?: ReactNode
    title?: ReactNode
  }) => (
    <header>
      {title}
      {description}
      {actions}
    </header>
  ),
  ManagementState: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ dataSource = [] }: { dataSource?: Array<{ name?: string }> }) => (
    <div>{dataSource.map((item) => item.name).join(',')}</div>
  ),
}))

const mountedRoots: Root[] = []

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})
beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('cluster detail page', () => {
  it('loads unwrapped detail and node snapshot data for the route cluster', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mountedRoots.push(root)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/clusters/cluster-a']}>
            <Routes>
              <Route path="/clusters/:clusterId" element={<ClusterDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })
    await flushAsyncWork()
    await flushAsyncWork()

    expect(apiGetMock).toHaveBeenCalledWith('/clusters/cluster-a/detail')
    expect(apiGetMock).toHaveBeenCalledWith('/clusters/cluster-a/infrastructure/nodes')
    expect(container.textContent).toContain('集群详情: Primary')
    expect(container.textContent).toContain('node-a')
  })
})
