/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoragePvcDetailPage } from './persistent-volume-claims/detail-page'
import { StoragePvDetailPage } from './persistent-volumes/detail-page'
import { StorageClassDetailPage } from './storage-classes/detail-page'

const testState = vi.hoisted(() => ({
  editorModuleLoads: 0,
  scope: { clusterId: 'cluster-a', namespace: 'selected-ns' },
}))
const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path.includes('/yaml?') || path.endsWith('/yaml')) {
      return { data: { name: 'resource-a', content: 'kind: Resource' } }
    }
    if (path.includes('/persistentvolumeclaims/')) {
      return {
        data: {
          name: 'claim-a',
          namespace: 'selected-ns',
          status: 'Bound',
          ageSeconds: 60,
        },
      }
    }
    if (path.includes('/persistentvolumes/')) {
      return { data: { name: 'pv-a', status: 'Available', ageSeconds: 60 } }
    }
    return {
      data: {
        name: 'fast',
        provisioner: 'csi.example.io',
        allowVolumeExpansion: true,
        ageSeconds: 60,
      },
    }
  }),
)

vi.mock('@/services/api-client', () => ({
  api: { get: apiGetMock, put: vi.fn(async () => ({ data: { content: 'updated' } })) },
}))
vi.mock('@/components/k8s-yaml-editor', () => {
  testState.editorModuleLoads += 1
  return { K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div> }
})
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
  StatusTag: ({ value }: { value: string }) => <span>{value}</span>,
}))
vi.mock('@/components/management-list', () => ({
  ManagementState: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.scope.clusterId = 'cluster-a'
  testState.scope.namespace = 'selected-ns'
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

async function renderDetail(path: string, route: string, page: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={page} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  await flushAsyncWork()
  await flushAsyncWork()
  return container
}

function clickYAML(container: HTMLElement) {
  const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find((item) =>
    item.textContent?.includes('YAML'),
  )
  expect(tab).toBeDefined()
  tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('storage detail pages', () => {
  it('loads PVC YAML query and editor only after the YAML tab is activated', async () => {
    const container = await renderDetail(
      '/storage/persistentvolumeclaims/claim-a?namespace=url-ns',
      '/storage/persistentvolumeclaims/:name',
      <StoragePvcDetailPage />,
    )
    const paths = () => apiGetMock.mock.calls.map(([path]) => String(path))
    expect(paths()).toContain(
      '/clusters/cluster-a/storage/persistentvolumeclaims/claim-a/detail?namespace=selected-ns',
    )
    expect(paths().some((path) => path.includes('/yaml?'))).toBe(false)
    expect(container.querySelector('[data-testid="yaml-editor"]')).toBeNull()

    await act(async () => clickYAML(container))
    await flushAsyncWork()
    expect(paths()).toContain(
      '/clusters/cluster-a/storage/persistentvolumeclaims/claim-a/yaml?namespace=selected-ns',
    )
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
    expect(testState.editorModuleLoads).toBe(1)
  })

  it('keeps PV and StorageClass detail requests cluster scoped', async () => {
    await renderDetail(
      '/storage/persistentvolumes/pv-a',
      '/storage/persistentvolumes/:name',
      <StoragePvDetailPage />,
    )
    await renderDetail(
      '/storage/storageclasses/fast',
      '/storage/storageclasses/:name',
      <StorageClassDetailPage />,
    )
    expect(apiGetMock).toHaveBeenCalledWith(
      '/clusters/cluster-a/storage/persistentvolumes/pv-a/detail',
    )
    expect(apiGetMock).toHaveBeenCalledWith(
      '/clusters/cluster-a/storage/storageclasses/fast/detail',
    )
    expect(
      apiGetMock.mock.calls.some(([path]) => String(path).endsWith('/persistentvolumes/pv-a/yaml')),
    ).toBe(false)
    expect(
      apiGetMock.mock.calls.some(([path]) => String(path).endsWith('/storageclasses/fast/yaml')),
    ).toBe(false)
  })
})
