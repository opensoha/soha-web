/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DeliveryOverviewPage } from './overview-page'

const apiGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: [
          'delivery.applications.view',
          'delivery.application-environments.view',
          'delivery.release-board.view',
          'delivery.release-bundles.view',
          'delivery.execution-tasks.view',
        ],
      },
    },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: { get: apiGetMock },
}))

const roots: Array<ReturnType<typeof createRoot>> = []

beforeAll(() => {
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
})

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount())
  })
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('DeliveryOverviewPage', () => {
  it('keeps successful summaries visible when one query fails', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/delivery/release-board'
        ? Promise.reject(new Error('request failed'))
        : Promise.resolve({ data: [] }),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () => {
      root.render(
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <DeliveryOverviewPage />
            </MemoryRouter>
          </QueryClientProvider>
        </AntdApp>,
      )
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('部分交付数据加载失败')
    expect(container.textContent).toContain('应用 / 环境绑定')
    expect(container.textContent).toContain('版本包')
    expect(container.textContent).toContain('执行任务')
    expect(container.textContent).toContain('发布态势加载失败')
  })
})
