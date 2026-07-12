/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityPoliciesPage } from './list-page'

const testState = vi.hoisted(() => ({
  permissionKeys: ['identity.policies.view', 'identity.policies.manage'],
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}))

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
    get: (path: string) => testState.apiGet(path),
    put: (path: string, body?: unknown) => testState.apiPut(path, body),
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
    toolbar,
  }: {
    columns: MockColumn[]
    dataSource: Array<Record<string, unknown>>
    toolbar?: ReactNode
  }) => (
    <div>
      {toolbar}
      {dataSource.map((record) => (
        <div
          data-testid={`policy-${String(record.applicationId)}`}
          key={String(record.applicationId)}
        >
          {columns.map((column, columnIndex) => {
            const value = record[column.dataIndex ?? '']
            return (
              <span key={column.key ?? `${String(column.dataIndex)}-${columnIndex}`}>
                {column.render ? column.render(value, record) : String(value ?? '')}
              </span>
            )
          })}
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

vi.mock('./components/policy-form-modal', () => ({
  PolicyFormModal: ({
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
            assignments: [{ subjectType: 'role', subjectId: 'admin', effect: 'allow' }],
          })
        }
      >
        提交策略
      </button>
    ) : null,
}))

const policy = {
  applicationId: 'grafana/id',
  applicationSlug: 'grafana',
  applicationName: 'Grafana',
  providerType: 'oidc',
  providerId: 'provider-1',
  portalVisible: true,
  status: 'enabled',
  assignments: [],
  updatedAt: '2026-07-10T00:00:00Z',
}

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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

beforeEach(() => {
  testState.permissionKeys = ['identity.policies.view', 'identity.policies.manage']
  testState.apiGet.mockReset().mockResolvedValue({ data: [policy] })
  testState.apiPut.mockReset().mockResolvedValue({ data: policy })
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
            <IdentityPoliciesPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await settle(queryClient)
  return { container, queryClient }
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

describe('identity policies page behavior', () => {
  it('loads policies through canonical query options and renders assignments state', async () => {
    const { container } = await renderPage()

    expect(testState.apiGet).toHaveBeenCalledWith('/identity/policies')
    expect(container.querySelector('[data-testid="policy-grafana/id"]')).not.toBeNull()
    expect(container.textContent).toContain('All authenticated users')
  })

  it('keeps edit actions permission-gated', async () => {
    testState.permissionKeys = ['identity.policies.view']
    const { container } = await renderPage()

    expect(
      (container.querySelector('button[aria-label="编辑策略"]') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('updates assignments through the canonical mutation and encoded policy id', async () => {
    const { container, queryClient } = await renderPage()
    const edit = container.querySelector('button[aria-label="编辑策略"]') as HTMLButtonElement
    await act(async () => edit.click())
    await clickButton('提交策略')
    await settle(queryClient)

    expect(testState.apiPut).toHaveBeenCalledWith('/identity/policies/grafana%2Fid', {
      assignments: [{ subjectType: 'role', subjectId: 'admin', effect: 'allow' }],
    })
  })
})
