/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RolloutHistory } from '@/types'
import { DeploymentDetailPage } from './detail-page'

const testState = vi.hoisted(() => ({
  history: [] as RolloutHistory[],
  historyError: false,
  scope: {
    clusterId: 'cluster-a' as string | null,
    namespace: 'monitoring' as string | null,
    setClusterId: vi.fn(),
    setNamespace: vi.fn(),
  },
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path.includes('/detail?')) {
      return {
        data: {
          name: 'prometheus',
          namespace: 'monitoring',
          createdAt: '2026-01-01T00:00:00Z',
          selector: { app: 'prometheus' },
          pods: [
            {
              name: 'prometheus-0',
              namespace: 'monitoring',
              phase: 'Running',
              podIp: '10.20.0.1',
              nodeName: 'worker-a',
              readyContainers: '1/1',
              restarts: 0,
              ageSeconds: 60,
            },
          ],
          relatedResources: [
            {
              kind: 'Service',
              name: 'prometheus',
              namespace: 'monitoring',
              relation: 'selected-by-service',
            },
          ],
        },
      }
    }
    if (path.includes('/rollout-status?')) {
      return {
        data: {
          status: 'ready',
          revision: '12',
          desiredReplicas: 1,
          updatedReplicas: 1,
          readyReplicas: 1,
          availableReplicas: 1,
          conditions: [],
        },
      }
    }
    if (path.includes('/rollouts?')) {
      if (testState.historyError) throw new Error('History unavailable')
      return { data: testState.history }
    }
    if (path.includes('/metrics?')) return { data: { rangeMinutes: 60, series: [] } }
    if (path.includes('/yaml?')) {
      return { data: { kind: 'Deployment', name: 'prometheus', content: 'kind: Deployment' } }
    }
    return { data: [] }
  }),
)

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    put: vi.fn(async () => ({ data: { content: 'kind: Deployment' } })),
    post: vi.fn(async () => ({ data: null })),
    delete: vi.fn(async () => ({ data: null })),
  },
}))

vi.mock('@/stores/platform-scope-store', () => ({
  usePlatformScopeStore: (selector?: (state: typeof testState.scope) => unknown) =>
    selector ? selector(testState.scope) : testState.scope,
}))

vi.mock('@/i18n', () => ({
  localeText: (localeCode: string, chinese: string, english: string) =>
    localeCode === 'zh_CN' ? chinese : english,
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@/features/copilot', () => ({ useAIPageContext: vi.fn() }))

vi.mock('@/features/platform/cluster-capabilities', () => ({
  capabilityActionTooltip: (label: string) => label,
  useClusterCapability: () => ({ disabled: false, reason: '', status: 'available' }),
}))

vi.mock('@/components/resource-events-timeline', () => ({
  ResourceEventsTimeline: () => <div data-testid="events-panel">events-panel</div>,
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => <div data-testid="metrics-panel">metrics-panel</div>,
}))

vi.mock('@/components/k8s-yaml-editor', () => ({
  K8sYamlEditor: () => <div data-testid="yaml-editor">yaml-editor</div>,
}))

vi.mock('@/components/status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
  MetadataTag: ({ label }: { label: string }) => <span>{label}</span>,
}))

const mountedRoots: Root[] = []

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

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.scope.clusterId = 'cluster-a'
  testState.scope.namespace = 'monitoring'
  testState.history = []
  testState.historyError = false
  testState.scope.setClusterId.mockImplementation((value: string) => {
    testState.scope.clusterId = value
  })
  testState.scope.setNamespace.mockImplementation((value: string) => {
    testState.scope.namespace = value
  })
})

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

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="destination">
      {location.pathname}
      {location.search}
    </div>
  )
}

async function renderDetail() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <MemoryRouter
            initialEntries={[
              '/workloads/deployments/prometheus?clusterId=url-cluster&namespace=url-namespace',
            ]}
          >
            <Routes>
              <Route
                path="/workloads/deployments/:deploymentName"
                element={<DeploymentDetailPage />}
              />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </AntdApp>
      </QueryClientProvider>,
    )
  })
  await flushAsyncWork()
  await flushAsyncWork()
  return container
}

function clickTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find((item) =>
    item.textContent?.includes(label),
  )
  expect(tab).toBeDefined()
  tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('deployment detail page boundaries', () => {
  it('keeps mutation actions out of the read-only detail tabs', async () => {
    const container = await renderDetail()

    expect(container.querySelector('.soha-workload-detail-heading')).toBeNull()
    const tabsNav = container.querySelector('.soha-workload-detail-tabs > .ant-tabs-nav')
    expect(tabsNav?.textContent).not.toContain('重启')
    expect(tabsNav?.textContent).not.toContain('扩缩容')
  })

  it('deduplicates detail data and loads tab data only when activated', async () => {
    const container = await renderDetail()
    const requestedPaths = () => apiGetMock.mock.calls.map(([path]) => String(path))

    expect(requestedPaths().filter((path) => path.includes('/detail?'))).toEqual([
      '/clusters/url-cluster/workloads/deployments/prometheus/detail?namespace=url-namespace',
    ])
    expect(testState.scope.setClusterId).toHaveBeenCalledWith('url-cluster')
    expect(testState.scope.setNamespace).toHaveBeenCalledWith('url-namespace')
    expect(requestedPaths().some((path) => path.includes('/metrics?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/events?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/yaml?'))).toBe(false)
    expect(requestedPaths().some((path) => path.includes('/workloads/pods?'))).toBe(false)
    expect(container.textContent).toContain('prometheus-0')
    expect(container.textContent).toContain('Service 选择器命中')

    await act(async () => clickTab(container, '指标'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/metrics?namespace=url-namespace'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="metrics-panel"]')).not.toBeNull()

    await act(async () => clickTab(container, '事件'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/events?namespace=url-namespace'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="events-panel"]')).not.toBeNull()

    await act(async () => clickTab(container, 'YAML'))
    await flushAsyncWork()
    expect(requestedPaths().some((path) => path.includes('/yaml?namespace=url-namespace'))).toBe(
      true,
    )
    expect(container.querySelector('[data-testid="yaml-editor"]')).not.toBeNull()
  })

  it('paginates revisions numerically with the current marker and expandable images', async () => {
    testState.history = [9, 10, 2, 8, 11, 1, 12].map((revision) => ({
      name: `prometheus-rs-${revision}`,
      namespace: 'monitoring',
      revision: String(revision),
      replicas: revision === 12 ? 1 : 0,
      readyReplicas: revision === 12 ? 1 : 0,
      images: [`registry.example/prometheus:v${revision}`, 'registry.example/sidecar:v1'],
      createdAt: '2026-01-01T00:00:00Z',
    }))
    const container = await renderDetail()
    const section = container.querySelector<HTMLElement>('.soha-rollout-history-section')!
    const visibleRevisions = () =>
      Array.from(section.querySelectorAll('.soha-rollout-history-revision')).map(
        (item) => item.textContent,
      )
    expect(visibleRevisions()).toEqual(['版本 12', '版本 11', '版本 10'])
    expect(section.textContent).toContain('共 7 个版本')
    expect(section.querySelectorAll('[role="listitem"]')).toHaveLength(3)
    expect(section.querySelector('[role="listitem"]')?.textContent).toContain('当前版本')
    const images = section.querySelector('details')!
    expect(images.open).toBe(false)
    await act(async () => images.querySelector('summary')!.click())
    expect(images.open).toBe(true)
    expect(images.querySelectorAll('li')).toHaveLength(2)
    expect(images.textContent).toContain('registry.example/sidecar:v1')

    const next = () =>
      section.querySelector<HTMLButtonElement>('.ant-pagination-next button')!.click()
    await act(async () => next())
    expect(visibleRevisions()).toEqual(['版本 9', '版本 8', '版本 2'])
    expect(section.textContent).not.toContain('当前版本')
    await act(async () => next())
    expect(visibleRevisions()).toEqual(['版本 1'])
    expect(section.querySelector('.ant-pagination-next')?.getAttribute('aria-disabled')).toBe(
      'true',
    )
    await act(async () =>
      section.querySelector<HTMLButtonElement>('.ant-pagination-prev button')!.click(),
    )
    expect(visibleRevisions()).toEqual(['版本 9', '版本 8', '版本 2'])
    expect(apiGetMock.mock.calls.filter(([path]) => path.includes('/rollouts?'))).toHaveLength(1)
    expect(testState.history.map((item) => item.revision)).toEqual([
      '9',
      '10',
      '2',
      '8',
      '11',
      '1',
      '12',
    ])
  })

  it('distinguishes empty history from a failed history request', async () => {
    testState.historyError = true
    const container = await renderDetail()
    expect(container.textContent).toContain('版本历史加载失败')
    expect(container.textContent).not.toContain('暂无滚动历史')
    expect(container.querySelector('.soha-rollout-history-pagination')).toBeNull()
  })

  it('keeps Pod facts together and preserves the detail cluster and namespace when navigating', async () => {
    const container = await renderDetail()
    const row = container.querySelector('.soha-related-pod-cards [role="listitem"]')!
    expect(row.textContent).toContain('Running')
    const facts = Object.fromEntries(
      Array.from(row.querySelectorAll('dl > div')).map((item) => [
        item.querySelector('dt')?.textContent,
        item.querySelector('dd')?.textContent,
      ]),
    )
    expect(facts).toMatchObject({
      命名空间: 'monitoring',
      节点: 'worker-a',
      'Pod IP': '10.20.0.1',
      就绪: '1/1',
      重启: '0',
    })
    await act(async () => row.querySelector<HTMLButtonElement>('.soha-related-pod-link')!.click())
    expect(container.querySelector('[data-testid="destination"]')?.textContent).toBe(
      '/workloads/pods/prometheus-0?clusterId=url-cluster&namespace=url-namespace',
    )
  })
})
