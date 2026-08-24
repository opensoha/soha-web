/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertEventStreamSignal } from '@opensoha/contracts/gen/ts/sohaapi'
import { useAlertEventStream } from './use-alert-event-stream'

const withStreamTicket = vi.fn(async (url: URL | string) => String(url))

vi.mock('@/features/auth', () => ({
  buildSameOriginStreamURL: (path: string) => new URL(path, 'ws://localhost'),
  withStreamTicket: (url: URL | string) => withStreamTicket(url),
}))

class WebSocketMock {
  static instances: WebSocketMock[] = []
  static OPEN = 1
  readyState = WebSocketMock.OPEN
  onopen?: () => void
  onmessage?: (event: MessageEvent<string>) => void
  onclose?: () => void
  onerror?: () => void
  constructor(readonly url: string) {
    WebSocketMock.instances.push(this)
  }
  close() {}
}

function Probe({ onSignal }: { onSignal: (signal: AlertEventStreamSignal) => void }) {
  const stream = useAlertEventStream({ clusterId: 'cluster-a', onSignal })
  return <span>{stream.status}</span>
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

describe('alert event stream', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('WebSocket', WebSocketMock)
    WebSocketMock.instances = []
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('binds cluster scope and treats the initial reset as a live resync signal', async () => {
    const onSignal = vi.fn()
    await act(async () => root.render(<Probe onSignal={onSignal} />))
    await act(async () => Promise.resolve())
    const socket = WebSocketMock.instances[0]
    expect(socket?.url).toContain('/api/v1/alert-events/stream')
    expect(socket?.url).toContain('clusterId=cluster-a')

    await act(async () => socket?.onopen?.())
    expect(container.textContent).toBe('connecting')
    await act(async () =>
      socket?.onmessage?.({
        data: JSON.stringify({
          type: 'reset',
          observedAt: '2026-08-23T08:00:00Z',
          clusterId: 'cluster-a',
          resyncRequired: true,
        }),
      } as MessageEvent<string>),
    )
    expect(onSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'reset' }))
    expect(container.textContent).toBe('live')
  })
})
