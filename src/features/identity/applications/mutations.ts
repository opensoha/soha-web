import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { providerPortalKeys } from '@/features/provider-portal'
import {
  createIdentityApplication,
  deleteIdentityApplication,
  updateIdentityApplication,
} from './api'
import { identityApplicationKeys, identityApplicationMutationKeys } from './keys'

async function invalidateApplicationCaches(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: identityApplicationKeys.all }),
    queryClient.invalidateQueries({ queryKey: providerPortalKeys.all }),
  ])
}

export const identityApplicationMutations = {
  create: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: identityApplicationMutationKeys.create,
      mutationFn: createIdentityApplication,
      onSuccess: () => invalidateApplicationCaches(queryClient),
    }),
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: identityApplicationMutationKeys.update,
      mutationFn: updateIdentityApplication,
      onSuccess: () => invalidateApplicationCaches(queryClient),
    }),
  remove: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: identityApplicationMutationKeys.remove,
      mutationFn: deleteIdentityApplication,
      onSuccess: () => invalidateApplicationCaches(queryClient),
    }),
}
