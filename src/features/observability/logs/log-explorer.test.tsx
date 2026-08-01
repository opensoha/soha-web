/** @vitest-environment jsdom */

import { act, useState } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogExplorer } from './log-explorer'

const apiMocks = vi.hoisted(() => ({
  queryLogs: vi.fn(),
  issueLogStreamTicket: vi.fn(),
  buildLogStreamURL: vi.fn(() => 'ws://soha.local/logs?stream_ticket=ticket-1'),
  logTargetKey: vi.fn((target: { kind: string }) => JSON.stringify(target)),
}))

vi.mock('./api', () => apiMocks)
vi.mock('@/utils/download', () => ({ downloadText: vi.fn() }))
vi.mock('@/features/auth', () => ({
  hasPermission: () => false,
  usePermissionSnapshot: () => ({ data: { data: { permissionKeys: [] } } }),
}))

class WebSocketMock {
  static instances: WebSocketMock[] = []
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    WebSocketMock.instances.push(this)
  }

  close() {
    this.onclose?.()
  }
}

const roots: Root[] = []

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', WebSocketMock)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  WebSocketMock.instances = []
  apiMocks.queryLogs.mockResolvedValue({
    entries: [
      {
        timestamp: '2026-07-31T02:00:00Z',
        message: 'server ready',
        source: { domain: 'kubernetes', podName: 'api-0', containerName: 'api' },
        sourceMode: 'runtime',
      },
    ],
    partial: false,
    truncated: false,
    scopeRestricted: false,
    coverage: { resolvedSources: 1, successfulSources: 1, failedSources: 0 },
  })
  apiMocks.issueLogStreamTicket.mockResolvedValue({
    ticket: 'ticket-1',
    expiresAt: '2026-07-31T02:01:00Z',
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function renderExplorer(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            {element}
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (client.isFetching() === 0 && WebSocketMock.instances.length > 0) break
  }
  return container
}

describe('LogExplorer', () => {
  it('loads an authorized snapshot and opens a query-bound live stream', async () => {
    const container = await renderExplorer(
      <LogExplorer
        autoStart
        clusterId="cluster-a"
        embedded
        namespace="apps"
        preset={{ workloadKind: 'Deployment', workloadName: 'api' }}
      />,
    )

    expect(container.textContent).toContain('server ready')
    expect(apiMocks.queryLogs).toHaveBeenCalledOnce()
    expect(apiMocks.issueLogStreamTicket).toHaveBeenCalledOnce()
    expect(WebSocketMock.instances[0]?.url).toContain('stream_ticket=ticket-1')
    expect(container.textContent).toContain('在日志中心打开')
    expect(container.textContent).not.toContain('Live')
    expect(container.textContent).not.toContain('History')

    await act(async () => {
      WebSocketMock.instances[0]?.onopen?.()
      WebSocketMock.instances[0]?.onmessage?.({
        data: JSON.stringify({
          type: 'entry',
          entry: {
            timestamp: '2026-07-31T02:00:01Z',
            message: 'request handled',
            source: { domain: 'kubernetes', podName: 'api-1', containerName: 'api' },
            sourceMode: 'runtime',
          },
        }),
      })
      await Promise.resolve()
    })
    expect(container.textContent).toContain('request handled')

    const stop = container.querySelector<HTMLButtonElement>('[aria-label="停止实时日志"]')
    expect(stop).not.toBeNull()
    await act(async () => stop?.click())
    expect(container.textContent).toContain('实时会话已手动停止')
  })

  it('queries durable history without opening a live stream', async () => {
    apiMocks.queryLogs.mockResolvedValueOnce({
      entries: [
        {
          timestamp: '2026-07-31T01:00:00Z',
          message: 'historical entry',
          source: { domain: 'kubernetes', podName: 'api-0', containerName: 'api' },
          sourceMode: 'durable',
        },
      ],
      nextCursor: 'next-page',
      partial: false,
      truncated: true,
      scopeRestricted: false,
    })
    const container = await renderExplorer(
      <LogExplorer
        clusterId="cluster-a"
        namespace="apps"
        preset={{ podNames: ['api-0'], containers: ['api'], text: 'timeout' }}
      />,
    )
    expect(container.textContent).not.toContain('Live')
    expect(container.textContent).not.toContain('History')
    expect(container.textContent).toContain('SohaQL')
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="SohaQL 查询语句"]')?.value).toBe(
      '{pod="api-0", container="api"} |= "timeout"',
    )
    expect(container.textContent).not.toContain('工作负载类型')

    const submit = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('查询日志'),
    )
    await act(async () => {
      submit?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    for (
      let attempt = 0;
      attempt < 20 && !container.textContent?.includes('historical entry');
      attempt += 1
    ) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }

    expect(container.textContent).toContain('historical entry')
    expect(apiMocks.queryLogs).toHaveBeenCalledOnce()
    expect(apiMocks.queryLogs.mock.calls[0]?.[1]).toMatchObject({
      sourceMode: 'durable',
      selector: { namespace: 'apps', podNames: ['api-0'], containers: ['api'] },
      direction: 'backward',
      text: 'timeout',
    })
    expect(apiMocks.issueLogStreamTicket).not.toHaveBeenCalled()
  })

  it('switches the standalone query editor to the visual filter builder', async () => {
    const container = await renderExplorer(
      <LogExplorer
        clusterId="cluster-a"
        namespace="apps"
        preset={{ workloadKind: 'Deployment', workloadName: 'api' }}
      />,
    )
    const builder = Array.from(container.querySelectorAll<HTMLElement>('.ant-segmented-item')).find(
      (item) => item.textContent?.includes('筛选器'),
    )

    expect(builder).toBeDefined()
    await act(async () => builder?.click())

    expect(container.textContent).toContain('工作负载类型')
    expect(container.textContent).toContain('工作负载名称')
    expect(container.querySelector('[aria-label="SohaQL 查询语句"]')).toBeNull()
  })

  it('updates the query editor when an in-place deep link changes', async () => {
    function Harness() {
      const [podName, setPodName] = useState('api-0')
      return (
        <>
          <button onClick={() => setPodName('api-1')}>切换深链</button>
          <LogExplorer clusterId="cluster-a" namespace="apps" preset={{ podNames: [podName] }} />
        </>
      )
    }

    const container = await renderExplorer(<Harness />)
    const query = () =>
      container.querySelector<HTMLTextAreaElement>('[aria-label="SohaQL 查询语句"]')

    expect(query()?.value).toBe('{pod="api-0"}')
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === '切换深链')
        ?.click()
    })
    expect(query()?.value).toBe('{pod="api-1"}')
  })

  it('opens the log center with the current embedded filters', async () => {
    const container = await renderExplorer(
      <LogExplorer
        clusterId="cluster-a"
        embedded
        namespace="apps"
        preset={{ podNames: ['api-0'] }}
      />,
    )
    const textFilter = container.querySelector<HTMLInputElement>(
      'input[placeholder="服务端文本匹配"]',
    )

    await act(async () => {
      if (textFilter) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          textFilter,
          'timeout',
        )
      }
      textFilter?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('在日志中心打开'))
        ?.click()
    })

    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain(
      '/monitoring-workbench/logs?cluster=cluster-a&namespace=apps&text=timeout&range=900&tail=200&allContainers=true&pod=api-0',
    )
  })

  it('uses the shared explorer for a Docker project service', async () => {
    const container = await renderExplorer(
      <LogExplorer
        autoStart
        embedded
        target={{ kind: 'docker', projectId: 'project-1', serviceName: 'api' }}
      />,
    )

    expect(apiMocks.queryLogs).toHaveBeenCalledWith(
      { kind: 'docker', projectId: 'project-1', serviceName: 'api' },
      expect.objectContaining({ selector: { dockerService: 'api' }, sourceMode: 'runtime' }),
      expect.any(AbortSignal),
    )
    expect(apiMocks.issueLogStreamTicket).toHaveBeenCalled()
    expect(container.textContent).not.toContain('工作负载类型')
    expect(container.textContent).not.toContain('History')
  })

  it('queries delivery history without forcing the default namespace', async () => {
    const target = {
      kind: 'delivery' as const,
      applicationId: 'app-1',
      environmentId: 'binding-1',
      namespace: '',
    }
    const container = await renderExplorer(
      <LogExplorer target={target} />,
    )
    const submit = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('查询日志'),
    )

    await act(async () => {
      submit?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(apiMocks.queryLogs).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        sourceMode: 'durable',
        selector: expect.objectContaining({ namespace: '' }),
      }),
      expect.any(AbortSignal),
    )
    expect(apiMocks.issueLogStreamTicket).not.toHaveBeenCalled()
  })
})
