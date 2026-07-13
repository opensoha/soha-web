/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp, Form } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildIdentityOutpostInput,
  type IdentityOutpostFormValues,
} from './components/outpost-form-modal'
import { IdentityOutpostsPage } from './list-page'

const testState = vi.hoisted(() => ({
  permissionKeys: ['identity.outposts.view', 'identity.outposts.manage'],
  apiGet: vi.fn(),
  apiPost: vi.fn(),
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
    delete: vi.fn(async () => ({ data: { status: 'ok' } })),
    get: (path: string) => testState.apiGet(path),
    post: (path: string, body?: unknown) => testState.apiPost(path, body),
    put: vi.fn(async () => ({ data: {} })),
  },
}))

interface MockColumn {
  dataIndex?: string | string[]
  key?: string
  render?: (value: unknown, record: Record<string, unknown>) => ReactNode
}

vi.mock('@/components/management-data-page', () => ({
  ManagementDataPage: ({
    query,
    table,
  }: {
    query?: {
      actions?: ReactNode
      children?: ReactNode
      form?: ReturnType<typeof Form.useForm>[0]
      initialValues?: Record<string, unknown>
      onFinish?: (values: Record<string, unknown>) => void
    }
    table: {
      columns: MockColumn[]
      dataSource: Array<Record<string, unknown>>
      headerExtra?: ReactNode
      toolbar?: ReactNode
    }
  }) => (
    <div>
      <Form<unknown>
        form={query?.form}
        initialValues={query?.initialValues}
        onFinish={(values) => query?.onFinish?.(values as Record<string, unknown>)}
      >
        {query?.children}
        {query?.actions}
      </Form>
      {table.toolbar}
      {table.headerExtra}
      {table.dataSource.map((record) => (
        <div data-testid={`row-${String(record.id)}`} key={String(record.id)}>
          {table.columns.map((column, columnIndex) => {
            const value = Array.isArray(column.dataIndex)
              ? column.dataIndex.reduce<unknown>(
                  (current, key) =>
                    current && typeof current === 'object'
                      ? (current as Record<string, unknown>)[key]
                      : undefined,
                  record,
                )
              : record[column.dataIndex ?? '']
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

vi.mock('@/components/management-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/management-list')>()),
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
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      width: '0px',
      height: '0px',
      overflow: 'auto',
      getPropertyValue: () => '',
    }),
  })
})

beforeEach(() => {
  testState.permissionKeys = ['identity.outposts.view', 'identity.outposts.manage']
  testState.apiGet.mockReset()
  testState.apiPost.mockReset()
  testState.apiGet.mockResolvedValue({
    data: [
      {
        id: 'edge-grafana',
        name: 'Edge Grafana',
        mode: 'embedded',
        status: 'online',
        endpoint: 'https://grafana.example.com',
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
      },
      {
        id: 'edge-harbor',
        name: 'Edge Harbor',
        mode: 'agent',
        status: 'offline',
        endpoint: 'https://harbor.example.com',
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
      },
    ],
  })
  testState.apiPost.mockResolvedValue({
    data: {
      id: 'edge-new',
      name: 'Edge New',
      mode: 'embedded',
      status: 'offline',
      token: 'one-time-token-value',
      metadata: {},
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
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <IdentityOutpostsPage />
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
  const expectedText = text.replace(/\s+/g, '')
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, '') === expectedText,
  )
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`)
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('identity outposts page behavior', () => {
  it('loads canonical list data and filters rows locally', async () => {
    const { container } = await renderPage()

    expect(testState.apiGet).toHaveBeenCalledWith('/identity/outposts')
    expect(container.querySelector('[data-testid="row-edge-grafana"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="row-edge-harbor"]')).not.toBeNull()

    const search = container.querySelector(
      'input[placeholder="搜索名称、endpoint、版本"]',
    ) as HTMLInputElement
    await act(async () => setInputValue(search, 'harbor'))
    await clickButton('查询')

    expect(container.querySelector('[data-testid="row-edge-grafana"]')).toBeNull()
    expect(container.querySelector('[data-testid="row-edge-harbor"]')).not.toBeNull()
  })

  it('keeps management actions permission-gated', async () => {
    testState.permissionKeys = ['identity.outposts.view']
    const { container } = await renderPage()

    expect(
      (container.querySelector('button[aria-label="编辑 Outpost"]') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('新建 Outpost'),
      )?.disabled,
    ).toBe(true)
  })

  it('shows a create token exactly through the one-time warning flow', async () => {
    const { queryClient } = await renderPage()
    await clickButton('新建 Outpost')

    const nameInput = document.querySelector(
      'input[placeholder="edge-grafana"]',
    ) as HTMLInputElement
    await act(async () => setInputValue(nameInput, 'Edge New'))
    await clickButton('创建')
    await settle(queryClient)

    expect(testState.apiPost).toHaveBeenCalledWith(
      '/identity/outposts',
      expect.objectContaining({
        metadata: {},
        mode: 'embedded',
        name: 'Edge New',
        status: 'offline',
      }),
    )
    expect(document.body.textContent).toContain('Token is shown once')
    expect(document.body.textContent).toContain('one-time-token-value')
  })

  it('builds trimmed inputs and rejects non-object metadata before mutation', () => {
    const values: IdentityOutpostFormValues = {
      name: ' Edge New ',
      mode: 'external',
      status: 'degraded',
      endpoint: ' https://edge.example.com ',
      version: ' 1.2.3 ',
      metadataJson: '{"region":"cn-east"}',
    }

    expect(buildIdentityOutpostInput(values)).toEqual({
      name: 'Edge New',
      mode: 'external',
      status: 'degraded',
      endpoint: 'https://edge.example.com',
      version: '1.2.3',
      metadata: { region: 'cn-east' },
    })
    expect(() => buildIdentityOutpostInput({ ...values, metadataJson: '[]' })).toThrow(
      'metadata must be a JSON object',
    )
  })
})
