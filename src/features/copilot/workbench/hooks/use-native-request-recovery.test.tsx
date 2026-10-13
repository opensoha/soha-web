/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativeRequestRecovery } from './use-native-request-recovery'
import { workbenchApi } from '../api'
import { workbenchKeys } from '../keys'
import {
  pendingNativeRequests,
  rememberNativeRequest,
  requestNativeCancellation,
} from '../native-request-journal'
import type { WorkbenchAgentRun } from '../types'

const run: WorkbenchAgentRun = {
  id: 'late-run',
  sessionId: 'session-1',
  providerId: 'internal',
  providerKind: 'native',
  capabilityId: 'chat',
  createdBy: 'owner-1',
  status: 'running',
  timeoutSeconds: 300,
  queuedAt: '2026-10-13T00:00:00Z',
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
}
const scope = (owner = 'owner-1') => JSON.stringify([workbenchApi.serviceScope(), owner])
let client: QueryClient
let root: Root
let recovery: ReturnType<typeof useNativeRequestRecovery>
function Probe({ owner, session, enabled }: { owner: string; session: string; enabled: boolean }) {
  recovery = useNativeRequestRecovery(owner, session, enabled)
  return null
}
async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}
async function mount(owner = 'owner-1', session = 'session-1', enabled = true) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe owner={owner} session={session} enabled={enabled} />
      </QueryClientProvider>,
    )
    await flush()
  })
  await act(flush)
}
async function recheck() {
  await act(async () => {
    recovery.recheck()
    await flush()
  })
  await act(flush)
}

describe('Native request cancellation recovery', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    localStorage.clear()
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    root = createRoot(document.createElement('div'))
    vi.spyOn(workbenchApi.agentRuns, 'findRequest').mockRejectedValue(new Error('HTTP 404'))
    vi.spyOn(workbenchApi.agentRuns, 'cancel').mockResolvedValue({
      data: { ...run, status: 'canceled', output: { cancellationPending: true } },
    })
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    client.clear()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('retains stop intent across an absent creation, retries failures, and waits for cancellation confirmation', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    await mount()
    expect(recovery.canRetry('request-1')).toBe(true)
    expect(recovery.canRetry('new-request')).toBe(false)
    await act(async () => {
      recovery.cancel('session-1')
      recovery.acknowledge('session-1', 'request-1')
      await flush()
    })
    expect(recovery.pending).toBe(true)
    expect(recovery.cancelling).toBe(true)
    expect(recovery.canRetry('request-1')).toBe(false)
    expect(workbenchApi.agentRuns.cancel).not.toHaveBeenCalled()
    vi.mocked(workbenchApi.agentRuns.findRequest).mockResolvedValue({ data: run })
    vi.mocked(workbenchApi.agentRuns.cancel).mockRejectedValueOnce(new Error('offline'))
    await recheck()
    expect(recovery.error).toContain('offline')
    expect(pendingNativeRequests(scope(), 'session-1')).toEqual(['request-1'])
    await recheck()
    expect(workbenchApi.agentRuns.cancel).toHaveBeenCalledTimes(2)
    expect(recovery.pending).toBe(true)
    vi.mocked(workbenchApi.agentRuns.findRequest).mockResolvedValue({
      data: { ...run, status: 'canceled', output: { cancellationPending: false } },
    })
    await recheck()
    expect(recovery.pending).toBe(false)
    expect(recovery.error).toBeUndefined()
    expect(workbenchApi.agentRuns.cancel).toHaveBeenCalledTimes(2)
  })

  it('recovers persisted cancellation in another session after reload and isolates owners', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    requestNativeCancellation(scope(), 'session-1')
    rememberNativeRequest(scope('owner-2'), 'session-2', 'request-2')
    requestNativeCancellation(scope('owner-2'), 'session-2')
    vi.mocked(workbenchApi.agentRuns.findRequest).mockResolvedValue({ data: run })
    vi.mocked(workbenchApi.agentRuns.cancel).mockResolvedValue({
      data: { ...run, status: 'canceled' },
    })
    await mount('owner-1', 'session-3')
    expect(workbenchApi.agentRuns.findRequest).toHaveBeenCalledWith('session-1', 'request-1')
    expect(workbenchApi.agentRuns.cancel).toHaveBeenCalledExactlyOnceWith('late-run')
    expect(pendingNativeRequests(scope(), 'session-1')).toEqual([])
    expect(pendingNativeRequests(scope('owner-2'), 'session-2')).toEqual(['request-2'])
  })

  it('does not overlap slow cancellations or apply late responses after an owner change', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    requestNativeCancellation(scope(), 'session-1')
    vi.mocked(workbenchApi.agentRuns.findRequest).mockResolvedValue({ data: run })
    let resolveCancel!: (value: { data: WorkbenchAgentRun }) => void
    vi.mocked(workbenchApi.agentRuns.cancel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve
        }),
    )
    await mount()
    await recheck()
    expect(workbenchApi.agentRuns.cancel).toHaveBeenCalledTimes(1)
    await mount('owner-2', 'session-2')
    client.removeQueries({ queryKey: workbenchKeys.agentRuns.session('session-1') })
    await act(async () => {
      resolveCancel({ data: { ...run, status: 'canceled' } })
      await flush()
    })
    expect(pendingNativeRequests(scope(), 'session-1')).toEqual(['request-1'])
    expect(client.getQueryData(workbenchKeys.agentRuns.session('session-1'))).toBeUndefined()
    expect(recovery.error).toBeUndefined()
  })

  it('does not dispatch cancellation when recovery is disabled', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    requestNativeCancellation(scope(), 'session-1')
    client.setQueryData(workbenchKeys.agentRuns.request(scope(), 'session-1', 'request-1'), {
      data: run,
    })
    await mount('owner-1', 'session-1', false)
    expect(workbenchApi.agentRuns.cancel).not.toHaveBeenCalled()
  })

  it('keeps a queued receipt stoppable after handoff and retries a failed stop after reload', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    vi.mocked(workbenchApi.agentRuns.findRequest).mockResolvedValue({
      data: { ...run, status: 'queued' },
    })
    await mount()
    expect(pendingNativeRequests(scope(), 'session-1')).toEqual(['request-1'])
    expect(workbenchApi.agentRuns.cancel).not.toHaveBeenCalled()
    vi.mocked(workbenchApi.agentRuns.cancel).mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      recovery.cancel('session-1')
      await flush()
    })
    await act(flush)
    expect(recovery.error).toContain('offline')
    await act(async () => root.unmount())
    client.clear()
    root = createRoot(document.createElement('div'))
    vi.mocked(workbenchApi.agentRuns.cancel).mockResolvedValue({
      data: { ...run, status: 'canceled' },
    })
    await mount()
    expect(workbenchApi.agentRuns.cancel).toHaveBeenCalledTimes(2)
    expect(pendingNativeRequests(scope(), 'session-1')).toEqual([])
  })

  it('keeps a storage failure visible until the user retries saving stop intent', async () => {
    rememberNativeRequest(scope(), 'session-1', 'request-1')
    await mount()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await act(async () => {
      expect(() => recovery.cancel('session-1')).toThrow('quota')
      await flush()
    })
    expect(recovery.error).toContain('停止意图保存失败')
    expect(recovery.pending).toBe(true)
    write.mockRestore()
    await act(async () => {
      recovery.cancel('session-1')
      await flush()
    })
    expect(recovery.error).toBeUndefined()
    expect(recovery.cancelling).toBe(true)
  })
})
