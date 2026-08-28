/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { I18nProvider } from '@/i18n'
import { usePreferencesStore } from '@/stores/preferences-store'
import { ComputeOverviewPage } from './page'

const testState = vi.hoisted(() => ({
  permissionKeys: [
    'virtualization.overview.view',
    'virtualization.vms.view',
    'virtualization.clusters.view',
    'virtualization.operations.view',
    'docker.overview.view',
    'docker.hosts.view',
    'docker.projects.view',
  ],
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: vi.fn(),
}))
vi.mock('@/features/copilot', () => ({ useAIPageContext: vi.fn() }))
vi.mock('./provider-instances-panel', () => ({
  ProviderInstancesPanel: ({
    canDiscover,
    canTest,
    localeCode,
  }: {
    canDiscover: boolean
    canTest: boolean
    localeCode: 'zh_CN' | 'en_US'
  }) => (
    <div data-can-discover={String(canDiscover)} data-can-test={String(canTest)}>
      {localeCode === 'zh_CN' ? '提供方实例' : 'Provider instances'}
    </div>
  ),
}))
vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  usePermissionSnapshot: () => ({
    data: { data: { permissionKeys: testState.permissionKeys } },
  }),
}))

const roots: Array<ReturnType<typeof createRoot>> = []

function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() =>
    root.render(
      <I18nProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </I18nProvider>,
    ),
  )
  return container
}

afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
  testState.permissionKeys = [
    'virtualization.overview.view',
    'virtualization.vms.view',
    'virtualization.clusters.view',
    'virtualization.operations.view',
    'docker.overview.view',
    'docker.hosts.view',
    'docker.projects.view',
  ]
  usePreferencesStore.setState({ localeCode: 'zh_CN' })
})

describe('compute overview page', () => {
  it('loads virtualization data for a storage-only identity', () => {
    testState.permissionKeys = ['virtualization.storage.view']
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as never)

    render(<ComputeOverviewPage />)

    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })

  it('exposes provider actions only for their exact permissions', () => {
    testState.permissionKeys = [
      'virtualization.clusters.view',
      'virtualization.clusters.test',
      'virtualization.sync.sync',
    ]
    vi.mocked(useQuery).mockReturnValue({
      data: { data: { attention: [], providerHealth: [], partial: false, warnings: [] } },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never)

    const container = render(<ComputeOverviewPage />)
    const panel = container.querySelector('[data-can-test]')

    expect(panel?.getAttribute('data-can-test')).toBe('true')
    expect(panel?.getAttribute('data-can-discover')).toBe('true')
  })

  it('retries the overview query from its error state', () => {
    const refetch = vi.fn()
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch,
    } as never)

    const container = render(<ComputeOverviewPage />)
    const retry = container.querySelector<HTMLButtonElement>(
      'button[aria-label="重试加载计算资源总览"]',
    )

    expect(retry).toBeDefined()
    act(() => retry?.click())
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('keeps available sections visible when another section is omitted or degraded', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        data: {
          virtualization: {
            status: 'degraded',
            summary: {
              connectionsTotal: 2,
              connectionsHealthy: 1,
              connectionsDegraded: 1,
              connectionsUnsynced: 0,
              vmsTotal: 8,
              vmsRunning: 6,
              vmsStopped: 2,
              vmsError: 0,
            },
          },
          tasks: {
            status: 'ok',
            summary: { queued: 1, running: 2, failed: 0 },
          },
          attention: [
            {
              code: 'runtime_host_unavailable',
              severity: 'warning',
              summary: 'Container runtime host needs attention',
              resources: [
                {
                  domain: 'container_runtime',
                  kind: 'runtime_host',
                  id: 'runtime-1',
                  displayName: 'runtime-edge-1',
                },
              ],
            },
          ],
          providerHealth: [
            {
              domain: 'virtualization',
              providerKey: 'pve',
              status: 'degraded',
              generation: 4,
              checkedAt: '2026-08-23T12:00:00Z',
            },
          ],
          generatedAt: '2026-08-23T12:00:00Z',
          freshness: { status: 'fresh', observedAt: '2026-08-23T12:00:00Z' },
          partial: true,
          warnings: [{ code: 'runtime_unavailable', message: '运行时数据暂不可用' }],
        },
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never)

    const container = render(<ComputeOverviewPage />)
    const text = container.textContent ?? ''

    expect(container.querySelector('.soha-management-detail-header')).toBeNull()
    expect(text).not.toContain('查看虚拟化、主机、容器与任务的资源规模')
    expect(text).toContain('部分资源暂不可用')
    expect(text).toContain('运行时数据暂不可用')
    expect(text).toContain('虚拟化')
    expect(text).toContain('接入状态')
    expect(text).toContain('任务运行')
    expect(text).not.toContain('运行健康')
    expect(text).toContain('提供方健康')
    expect(text).toContain('pve')
    expect(text).toContain('服务降级，请检查连接状态')
    expect(text).toContain('最近检查')
    expect(text).not.toContain('代际')
    expect(text).not.toContain('Generation')
    expect(text).toContain('runtime-edge-1')
    expect(text).toContain('运行时主机需要关注')
    expect(text).not.toContain('影响 1 个资源')
    expect(container.querySelector('a[href="/compute/runtimes/hosts/runtime-1"]')).not.toBeNull()
    expect(container.querySelector('a[href="/compute/virtualization/clusters"]')).not.toBeNull()
    expect(text).not.toContain('数据时间')
    expect(container.querySelector('.soha-compute-overview-freshness')).toBeNull()
    expect(text).not.toContain('统一查看虚拟化连接、Agent 主机与运行时主机')
    expect(text).not.toContain('集中查看同步、构建与资源操作的执行状态')
    expect(text).not.toContain('优先处理不可用资源、接入异常与失败任务')
    expect(text).not.toContain('查看已加载计算提供方的激活代际与健康状态')
    expect(container.querySelector('.soha-overview-page')).not.toBeNull()
    expect(container.querySelectorAll('.soha-overview-metric-card')).toHaveLength(4)
    expect(
      container.querySelector('a[href="/compute/virtualization/vms"] .soha-overview-metric-card'),
    ).not.toBeNull()
    expect(
      container.querySelector('a[href="/compute/tasks/operations"] .soha-overview-metric-card'),
    ).not.toBeNull()
    expect(container.querySelector('a[href^="/compute/access"]')).toBeNull()
    expect(container.querySelector('a[href="/compute/virtualization/clusters"]')).not.toBeNull()
    expect(container.querySelector('.soha-compute-section')).toBeNull()
    expect(
      container.querySelectorAll('.soha-overview-runtime-layout > .soha-overview-runtime-card'),
    ).toHaveLength(2)
  })

  it('does not render virtualization destinations for a Docker-only identity', () => {
    testState.permissionKeys = [
      'docker.overview.view',
      'docker.hosts.view',
      'docker.projects.view',
      'docker.operations.view',
    ]
    vi.mocked(useQuery).mockReturnValue({
      data: {
        data: {
          tasks: { status: 'ok', summary: { queued: 1, running: 2, failed: 0 } },
          attention: [],
          providerHealth: [],
          partial: false,
          warnings: [],
        },
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never)

    const container = render(<ComputeOverviewPage />)

    expect(container.querySelector('a[href^="/compute/virtualization"]')).toBeNull()
    expect(container.querySelector('a[href="/compute/runtimes/hosts"]')).not.toBeNull()
    expect(container.querySelector('a[href="/compute/tasks/operations"]')).not.toBeNull()
  })

  it('renders the compute overview in English without Chinese UI labels', () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    vi.mocked(useQuery).mockReturnValue({
      data: {
        data: {
          virtualization: {
            status: 'ok',
            summary: {
              connectionsTotal: 1,
              connectionsHealthy: 1,
              vmsTotal: 2,
              vmsRunning: 2,
              vmsStopped: 0,
            },
          },
          runtimes: { status: 'ok', summary: { total: 1, available: 1, error: 0 } },
          runtimeWorkloads: { status: 'ok', summary: { projects: 1, services: 2, containers: 2 } },
          tasks: { status: 'ok', summary: { queued: 1, running: 1, failed: 0 } },
          attention: [],
          providerHealth: [],
          partial: false,
          warnings: [],
        },
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never)

    const text = render(<ComputeOverviewPage />).textContent ?? ''

    expect(text).toContain('Virtual machines')
    expect(text).toContain('Access status')
    expect(text).toContain('Task activity')
    expect(text).toContain('Needs attention')
    expect(text).not.toContain('虚拟机')
    expect(text).not.toContain('接入状态')
    expect(text).not.toContain('任务运行')
    expect(text).not.toContain('需要关注')
  })
})
