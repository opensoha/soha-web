/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { ComputeOverviewPage } from './page'

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: vi.fn(),
}))
vi.mock('@/features/copilot', () => ({ useAIPageContext: vi.fn() }))

const roots: Array<ReturnType<typeof createRoot>> = []

function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(<MemoryRouter>{node}</MemoryRouter>))
  return container
}

afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('compute overview page', () => {
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
            { code: 'agent_waiting', severity: 'warning', summary: '1 台主机等待 Agent' },
          ],
          providerHealth: [
            {
              domain: 'virtualization',
              providerKey: 'pve',
              status: 'degraded',
              generation: 4,
            },
          ],
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
    expect(text).toContain('资源接入')
    expect(text).toContain('任务运行')
    expect(text).toContain('运行健康')
    expect(text).toContain('Provider 健康')
    expect(text).toContain('pve')
    expect(container.querySelector('.soha-overview-page')).not.toBeNull()
    expect(container.querySelectorAll('.soha-overview-metric-card')).toHaveLength(4)
    expect(container.querySelector('.soha-compute-section')).toBeNull()
  })
})
