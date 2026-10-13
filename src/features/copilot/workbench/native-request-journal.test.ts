/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  forgetNativeRequest,
  pendingNativeRequests,
  rememberNativeRequest,
  nativeRecoveryBatch,
  nativeCancellationRequested,
  pendingNativeCancellations,
  requestNativeCancellation,
} from './native-request-journal'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('Native request recovery journal', () => {
  it('keeps cancellation intent across retries and discovers it after switching sessions', () => {
    rememberNativeRequest('owner', 'session/one', 'request/one')
    rememberNativeRequest('other-owner', 'session/one', 'request/one')
    requestNativeCancellation('owner', 'session/one')
    rememberNativeRequest('owner', 'session/one', 'request/one')
    expect(nativeCancellationRequested('owner', 'session/one', 'request/one')).toBe(true)
    expect(pendingNativeCancellations('owner')).toEqual([
      { sessionId: 'session/one', requestId: 'request/one' },
    ])
    expect(pendingNativeCancellations('other-owner')).toEqual([])
    forgetNativeRequest('owner', 'session/one', 'request/one')
    expect(pendingNativeCancellations('owner')).toEqual([])
    expect(pendingNativeRequests('other-owner', 'session/one')).toEqual(['request/one'])
  })
  it('survives a reload and keeps concurrent entries without request contents', () => {
    rememberNativeRequest('service+user', 'session', 'one')
    rememberNativeRequest('service+user', 'session', 'two')
    expect(pendingNativeRequests('service+user', 'session')).toEqual(['one', 'two'])
    expect(
      [...Array(localStorage.length)].map((_, index) =>
        localStorage.getItem(localStorage.key(index)!),
      ),
    ).toEqual(['1', '1'])
    forgetNativeRequest('service+user', 'session', 'one')
    expect(pendingNativeRequests('service+user', 'session')).toEqual(['two'])
  })
  it('separates services, principals and sessions even with identical request IDs', () => {
    rememberNativeRequest('service-A/user', 'session', 'opaque/key+id')
    rememberNativeRequest('service-B/user', 'session', 'opaque/key+id')
    forgetNativeRequest('service-A/user', 'session', 'opaque/key+id')
    expect(pendingNativeRequests('service-B/user', 'session')).toEqual(['opaque/key+id'])
    expect(pendingNativeRequests('service-A/other', 'session')).toEqual([])
    expect(pendingNativeRequests('service-B/user', 'other')).toEqual([])
  })
  it('refuses to evict unresolved submissions or dispatch without durable recovery storage', () => {
    for (let index = 0; index < 65; index++)
      rememberNativeRequest('owner', 'session', String(index))
    const ids = pendingNativeRequests('owner', 'session')
    expect(ids).toHaveLength(65)
    expect(nativeRecoveryBatch(ids, 0)).toHaveLength(64)
    expect(new Set([...nativeRecoveryBatch(ids, 0), ...nativeRecoveryBatch(ids, 1)]).size).toBe(65)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => rememberNativeRequest('owner', 'another-session', 'pending')).toThrow()
  })
})
