/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityProvidersPage } from './list-page'

const testState = vi.hoisted(() => ({
  permissionKeys: ['identity.providers.view', 'identity.providers.manage'],
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    Popconfirm: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: { permissionKeys: testState.permissionKeys } },
    isLoading: false,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(async () => ({ data: { status: 'ok' } })),
    get: (path: string) => testState.apiGet(path),
    post: (path: string, body?: unknown) => testState.apiPost(path, body),
    put: vi.fn(async () => ({ data: {} })),
  },
}))

interface MockColumn {
  dataIndex?: string
  key?: string
  render?: (value: unknown, record: Record<string, unknown>) => ReactNode
}

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    expandable,
    toolbar,
  }: {
    columns: MockColumn[]
    dataSource: Array<Record<string, unknown>>
    expandable?: {
      expandedRowRender?: (record: Record<string, unknown>) => ReactNode
      rowExpandable?: (record: Record<string, unknown>) => boolean
    }
    toolbar?: ReactNode
  }) => (
    <div>
      {toolbar}
      {dataSource.map((record) => (
        <div data-testid={`row-${String(record.id)}`} key={String(record.id)}>
          {columns.map((column, columnIndex) => {
            const value = record[column.dataIndex ?? '']
            return (
              <span key={column.key ?? `${String(column.dataIndex)}-${columnIndex}`}>
                {column.render ? column.render(value, record) : String(value ?? '')}
              </span>
            )
          })}
          {expandable?.rowExpandable?.(record) ? expandable.expandedRowRender?.(record) : null}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/management-list', () => ({
  ManagementDetailHeader: ({ actions, title }: { actions?: ReactNode; title: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
  ManagementIconButton: ({
    disabled,
    onClick,
    tooltip,
  }: {
    disabled?: boolean
    onClick?: () => void
    tooltip: string
  }) => (
    <button aria-label={tooltip} disabled={disabled} onClick={onClick}>
      {tooltip}
    </button>
  ),
  ManagementState: ({ title }: { title: ReactNode }) => <div>{title}</div>,
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ManagementToolbarSearch: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange: (value: string) => void
    placeholder?: string
    value?: string
  }) => (
    <input
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
}))

vi.mock('./components/provider-form-modal', () => ({
  ProviderFormModal: ({
    onSubmit,
    open,
  }: {
    onSubmit: (input: Record<string, unknown>) => void
    open: boolean
  }) =>
    open ? (
      <button
        onClick={() =>
          onSubmit({
            applicationId: 'grafana',
            name: 'New Provider',
            type: 'oidc',
            enabled: true,
            config: {},
            secretRefs: {},
            status: 'enabled',
          })
        }
      >
        提交 Provider
      </button>
    ) : null,
}))

vi.mock('./components/oidc-clients-panel', () => ({
  OIDCClientsPanel: ({ canManage }: { canManage: boolean }) => (
    <div data-testid="oidc-panel">manage:{String(canManage)}</div>
  ),
}))

vi.mock('./components/secret-reveal-modal', () => ({
  SecretRevealModal: () => null,
}))

const roots: Root[] = []
const containers: HTMLElement[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

beforeEach(() => {
  testState.permissionKeys = ['identity.providers.view', 'identity.providers.manage']
  testState.apiGet.mockReset()
  testState.apiPost.mockReset()
  testState.apiGet.mockImplementation(async (path: string) => {
    if (path === '/identity/providers') {
      return {
        data: [
          {
            id: 'provider-grafana',
            applicationId: 'grafana',
            name: 'Grafana OIDC',
            type: 'oidc',
            enabled: true,
            status: 'enabled',
            createdAt: '2026-07-10T00:00:00Z',
            updatedAt: '2026-07-10T00:00:00Z',
          },
          {
            id: 'provider-harbor',
            applicationId: 'harbor',
            name: 'Container Login',
            type: 'proxy',
            enabled: true,
            status: 'enabled',
            createdAt: '2026-07-10T00:00:00Z',
            updatedAt: '2026-07-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/identity/applications') {
      return {
        data: [
          {
            id: 'grafana',
            slug: 'grafana',
            name: 'Grafana',
            tags: [],
            providerType: 'oidc',
            portalVisible: true,
            featured: false,
            sortOrder: 1,
            status: 'enabled',
            createdAt: '2026-07-10T00:00:00Z',
            updatedAt: '2026-07-10T00:00:00Z',
          },
          {
            id: 'harbor',
            slug: 'harbor',
            name: 'Harbor Registry',
            tags: [],
            providerType: 'proxy',
            portalVisible: true,
            featured: false,
            sortOrder: 2,
            status: 'enabled',
            createdAt: '2026-07-10T00:00:00Z',
            updatedAt: '2026-07-10T00:00:00Z',
          },
        ],
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  })
  testState.apiPost.mockResolvedValue({
    data: {
      id: 'provider-new',
      applicationId: 'grafana',
      name: 'New Provider',
      type: 'oidc',
      enabled: true,
      status: 'enabled',
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    },
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  for (const container of containers.splice(0)) container.remove()
  document.body.innerHTML = ''
})

async function settle(queryClient: QueryClient) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (queryClient.isFetching() === 0 && queryClient.isMutating() === 0) return
  }
}

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <IdentityProvidersPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await settle(queryClient)
  return { container, queryClient }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text),
  )
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`)
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('identity providers page behavior', () => {
  it('loads canonical provider/application data and filters by application metadata', async () => {
    const { container } = await renderPage()

    expect(testState.apiGet).toHaveBeenCalledWith('/identity/providers')
    expect(testState.apiGet).toHaveBeenCalledWith('/identity/applications')
    expect(container.querySelector('[data-testid="row-provider-grafana"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="row-provider-harbor"]')).not.toBeNull()

    const search = container.querySelector(
      'input[placeholder="搜索 Provider 或应用"]',
    ) as HTMLInputElement
    await act(async () => setInputValue(search, 'Harbor Registry'))

    expect(container.querySelector('[data-testid="row-provider-grafana"]')).toBeNull()
    expect(container.querySelector('[data-testid="row-provider-harbor"]')).not.toBeNull()
  })

  it('keeps provider and nested OIDC actions permission-gated', async () => {
    testState.permissionKeys = ['identity.providers.view']
    const { container } = await renderPage()

    expect(
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('新建 Provider'),
      )?.disabled,
    ).toBe(true)
    expect(
      (container.querySelector('button[aria-label="编辑"]') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(container.querySelector('[data-testid="oidc-panel"]')?.textContent).toBe('manage:false')
  })

  it('submits provider creates through canonical mutations', async () => {
    const { queryClient } = await renderPage()
    await clickButton('新建 Provider')
    await clickButton('提交 Provider')
    await settle(queryClient)

    expect(testState.apiPost).toHaveBeenCalledWith(
      '/identity/providers',
      expect.objectContaining({ applicationId: 'grafana', name: 'New Provider' }),
    )
  })
})
