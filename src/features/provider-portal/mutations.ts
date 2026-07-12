import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import type { IdentityApplication } from '@/features/identity'
import { providerPortalApi } from './api'
import { providerPortalKeys } from './keys'

export function invalidateProviderPortalQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: providerPortalKeys.all })
}

export const providerPortalMutations = {
  launch: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...providerPortalKeys.all, 'mutation', 'launch'] as const,
      mutationFn: (application: IdentityApplication) => providerPortalApi.launch(application.id),
      onSuccess: (decision) =>
        decision.launchUrl ? invalidateProviderPortalQueries(queryClient) : undefined,
    }),
  toggleFavorite: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...providerPortalKeys.all, 'mutation', 'favorite'] as const,
      mutationFn: async (application: IdentityApplication): Promise<void> => {
        if (application.favorite) {
          await providerPortalApi.unfavorite(application.id)
          return
        }
        await providerPortalApi.favorite(application.id)
      },
      onSuccess: () => invalidateProviderPortalQueries(queryClient),
    }),
}
