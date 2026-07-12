/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MonitoringPage } from './page'

const responses = vi.hoisted(() => ({
  '/monitoring/summary': {
    totalCount: 3,
    firingCount: 1,
    resolvedCount: 2,
    criticalCount: 1,
    warningCount: 0,
    infoCount: 0,
    channelCount: 2,
    lastReceivedAt: '2026-07-10T00:00:00Z',
  },
  '/alert-events?limit=8': [
    {
      id: 'event-1',
      sourceType: 'alertmanager',
      fingerprint: 'fp-1',
      title: 'High CPU',
      summary: 'CPU above threshold',
      severity: 'critical',
      status: 'firing',
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    },
  ],
  '/alert-rules': [{ id: 'rule-1', name: 'CPU', enabled: true }],
  '/alert-integrations': [
    {
      id: 'integration-1',
      name: 'Alertmanager',
      integrationType: 'alertmanager_v1',
      enabled: true,
      status: 'ready',
    },
  ],
  '/notification-policies': [
    {
      id: 'policy-1',
      name: 'Critical',
      sendResolved: true,
      cooldownSeconds: 60,
      enabled: true,
    },
  ],
  '/oncall/schedules': [{ id: 'schedule-1', name: 'Primary', enabled: true }],
  '/healing-runs?limit=6': [{ id: 'run-1', policyId: 'heal-1', status: 'pending' }],
}))

const apiMocks = vi.hoisted(() => ({
  get: vi.fn((path: keyof typeof responses) => Promise.resolve({ data: responses[path] ?? [] })),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))
vi.mock('@/components/overview-visuals', () => ({
  OverviewMetricCard: ({ label, value }: { label: string; value: ReactNode }) => (
    <div>
      {label}: {value}
    </div>
  ),
  OverviewChip: ({ label, value }: { label: string; value: ReactNode }) => (
    <div>
      {label}: {value}
    </div>
  ),
  OverviewSectionBar: ({ title, extra }: { title: string; extra?: ReactNode }) => (
    <div>
      {title}
      {extra}
    </div>
  ),
}))
vi.mock('@/components/management-list', () => ({
  ManagementDetailHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1>,
  ManagementIconButton: ({ 'aria-label': label }: { 'aria-label': string }) => (
    <button aria-label={label} />
  ),
  ManagementState: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
}))
vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))

const roots: Root[] = []
const containers: HTMLElement[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  for (const container of containers.splice(0)) container.remove()
  vi.clearAllMocks()
})

describe('MonitoringPage', () => {
  it('renders the bounded overview from canonical capability queries', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    containers.push(container)
    const root = createRoot(container)
    roots.push(root)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await act(async () => {
      root.render(
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <MonitoringPage />
            </MemoryRouter>
          </QueryClientProvider>
        </AntdApp>,
      )
    })
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      if (container.textContent?.includes('High CPU') && queryClient.isFetching() === 0) break
    }

    expect(container.textContent).toContain('总览')
    expect(container.textContent).toContain('活跃告警: 1')
    expect(container.textContent).toContain('High CPU')
    expect(container.textContent).toContain('待处理自愈: 1')
    expect(apiMocks.get).toHaveBeenCalledWith('/alert-events?limit=8')
  })
})
