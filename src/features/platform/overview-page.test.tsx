/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { OverviewPage } from './overview-page'

const testState = vi.hoisted(() => ({
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
  workload: { data: { data: null }, isError: false, isLoading: false },
}))

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    if (options.queryKey[0] === 'platform') return testState.clusters
    if (options.queryKey[0] === 'monitoring-summary') return testState.summary
    return testState.workload
  },
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
  StatusTag: ({ value }: { value: ReactNode }) => <span>{value}</span>,
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
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OverviewPage />
        </MemoryRouter>
      </I18nProvider>,
    )
  })
}

describe('OverviewPage error states', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  })

  beforeEach(() => {
    testState.clusters.isError = false
    testState.summary.isError = false
    testState.workload.isError = false
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
  })

  it('does not present alert summary failures as empty data', async () => {
    testState.summary.isError = true
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
})
