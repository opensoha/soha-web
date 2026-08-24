/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { useQuery } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkloadsOverviewPage } from './page'

const testState = vi.hoisted(() => ({
  adminTableProps: null as Record<string, unknown> | null,
  events: [] as Array<Record<string, unknown>>,
  permissionKeys: ['platform.workloads.overview.view', 'platform.pods.view'],
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: vi.fn((options: { queryKey?: unknown }) => {
    const queryKey = JSON.stringify(options.queryKey)
    return {
      data: queryKey.includes('security-posture')
        ? {
            clusterId: 'cluster-a',
            provider: 'kubescape',
            status: 'unsupported',
            generatedAt: '2026-08-23T08:00:00Z',
            counts: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
            findings: [],
            warnings: [],
          }
        : queryKey.includes('events')
          ? testState.events
          : [],
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    }
  }),
}))
vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: testState.permissionKeys,
      },
    },
  }),
}))
vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => ({ clusterId: 'cluster-a', namespace: 'team-a' }),
}))
vi.mock('@/i18n', () => ({
  useI18n: () => ({ localeCode: 'zh_CN', t: (_key: string, fallback: string) => fallback }),
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: (props: {
    columns: Array<{
      dataIndex?: string
      render?: (value: unknown, record: Record<string, unknown>) => ReactNode
    }>
    dataSource: Array<Record<string, unknown>>
  }) => {
    testState.adminTableProps = props as unknown as Record<string, unknown>
    const objectColumn = props.columns.find((column) => column.dataIndex === 'involvedName')
    return (
      <div data-testid="admin-table">
        {props.dataSource.map((record) => (
          <div key={String(record.name)}>{objectColumn?.render?.(record.involvedName, record)}</div>
        ))}
      </div>
    )
  },
}))
vi.mock('@/components/management-list', () => ({
  ManagementState: () => <div />,
  ManagementTableToolbar: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/overview-visuals', () => ({
  OverviewMetricCard: ({ label }: { label: ReactNode }) => <div>{label}</div>,
}))
vi.mock('@/components/status-tag', () => ({ StatusTag: () => <span /> }))
vi.mock('../shared/list-controls', () => ({
  useWorkloadTableDensity: () => ({ densityButton: null, tableSize: 'small' }),
  WorkloadRefreshButton: () => null,
  WorkloadTableEmpty: () => null,
  WorkloadTableSummary: () => null,
}))

afterEach(() => {
  document.body.innerHTML = ''
  testState.adminTableProps = null
  testState.events = []
  testState.permissionKeys = ['platform.workloads.overview.view', 'platform.pods.view']
  vi.clearAllMocks()
})

function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() =>
    root.render(
      <MemoryRouter initialEntries={['/workloads/overview']}>
        <WorkloadsOverviewPage />
      </MemoryRouter>,
    ),
  )
  return { container, root }
}

describe('workloads overview permissions', () => {
  it('only enables resource queries covered by exact leaf permissions', () => {
    const { container, root } = renderPage()

    expect(
      vi
        .mocked(useQuery)
        .mock.calls.slice(0, 8)
        .map(([options]) => options.enabled),
    ).toEqual([false, true, false, false, false, false, true, true])
    expect(container.textContent).toContain('Pods')
    expect(container.textContent).not.toContain('Deployments')
    expect(container.textContent).toContain('安装 Kubescape Operator 后')
    act(() => root.unmount())
  })

  it('links workload summaries and event objects to scoped resource pages', () => {
    testState.permissionKeys = [
      'platform.workloads.overview.view',
      'platform.deployment.view',
      'platform.pods.view',
      'platform.workloads.stateful-sets.view',
      'platform.workloads.daemon-sets.view',
      'platform.workloads.jobs.view',
      'platform.workloads.cron-jobs.view',
    ]
    testState.events = [
      {
        ageSeconds: 5,
        count: 1,
        involvedKind: 'Pod',
        involvedName: 'api/server',
        message: 'Back-off restarting failed container',
        name: 'event-a',
        namespace: 'team/a',
        reason: 'BackOff',
        type: 'Warning',
      },
      {
        ageSeconds: 8,
        count: 1,
        involvedKind: 'ConfigMap',
        involvedName: 'settings',
        message: 'Updated',
        name: 'event-b',
        namespace: 'team/a',
        reason: 'Updated',
        type: 'Normal',
      },
    ]

    const { container, root } = renderPage()

    expect(
      container.querySelector(
        'a[href="/workloads/deployments?clusterId=cluster-a&namespace=team-a"]',
      ),
    ).not.toBeNull()
    const eventLink = Array.from(container.querySelectorAll('a')).find((link) =>
      link.textContent?.includes('Pod / api/server'),
    )
    expect(eventLink?.getAttribute('href')).toBe(
      '/workloads/pods/api%2Fserver?clusterId=cluster-a&namespace=team%2Fa',
    )
    expect(container.textContent).toContain('ConfigMap / settings')
    expect(testState.adminTableProps).toMatchObject({
      localSorting: true,
      pageSize: 15,
      viewportScroll: true,
    })
    act(() => root.unmount())
  })
})
