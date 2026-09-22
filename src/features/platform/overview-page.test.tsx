/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertEvent } from '@/features/observability'
import { I18nProvider } from '@/i18n'
import { OverviewPage } from './overview-page'
import type { WorkloadOverview } from './overview/types'

const testState = vi.hoisted(() => ({
  permissionKeys: ['platform.clusters.view', 'observe.monitoring.view', 'platform.pods.view'],
  queryEnabled: {} as Record<string, boolean | undefined>,
  clusters: {
    data: [
      {
        id: 'cluster-a',
        name: 'Cluster A',
        region: 'local',
        environment: 'production',
        connectionMode: 'agent',
        health: { status: 'healthy' },
      },
    ],
    isError: false,
    isLoading: false,
  },
  summary: { data: { data: {} }, isError: false, isLoading: false },
  alerts: { data: [] as AlertEvent[], isError: false, isLoading: false },
  workload: {
    data: { data: null as WorkloadOverview | null },
    isError: false,
    isLoading: false,
  },
}))

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (options: { enabled?: boolean; queryKey: readonly unknown[] }) => {
    testState.queryEnabled[String(options.queryKey[0])] = options.enabled
    if (options.queryKey[0] === 'platform') return testState.clusters
    if (options.queryKey[0] === 'monitoring-summary') return testState.summary
    if (options.queryKey[0] === 'observability') return testState.alerts
    return testState.workload
  },
}))

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: { permissionKeys: testState.permissionKeys } },
    isError: false,
    isLoading: false,
  }),
}))

vi.mock('@/features/observability', () => ({
  observabilityAlertQueries: {
    recent: (limit: number, clusterId?: string) => ({
      queryKey: ['observability', 'alerts', 'recent', limit, clusterId],
    }),
  },
  useAlertEventStream: () => ({ status: 'live', lastEventAt: '2026-08-23T08:00:00Z' }),
}))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: () => ({ clusterId: 'cluster-a' }),
}))

vi.mock('@/components/overview-visuals', () => ({
  OverviewChip: ({ label, value }: { label: ReactNode; value: ReactNode }) => (
    <div>
      {label}: {value}
    </div>
  ),
  OverviewMetricCard: ({ label, value }: { label: ReactNode; value: ReactNode }) => (
    <div>
      {label}: {value}
    </div>
  ),
  OverviewSectionBar: ({ title }: { title: ReactNode }) => <div>{title}</div>,
}))

vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ label, value }: { label?: ReactNode; value: ReactNode }) => (
    <span>{label ?? value}</span>
  ),
}))

vi.mock('./overview/operations-panel', () => ({
  PlatformOperationsPanel: () => <div>Operations evidence</div>,
}))

vi.mock('./overview/resource-finder', () => ({
  ResourceFinder: () => <div>Resource finder</div>,
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function renderPage() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <I18nProvider>
        <MemoryRouter>
          <OverviewPage />
        </MemoryRouter>
      </I18nProvider>,
    )
  })
}

describe('OverviewPage error states', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  beforeEach(() => {
    testState.permissionKeys = [
      'platform.clusters.view',
      'observe.monitoring.view',
      'platform.pods.view',
    ]
    testState.queryEnabled = {}
    testState.clusters.data = [
      {
        id: 'cluster-a',
        name: 'Cluster A',
        region: 'local',
        environment: 'production',
        connectionMode: 'agent',
        health: { status: 'healthy' },
      },
    ]
    testState.summary.data = { data: {} }
    testState.alerts.data = []
    testState.workload.data = { data: null }
    testState.clusters.isError = false
    testState.summary.isError = false
    testState.alerts.isError = false
    testState.workload.isError = false
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
  })

  it('does not present cluster alert failures as empty data', async () => {
    testState.permissionKeys.push('observe.alerts.view')
    testState.alerts.isError = true
    await renderPage()

    expect(container.querySelector('.soha-overview-panel-card .is-error')).not.toBeNull()
    expect(container.textContent).not.toContain('No alert summary')
  })

  it('does not present workload failures as an empty runtime summary', async () => {
    testState.workload.isError = true
    await renderPage()

    expect(container.querySelector('.soha-overview-runtime-card .is-error')).not.toBeNull()
    expect(container.textContent).not.toContain('No workload runtime summary for the platform')
  })

  it('renders zero alert timestamps as empty and keeps the complete severity summary', async () => {
    testState.permissionKeys.push('observe.alerts.view')
    testState.summary.data = {
      data: {
        totalCount: 4,
        firingCount: 2,
        resolvedCount: 2,
        criticalCount: 1,
        warningCount: 0,
        infoCount: 1,
        channelCount: 2,
        lastReceivedAt: '0001-01-01T00:05:00Z',
      },
    }
    testState.alerts.data = [
      {
        id: 'cluster-alert',
        sourceType: 'prometheus',
        fingerprint: 'cluster-alert',
        title: 'Cluster alert',
        summary: 'Cluster alert',
        severity: 'info',
        status: 'firing',
        clusterId: 'cluster-a',
        createdAt: '0001-01-01T00:05:00Z',
        updatedAt: '0001-01-01T00:05:00Z',
      },
    ]
    const cluster = testState.clusters.data[0]
    testState.clusters.data = Array.from({ length: 4 }, (_, index) => ({
      ...cluster,
      id: `cluster-${index}`,
      name: `Cluster ${index}`,
    }))

    await renderPage()

    expect(container.textContent).toContain('暂无接收记录')
    expect(container.textContent).toContain('信息: 1')
    expect(container.querySelector('.soha-overview-cluster-list')?.getAttribute('tabindex')).toBe(
      '0',
    )
  })

  it('shows only alerts assigned to the active Kubernetes cluster', async () => {
    testState.permissionKeys.push('observe.alerts.view')
    testState.summary.data = { data: { totalCount: 22, firingCount: 22 } }
    testState.alerts.data = [
      {
        id: 'global-governance',
        sourceType: 'governance',
        fingerprint: 'global-governance',
        title: 'Governance audit success: identity.provider.delete',
        summary: 'identity.provider.delete',
        severity: 'critical',
        status: 'firing',
        createdAt: '2026-08-22T09:00:00Z',
        updatedAt: '2026-08-22T09:01:00Z',
      },
      {
        id: 'cluster-alert',
        sourceType: 'prometheus',
        fingerprint: 'cluster-alert',
        title: 'Pod restart rate is high',
        summary: 'Deployment prod/api',
        severity: 'warning',
        status: 'firing',
        clusterId: 'cluster-a',
        namespace: 'prod',
        createdAt: '2026-08-22T09:00:00Z',
        updatedAt: '2026-08-22T09:02:00Z',
      },
    ]

    await renderPage()

    expect(container.textContent).toContain('Pod restart rate is high')
    expect(container.textContent).toContain('集群：Cluster A · 命名空间：prod')
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toContain('实时')
    expect(container.textContent).toContain('最近记录 1')
    expect(container.textContent).not.toContain('Governance audit success')
    expect(container.textContent).not.toContain('删除身份提供商')
    expect(container.textContent).not.toContain('最近记录 22')
  })

  it('keeps overflowing pod runtime lists keyboard accessible', async () => {
    testState.workload.data = {
      data: {
        clusterId: 'cluster-a',
        source: 'live',
        generatedAt: '2026-08-21T00:30:00Z',
        totalPods: 4,
        runningPods: 4,
        pendingPods: 0,
        succeededPods: 0,
        failedPods: 0,
        unknownPods: 0,
        restartingPods: 4,
        atRiskPods: 4,
        namespaceBreakdown: Array.from({ length: 4 }, (_, index) => ({
          namespace: `namespace-${index}`,
          totalPods: 1,
          runningPods: 1,
          atRiskPods: 1,
          restartingPods: 1,
        })),
        problematicPods: Array.from({ length: 4 }, (_, index) => ({
          name: `pod-${index}`,
          namespace: `namespace-${index}`,
          phase: 'Running',
          readyContainers: '1/1',
          restarts: 1,
          nodeName: 'node-a',
          ageSeconds: 60,
        })),
      },
    }

    await renderPage()

    expect(container.querySelector('.soha-overview-attention-main a')?.getAttribute('href')).toBe('/workloads/pods/pod-0?clusterId=cluster-a&namespace=namespace-0')
    expect(container.querySelector('.soha-overview-attention-list')?.getAttribute('tabindex')).toBe(
      '0',
    )
    expect(container.querySelector('.soha-overview-namespace-list')?.getAttribute('tabindex')).toBe(
      '0',
    )
  })

  it('disables and masks auxiliary data without its exact read permissions', async () => {
    testState.permissionKeys = []
    await renderPage()

    expect(testState.queryEnabled).toEqual({
      platform: false,
      'monitoring-summary': false,
      observability: false,
      'overview-workload': false,
    })
    expect(container.querySelectorAll('.is-no-permission')).toHaveLength(3)
    expect(container.textContent).not.toContain('Cluster A')
  })
})
