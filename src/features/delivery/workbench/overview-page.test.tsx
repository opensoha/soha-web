/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryOverviewPage } from './overview-page'

const apiGetMock = vi.hoisted(() => vi.fn())
const permissionState = vi.hoisted(() => ({ keys: [] as string[] }))
beforeEach(() => {
  permissionState.keys = [
    'delivery.applications.view',
    'delivery.application-environments.view',
    'delivery.release-board.view',
    'delivery.release-bundles.view',
    'delivery.execution-tasks.view',
  ]
})

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: permissionState.keys,
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

async function renderOverview() {
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

  return container
}

describe('DeliveryOverviewPage', () => {
  it('keeps successful summaries visible when one query fails', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/delivery/release-board'
        ? Promise.reject(new Error('request failed'))
        : Promise.resolve({ data: [] }),
    )
    const container = await renderOverview()

    expect(container.textContent).toContain('部分交付数据加载失败')
    expect(container.textContent).toContain('应用 / 环境绑定')
    expect(container.textContent).toContain('版本包')
    expect(container.textContent).toContain('执行任务')
    expect(container.textContent).toContain('发布态势加载失败')
  })
  it('prioritizes blocked releases and links recent records in time order', async () => {
    const targets = [{ id: 'target' }]
    const rows: Record<string, unknown[]> = {
      '/applications': [{ id: 'app-1', name: 'Payments' }],
      '/delivery/release-board': [
        {
          applicationEnvironmentId: 'ready',
          applicationId: 'app-1',
          applicationName: 'Ready App',
          environmentId: 'dev',
          targets,
          latestRelease: { status: 'succeeded' },
        },
        {
          applicationEnvironmentId: 'approval',
          applicationId: 'app-1',
          applicationName: 'Approval App',
          environmentId: 'stage',
          targets,
          requiresApproval: true,
          latestWorkflow: { status: 'awaiting_approval' },
        },
        {
          applicationEnvironmentId: 'blocked',
          applicationId: 'app-1',
          applicationName: 'Blocked App',
          environmentName: '生产',
          targets,
          latestExecutionTask: { status: 'failed' },
        },
      ],
      '/delivery/execution-tasks': [
        {
          id: 'old',
          applicationId: 'app-1',
          taskKind: 'build',
          status: 'succeeded',
          createdAt: '2026-09-01',
        },
        {
          id: 'new',
          applicationId: 'app-1',
          taskKind: 'verify',
          status: 'failed',
          createdAt: '2026-09-22',
        },
      ],
      '/delivery/release-bundles': [
        {
          id: 'bundle-1',
          applicationId: 'app-1',
          version: 'v1.0',
          status: 'ready',
          createdAt: '2026-09-21',
        },
      ],
    }
    apiGetMock.mockImplementation((path: string) => Promise.resolve({ data: rows[path] ?? [] }))
    const container = await renderOverview()
    const attention = [
      ...container.querySelectorAll(
        '.soha-delivery-release-states + div + .soha-delivery-overview-records .soha-delivery-overview-record',
      ),
    ]
    expect(attention.map((item) => item.textContent)).toEqual([
      'Blocked App生产阻塞',
      'Approval Appstage待审批',
    ])
    expect(container.textContent).not.toContain('Ready App')
    const tasks = container.querySelector('[aria-label="最近执行"]')!
    expect(
      [...tasks.querySelectorAll('.soha-delivery-overview-record')].map((item) =>
        item.getAttribute('href'),
      ),
    ).toEqual(['/delivery/execution-tasks/new', '/delivery/execution-tasks/old'])
    expect(tasks.textContent).toContain('Payments')
    expect(
      container.querySelector('a[href="/delivery/release-bundles/bundle-1"]')?.textContent,
    ).toContain('v1.0')
  })

  it('keeps restricted collections out of requests and navigation', async () => {
    permissionState.keys = ['delivery.release-bundles.view']
    apiGetMock.mockResolvedValue({ data: [] })
    const container = await renderOverview()
    expect(apiGetMock.mock.calls.map(([path]) => path)).toEqual(['/delivery/release-bundles'])
    expect(container.textContent).toContain('暂无版本包')
    expect(container.querySelector('[aria-label="最近执行"]')).toBeNull()
    expect(container.querySelector('a[href="/applications"]')).toBeNull()
    expect(container.querySelector('a[href="/release-board"]')).toBeNull()
  })

  it('retries a failed task section while retaining the latest version', async () => {
    let failed = true
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/delivery/execution-tasks' && failed)
        return Promise.reject(new Error('offline'))
      return Promise.resolve({
        data:
          path === '/delivery/release-bundles'
            ? [{ id: 'kept', applicationId: 'app-1', version: 'v2.0', status: 'ready' }]
            : [],
      })
    })
    const container = await renderOverview()
    expect(container.textContent).toContain('v2.0')
    const tasks = container.querySelector('[aria-label="最近执行"]')!
    expect(tasks.textContent).toContain('执行任务加载失败')
    failed = false
    await act(async () => {
      ;(tasks.querySelector('button') as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(tasks.textContent).toContain('暂无执行任务')
    expect(container.textContent).toContain('v2.0')
  })
})
