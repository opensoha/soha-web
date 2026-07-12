/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformAccessControlRoleDetailPage } from './access-control/roles/detail-page'

const testState = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'default' as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn((path: string) => Promise.resolve({ data: testState.responses[path] ?? [] })),
)

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'en_US' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    put: vi.fn(),
  },
}))

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div>,
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function setResponses(responses: Record<string, unknown>) {
  testState.responses = responses
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderWithProviders(node: ReactNode) {
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
        <MemoryRouter
          initialEntries={['/platform-access-control/roles/demo?namespace=default']}
          future={{
            v7_relativeSplatPath: true,
            v7_startTransition: true,
          }}
        >
          <Routes>
            <Route path="/platform-access-control/roles/:name" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  await flushAsyncWork()

  return container
}

describe('RBAC detail YAML tab', () => {
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
    testState.scope.clusterId = 'cluster-a'
    testState.scope.namespace = 'default'
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Agent Cluster',
          connectionMode: 'agent',
          region: 'dev',
          environment: 'test',
          labels: {},
          version: 'v1.30.0',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'resource.yaml.apply',
          label: 'YAML apply and delete',
          category: 'configuration',
          direct: { status: 'available' },
          agent: {
            status: 'unsupported',
            notes: ['YAML endpoints are not supported for agent-connected clusters yet'],
          },
        },
      ],
      '/clusters/cluster-a/access-control/roles/demo/detail?namespace=default': {
        annotations: {},
        createdAt: '2026-06-10T00:00:00Z',
        labels: {},
        name: 'demo',
        namespace: 'default',
        ruleSummaries: ['get pods'],
        rules: 1,
      },
    })
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

  it('does not fetch YAML for agent clusters with unsupported YAML capability', async () => {
    const container = await renderWithProviders(<PlatformAccessControlRoleDetailPage />)

    const yamlTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (item) => item.textContent === 'YAML',
    )
    if (!yamlTab) {
      throw new Error('YAML tab not found')
    }

    await act(async () => {
      yamlTab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()

    expect(container.textContent).toContain(
      'YAML endpoints are not supported for agent-connected clusters yet',
    )
    expect(apiGetMock.mock.calls.map(([path]) => path)).not.toContain(
      '/clusters/cluster-a/access-control/roles/demo/yaml?namespace=default',
    )
  })
})
