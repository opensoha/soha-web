/** @vitest-environment jsdom */

import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { useQuery } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkloadsOverviewPage } from './page'

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: vi.fn(() => ({
    data: [],
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
}))
vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: ['platform.workloads.overview.view', 'platform.pods.view'],
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
vi.mock('@/components/admin-table', () => ({ AdminTable: () => <div /> }))
vi.mock('@/components/management-list', () => ({
  ManagementState: () => <div />,
  ManagementTableToolbar: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/overview-visuals', () => ({
  OverviewMetricCard: ({ label }: { label: string }) => <div>{label}</div>,
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
  vi.clearAllMocks()
})

describe('workloads overview permissions', () => {
  it('only enables resource queries covered by exact leaf permissions', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => root.render(<WorkloadsOverviewPage />))

    expect(vi.mocked(useQuery).mock.calls.map(([options]) => options.enabled)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ])
    expect(container.textContent).toContain('Pods')
    expect(container.textContent).not.toContain('Deployments')
    act(() => root.unmount())
  })
})
