import type { QueryClient } from '@tanstack/react-query'
import { networkMutations } from '../shared/mutations'

export const serviceMutations = {
  remove: (queryClient: QueryClient) => networkMutations.remove('services', queryClient),
  updateYAML: (queryClient: QueryClient) => networkMutations.updateYAML('services', queryClient),
}
