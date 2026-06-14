/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryBlueprintsPage } from './delivery-blueprint-pages'

const testState = vi.hoisted(() => ({
  permissionSnapshot: {
    permissionKeys: ['delivery.application.update'],
    visibleMenuIds: [],
    visibleMenus: [],
  },
  apiGet: vi.fn(async (path: string) => {
    if (path === '/delivery/blueprints') {
      return {
        data: [
          {
            id: 'blueprint-1',
            key: 'node-service',
            name: 'Node Service',
            description: 'Node.js service onboarding',
            applicationDraft: {
              key: 'node-service',
              name: 'Node Service',
              group: 'frontend',
              language: 'node',
              enabled: true,
            },
            buildSources: [
              {
                id: 'source-1',
                name: 'Repo Dockerfile',
                type: 'repo_dockerfile',
                enabled: true,
                isDefault: true,
                config: { contextDir: '.', dockerfilePath: 'Dockerfile' },
              },
            ],
            environmentBindings: [
              {
                environmentKey: 'dev',
                workflowTemplateId: 'wf-dev',
                buildPolicy: { sourceId: 'source-1', refType: 'branch', refValue: 'main' },
                releasePolicy: { actionKind: 'deploy', verificationMode: 'workflow' },
              },
            ],
            files: [
              { path: 'Dockerfile', kind: 'dockerfile', content: 'FROM node:22', required: true },
            ],
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
        ],
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, key: string) => snapshot?.permissionKeys?.includes(key) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: testState.permissionSnapshot },
    isLoading: false,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: (path: string) => testState.apiGet(path),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

async function renderWithProviders(node: ReactNode, route = '/delivery/blueprints') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            {node}
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  return container
}

describe('DeliveryBlueprintsPage', () => {
  beforeEach(() => {
    testState.apiGet.mockClear()
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

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) root.unmount()
    })
    roots = []
    for (const container of containers) container.remove()
    containers = []
    vi.clearAllMocks()
  })

  it('renders onboarding templates as a left-list and right-designer workspace', async () => {
    const container = await renderWithProviders(<DeliveryBlueprintsPage />)

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/blueprints')
    expect(container.querySelector('.soha-delivery-blueprint-workspace')).not.toBeNull()
    expect(container.querySelector('.soha-delivery-blueprint-list')).not.toBeNull()
    expect(container.querySelector('.soha-delivery-blueprint-designer')).not.toBeNull()
    expect(container.textContent).toContain('新建模板')
    expect(container.textContent).toContain('保存')
    expect(container.textContent).toContain('渲染规范')
    expect(container.textContent).toContain('平台接入')
    expect(container.textContent).toContain('Node Service')
    expect(container.textContent).toContain('node-service')
    expect(container.textContent).toContain('构建 1')
    expect(container.textContent).toContain('环境 1')
    expect(container.textContent).toContain('文件 1')
    expect(container.textContent).toContain('基础信息')
    expect(container.textContent).toContain('应用档案')
    expect(container.textContent).toContain('构建源')
    expect(container.textContent).toContain('环境绑定')
    expect(container.textContent).toContain('规范文件')
    expect(container.textContent).toContain('高级预览')
    expect(container.textContent).not.toContain('Application Draft(JSON)')
    expect(container.textContent).not.toContain('Build Sources(JSON Array)')
    expect(container.textContent).not.toContain('Environment Bindings(JSON Array)')
  })
})
