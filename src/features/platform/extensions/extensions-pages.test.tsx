/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { CRDApiGroupDetailPage } from './crds/api-group-detail-page'
import { CRDPage } from './crds/list-page'
import { HelmChartsPage } from './helm/charts/page'
import { HelmReleaseDetailPage } from './helm/releases/detail-page'
import { HelmReleasesPage } from './helm/releases/list-page'

const testState = vi.hoisted(() => ({
  editorLoaded: false,
  normalizePath: (path: string) => {
    const [pathname, query] = path.split('?')
    if (!query) return path
    const params = new URLSearchParams(query)
    params.sort()
    const normalized = params.toString()
    return normalized ? `${pathname}?${normalized}` : pathname
  },
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'team-a' as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    const key = path in testState.responses ? path : testState.normalizePath(path)
    const payload = testState.responses[key]
    if (payload instanceof Error) return Promise.reject(payload)
    return Promise.resolve({ data: payload ?? [] })
  }),
)

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(),
    get: apiGetMock,
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/components/k8s-yaml-editor', () => {
  testState.editorLoaded = true
  return { K8sYamlEditor: () => <div data-testid="k8s-editor" /> }
})

vi.mock('@/components/yaml-draft-diff-editor', () => {
  testState.editorLoaded = true
  return {
    YamlDraftDiffEditor: ({ modified }: { modified: string }) => (
      <div data-testid="values-editor">{modified}</div>
    ),
  }
})

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    empty,
    headerExtra,
    onRow,
    paginationSummary,
    toolbar,
    toolbarExtra,
  }: {
    columns: Array<Record<string, any>>
    dataSource: Array<Record<string, any>>
    empty?: ReactNode
    headerExtra?: ReactNode
    onRow?: (record: Record<string, any>, index: number) => Record<string, any>
    paginationSummary?: ReactNode | ((total: number, range: [number, number]) => ReactNode)
    toolbar?: ReactNode
    toolbarExtra?: ReactNode
  }) => (
    <div data-testid="admin-table">
      {headerExtra}
      {toolbar}
      {toolbarExtra}
      <div data-testid="pagination-summary">
        {typeof paginationSummary === 'function'
          ? paginationSummary(dataSource.length, [1, dataSource.length])
          : paginationSummary}
      </div>
      <div data-testid="row-count">{dataSource.length}</div>
      {dataSource.length ? null : empty}
      {dataSource.map((record, rowIndex) => (
        <div
          key={`${record.group || record.name}-${rowIndex}`}
          data-testid={`row-${rowIndex}`}
          onClick={onRow?.(record, rowIndex)?.onClick}
        >
          {columns.map((column, columnIndex) => {
            const value =
              typeof column.dataIndex === 'string' ? record[column.dataIndex] : undefined
            return (
              <div key={`${rowIndex}-${columnIndex}`}>
                {typeof column.render === 'function'
                  ? column.render(value, record, rowIndex)
                  : value}
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

function setResponses(responses: Record<string, unknown>) {
  testState.responses = {}
  Object.entries(responses).forEach(([path, payload]) => {
    testState.responses[path] = payload
    testState.responses[testState.normalizePath(path)] = payload
  })
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  await new Promise((resolve) => window.setTimeout(resolve, 20))
}

async function renderPage(node: ReactNode, route: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <MemoryRouter
              initialEntries={[route]}
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
              {node}
            </MemoryRouter>
          </I18nProvider>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await act(flush)
  return container
}

describe('extensions capability pages', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn(() => ({ getPropertyValue: vi.fn(() => '') })),
    })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  beforeEach(() => {
    testState.editorLoaded = false
    setResponses({})
  })

  afterEach(async () => {
    await act(async () => {
      roots.forEach((root) => root.unmount())
    })
    roots = []
    containers.forEach((container) => container.remove())
    containers = []
    document.querySelectorAll('.ant-drawer-root, .ant-modal-root').forEach((node) => node.remove())
    vi.clearAllMocks()
  })

  it('exports five independent route pages and groups the CRD catalog', async () => {
    expect([
      CRDPage,
      CRDApiGroupDetailPage,
      HelmReleasesPage,
      HelmReleaseDetailPage,
      HelmChartsPage,
    ]).toHaveLength(5)
    setResponses({
      '/clusters/cluster-a/extensions/crds': [
        {
          name: 'widgets.example.io',
          group: 'example.io',
          kind: 'Widget',
          plural: 'widgets',
          version: 'v1',
          scope: 'Namespaced',
        },
        {
          name: 'gadgets.example.io',
          group: 'example.io',
          kind: 'Gadget',
          plural: 'gadgets',
          version: 'v1',
          scope: 'Cluster',
        },
      ],
    })
    const container = await renderPage(<CRDPage />, '/extensions')
    expect(container.querySelector('[data-testid="row-count"]')?.textContent).toBe('1')
    expect(container.textContent).toContain('widgets.example.io')
    expect(container.textContent).toContain('gadgets.example.io')
  })

  it('keeps CRD YAML code and requests unloaded before an editor action', async () => {
    setResponses({
      '/clusters/cluster-a/extensions/crds': [
        {
          name: 'widgets.example.io',
          group: 'example.io',
          kind: 'Widget',
          plural: 'widgets',
          version: 'v1',
          scope: 'Namespaced',
        },
      ],
      '/clusters/cluster-a/extensions/crds/widgets.example.io/resources?namespace=team-a&version=v1':
        [],
    })
    await renderPage(
      <Routes>
        <Route path="/extensions/apis/:groupName" element={<CRDApiGroupDetailPage />} />
      </Routes>,
      '/extensions/apis/example.io',
    )
    expect(testState.editorLoaded).toBe(false)
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/yaml'))).toBe(false)
  })

  it('loads Helm history without loading values or the diff editor', async () => {
    setResponses({
      '/clusters/cluster-a/helm/releases/demo/detail?namespace=team-a': {
        name: 'demo',
        namespace: 'team-a',
        status: 'deployed',
        ageSeconds: 1,
        valuesEditable: true,
        valuesDiffEnabled: true,
      },
      '/clusters/cluster-a/helm/releases/demo/history?namespace=team-a': [],
    })
    await renderPage(
      <Routes>
        <Route path="/helm/releases/:releaseName" element={<HelmReleaseDetailPage />} />
      </Routes>,
      '/helm/releases/demo?namespace=team-a&tab=history',
    )
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/history'))).toBe(true)
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/values'))).toBe(false)
    expect(testState.editorLoaded).toBe(false)
  })

  it('loads chart detail and default values only after opening the drawer and Values tab', async () => {
    const chart = {
      packageId: 'pkg-nginx',
      name: 'nginx',
      repositoryName: 'bitnami',
      repositoryUrl: 'https://charts.bitnami.com/bitnami',
      latestVersion: '1.2.3',
      versionCount: 1,
      allowedActions: ['create'],
    }
    setResponses({
      '/clusters/cluster-a/helm/charts?limit=20&offset=0': {
        repository: { id: 'artifacthub', name: 'Artifact Hub', url: 'https://artifacthub.io' },
        refreshedAt: '2026-01-01T00:00:00Z',
        totalCount: 1,
        chartCount: 1,
        versionCount: 1,
        charts: [chart],
      },
      '/clusters/cluster-a/helm/charts/bitnami/nginx?version=1.2.3': chart,
      '/clusters/cluster-a/helm/charts/values?name=nginx&packageId=pkg-nginx&version=1.2.3': {
        packageId: 'pkg-nginx',
        name: 'nginx',
        version: '1.2.3',
        content: 'replicaCount: 2\n',
      },
    })
    const container = await renderPage(<HelmChartsPage />, '/helm/charts')
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/bitnami/nginx'))).toBe(
      false,
    )
    await act(async () => {
      container
        .querySelector('[data-testid="row-0"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await import('./helm/charts/chart-drawer')
      await flush()
    })
    expect(document.body.textContent).toContain('Chart: bitnami/nginx')
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/bitnami/nginx'))).toBe(
      true,
    )
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/charts/values'))).toBe(
      false,
    )
    const valuesTab = Array.from(document.body.querySelectorAll('[role="tab"]')).find((node) =>
      node.textContent?.includes('Values'),
    )
    await act(async () => {
      valuesTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
    })
    await act(flush)
    expect(apiGetMock.mock.calls.some(([path]) => String(path).includes('/charts/values'))).toBe(
      true,
    )
    expect(
      (document.body.querySelector('textarea') as HTMLTextAreaElement | null)?.value,
    ).toContain('replicaCount: 2')
  })
})
