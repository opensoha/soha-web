/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PodDetailPage } from './detail-page'

const testState = vi.hoisted(() => ({
  runtimeLoads: {
    logs: 0,
    metrics: 0,
    terminal: 0,
  },
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'monitoring' as string | null,
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path.includes('/detail?')) {
      return {
        data: {
          name: 'prometheus-0',
          namespace: 'monitoring',
          phase: 'Running',
          createdAt: '2026-01-01T00:00:00Z',
          containers: [
            {
              name: 'prometheus',
              image: 'prometheus:v1',
              ready: true,
              restartCount: 0,
              state: 'running',
            },
          ],
          conditions: [],
          volumes: [],
          relatedResources: [],
        },
      }
    }
    if (path.includes('/metrics?')) {
      return {
        data: {
          resourceKind: 'Pod',
          resourceName: 'prometheus-0',
          configured: true,
          rangeMinutes: 60,
          series: [],
        },
      }
    }
    if (path.includes('/events?')) return { data: [] }
    if (path.includes('/yaml?')) {
      return { data: { kind: 'Pod', name: 'prometheus-0', content: 'kind: Pod' } }
    }
    return { data: [] }
  }),
)

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    put: vi.fn(async () => ({ data: { content: 'kind: Pod' } })),
  },
}))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@/features/copilot', () => ({ useAIPageContext: vi.fn() }))

vi.mock('@/features/platform/cluster-capabilities', () => ({
  useClusterCapability: () => ({
    disabled: false,
    isLoading: false,
    reason: '',
    status: 'available',
  }),
}))

vi.mock('@/components/resource-events-timeline', () => ({
  ResourceEventsTimeline: () => <div data-testid="events-panel">events-panel</div>,
}))

vi.mock('@/components/resource-metrics-panel', () => {
  testState.runtimeLoads.metrics += 1
  return {
    ResourceMetricsPanel: () => <div data-testid="metrics-panel">metrics-panel</div>,
  }
})

vi.mock('@/components/pod-log-viewer', () => {
  testState.runtimeLoads.logs += 1
  return { PodLogViewer: () => <div data-testid="logs-panel">logs-panel</div> }
})

vi.mock('@/components/pod-terminal', () => {
  testState.runtimeLoads.terminal += 1
  return { PodTerminal: () => <div data-testid="terminal-panel">terminal-panel</div> }
})

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div>,
}))

vi.mock('@/components/status-tag', () => ({
  BooleanTag: ({ value }: { value: boolean }) => <span>{String(value)}</span>,
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ dataSource = [] }: { dataSource?: unknown[] }) => (
    <div data-testid="admin-table">{dataSource.length}</div>
  ),
}))

const mountedRoots: Root[] = []

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
  vi.clearAllMocks()
  testState.scope.clusterId = 'cluster-a'
  testState.scope.namespace = 'monitoring'
  testState.runtimeLoads.logs = 0
  testState.runtimeLoads.metrics = 0
  testState.runtimeLoads.terminal = 0
})

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

async function renderDetail() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <MemoryRouter initialEntries={['/workloads/pods/prometheus-0?namespace=url-namespace']}>
            <Routes>
              <Route path="/workloads/pods/:podName" element={<PodDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AntdApp>
      </QueryClientProvider>,
    )
  })
  await flushAsyncWork()
  await flushAsyncWork()
  return container
}

async function clickTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find((item) =>
    item.textContent?.includes(label),
  )
  expect(tab).toBeDefined()
  await act(async () => tab?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await flushAsyncWork()
}

describe('pod detail page lazy boundaries', () => {
  it('loads tab data and heavy runtimes only after their tab is activated', async () => {
    const container = await renderDetail()
    const requestedPaths = () => apiGetMock.mock.calls.map(([path]) => String(path))

    expect(requestedPaths().filter((path) => path.includes('/detail?'))).toEqual([
      '/clusters/cluster-a/workloads/pods/prometheus-0/detail?namespace=monitoring',
    ])
    expect(requestedPaths().some((path) => path.includes('/metrics?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/events?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/yaml?'))).toBe(false)
    expect(testState.runtimeLoads).toEqual({ logs: 0, metrics: 0, terminal: 0 })

    await clickTab(container, '指标')
    expect(requestedPaths().some((path) => path.includes('/metrics?namespace=monitoring'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="metrics-panel"]')).not.toBeNull()
    expect(testState.runtimeLoads).toEqual({ logs: 0, metrics: 1, terminal: 0 })

    await clickTab(container, '日志')
    expect(container.querySelector('[data-testid="logs-panel"]')).not.toBeNull()
    expect(testState.runtimeLoads.logs).toBe(1)

    await clickTab(container, '终端')
    expect(container.querySelector('[data-testid="terminal-panel"]')).not.toBeNull()
    expect(testState.runtimeLoads.terminal).toBe(1)

    await clickTab(container, '事件')
    expect(requestedPaths().some((path) => path.includes('/events?namespace=monitoring'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="events-panel"]')).not.toBeNull()

    await clickTab(container, 'YAML')
    expect(requestedPaths().some((path) => path.includes('/yaml?namespace=monitoring'))).toBe(true)
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
  })
})
