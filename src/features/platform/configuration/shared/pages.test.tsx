/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigMapDetailPage } from '../configmaps/detail-page'
import { ConfigurationConfigMapsPage } from '../configmaps/list-page'
import { ConfigurationResourceQuotaDetailPage } from '../resourcequotas/detail-page'
import { SecretDetailPage } from '../secrets/detail-page'
import { ConfigurationSecretsPage } from '../secrets/list-page'

const testState = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'team-a' as string | null,
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => ({ data: testState.responses[path] ?? [] })),
)

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(async () => ({ data: null })),
    get: apiGetMock,
    post: vi.fn(async () => ({ data: { content: '' } })),
    put: vi.fn(async () => ({ data: { content: '' } })),
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

vi.mock('@/components/status-tag', () => ({
  BooleanTag: ({ value }: { value: boolean }) => <span>{String(value)}</span>,
}))

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div>,
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    empty,
    headerExtra,
    paginationSummary,
  }: {
    columns: Array<Record<string, any>>
    dataSource: Array<Record<string, any>>
    empty?: ReactNode
    headerExtra?: ReactNode
    paginationSummary?: ReactNode
  }) => (
    <div data-testid="admin-table">
      {headerExtra ? <div data-testid="header-extra">{headerExtra}</div> : null}
      {paginationSummary ? <div data-testid="pagination-summary">{paginationSummary}</div> : null}
      <div data-testid="row-count">{dataSource.length}</div>
      {dataSource.length === 0 ? <div>{empty}</div> : null}
      {dataSource.map((record, rowIndex) => (
        <div key={`${record.namespace}/${record.name}`} data-testid={`row-${rowIndex}`}>
          {columns.map((column, columnIndex) => {
            const value =
              typeof column.dataIndex === 'string' ? record[column.dataIndex] : undefined
            const content =
              typeof column.render === 'function' ? column.render(value, record, rowIndex) : value
            return <div key={columnIndex}>{content == null ? '' : content}</div>
          })}
        </div>
      ))}
    </div>
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
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.scope.clusterId = 'cluster-a'
  testState.scope.namespace = 'team-a'
  testState.responses = {}
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

async function renderPage(node: ReactNode, route: string, routePath?: string) {
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
            initialEntries={[route]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            {routePath ? (
              <Routes>
                <Route path={routePath} element={node} />
              </Routes>
            ) : (
              node
            )}
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

describe('configuration leaf pages', () => {
  it('keeps ConfigMaps and Secrets list wire paths and management controls', async () => {
    testState.responses['/clusters/cluster-a/configuration/configmaps?namespace=team-a'] = [
      {
        name: 'app-config',
        namespace: 'team-a',
        dataEntries: 2,
        binaryEntries: 0,
        immutable: false,
        ageSeconds: 60,
      },
    ]
    testState.responses['/clusters/cluster-a/configuration/secrets?namespace=team-a'] = [
      {
        name: 'registry-secret',
        namespace: 'team-a',
        type: 'Opaque',
        dataEntries: 1,
        immutable: false,
        ageSeconds: 60,
      },
    ]

    const configMaps = await renderPage(
      <ConfigurationConfigMapsPage />,
      '/configuration/configmaps',
    )
    expect(configMaps.textContent).toContain('app-config')
    expect(
      configMaps.querySelector('input[placeholder="搜索 ConfigMaps 名称 / 命名空间"]'),
    ).not.toBeNull()
    expect(configMaps.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
      '当前 1 / 1 条',
    )

    const secrets = await renderPage(<ConfigurationSecretsPage />, '/configuration/secrets')
    expect(secrets.textContent).toContain('registry-secret')
    expect(apiGetMock).toHaveBeenCalledWith(
      '/clusters/cluster-a/configuration/secrets?namespace=team-a',
    )
  })

  it('uses store namespace and lazily loads ConfigMap references and YAML', async () => {
    testState.responses[
      '/clusters/cluster-a/configuration/configmaps/app-config/detail?namespace=team-a'
    ] = {
      name: 'app-config',
      namespace: 'team-a',
      data: { feature: 'enabled' },
      binaryData: {},
      immutable: false,
      ageSeconds: 60,
    }
    testState.responses[
      '/clusters/cluster-a/configuration/configmaps/app-config/references?namespace=team-a'
    ] = []
    testState.responses[
      '/clusters/cluster-a/configuration/configmaps/app-config/yaml?namespace=team-a'
    ] = { content: 'kind: ConfigMap' }

    const container = await renderPage(
      <ConfigMapDetailPage />,
      '/configuration/configmaps/app-config?namespace=url-team',
      '/configuration/configmaps/:configMapName',
    )
    const requestedPaths = () => apiGetMock.mock.calls.map(([path]) => String(path))

    expect(requestedPaths()).toEqual([
      '/clusters/cluster-a/configuration/configmaps/app-config/detail?namespace=team-a',
    ])
    await clickTab(container, '关联关系')
    expect(requestedPaths().some((path) => path.includes('/references?namespace=team-a'))).toBe(
      true,
    )
    await clickTab(container, 'YAML')
    expect(requestedPaths().some((path) => path.includes('/yaml?namespace=team-a'))).toBe(true)
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
  })

  it('renders decoded Secret data from the typed detail endpoint', async () => {
    testState.responses[
      '/clusters/cluster-a/configuration/secrets/registry-secret/detail?namespace=team-a'
    ] = {
      name: 'registry-secret',
      namespace: 'team-a',
      type: 'Opaque',
      data: { token: 'aGVsbG8=' },
      immutable: false,
      ageSeconds: 60,
    }

    const container = await renderPage(
      <SecretDetailPage />,
      '/configuration/secrets/registry-secret?namespace=url-team',
      '/configuration/secrets/:secretName',
    )
    await clickTab(container, '数据')

    expect(container.textContent).toContain('aGVsbG8=')
    expect(container.textContent).toContain('hello')
  })

  it('shows scope selection before resolving list-backed details', async () => {
    testState.scope.clusterId = null
    testState.scope.namespace = null

    const container = await renderPage(
      <ConfigurationResourceQuotaDetailPage />,
      '/configuration/resourcequotas/demo',
      '/configuration/resourcequotas/:name',
    )

    expect(container.textContent).toContain('请选择集群和命名空间')
    expect(apiGetMock).not.toHaveBeenCalled()
  })
})
