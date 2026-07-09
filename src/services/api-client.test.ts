/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuthSession, restoreAuthSession } from '@/features/auth/auth-api'
import { api } from './api-client'
import { API_ERROR_EVENT, type ApiErrorEventDetail } from './api-error'

vi.mock('@/features/auth/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/auth-api')>(
    '@/features/auth/auth-api',
  )
  return {
    ...actual,
    clearAuthSession: vi.fn(),
    getStoredAccessToken: vi.fn(() => 'expired-token'),
    restoreAuthSession: vi.fn(async () => 'unauthenticated'),
  }
})

function jsonResponse(body: unknown, init: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

describe('api client error handling', () => {
  const events: ApiErrorEventDetail[] = []
  let apiErrorListener: EventListener

  beforeEach(() => {
    events.length = 0
    apiErrorListener = ((event: CustomEvent<ApiErrorEventDetail>) => {
      events.push(event.detail)
    }) as EventListener
    window.addEventListener(API_ERROR_EVENT, apiErrorListener)
    vi.mocked(clearAuthSession).mockClear()
    vi.mocked(restoreAuthSession).mockClear()
    vi.mocked(restoreAuthSession).mockResolvedValue('unauthenticated')
  })

  afterEach(() => {
    window.removeEventListener(API_ERROR_EVENT, apiErrorListener)
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('clears auth and emits a typed event when refresh cannot recover a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 'token_expired', message: 'token expired', request_id: 'req-401' } },
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'x-request-id': 'req-401' },
          },
        ),
      ),
    )

    await expect(api.get('/clusters')).rejects.toMatchObject({
      code: 'token_expired',
      kind: 'auth',
      message: 'token expired',
      requestId: 'req-401',
      status: 401,
    })

    expect(restoreAuthSession).toHaveBeenCalledTimes(1)
    expect(clearAuthSession).toHaveBeenCalledTimes(1)
    expect(events).toEqual([
      expect.objectContaining({
        code: 'token_expired',
        kind: 'auth',
        method: 'GET',
        path: '/clusters',
        requestId: 'req-401',
        status: 401,
      }),
    ])
  })

  it('keeps auth state when token refresh is temporarily unavailable', async () => {
    vi.mocked(restoreAuthSession).mockResolvedValueOnce('unavailable')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 'token_expired', message: 'token expired', request_id: 'req-401' } },
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'x-request-id': 'req-401' },
          },
        ),
      ),
    )

    await expect(api.get('/clusters')).rejects.toMatchObject({
      kind: 'network',
      message: 'Authentication refresh is temporarily unavailable',
      path: '/auth/refresh',
      status: 0,
    })

    expect(restoreAuthSession).toHaveBeenCalledTimes(1)
    expect(clearAuthSession).not.toHaveBeenCalled()
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'network',
        method: 'POST',
        path: '/auth/refresh',
        status: 0,
      }),
    ])
  })

  it('classifies forbidden and server errors for global notification handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 'access_denied', message: 'denied' } },
          {
            status: 403,
            statusText: 'Forbidden',
          },
        ),
      ),
    )

    await expect(api.delete('/clusters/prod')).rejects.toMatchObject({
      code: 'access_denied',
      kind: 'forbidden',
      message: 'denied',
      status: 403,
    })

    expect(events[events.length - 1]).toMatchObject({
      code: 'access_denied',
      kind: 'forbidden',
      method: 'DELETE',
      path: '/clusters/prod',
      status: 403,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 'internal_error', message: 'database unavailable' } },
          {
            status: 503,
            statusText: 'Service Unavailable',
          },
        ),
      ),
    )

    await expect(api.post('/applications', { name: 'demo' })).rejects.toMatchObject({
      code: 'internal_error',
      kind: 'server',
      message: 'database unavailable',
      status: 503,
    })

    expect(events[events.length - 1]).toMatchObject({
      code: 'internal_error',
      kind: 'server',
      method: 'POST',
      path: '/applications',
      status: 503,
    })
  })

  it('normalizes network failures into api errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(api.get('/clusters')).rejects.toMatchObject({
      kind: 'network',
      message: 'Failed to fetch',
      status: 0,
    })

    expect(events[events.length - 1]).toMatchObject({
      kind: 'network',
      method: 'GET',
      path: '/clusters',
      status: 0,
    })
  })

  it('keeps legacy error payload compatibility while preferring the contract schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { message: 'legacy message' },
          {
            status: 409,
            statusText: 'Conflict',
          },
        ),
      ),
    )

    await expect(api.put('/applications/app-1', { name: 'demo' })).rejects.toMatchObject({
      code: undefined,
      kind: 'client',
      message: 'legacy message',
      status: 409,
    })

    expect(events[events.length - 1]).toMatchObject({
      code: undefined,
      kind: 'client',
      message: 'legacy message',
      method: 'PUT',
      path: '/applications/app-1',
      status: 409,
    })
  })

  it('rejects successful responses with invalid JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>not json</html>', {
            status: 200,
            statusText: 'OK',
            headers: {
              'content-type': 'text/html',
              'x-request-id': 'req-json',
            },
          }),
      ),
    )

    await expect(api.get('/clusters')).rejects.toMatchObject({
      kind: 'client',
      message: expect.stringContaining('Invalid JSON response'),
      requestId: 'req-json',
      status: 200,
    })

    expect(events[events.length - 1]).toMatchObject({
      kind: 'client',
      method: 'GET',
      path: '/clusters',
      requestId: 'req-json',
      status: 200,
    })
  })
})
