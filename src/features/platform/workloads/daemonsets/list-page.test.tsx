/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkloadsDaemonSetsPage } from './list-page'

const testState = vi.hoisted(() => ({
  scope: { clusterId: 'cluster-a', namespace: 'selected-ns' },
}))
const apiGetMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: [
      {
        name: 'node-agent',
        namespace: 'record-ns',
        desiredNumber: 3,
        currentNumber: 3,
        readyNumber: 3,
        availableNumber: 3,
        updatedNumber: 3,
        ageSeconds: 300,
        allowedActions: ['restart', 'delete'],
      },
    ],
  })),
)
const apiPostMock = vi.hoisted(() => vi.fn(async () => ({ data: null })))

vi.mock('@/services/api-client', () => ({
  api: { delete: vi.fn(async () => ({ data: null })), get: apiGetMock, post: apiPostMock },
}))
vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))
vi.mock('@/i18n', () => ({ useI18n: () => ({ localeCode: 'zh_CN' as const }) }))
vi.mock('@/features/auth', () => ({
  hasAllowedAction: (actions: string[] | undefined, action: string) =>
    actions?.includes(action) ?? false,
}))
vi.mock('@/features/platform/cluster-capabilities', () => ({
  capabilityActionTooltip: (label: string) => label,
  useClusterCapability: () => ({ disabled: false, reason: '', status: 'available' }),
}))
vi.mock('@/components/resource-actions', () => ({
  TABLE_ACTIONS_COLUMN_CLASS_NAME: 'soha-actions',
}))
vi.mock('@/components/management-list', () => ({
  ManagementIconButton: ({
    'aria-label': ariaLabel,
    disabled,
    loading,
    onClick,
  }: {
    'aria-label': string
    disabled?: boolean
    loading?: boolean
    onClick?: () => void
  }) => (
    <button aria-label={ariaLabel} disabled={disabled || loading} onClick={onClick}>
      {ariaLabel}
    </button>
  ),
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('@/features/platform/workloads/shared/list-controls', () => ({
  renderWorkloadNameLink: (name: string) => <span>{name}</span>,
  useWorkloadTableDensity: () => ({ densityButton: null, tableSize: 'small' as const }),
  WorkloadQueryPanel: ({ children }: { children?: ReactNode }) => <>{children}</>,
  WorkloadRefreshButton: () => null,
  WorkloadSearchInput: () => null,
  WorkloadTableEmpty: () => null,
  WorkloadTableSummary: () => null,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns = [],
    dataSource = [],
  }: {
    columns?: Array<{
      dataIndex?: string
      key?: string
      render?: (value: unknown, record: Record<string, unknown>) => ReactNode
    }>
    dataSource?: Array<Record<string, unknown>>
  }) => (
    <div>
      {dataSource.map((record, rowIndex) => (
        <div key={rowIndex}>
          {columns.map((column, columnIndex) => (
            <span key={column.key ?? `${column.dataIndex}-${columnIndex}`}>
              {column.render
                ? column.render(record[column.dataIndex ?? ''], record)
                : (record[column.dataIndex ?? ''] as ReactNode)}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}))
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    Popconfirm: ({ children }: { children?: ReactNode }) => <>{children}</>,
    message: { error: vi.fn(), success: vi.fn() },
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
          <WorkloadsDaemonSetsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  await flushAsyncWork()
  return container
}

describe('daemonset list actions', () => {
  it('uses the record namespace for restart actions', async () => {
    const container = await renderPage()
    const restartButton = container.querySelector('button[aria-label="重启"]')
    expect(restartButton).toBeInstanceOf(HTMLButtonElement)
    expect(container.querySelector('button[aria-label="删除"]')).toBeInstanceOf(HTMLButtonElement)

    await act(async () => restartButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushAsyncWork()
    expect(apiPostMock).toHaveBeenCalledWith('/clusters/cluster-a/workloads/daemonsets/restart', {
      namespace: 'record-ns',
      name: 'node-agent',
    })
  })
})
