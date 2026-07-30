import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { manifestApi } from './api'
import { manifestKeys } from './keys'
import type { ManifestPackageInput } from './types'

export const manifestMutations = {
  create: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...manifestKeys.all, 'create'],
      mutationFn: manifestApi.create,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: manifestKeys.all }),
    }),
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...manifestKeys.all, 'update'],
      mutationFn: ({ id, input }: { id: string; input: ManifestPackageInput }) =>
        manifestApi.update(id, input),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: manifestKeys.all }),
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...manifestKeys.all, 'delete'],
      mutationFn: manifestApi.remove,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: manifestKeys.all }),
    }),
  publish: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...manifestKeys.all, 'publish'],
      mutationFn: ({ id, note }: { id: string; note: string }) => manifestApi.publish(id, note),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: manifestKeys.all }),
    }),
}
