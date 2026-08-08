import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSoftwareCatalog } from './software-library-api'

vi.mock('@/features/auth', () => ({ getStoredAccessToken: () => 'access-token' }))

describe('desktop software library api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('passes the in-memory access token to the native catalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(getSoftwareCatalog()).resolves.toEqual([])
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/app/v1/software')
    expect(headers.get('Authorization')).toBe('Bearer access-token')
  })
})
