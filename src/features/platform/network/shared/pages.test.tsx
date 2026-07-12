/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngressDetailPage } from '../ingresses/detail-page'
import { NetworkIngressesPage } from '../ingresses/list-page'
import { ServiceDetailPage } from '../services/detail-page'
import { NetworkServicesPage } from '../services/list-page'

const testState = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'team-a' as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn((path: string) => Promise.resolve({ data: testState.responses[path] ?? [] })),
  put: vi.fn((path: string) => Promise.resolve({ data: testState.responses[path] ?? {} })),
}))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

vi.mock('@/features/copilot', () => ({
  encodeAIContextForElement: () => 'ai-context',
  useAIPageContext: () => undefined,
}))

vi.mock('@/components/resource-events-timeline', () => ({
  ResourceEventsTimeline: () => <div data-testid="events-timeline" />,
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => <div data-testid="metrics-panel" />,
}))

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor" />,
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    empty,
    headerExtra,
    paginationSummary,
    title,
  }: {
    columns: Array<Record<string, any>>
    dataSource: Array<Record<string, any>>
    empty?: ReactNode
    headerExtra?: ReactNode
    paginationSummary?: ReactNode
    title?: ReactNode
  }) => (
    <div data-testid="admin-table">
      {title ? <div data-testid="table-title">{title}</div> : null}
      {headerExtra ? <div data-testid="header-extra">{headerExtra}</div> : null}
      {paginationSummary ? <div data-testid="pagination-summary">{paginationSummary}</div> : null}
      <div data-testid="row-count">{dataSource.length}</div>
      {dataSource.length === 0 ? <div data-testid="empty">{empty}</div> : null}
      {dataSource.map((record, rowIndex) => (
        <div key={`${record.name}-${rowIndex}`} data-testid={`row-${rowIndex}`}>
          {columns.map((column, columnIndex) => {
            const value =
              typeof column.dataIndex === 'string' ? record[column.dataIndex] : undefined
            const content =
              typeof column.render === 'function' ? column.render(value, record, rowIndex) : value
            return (
              <div key={`${String(column.dataIndex)}-${columnIndex}`}>
                {content == null ? '' : content}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  ),
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function installDomMocks() {
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
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

async function renderPage(node: ReactNode, route: string, routePath: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[route]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route path={routePath} element={node} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await act(async () => {
    await flush()
  })
  return container
}

async function clickTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find((item) =>
    item.textContent?.includes(label),
  )
  if (!tab) throw new Error(`Tab not found: ${label}`)
  await act(async () => {
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
  })
}

function setNativeInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')
  descriptor?.set?.call(element, value)
}

describe('network core pages', () => {
  beforeAll(installDomMocks)

  beforeEach(() => {
    testState.scope.clusterId = 'cluster-a'
    testState.scope.namespace = 'team-a'
    testState.responses = {}
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) root.unmount()
    })
    roots = []
    for (const container of containers) container.remove()
    containers = []
  })

  it('preserves Service list search, summary, and API path', async () => {
    testState.responses['/clusters/cluster-a/network/services?namespace=team-a'] = [
      {
        name: 'core-dns',
        namespace: 'team-a',
        type: 'ClusterIP',
        clusterIp: '10.43.0.10',
        ports: ['53/UDP'],
        ageSeconds: 60,
        allowedActions: ['view'],
      },
      {
        name: 'web',
        namespace: 'team-a',
        type: 'NodePort',
        clusterIp: '10.43.1.20',
        ports: ['80/TCP'],
        ageSeconds: 120,
        allowedActions: ['view'],
      },
    ]
    const container = await renderPage(
      <NetworkServicesPage />,
      '/network/services',
      '/network/services',
    )

    expect(apiMocks.get).toHaveBeenCalledWith(
      '/clusters/cluster-a/network/services?namespace=team-a',
    )
    expect(container.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
      '当前 2 / 2 条',
    )
    const input = container.querySelector(
      'input[placeholder="搜索 Service / namespace / type / port"]',
    ) as HTMLInputElement
    await act(async () => {
      setNativeInputValue(input, 'core')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await flush()
    })
    expect(container.querySelector('[data-testid="row-count"]')?.textContent).toBe('1')
  })

  it('renders Ingress list from the unchanged endpoint', async () => {
    testState.responses['/clusters/cluster-a/network/ingresses?namespace=team-a'] = [
      {
        name: 'web',
        namespace: 'team-a',
        className: 'nginx',
        hosts: ['example.test'],
        address: '10.0.0.1',
        backendServices: ['web'],
        ageSeconds: 60,
        allowedActions: ['view'],
      },
    ]
    const container = await renderPage(
      <NetworkIngressesPage />,
      '/network/ingresses',
      '/network/ingresses',
    )

    expect(apiMocks.get).toHaveBeenCalledWith(
      '/clusters/cluster-a/network/ingresses?namespace=team-a',
    )
    expect(container.textContent).toContain('example.test')
    expect(container.textContent).toContain('web')
  })

  it('enables Service backend pods, metrics, events, and YAML only on their tabs', async () => {
    const listPath = '/clusters/cluster-a/network/services?namespace=team-a'
    const podsPath = '/clusters/cluster-a/workloads/pods?namespace=team-a'
    const metricsPath = '/clusters/cluster-a/network/services/api/metrics?namespace=team-a'
    const eventsPath = '/clusters/cluster-a/events?namespace=team-a&limit=100'
    const yamlPath = '/clusters/cluster-a/network/services/api/yaml?namespace=team-a'
    testState.responses[listPath] = [
      {
        name: 'api',
        namespace: 'team-a',
        type: 'ClusterIP',
        clusterIp: '10.43.0.20',
        ports: ['80/TCP'],
        selector: { app: 'api' },
        ageSeconds: 60,
      },
    ]
    testState.responses[podsPath] = [
      {
        name: 'api-1',
        namespace: 'team-a',
        phase: 'Running',
        readyContainers: '1/1',
        restarts: 0,
        labels: { app: 'api' },
        ageSeconds: 30,
      },
    ]
    testState.responses[metricsPath] = { rangeMinutes: 60 }
    testState.responses[eventsPath] = []
    testState.responses[yamlPath] = {
      kind: 'Service',
      name: 'api',
      namespace: 'team-a',
      content: 'kind: Service',
    }
    const container = await renderPage(
      <ServiceDetailPage />,
      '/network/services/api?namespace=team-a',
      '/network/services/:serviceName',
    )
    const requested = () => apiMocks.get.mock.calls.map(([path]) => path as string)

    expect(requested()).toEqual([listPath])
    await clickTab(container, '后端 Pods')
    expect(requested()).toContain(podsPath)
    expect(requested()).not.toContain(metricsPath)
    expect(requested()).not.toContain(eventsPath)
    expect(requested()).not.toContain(yamlPath)

    await clickTab(container, '指标')
    expect(requested()).toContain(metricsPath)
    await clickTab(container, '事件')
    expect(requested()).toContain(eventsPath)
    await clickTab(container, 'YAML')
    expect(requested()).toContain(yamlPath)
    await act(async () => {
      await flush()
    })
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
  })

  it('keeps Ingress YAML request behind the YAML tab', async () => {
    const listPath = '/clusters/cluster-a/network/ingresses?namespace=team-a'
    const yamlPath = '/clusters/cluster-a/network/ingresses/web/yaml?namespace=team-a'
    testState.responses[listPath] = [
      {
        name: 'web',
        namespace: 'team-a',
        className: 'nginx',
        hosts: ['example.test'],
        address: '10.0.0.1',
        backendServices: ['web'],
        ageSeconds: 60,
      },
    ]
    testState.responses[yamlPath] = {
      kind: 'Ingress',
      name: 'web',
      namespace: 'team-a',
      content: 'kind: Ingress',
    }
    const container = await renderPage(
      <IngressDetailPage />,
      '/network/ingresses/web?namespace=team-a',
      '/network/ingresses/:name',
    )
    const requested = () => apiMocks.get.mock.calls.map(([path]) => path as string)

    expect(requested()).toEqual([listPath])
    await clickTab(container, 'YAML')
    expect(requested()).toContain(yamlPath)
  })
})
