/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { podQueries } from '../workloads/pods/queries'
import {
  RealtimeSessionDockProvider,
  RealtimeSessionDockTrigger,
  useRealtimeSessionDock,
} from './session-dock'

const { getPodDetailMock } = vi.hoisted(() => ({ getPodDetailMock: vi.fn() }))

vi.mock('../workloads/pods/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../workloads/pods/api')>()),
  getPodDetail: getPodDetailMock,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN' as const,
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@/components/pod-terminal', () => ({
  PodTerminal: ({
    clusterId,
    container,
    podName,
    shell,
    toolbarContent,
  }: {
    clusterId: string
    container?: string
    podName: string
    shell?: string
    toolbarContent?: ReactNode
  }) => (
    <div
      data-container={container ?? ''}
      data-shell={shell ?? ''}
      data-testid={`terminal:${clusterId}:${podName}`}
    >
      {toolbarContent}
      terminal
    </div>
  ),
}))

vi.mock('@/components/pod-log-viewer', () => ({
  PodLogViewer: ({ clusterId, podName }: { clusterId: string; podName: string }) => (
    <div data-testid={`logs:${clusterId}:${podName}`}>logs</div>
  ),
}))

function SessionHarness() {
  const { openSession } = useRealtimeSessionDock()
  return (
    <>
      <button
        type="button"
        onClick={() =>
          openSession({
            clusterId: 'cluster-a',
            container: 'api',
            kind: 'terminal',
            namespace: 'team-a',
            podName: 'pod-a',
            shell: '/bin/sh',
          })
        }
      >
        terminal-a
      </button>
      <button
        type="button"
        onClick={() =>
          openSession({
            clusterId: 'cluster-a',
            container: 'worker',
            kind: 'logs',
            namespace: 'team-a',
            podName: 'pod-b',
          })
        }
      >
        logs-a
      </button>
      <button
        type="button"
        onClick={() =>
          openSession({
            clusterId: 'cluster-b',
            kind: 'terminal',
            namespace: 'team-b',
            podName: 'pod-c',
          })
        }
      >
        terminal-b
      </button>
    </>
  )
}

const roots: Root[] = []

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
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
})

beforeEach(() => {
  getPodDetailMock.mockReset()
  usePlatformScopeStore.setState({ clusterId: 'cluster-a', namespace: 'team-a' })
})

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount())
  })
  document.body.innerHTML = ''
})

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function click(element: Element | null | undefined) {
  expect(element).not.toBeNull()
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await flushAsyncWork()
  await flushAsyncWork()
}

async function selectOption(select: Element | null | undefined, optionLabel: string) {
  expect(select).not.toBeNull()
  await act(async () => {
    select
      ?.querySelector('.ant-select-content')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
  await flushAsyncWork()
  const option = Array.from(document.body.querySelectorAll('.ant-select-item-option')).find(
    (item) => item.textContent === optionLabel,
  )
  expect(option).not.toBeUndefined()
  await act(async () => {
    option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await flushAsyncWork()
}

function pointerEvent(type: string, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function renderDock({ preloadPodDetails = true } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (preloadPodDetails) {
    queryClient.setQueryData(
      podQueries.detail({ clusterId: 'cluster-a', namespace: 'team-a' }, 'pod-a').queryKey,
      {
        containers: [
          { image: 'api:latest', name: 'api', ready: true, restartCount: 0 },
          { image: 'sidecar:latest', name: 'sidecar', ready: true, restartCount: 0 },
        ],
        name: 'pod-a',
        namespace: 'team-a',
        phase: 'Running',
      },
    )
    queryClient.setQueryData(
      podQueries.detail({ clusterId: 'cluster-b', namespace: 'team-b' }, 'pod-c').queryKey,
      { containers: [], name: 'pod-c', namespace: 'team-b', phase: 'Running' },
    )
  }
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <RealtimeSessionDockProvider visible>
          <RealtimeSessionDockTrigger />
          <SessionHarness />
        </RealtimeSessionDockProvider>
      </QueryClientProvider>,
    )
  })
  return container
}

describe('realtime session dock', () => {
  it('opens the empty dock on the first trigger click', async () => {
    const container = await renderDock()

    await click(container.querySelector('.soha-header-realtime-sessions'))
    await act(async () => {
      await vi.dynamicImportSettled()
    })

    const dock = container.querySelector<HTMLElement>('section[aria-label="实时会话"]')
    expect(dock?.hidden).toBe(false)
    expect(dock?.textContent).toContain('当前集群暂无实时会话')
  })

  it('mounts only the visible active session', async () => {
    const container = await renderDock()
    const buttonByText = (value: string) =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes(value),
      )

    await click(buttonByText('terminal-a'))
    await click(buttonByText('logs-a'))
    await flushAsyncWork()
    await flushAsyncWork()

    const dock = container.querySelector<HTMLElement>('[aria-label="实时会话"]')
    const clusterA = container.querySelector<HTMLElement>('[data-cluster-id="cluster-a"]')
    expect(dock?.hidden).toBe(false)
    expect(clusterA?.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(container.querySelector('[data-testid="terminal:cluster-a:pod-a"]')).toBeNull()
    expect(container.querySelector('[data-testid="logs:cluster-a:pod-b"]')).not.toBeNull()

    const resizeHandle = container.querySelector('[aria-label="调整实时会话高度"]')
    vi.spyOn(dock as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      ...dock?.getBoundingClientRect(),
      height: 400,
    } as DOMRect)
    await act(async () => {
      resizeHandle?.dispatchEvent(pointerEvent('pointerdown', 400))
      window.dispatchEvent(pointerEvent('pointermove', 300))
      window.dispatchEvent(pointerEvent('pointerup', 300))
    })
    expect(dock?.style.getPropertyValue('--soha-realtime-session-height')).toBe('500px')

    await act(async () => {
      resizeHandle?.dispatchEvent(pointerEvent('pointerdown', 300))
      resizeHandle?.dispatchEvent(pointerEvent('lostpointercapture', 300))
      window.dispatchEvent(pointerEvent('pointermove', 250))
    })
    expect(dock?.style.getPropertyValue('--soha-realtime-session-height')).toBe('500px')

    await act(async () => {
      resizeHandle?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }))
    })
    expect(dock?.style.getPropertyValue('--soha-realtime-session-height')).toBe('532px')

    await click(container.querySelector('[aria-label="最大化实时会话"]'))
    expect(dock?.classList.contains('is-maximized')).toBe(true)

    await click(container.querySelector('[aria-label="收起实时会话"]'))
    expect(container.querySelector('[aria-label="实时会话"]')).toBeNull()
    expect(container.querySelector('[data-testid="terminal:cluster-a:pod-a"]')).toBeNull()
    expect(container.querySelector('[data-testid="logs:cluster-a:pod-b"]')).toBeNull()

    await click(container.querySelector('.soha-header-realtime-sessions'))
    await act(async () => {
      usePlatformScopeStore.getState().setClusterId('cluster-b')
    })
    await flushAsyncWork()
    expect(container.querySelector('[data-cluster-id="cluster-a"]')).toBeNull()
    expect(container.querySelector('[data-testid="logs:cluster-a:pod-b"]')).toBeNull()

    await click(buttonByText('terminal-b'))
    const clusterB = container.querySelector<HTMLElement>('[data-cluster-id="cluster-b"]')
    expect(clusterB?.hidden).toBe(false)
    expect(container.querySelector('[data-testid="terminal:cluster-b:pod-c"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="terminal:cluster-a:pod-a"]')).toBeNull()

    await act(async () => {
      usePlatformScopeStore.getState().setClusterId('cluster-a')
    })
    await flushAsyncWork()
    const activeClusterA = container.querySelector<HTMLElement>('[data-cluster-id="cluster-a"]')
    const removeButtons = activeClusterA?.querySelectorAll('.ant-tabs-tab-remove')
    await click(removeButtons?.item(1))
    expect(container.querySelector('[data-testid="logs:cluster-a:pod-b"]')).toBeNull()
    expect(container.querySelector('[data-testid="terminal:cluster-a:pod-a"]')).not.toBeNull()
  })

  it('switches a terminal container and shell in the current tab', async () => {
    const container = await renderDock()
    const terminalButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('terminal-a'),
    )

    await click(terminalButton)
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await flushAsyncWork()

    let terminal = container.querySelector<HTMLElement>('[data-testid="terminal:cluster-a:pod-a"]')
    expect(terminal?.textContent).toContain('容器:')
    expect(terminal?.textContent).toContain('Shell:')
    expect(terminal?.dataset.container).toBe('api')
    expect(terminal?.dataset.shell).toBe('/bin/sh')

    let selects = terminal?.querySelectorAll('.ant-select')
    expect(selects).toHaveLength(2)
    await selectOption(selects?.item(0), 'sidecar')

    terminal = container.querySelector<HTMLElement>('[data-testid="terminal:cluster-a:pod-a"]')
    expect(terminal?.dataset.container).toBe('sidecar')
    expect(container.querySelectorAll('[data-cluster-id="cluster-a"] [role="tab"]')).toHaveLength(1)

    selects = terminal?.querySelectorAll('.ant-select')
    await selectOption(selects?.item(1), '/bin/ash')
    terminal = container.querySelector<HTMLElement>('[data-testid="terminal:cluster-a:pod-a"]')
    expect(terminal?.dataset.shell).toBe('/bin/ash')
    expect(container.querySelectorAll('[data-cluster-id="cluster-a"] [role="tab"]')).toHaveLength(1)
  })

  it('shows and retries container loading errors', async () => {
    getPodDetailMock.mockRejectedValue(new Error('unavailable'))
    const container = await renderDock({ preloadPodDetails: false })
    const terminalButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('terminal-a'),
    )

    await click(terminalButton)
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await flushAsyncWork()
    await flushAsyncWork()

    const terminal = container.querySelector<HTMLElement>(
      '[data-testid="terminal:cluster-a:pod-a"]',
    )
    expect(terminal?.textContent).toContain('容器列表加载失败')
    const retryButton = terminal?.querySelector('[aria-label="重新加载容器"]')
    expect(retryButton).not.toBeNull()
    expect(getPodDetailMock).toHaveBeenCalledTimes(1)

    await click(retryButton)
    expect(getPodDetailMock).toHaveBeenCalledTimes(2)
  })
})
