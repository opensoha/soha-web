/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecretsPage } from './page'

const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth', () => ({
  hasPermission: () => true,
  usePermissionSnapshot: () => ({ data: { data: { permissionKeys: ['secret.manage'] } } }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(),
    get: apiGet,
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ dataSource, empty }: { dataSource: unknown[]; empty?: React.ReactNode }) => (
    <div data-testid="admin-table">{dataSource.length ? `${dataSource.length} rows` : empty}</div>
  ),
}))

const roots: Root[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={client}>
          <SecretsPage />
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await flush()
  return container
}

describe('SecretsPage', () => {
  it('distinguishes a request failure from an empty list and retries it', async () => {
    apiGet.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [] })
    const container = await renderPage()

    expect(container.textContent).toContain('Secret 加载失败')
    expect(container.textContent).not.toContain('暂无 Secret')

    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('重试'),
    )
    await act(async () => retry?.click())
    await flush()

    expect(apiGet).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('暂无 Secret')
    expect(container.textContent).not.toContain('Secret 加载失败')
  })
})
