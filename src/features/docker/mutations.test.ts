import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dockerApi } from './docker-api'
import { computeKeys } from '@/features/compute'
import { dockerKeys, dockerMutationKeys } from './keys'
import { dockerMutations, invalidateDockerQueries } from './mutations'
import type { DockerHostInput, DockerProjectInput } from './docker-types'

function queryClientWithInvalidationSpy() {
  const queryClient = new QueryClient()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
  return { invalidateQueries, queryClient }
}

describe('dockerMutations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('invalidates the domain root and canonical Compute overview', async () => {
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()

    await invalidateDockerQueries(queryClient)

    expect(invalidateQueries).toHaveBeenCalledTimes(2)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: dockerKeys.all })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: computeKeys.overview() })
  })

  it('returns domain entities and invalidates the Docker root after success', async () => {
    const input = { name: 'Host A' } as DockerHostInput
    const host = { id: 'host-1', name: 'Host A' }
    vi.spyOn(dockerApi, 'createHost').mockResolvedValue(host)
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()
    const observer = new MutationObserver(queryClient, dockerMutations.createHost(queryClient))

    await expect(observer.mutate(input)).resolves.toBe(host)
    expect(observer.options.mutationKey).toEqual(dockerMutationKeys.host('create'))
    expect(dockerApi.createHost).toHaveBeenCalledWith(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: dockerKeys.all })
  })

  it('maps typed update and action variables to the existing API wire calls', async () => {
    const input = { hostId: 'host-1', name: 'Project A' } as DockerProjectInput
    vi.spyOn(dockerApi, 'updateProject').mockResolvedValue({
      id: 'project-1',
      ...input,
    })
    vi.spyOn(dockerApi, 'serviceAction').mockResolvedValue({ id: 'operation-1' })
    const { queryClient } = queryClientWithInvalidationSpy()
    const updateObserver = new MutationObserver(
      queryClient,
      dockerMutations.updateProject(queryClient),
    )
    const actionObserver = new MutationObserver(
      queryClient,
      dockerMutations.serviceAction(queryClient),
    )

    await updateObserver.mutate({ id: 'project-1', payload: input })
    await actionObserver.mutate({ id: 'service-1', action: 'restart' })

    expect(dockerApi.updateProject).toHaveBeenCalledWith('project-1', input)
    expect(dockerApi.serviceAction).toHaveBeenCalledWith('service-1', 'restart')
    expect(actionObserver.options.mutationKey).toEqual(dockerMutationKeys.service('action'))
  })

  it('does not invalidate when a mutation fails', async () => {
    const failure = new Error('delete failed')
    vi.spyOn(dockerApi, 'deletePort').mockRejectedValue(failure)
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()
    const observer = new MutationObserver(queryClient, dockerMutations.deletePort(queryClient))

    await expect(observer.mutate('port-1')).rejects.toBe(failure)
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
