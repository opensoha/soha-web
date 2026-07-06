/** @vitest-environment jsdom */

import { act } from 'react'
import type { Key, ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PodLogViewer } from '@/components/pod-log-viewer'
import {
  PodDetailPage,
  WorkloadsDaemonSetsPage,
  WorkloadsDeploymentsPage,
  WorkloadsPodsPage,
  WorkloadsStatefulSetsPage,
} from './workloads-pages'

const testState = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'monitoring' as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn((path: string) => Promise.resolve({ data: testState.responses[path] ?? [] })),
)
const apiDeleteMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null })))
const apiPostMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null })))
const withStreamTicketMock = vi.hoisted(() => vi.fn(async (url: string) => url))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => testState.scope,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    delete: apiDeleteMock,
    post: apiPostMock,
    put: vi.fn(),
  },
}))

vi.mock('@/features/auth/stream-ticket', () => ({
  buildSameOriginStreamURL: (path: string, protocol: string) =>
    new URL(path, `${protocol}://localhost`).toString(),
  withStreamTicket: withStreamTicketMock,
}))

vi.mock('@/components/platform-scope-toolbar', () => ({
  PlatformScopeToolbar: () => <div data-testid="scope-toolbar">scope-toolbar</div>,
}))

vi.mock('@/components/resource-events-timeline', () => ({
  ResourceEventsTimeline: () => (
    <div data-testid="resource-events-timeline">resource-events-timeline</div>
  ),
}))

vi.mock('@/components/status-tag', () => ({
  BooleanTag: ({ value }: { value: boolean }) => <span>{String(value)}</span>,
  StatusTag: ({ value }: { value: string }) => <span>{value}</span>,
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => (
    <div data-testid="resource-metrics-panel">resource-metrics-panel</div>
  ),
}))

vi.mock('@/features/platform/node-resource-utils', () => ({
  ResourceProgressCell: () => (
    <div data-testid="resource-progress-cell">resource-progress-cell</div>
  ),
  formatBytesAsG: () => '-',
  formatCpu: () => '-',
}))

vi.mock('@/components/stat-grid', () => ({
  StatGrid: () => <div data-testid="stat-grid">stat-grid</div>,
}))

vi.mock('@/components/resource-actions', () => ({
  TABLE_ACTIONS_COLUMN_CLASS_NAME: 'soha-actions',
  useResourceActions: () => ({
    column: { title: '', dataIndex: '__actions__', render: () => null },
    modalNode: null,
  }),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  hasAllowedAction: (allowedActions: string[] | undefined, action: string) =>
    allowedActions?.includes(action) ?? false,
}))

vi.mock('@/utils/download', () => ({
  downloadJSON: vi.fn(),
  downloadText: vi.fn(),
}))

type MockRecord = Record<string, unknown>
type MockColumn = {
  dataIndex?: string | string[]
  key?: Key
  render?: (value: unknown, record: MockRecord, index: number) => ReactNode
  title?: ReactNode
}

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    headerExtra,
    loading,
    rowKey,
    rowSelection,
    title,
    toolbar,
    toolbarExtra,
  }: {
    columns?: MockColumn[]
    dataSource?: MockRecord[]
    headerExtra?: ReactNode
    loading?: boolean
    rowKey?: string | ((record: MockRecord) => Key)
    rowSelection?: {
      onChange?: (keys: string[]) => void
      selectedRowKeys?: string[]
    }
    title?: ReactNode
    toolbar?: ReactNode
    toolbarExtra?: ReactNode
  }) => {
    function mockCellValue(record: MockRecord, dataIndex?: string | string[]) {
      if (!dataIndex) return undefined
      if (Array.isArray(dataIndex)) {
        return dataIndex.reduce<unknown>(
          (value, key) =>
            value && typeof value === 'object' ? (value as MockRecord)[key] : undefined,
          record,
        )
      }
      return record[dataIndex]
    }

    function mockRowKey(record: MockRecord) {
      if (typeof rowKey === 'function') return rowKey(record)
      if (typeof rowKey === 'string') return String(record[rowKey] ?? '')
      return String(record.id ?? record.name ?? '')
    }

    const rows = dataSource ?? []
    const selectedRowKeys = rowSelection?.selectedRowKeys ?? []
    return (
      <div data-testid="admin-table">
        {title ? <div data-testid="table-title">{title}</div> : null}
        {headerExtra ? <div data-testid="table-header-extra">{headerExtra}</div> : null}
        {toolbar ? <div data-testid="table-toolbar">{toolbar}</div> : null}
        {toolbarExtra ? <div data-testid="table-toolbar-extra">{toolbarExtra}</div> : null}
        <div data-testid="table-loading">{String(Boolean(loading))}</div>
        <div data-testid="table-rows">{rows.length}</div>
        {rows.map((record, rowIndex) => {
          const key = String(mockRowKey(record))
          return (
            <div key={key || rowIndex} data-testid={`row-${rowIndex}`}>
              {rowSelection ? (
                <input
                  aria-label={`select-${key}`}
                  checked={selectedRowKeys.includes(key)}
                  onChange={(event) => {
                    const nextKeys = event.currentTarget.checked
                      ? Array.from(new Set([...selectedRowKeys, key]))
                      : selectedRowKeys.filter((item) => item !== key)
                    rowSelection.onChange?.(nextKeys)
                  }}
                  type="checkbox"
                />
              ) : null}
              {(columns ?? []).map((column, columnIndex) => {
                const value = mockCellValue(record, column.dataIndex)
                const content =
                  typeof column.render === 'function'
                    ? column.render(value, record, rowIndex)
                    : value
                return (
                  <div
                    key={`${String(column.key ?? column.dataIndex ?? columnIndex)}-${columnIndex}`}
                    data-testid={`cell-${rowIndex}-${columnIndex}`}
                  >
                    {content as ReactNode}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  },
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function setResponses(responses: Record<string, unknown>) {
  testState.responses = responses
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderWithProviders(node: ReactNode, route = '/workloads/pods') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[route]}
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {node}
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })

  await flushAsyncWork()

  return container
}

describe('workloads pods page refresh controls', () => {
  beforeAll(() => {
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
    const getComputedStyle = window.getComputedStyle.bind(window)
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: (element: Element) => getComputedStyle(element),
    })

    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  beforeEach(() => {
    vi.useFakeTimers()
    testState.scope.clusterId = 'cluster-a'
    testState.scope.namespace = 'monitoring'
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Direct Cluster',
          connectionMode: 'direct',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial' },
        },
      ],
      '/clusters/cluster-a/workloads/pods?namespace=monitoring': [
        {
          name: 'prometheus-0',
          namespace: 'monitoring',
          phase: 'Running',
          readyContainers: '1/1',
          restarts: 0,
          podIp: '10.0.0.10',
          nodeName: 'node-a',
          cpu: '10m',
          memory: '64Mi',
          ageSeconds: 60,
          allowedActions: ['delete'],
        },
      ],
    })
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots = []
    for (const container of containers) {
      container.remove()
    }
    containers = []
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('manually refetches pod data from the refresh button', async () => {
    const container = await renderWithProviders(<WorkloadsPodsPage />)
    const podListPath = '/clusters/cluster-a/workloads/pods?namespace=monitoring'
    expect(apiGetMock.mock.calls.filter(([path]) => path === podListPath)).toHaveLength(1)

    const refreshButton = container.querySelector('button[aria-label="Refresh"]')
    if (!refreshButton) {
      throw new Error('refresh button not found')
    }

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()

    expect(apiGetMock.mock.calls.filter(([path]) => path === podListPath)).toHaveLength(2)
  })

  it('polls pod data automatically when auto refresh is enabled', async () => {
    await renderWithProviders(<WorkloadsPodsPage />)
    const podListPath = '/clusters/cluster-a/workloads/pods?namespace=monitoring'
    expect(apiGetMock.mock.calls.filter(([path]) => path === podListPath)).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(15000)
    })
    await flushAsyncWork()

    expect(apiGetMock.mock.calls.filter(([path]) => path === podListPath)).toHaveLength(2)
  })

  it('renders pod CPU and memory resources as compact progress markers', async () => {
    setResponses({
      '/clusters/cluster-a/workloads/pods?namespace=monitoring': [
        {
          name: 'resource-demo',
          namespace: 'monitoring',
          phase: 'Running',
          readyContainers: '1/1',
          restarts: 0,
          podIp: '10.0.0.11',
          nodeName: 'node-a',
          cpu: '50m',
          memory: '64Mi',
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '200m', memory: '256Mi' },
          ageSeconds: 60,
        },
      ],
    })

    const container = await renderWithProviders(<WorkloadsPodsPage />)
    await act(async () => {
      vi.advanceTimersByTime(0)
      await Promise.resolve()
    })
    await flushAsyncWork()

    const resourceCells = Array.from(container.querySelectorAll('.soha-pod-resource-limit-cell'))

    expect(resourceCells).toHaveLength(2)
    for (const cell of resourceCells) {
      expect(cell.textContent?.trim()).toBe('')
      expect(cell.querySelectorAll('.ant-progress')).toHaveLength(1)
      expect(cell.querySelectorAll('.soha-pod-resource-marker.is-request')).toHaveLength(1)
      expect(cell.querySelectorAll('.soha-pod-resource-marker.is-limit')).toHaveLength(1)
      expect(cell.getAttribute('aria-label')).toContain('使用')
    }
  })

  it('disables pod rebuild and batch delete when agent mode only partially supports workload mutations', async () => {
    const partialReason = 'pod deletion remains direct-only'
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Agent Cluster',
          connectionMode: 'agent',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial', notes: [partialReason] },
        },
      ],
      '/clusters/cluster-a/workloads/pods?namespace=monitoring': [
        {
          name: 'failed-pod',
          namespace: 'monitoring',
          phase: 'Failed',
          readyContainers: '0/1',
          restarts: 0,
          podIp: '',
          nodeName: 'node-a',
          cpu: '0',
          memory: '0',
          ageSeconds: 60,
          allowedActions: ['delete'],
        },
      ],
    })

    const container = await renderWithProviders(<WorkloadsPodsPage />)
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const rebuildButton = container.querySelector('button[aria-label="重建 Pod"]')
    expect(rebuildButton).toBeInstanceOf(HTMLButtonElement)
    expect((rebuildButton as HTMLButtonElement).disabled).toBe(true)

    const checkbox = container.querySelector('input[aria-label="select-monitoring/failed-pod"]')
    expect(checkbox).toBeInstanceOf(HTMLInputElement)
    await act(async () => {
      checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()

    const batchDeleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '批量删除',
    )
    expect(batchDeleteButton).toBeInstanceOf(HTMLButtonElement)
    expect((batchDeleteButton as HTMLButtonElement).disabled).toBe(true)
    expect(apiDeleteMock).not.toHaveBeenCalled()
  })

  it('limits concurrent pod batch delete requests', async () => {
    const podCount = 12
    const releaseDeleteRequests: Array<() => void> = []
    let activeDeletes = 0
    let maxActiveDeletes = 0
    apiDeleteMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          activeDeletes += 1
          maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes)
          releaseDeleteRequests.push(() => {
            activeDeletes -= 1
            resolve({ data: null })
          })
        }),
    )
    for (let index = 1; index < podCount; index += 1) {
      apiDeleteMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            activeDeletes += 1
            maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes)
            releaseDeleteRequests.push(() => {
              activeDeletes -= 1
              resolve({ data: null })
            })
          }),
      )
    }
    setResponses({
      '/clusters/cluster-a/workloads/pods?namespace=monitoring': Array.from(
        { length: podCount },
        (_, index) => ({
          name: `failed-pod-${index}`,
          namespace: 'monitoring',
          phase: 'Failed',
          readyContainers: '0/1',
          restarts: 0,
          podIp: '',
          nodeName: 'node-a',
          cpu: '0',
          memory: '0',
          ageSeconds: 60,
          allowedActions: ['delete'],
        }),
      ),
    })

    const container = await renderWithProviders(<WorkloadsPodsPage />)
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    for (let index = 0; index < podCount; index += 1) {
      const checkbox = container.querySelector(
        `input[aria-label="select-monitoring/failed-pod-${index}"]`,
      )
      expect(checkbox).toBeInstanceOf(HTMLInputElement)
      await act(async () => {
        checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await flushAsyncWork()
    }

    const batchDeleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '批量删除',
    )
    expect(batchDeleteButton).toBeInstanceOf(HTMLButtonElement)
    await act(async () => {
      batchDeleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const confirmButton = document.body.querySelector('.ant-popconfirm-buttons .ant-btn-primary')
    expect(confirmButton).toBeInstanceOf(HTMLButtonElement)
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await flushAsyncWork()

    expect(apiDeleteMock).toHaveBeenCalledTimes(8)
    expect(maxActiveDeletes).toBeLessThanOrEqual(8)

    while (releaseDeleteRequests.length > 0) {
      const release = releaseDeleteRequests.shift()
      await act(async () => {
        release?.()
        await Promise.resolve()
      })
      await flushAsyncWork()
    }

    expect(apiDeleteMock).toHaveBeenCalledTimes(podCount)
    expect(maxActiveDeletes).toBeLessThanOrEqual(8)
  })

  it('disables deployment mutation buttons when the current cluster capability is unsupported', async () => {
    const unsupportedReason = 'workload mutations are disabled for agent-connected clusters'
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Agent Cluster',
          region: 'dev',
          environment: 'test',
          labels: {},
          connectionMode: 'agent',
          version: 'v1.30.0',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: {
            status: 'unsupported',
            notes: [unsupportedReason],
          },
        },
      ],
      '/clusters/cluster-a/workloads/deployments?namespace=monitoring': [
        {
          name: 'prometheus',
          namespace: 'monitoring',
          desiredReplicas: 1,
          readyReplicas: 1,
          updatedReplicas: 1,
          available: 1,
          ageSeconds: 300,
          allowedActions: ['restart', 'scale', 'update', 'delete'],
        },
      ],
    })

    const container = await renderWithProviders(
      <WorkloadsDeploymentsPage />,
      '/workloads/deployments',
    )
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    expect(apiGetMock).toHaveBeenCalledWith('/clusters/capabilities')
    expect(container.textContent).toContain(unsupportedReason)
    for (const label of ['重启', '扩缩', '回滚', '删除']) {
      const button = container.querySelector(`button[aria-label="${label}"]`)
      expect(button).toBeInstanceOf(HTMLButtonElement)
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('renders statefulset restart, scale, and delete actions using workload permissions', async () => {
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Direct Cluster',
          connectionMode: 'direct',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial' },
        },
      ],
      '/clusters/cluster-a/workloads/statefulsets?namespace=monitoring': [
        {
          name: 'prometheus',
          namespace: 'monitoring',
          serviceName: 'prometheus',
          desiredReplicas: 2,
          readyReplicas: 1,
          currentReplicas: 2,
          ageSeconds: 300,
          allowedActions: ['restart', 'scale', 'delete'],
        },
      ],
    })

    const container = await renderWithProviders(
      <WorkloadsStatefulSetsPage />,
      '/workloads/statefulsets',
    )
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const restartButton = container.querySelector('button[aria-label="重启"]')
    const scaleButton = container.querySelector('button[aria-label="扩缩"]')
    const deleteButton = container.querySelector('button[aria-label="删除"]')
    expect(restartButton).toBeInstanceOf(HTMLButtonElement)
    expect(scaleButton).toBeInstanceOf(HTMLButtonElement)
    expect(deleteButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      restartButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()
    expect(apiPostMock).toHaveBeenCalledWith('/clusters/cluster-a/workloads/statefulsets/restart', {
      namespace: 'monitoring',
      name: 'prometheus',
    })
  })

  it('opens the statefulset scale modal and submits replicas to the scale endpoint', async () => {
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Direct Cluster',
          connectionMode: 'direct',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial' },
        },
      ],
      '/clusters/cluster-a/workloads/statefulsets?namespace=monitoring': [
        {
          name: 'prometheus',
          namespace: 'monitoring',
          serviceName: 'prometheus',
          desiredReplicas: 2,
          readyReplicas: 1,
          currentReplicas: 2,
          ageSeconds: 300,
          allowedActions: ['scale'],
        },
      ],
    })

    const container = await renderWithProviders(
      <WorkloadsStatefulSetsPage />,
      '/workloads/statefulsets',
    )
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const scaleButton = container.querySelector('button[aria-label="扩缩"]')
    await act(async () => {
      scaleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const modalOkButton = document.body.querySelector('.ant-modal-footer .ant-btn-primary')
    expect(document.body.textContent).toContain('StatefulSet 扩缩容')
    expect(modalOkButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      modalOkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()
    expect(apiPostMock).toHaveBeenCalledWith('/clusters/cluster-a/workloads/statefulsets/scale', {
      namespace: 'monitoring',
      name: 'prometheus',
      replicas: 2,
    })
  })

  it('renders daemonset restart and delete actions', async () => {
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Direct Cluster',
          connectionMode: 'direct',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'workload.mutations',
          label: 'Workload mutations',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial' },
        },
      ],
      '/clusters/cluster-a/workloads/daemonsets?namespace=monitoring': [
        {
          name: 'node-exporter',
          namespace: 'monitoring',
          desiredNumber: 3,
          currentNumber: 3,
          readyNumber: 3,
          availableNumber: 3,
          updatedNumber: 3,
          ageSeconds: 300,
          allowedActions: ['restart', 'delete'],
        },
      ],
    })

    const container = await renderWithProviders(
      <WorkloadsDaemonSetsPage />,
      '/workloads/daemonsets',
    )
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const restartButton = container.querySelector('button[aria-label="重启"]')
    const deleteButton = container.querySelector('button[aria-label="删除"]')
    expect(restartButton).toBeInstanceOf(HTMLButtonElement)
    expect(deleteButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      restartButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushAsyncWork()
    expect(apiPostMock).toHaveBeenCalledWith('/clusters/cluster-a/workloads/daemonsets/restart', {
      namespace: 'monitoring',
      name: 'node-exporter',
    })
  })

  it('renders container, volume, and related resource tabs on pod detail page', async () => {
    setResponses({
      '/clusters/cluster-a/workloads/pods/demo-pod/detail?namespace=monitoring': {
        name: 'demo-pod',
        namespace: 'monitoring',
        phase: 'Running',
        createdAt: '2026-05-07T12:00:00Z',
        containers: [
          {
            name: 'app',
            image: 'demo:1.0',
            ready: true,
            restartCount: 0,
            state: 'running',
          },
        ],
        volumes: [
          {
            name: 'config-volume',
            type: 'ConfigMap',
            sourceName: 'demo-config',
            readOnly: false,
            details: ['ConfigMap: demo-config'],
            volumeMounts: [{ name: 'app', mountPath: '/etc/config', readOnly: false }],
            referencedConfigMaps: ['demo-config'],
          },
        ],
        relatedResources: [
          {
            kind: 'Service',
            name: 'demo-svc',
            namespace: 'monitoring',
            relations: ['selected-by-service'],
            details: ['Type: ClusterIP'],
          },
        ],
      },
    })

    const container = await renderWithProviders(
      <Routes>
        <Route path="/workloads/pods/:podName" element={<PodDetailPage />} />
      </Routes>,
      '/workloads/pods/demo-pod?namespace=monitoring',
    )

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('容器')
    expect(container.textContent).toContain('卷')
    expect(container.textContent).toContain('相关资源')
  })

  it('keeps partial pod logs on snapshot mode and disables interactive terminal', async () => {
    const logsReason = 'agent connection supports snapshot logs only'
    const execReason = 'agent connection supports non-interactive exec only'
    setResponses({
      '/clusters': [
        {
          id: 'cluster-a',
          name: 'Agent Cluster',
          connectionMode: 'agent',
          health: { status: 'healthy' },
        },
      ],
      '/clusters/capabilities': [
        {
          key: 'pod.logs',
          label: 'Pod logs',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial', notes: [logsReason] },
        },
        {
          key: 'pod.exec',
          label: 'Pod exec',
          category: 'workloads',
          direct: { status: 'available' },
          agent: { status: 'partial', notes: [execReason] },
        },
      ],
      '/clusters/cluster-a/workloads/pods/demo-pod/detail?namespace=monitoring': {
        name: 'demo-pod',
        namespace: 'monitoring',
        phase: 'Running',
        createdAt: '2026-05-07T12:00:00Z',
        containers: [
          {
            name: 'app',
            image: 'demo:1.0',
            ready: true,
            restartCount: 0,
            state: 'running',
          },
        ],
      },
      '/clusters/cluster-a/workloads/pods/demo-pod/logs?namespace=monitoring&tailLines=100&container=app':
        {
          content: 'line one\nline two\n',
        },
    })

    const container = await renderWithProviders(
      <Routes>
        <Route path="/workloads/pods/:podName" element={<PodDetailPage />} />
      </Routes>,
      '/workloads/pods/demo-pod?namespace=monitoring',
    )
    await flushAsyncWork()
    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })
    await flushAsyncWork()

    const terminalTab = Array.from(container.querySelectorAll('[role="tab"]')).find((tab) =>
      tab.textContent?.replace(/\s/g, '').includes('终端'),
    )
    expect(terminalTab).toBeInstanceOf(HTMLElement)
    expect(terminalTab?.getAttribute('aria-disabled')).toBe('true')

    const logContainer = await renderWithProviders(
      <PodLogViewer
        active
        clusterId="cluster-a"
        namespace="monitoring"
        podName="demo-pod"
        container="app"
        streamingDisabledReason={logsReason}
      />,
    )
    await flushAsyncWork()

    expect(logContainer.textContent).toContain(logsReason)
    expect(logContainer.textContent).toContain('轮询')
    expect(
      apiGetMock.mock.calls.some(([path]) =>
        String(path).includes('/clusters/cluster-a/workloads/pods/demo-pod/logs?'),
      ),
    ).toBe(true)
    expect(withStreamTicketMock).not.toHaveBeenCalled()
  })
})
