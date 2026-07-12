import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { deleteWorkload } from './api'
import { workloadKeys } from './keys'
import type { WorkloadKind, WorkloadReference } from './types'

export const workloadMutations = {
  remove: (kind: WorkloadKind, queryClient: QueryClient) =>
    mutationOptions<void, Error, WorkloadReference>({
      mutationKey: [...workloadKeys.resource(kind), 'delete'] as const,
      mutationFn: ({ scope, name }) => deleteWorkload(kind, scope, name),
      onSuccess: async (_data, target) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: workloadKeys.lists(kind) }),
          queryClient.invalidateQueries({
            queryKey: workloadKeys.detail(kind, target.scope, target.name),
          }),
        ])
      },
    }),
}
