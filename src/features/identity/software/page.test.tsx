/** @vitest-environment jsdom */

import { act, type ComponentType } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoftwareLibraryPage } from './page'
import { SoftwareStoragePage } from './storage-page'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  getEnvelope: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  hasPermission: () => true,
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: [
          'software.package.view',
          'software.package.create',
          'software.package.delete',
        ],
      },
    },
  }),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    empty,
    headerExtra,
  }: {
    empty?: React.ReactNode
    headerExtra?: React.ReactNode
  }) => (
    <div data-testid="admin-table">
      {headerExtra}
      {empty}
    </div>
  ),
}))

const roots: Root[] = []

beforeAll(() => {
  const getComputedStyle = window.getComputedStyle.bind(window)
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value: (element: Element) => getComputedStyle(element),
  })
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
  apiMocks.getEnvelope.mockImplementation((path: string) =>
    path.startsWith('/software/storage')
      ? Promise.resolve({
          data: { backend: 'filesystem', objectCount: 0, totalBytes: 0, items: [] },
        })
      : Promise.resolve({ items: [] }),
  )
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

async function renderPage(Page: ComponentType = SoftwareLibraryPage) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={client}>
          <Page />
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await flush()
  return container
}

describe('SoftwareLibraryPage', () => {
  it('switches the publish source to a server-side URL import', async () => {
    const container = await renderPage()
    const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('上传软件'),
    )
    await act(async () => publish?.click())
    await flush()

    const urlSource = Array.from(
      document.body.querySelectorAll<HTMLElement>('.ant-segmented-item'),
    ).find((item) => item.textContent?.includes('下载地址'))
    await act(async () => urlSource?.click())
    await flush()

    expect(
      document.body.querySelector('input[placeholder="https://downloads.example.com/app.dmg"]'),
    ).not.toBeNull()
    expect(document.body.textContent).toContain('下载并发布')
  })

  it('shows managed storage totals on the dedicated storage page', async () => {
    const container = await renderPage(SoftwareStoragePage)
    expect(container.textContent).toContain('本地文件系统')
    expect(container.querySelector('.ant-tabs')).toBeNull()
    expect(apiMocks.getEnvelope).toHaveBeenCalledWith('/software/storage?limit=200')
  })
})
