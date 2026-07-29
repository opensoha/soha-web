/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PlatformManifestsPage } from './page'

const testState = vi.hoisted(() => ({
  apiGet: vi.fn(async () => ({ data: { items: [], total: 0, page: 1, pageSize: 20 } })),
}))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => ({ clusterId: null, namespace: null }),
}))

vi.mock('@/services/api-client', () => ({
  api: { get: testState.apiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ dataSource, empty }: { dataSource: unknown[]; empty?: ReactNode }) => (
    <div>{dataSource.length === 0 ? empty : null}</div>
  ),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  testState.apiGet.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it('does not query manifests until a cluster is selected', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <PlatformManifestsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    await Promise.resolve()
  })

  expect(testState.apiGet).not.toHaveBeenCalled()
  expect(container.textContent).toContain('请先选择集群')
})
