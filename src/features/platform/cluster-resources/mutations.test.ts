import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clusterResourceKeys } from './keys'
import { namespaceMutations, nodeMutations } from './mutations'

const apiMocks = vi.hoisted(() => ({
  applyNodeYAML: vi.fn(),
  createNamespace: vi.fn(),
  deleteNamespace: vi.fn(),
  deleteNode: vi.fn(),
  updateNamespace: vi.fn(),
  updateNode: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

const scope = { clusterId: 'cluster-a', namespace: null } as const

describe('cluster resource mutation options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates node list and target detail after updates', async () => {
    const variables = {
      scope,
      name: 'node-a',
      input: { labels: {}, taints: [] },
    }
    apiMocks.updateNode.mockResolvedValueOnce({ name: 'node-a' })
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const observer = new MutationObserver(queryClient, nodeMutations.update(queryClient))

    await observer.mutate(variables)

    expect(invalidate).toHaveBeenCalledWith({ queryKey: clusterResourceKeys.nodeLists() })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: clusterResourceKeys.nodeDetail(scope, 'node-a'),
    })
  })

  it('invalidates the namespace list after creation', async () => {
    const variables = {
      scope,
      input: { name: 'team-a', labels: {}, annotations: {} },
    }
    apiMocks.createNamespace.mockResolvedValueOnce(variables.input)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const observer = new MutationObserver(queryClient, namespaceMutations.create(queryClient))

    await observer.mutate(variables)

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: clusterResourceKeys.namespaceLists(),
    })
  })
})
