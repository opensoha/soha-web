import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { manifestKeys } from './keys'
import { manifestMutations } from './mutations'

const apiMocks = vi.hoisted(() => ({
  create: vi.fn(),
  publish: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}))
vi.mock('./api', () => ({ manifestApi: apiMocks }))

describe('manifest mutations', () => {
  it('invalidates delivery and platform manifest views after publishing', async () => {
    apiMocks.publish.mockResolvedValue({ id: 'manifest-1' })
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const observer = new MutationObserver(queryClient, manifestMutations.publish(queryClient))

    await observer.mutate({ id: 'manifest-1', note: 'release' })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: manifestKeys.all })
  })
})
