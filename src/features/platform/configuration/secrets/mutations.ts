import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { configurationMutations } from '../shared/mutations'
import type { ConfigurationTarget } from '../shared/types'
import { secretKind, updateSecretData } from './api'
import type { SecretDetail, UpdateSecretDataPayload } from './types'

export const secretMutations = {
  create: (queryClient: QueryClient) => configurationMutations.create(secretKind, queryClient),
  remove: (queryClient: QueryClient) => configurationMutations.remove(secretKind, queryClient),
  updateData: (queryClient: QueryClient) =>
    mutationOptions<
      SecretDetail,
      Error,
      { target: ConfigurationTarget; payload: UpdateSecretDataPayload }
    >({
      ...configurationMutations.updateData<SecretDetail, UpdateSecretDataPayload>(
        secretKind,
        queryClient,
      ),
      mutationFn: ({ target, payload }) => updateSecretData(target, payload),
    }),
  updateYAML: (queryClient: QueryClient) =>
    configurationMutations.updateYAML(secretKind, queryClient),
}
