import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { createCluster, deleteCluster, updateCluster } from './api'
import { clusterKeys } from './keys'
import type {
  ClusterPayload,
  ClusterTarget,
  DeleteClustersVariables,
  UpdateClusterVariables,
} from './types'

async function invalidateClusterTarget(queryClient: QueryClient, target: ClusterTarget) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: clusterKeys.list() }),
    queryClient.invalidateQueries({ queryKey: clusterKeys.legacyList() }),
    queryClient.invalidateQueries({ queryKey: clusterKeys.detail(target.scope) }),
    queryClient.invalidateQueries({ queryKey: clusterKeys.nodes(target.scope) }),
  ])
}

export const clusterMutations = {
  create: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterKeys.all, 'create'] as const,
      mutationFn: (values: ClusterPayload) => createCluster(values),
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: clusterKeys.list() }),
          queryClient.invalidateQueries({ queryKey: clusterKeys.legacyList() }),
        ]),
    }),
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterKeys.all, 'update'] as const,
      mutationFn: (variables: UpdateClusterVariables) => updateCluster(variables),
      onSuccess: (_data, variables) => invalidateClusterTarget(queryClient, variables),
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterKeys.all, 'delete'] as const,
      mutationFn: (target: ClusterTarget) => deleteCluster(target),
      onSuccess: (_data, variables) => invalidateClusterTarget(queryClient, variables),
    }),
  removeMany: (queryClient: QueryClient) =>
    mutationOptions<void, Error, DeleteClustersVariables>({
      mutationKey: [...clusterKeys.all, 'delete-many'] as const,
      mutationFn: async ({ scopes }) => {
        await Promise.all(scopes.map((scope) => deleteCluster({ scope })))
      },
      onSuccess: async (_data, { scopes }) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: clusterKeys.list() }),
          queryClient.invalidateQueries({ queryKey: clusterKeys.legacyList() }),
          ...scopes.flatMap((scope) => [
            queryClient.invalidateQueries({ queryKey: clusterKeys.detail(scope) }),
            queryClient.invalidateQueries({ queryKey: clusterKeys.nodes(scope) }),
          ]),
        ])
      },
    }),
}
