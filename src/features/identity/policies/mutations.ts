import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { providerPortalKeys } from '@/features/provider-portal'
import { identityApplicationKeys } from '../applications/keys'
import { updateIdentityPolicy } from './api'
import { identityPolicyKeys, identityPolicyMutationKeys } from './keys'

export const identityPolicyMutations = {
  update: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: identityPolicyMutationKeys.update,
      mutationFn: updateIdentityPolicy,
      onSuccess: async (_policy, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: identityPolicyKeys.lists() }),
          queryClient.invalidateQueries({
            queryKey: identityPolicyKeys.detail(variables.applicationId),
          }),
          queryClient.invalidateQueries({ queryKey: identityApplicationKeys.all }),
          queryClient.invalidateQueries({ queryKey: providerPortalKeys.all }),
        ])
      },
    }),
}
