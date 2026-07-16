import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import type { ComputeTaskDomain } from '@opensoha/contracts/gen/ts/sohaapi'
import { computeApi } from './api'
import { computeKeys, computeMutationKeys } from './keys'

export interface ComputeTaskMutationVariables {
  domain: ComputeTaskDomain
  taskId: string
}

export function invalidateComputeTaskQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: computeKeys.all })
}

export const computeMutations = {
  cancelTask: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: computeMutationKeys.task('cancel'),
      mutationFn: ({ domain, taskId }: ComputeTaskMutationVariables) =>
        computeApi.cancelTask(domain, taskId),
      onSuccess: () => invalidateComputeTaskQueries(queryClient),
    }),
  retryTask: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: computeMutationKeys.task('retry'),
      mutationFn: ({ domain, taskId }: ComputeTaskMutationVariables) =>
        computeApi.retryTask(domain, taskId),
      onSuccess: () => invalidateComputeTaskQueries(queryClient),
    }),
}
