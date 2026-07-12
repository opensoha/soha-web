import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import {
  applyNodeYAML,
  createNamespace,
  deleteNamespace,
  deleteNode,
  updateNamespace,
  updateNode,
} from './api'
import { clusterResourceKeys } from './keys'
import type {
  ApplyNodeYAMLVariables,
  NamespaceTarget,
  NodeTarget,
  UpdateNamespaceVariables,
  UpdateNodeVariables,
} from './types'

async function invalidateNodeCaches(queryClient: QueryClient, target: NodeTarget) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: clusterResourceKeys.nodeLists() }),
    queryClient.invalidateQueries({
      queryKey: clusterResourceKeys.nodeDetail(target.scope, target.name),
    }),
  ])
}

async function invalidateNamespaceCaches(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: clusterResourceKeys.namespaceLists() })
}

export const nodeMutations = {
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterResourceKeys.nodes(), 'update'] as const,
      mutationFn: updateNode,
      onSuccess: (_data, variables: UpdateNodeVariables) =>
        invalidateNodeCaches(queryClient, variables),
    }),
  applyYAML: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterResourceKeys.nodes(), 'apply-yaml'] as const,
      mutationFn: applyNodeYAML,
      onSuccess: (_data, variables: ApplyNodeYAMLVariables) =>
        invalidateNodeCaches(queryClient, variables),
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions<void, Error, NodeTarget>({
      mutationKey: [...clusterResourceKeys.nodes(), 'delete'] as const,
      mutationFn: deleteNode,
      onSuccess: (_data, variables) => invalidateNodeCaches(queryClient, variables),
    }),
}

export const namespaceMutations = {
  create: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterResourceKeys.namespaces(), 'create'] as const,
      mutationFn: createNamespace,
      onSuccess: () => invalidateNamespaceCaches(queryClient),
    }),
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...clusterResourceKeys.namespaces(), 'update'] as const,
      mutationFn: updateNamespace,
      onSuccess: (_data, _variables: UpdateNamespaceVariables) =>
        invalidateNamespaceCaches(queryClient),
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions<void, Error, NamespaceTarget>({
      mutationKey: [...clusterResourceKeys.namespaces(), 'delete'] as const,
      mutationFn: deleteNamespace,
      onSuccess: () => invalidateNamespaceCaches(queryClient),
    }),
}
