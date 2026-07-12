/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClustersPage } from './list-page'

const storeMocks = vi.hoisted(() => ({ setClusterId: vi.fn() }))
const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path === '/clusters') {
      return {
        data: [
          {
            id: 'cluster-a',
            name: 'Primary',
            region: 'gke',
            environment: 'prod',
            labels: {},
            connectionMode: 'agent',
            version: 'v1.30',
            health: { status: 'healthy' },
          },
        ],
      }
    }
    if (path === '/clusters/cluster-a/detail') {
      return {
        data: {
          summary: { id: 'cluster-a' },
          connection: { mode: 'agent', endpoint: 'http://agent' },
          monitoring: { prometheus: {} },
        },
      }
    }
    return { data: [] }
  }),
)
const apiDeleteMock = vi.hoisted(() => vi.fn(async () => ({ data: null })))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: apiDeleteMock,
    get: apiGetMock,
    post: vi.fn(async () => ({ data: {} })),
    put: vi.fn(async () => ({ data: {} })),
  },
}))
vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: (selector: (state: typeof storeMocks) => unknown) => selector(storeMocks),
}))
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))
vi.mock('@/components/management-list', () => ({
  ManagementBatchBar: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ManagementDensityButton: () => null,
  ManagementIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string
    onClick?: () => void
  }) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {ariaLabel}
    </button>
  ),
  ManagementKeywordField: () => null,
  ManagementQueryActions: () => null,
  ManagementQueryField: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ManagementQueryPanel: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ManagementRefreshButton: () => null,
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns = [],
    dataSource = [],
  }: {
    columns?: Array<{
      dataIndex?: string | string[]
      key?: string
      render?: (value: unknown, record: Record<string, unknown>) => ReactNode
    }>
    dataSource?: Array<Record<string, unknown>>
  }) => (
    <div>
      {dataSource.map((record, rowIndex) => (
        <div key={rowIndex}>
          {columns.map((column, columnIndex) => {
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
                {column.render ? column.render(value, record) : (value as ReactNode)}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  ),
}))
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  const FormMock = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  FormMock.Item = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const AppMock = Object.assign(({ children }: { children?: ReactNode }) => <>{children}</>, {
    useApp: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
  })
  return {
    ...actual,
    App: AppMock,
    Form: FormMock,
    Modal: ({
      children,
      open,
      title,
    }: {
      children?: ReactNode
      open?: boolean
      title?: ReactNode
    }) =>
      open ? (
        <div>
          {title}
          {children}
        </div>
      ) : null,
    Popconfirm: ({ children, onConfirm }: { children?: ReactNode; onConfirm?: () => void }) => (
      <span onClick={onConfirm}>{children}</span>
    ),
    Select: () => <select aria-label="select" />,
  }
})

const mountedRoots: Root[] = []

beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
beforeEach(() => vi.clearAllMocks())
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

async function renderPage() {
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
        <MemoryRouter>
          <ClustersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  await flushAsyncWork()
  return container
}

describe('clusters list page boundaries', () => {
  it('loads edit detail on demand and deletes through the capability mutation', async () => {
    const container = await renderPage()
    expect(apiGetMock).toHaveBeenCalledWith('/clusters')
    expect(apiGetMock).not.toHaveBeenCalledWith('/clusters/cluster-a/detail')

    const editButton = container.querySelector('button[aria-label="编辑集群"]')
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushAsyncWork()
    expect(apiGetMock).toHaveBeenCalledWith('/clusters/cluster-a/detail')
    expect(container.textContent).toContain('编辑集群')

    const deleteButton = container.querySelector('button[aria-label="删除集群"]')
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushAsyncWork()
    expect(apiDeleteMock).toHaveBeenCalledWith('/clusters/cluster-a')
  })
})
