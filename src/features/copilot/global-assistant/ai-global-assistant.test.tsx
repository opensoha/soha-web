/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api-client'
import type { PermissionSnapshot } from '@/types'
import { GlobalAIAssistantProvider } from './ai-global-assistant-provider'
import { useAIGlobalAssistant, useAIPageContext } from './ai-context-provider'
import {
  encodeAIContextForElement,
  inferSelectionKind,
  sanitizeSelectionText,
  workbenchScopeFromAIContext,
  type AIPageContext,
} from './ai-context'
import { buildGlobalAssistantPrompt } from './ai-prompts'
import { clampFloatPosition, snapFloatPosition } from './draggable-float-shell'

vi.mock('@/services/api-client', () => ({
  api: {
    post: vi.fn(),
  },
}))

const permissionSnapshot: PermissionSnapshot = {
  permissionKeys: ['observe.ai.chat'],
  visibleMenuIds: [],
  visibleMenus: [],
}

const serviceContext: AIPageContext = {
  sourceWorkbench: 'platform',
  sourceRoute: '/network/services/payment-api?namespace=payments',
  sourceTitle: 'Service payment-api',
  entityKind: 'kubernetes.service',
  entityName: 'payment-api',
  clusterId: 'prod',
  namespace: 'payments',
  service: 'payment-api',
  timeRangeMinutes: 60,
  promptHint: '排查 Service 访问异常。',
}

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function Harness() {
  const assistant = useAIGlobalAssistant()
  useAIPageContext(serviceContext)

  return (
    <div className="soha-pro-content-host">
      <button
        type="button"
        onClick={() => {
          void assistant?.launchAssistant({ action: 'analyze-page' })
        }}
      >
        ask
      </button>
      <div
        data-testid="row-context"
        data-ai-context={encodeAIContextForElement({
          sourceWorkbench: 'platform',
          sourceRoute: '/workloads/pods/demo-pod?namespace=payments',
          sourceTitle: 'Pod demo-pod',
          entityKind: 'kubernetes.pod',
          entityName: 'demo-pod',
          clusterId: 'prod',
          namespace: 'payments',
          pod: 'demo-pod',
          timeRangeMinutes: 60,
        })}
      >
        demo-pod
      </div>
      <p data-testid="selectable-text">ERROR password=secret token=abc payment-api timeout</p>
      <input data-testid="plain-input" />
    </div>
  )
}

async function renderProvider() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/network/services/payment-api?namespace=payments']}>
          <AntdApp>
            <GlobalAIAssistantProvider permissionSnapshot={permissionSnapshot}>
              <Harness />
            </GlobalAIAssistantProvider>
          </AntdApp>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  await act(async () => {
    await Promise.resolve()
  })
  return container
}

function sseResponse(content: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        id: 'event-1',
        sessionId: 'session-global',
        sequence: 1,
        createdAt: '2026-07-06T00:00:00Z',
        type: 'message.done',
        role: 'assistant',
        messageId: 'message-ai',
        content,
      })}\n\n`))
      controller.close()
    },
  })
  return Promise.resolve(new Response(stream, { status: 200 }))
}

function mockSelection(anchorNode: Node, text: string) {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    anchorNode,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ left: 80, top: 80, width: 120, height: 20, right: 200, bottom: 100, x: 80, y: 80, toJSON: () => ({}) }),
      getClientRects: () => [{ left: 80, top: 80, width: 120, height: 20, right: 200, bottom: 100, x: 80, y: 80, toJSON: () => ({}) }],
    }),
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
  } as unknown as Selection)
}

describe('global AI assistant utilities', () => {
  it('sanitizes selected text and maps page context into Workbench scope', () => {
    expect(sanitizeSelectionText('Authorization: Bearer abc\npassword=secret')).toContain('[REDACTED]')
    expect(inferSelectionKind('ERROR failed to connect')).toBe('error')
    expect(workbenchScopeFromAIContext(serviceContext)).toEqual({
      clusterId: 'prod',
      namespace: 'payments',
      service: 'payment-api',
      timeRangeMinutes: 60,
    })
  })

  it('builds an explicit context prompt without relying on DOM scraping', () => {
    const prompt = buildGlobalAssistantPrompt('troubleshoot-selection', serviceContext, {
      kind: 'error',
      text: 'ERROR timeout',
    })

    expect(prompt).toContain('sourceWorkbench: platform')
    expect(prompt).toContain('service: payment-api')
    expect(prompt).toContain('选中内容类型: error')
    expect(prompt).toContain('高风险操作只给建议')
  })

  it('clamps and snaps draggable FloatButton positions', () => {
    expect(clampFloatPosition({ x: -20, y: 900 }, { width: 400, height: 300 }, { width: 48, height: 48 })).toEqual({
      x: 24,
      y: 228,
    })
    expect(snapFloatPosition({ x: 340, y: 120 }, { width: 400, height: 300 }, { width: 48, height: 48 })).toEqual({
      x: 328,
      y: 120,
      edge: 'right',
    })
  })
})

describe('GlobalAIAssistantProvider', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    class IntersectionObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock })
    Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IntersectionObserverMock })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: '',
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'session-global',
        title: 'Service payment-api',
        updatedAt: '2026-07-06T00:00:00Z',
        metadata: { mode: 'root_cause' },
      },
    })
    vi.spyOn(window, 'fetch').mockImplementation(() => sseResponse('已完成当前服务分析。'))
    window.localStorage.clear()
  })

  afterEach(() => {
    roots.forEach((root) => root.unmount())
    roots = []
    containers.forEach((container) => container.remove())
    containers = []
    vi.restoreAllMocks()
  })

  it('creates a Workbench session and renders streamed assistant output', async () => {
    const container = await renderProvider()
    const askButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'ask')
    expect(askButton).toBeTruthy()

    await act(async () => {
      askButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(api.post).toHaveBeenCalledWith('/copilot/sessions', expect.objectContaining({
      mode: 'root_cause',
      scope: expect.objectContaining({ clusterId: 'prod', namespace: 'payments', service: 'payment-api' }),
      tags: ['global-assistant'],
    }))
    expect(String(container.textContent)).toContain('已完成当前服务分析。')
  })

  it('shows a selection toolbar only after an explicit text selection', async () => {
    const container = await renderProvider()
    const selectable = container.querySelector('[data-testid="selectable-text"]')
    expect(selectable?.firstChild).toBeTruthy()
    mockSelection(selectable!.firstChild!, 'ERROR password=secret')

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(container.querySelector('[data-testid="soha-ai-selection-toolbar"]')).toBeTruthy()
    expect(window.fetch).not.toHaveBeenCalled()
  })

  it('does not intercept native context menus in inputs', async () => {
    const container = await renderProvider()
    const input = container.querySelector('[data-testid="plain-input"]')
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })

    input?.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(container.querySelector('[data-testid="soha-ai-context-menu"]')).toBeNull()
  })

  it('uses row-level AI context from the controlled context menu', async () => {
    const container = await renderProvider()
    const row = container.querySelector('[data-testid="row-context"]')
    vi.spyOn(window, 'getSelection').mockReturnValue(null)
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 80, clientY: 80 })

    await act(async () => {
      row?.dispatchEvent(event)
      await Promise.resolve()
    })

    expect(event.defaultPrevented).toBe(true)
    expect(container.querySelector('[data-testid="soha-ai-context-menu"]')).toBeTruthy()

    const troubleshootButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('AI 排查这个资源'),
    )
    expect(troubleshootButton).toBeTruthy()

    await act(async () => {
      troubleshootButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(api.post).toHaveBeenCalledWith('/copilot/sessions', expect.objectContaining({
      scope: expect.objectContaining({
        clusterId: 'prod',
        namespace: 'payments',
        pod: 'demo-pod',
      }),
    }))
  })
})
