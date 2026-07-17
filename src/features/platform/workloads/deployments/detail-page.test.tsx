/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeploymentDetailPage } from './detail-page'

const testState = vi.hoisted(() => ({
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
          name: 'prometheus',
          namespace: 'monitoring',
          createdAt: '2026-01-01T00:00:00Z',
          selector: { app: 'prometheus' },
        },
      }
    }
    if (path.includes('/rollout-status?')) {
      return {
        data: {
          status: 'ready',
          desiredReplicas: 1,
          updatedReplicas: 1,
          readyReplicas: 1,
          availableReplicas: 1,
          conditions: [],
        },
      }
    }
    if (path.includes('/rollouts?')) return { data: [] }
    if (path.includes('/metrics?')) return { data: { rangeMinutes: 60, series: [] } }
    if (path.includes('/yaml?')) {
      return { data: { kind: 'Deployment', name: 'prometheus', content: 'kind: Deployment' } }
    }
    return { data: [] }
  }),
)

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    put: vi.fn(async () => ({ data: { content: 'kind: Deployment' } })),
    post: vi.fn(async () => ({ data: null })),
    delete: vi.fn(async () => ({ data: null })),
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
  capabilityActionTooltip: (label: string) => label,
  useClusterCapability: () => ({ disabled: false, reason: '', status: 'available' }),
}))

vi.mock('@/components/resource-events-timeline', () => ({
  ResourceEventsTimeline: () => <div data-testid="events-panel">events-panel</div>,
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => <div data-testid="metrics-panel">metrics-panel</div>,
}))

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div>,
}))

vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
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
          <MemoryRouter
            initialEntries={['/workloads/deployments/prometheus?namespace=url-namespace']}
          >
            <Routes>
              <Route
                path="/workloads/deployments/:deploymentName"
                element={<DeploymentDetailPage />}
              />
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

function clickTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find((item) =>
    item.textContent?.includes(label),
  )
  expect(tab).toBeDefined()
  tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('deployment detail page boundaries', () => {
  it('keeps mutation actions out of the read-only detail tabs', async () => {
    const container = await renderDetail()

    expect(container.querySelector('.soha-workload-detail-heading')).toBeNull()
    const tabsNav = container.querySelector('.soha-workload-detail-tabs > .ant-tabs-nav')
    expect(tabsNav?.textContent).not.toContain('重启')
    expect(tabsNav?.textContent).not.toContain('扩缩容')
  })

  it('deduplicates detail data and loads tab data only when activated', async () => {
    const container = await renderDetail()
    const requestedPaths = () => apiGetMock.mock.calls.map(([path]) => String(path))

    expect(requestedPaths().filter((path) => path.includes('/detail?'))).toEqual([
      '/clusters/cluster-a/workloads/deployments/prometheus/detail?namespace=monitoring',
    ])
    expect(requestedPaths().some((path) => path.includes('/metrics?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/events?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/yaml?'))).toBe(false)

    await act(async () => clickTab(container, '指标'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/metrics?namespace=monitoring'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="metrics-panel"]')).not.toBeNull()

    await act(async () => clickTab(container, '事件'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/events?namespace=monitoring'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="events-panel"]')).not.toBeNull()

    await act(async () => clickTab(container, 'YAML'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/yaml?namespace=monitoring'))).toBe(true)
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
  })
})
