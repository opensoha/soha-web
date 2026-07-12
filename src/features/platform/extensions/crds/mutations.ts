import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { applyCustomResource, deleteCustomResource } from './api'
import { crdKeys } from './keys'
import type { ApplyCustomResourceVariables, CustomResourceTarget } from './types'

async function invalidateCustomResource(queryClient: QueryClient, target: CustomResourceTarget) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: crdKeys.resources(target.clusterId, target.crd, target.namespace),
    }),
    queryClient.invalidateQueries({ queryKey: crdKeys.yaml(target) }),
  ])
}

export const crdMutations = {
  apply: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...crdKeys.all, 'apply'] as const,
      mutationFn: applyCustomResource,
      onSuccess: (_data, variables: ApplyCustomResourceVariables) => {
        const target = {
          clusterId: variables.clusterId,
          crd: variables.crd,
          namespace: variables.namespace,
          resourceName: variables.resourceName ?? '',
        }
        return invalidateCustomResource(queryClient, target)
      },
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...crdKeys.all, 'delete'] as const,
      mutationFn: deleteCustomResource,
      onSuccess: (_data, target) => invalidateCustomResource(queryClient, target),
    }),
}
