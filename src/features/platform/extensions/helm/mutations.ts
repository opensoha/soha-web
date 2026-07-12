import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { deleteHelmRelease, installHelmChart, updateHelmReleaseValues } from './api'
import { helmKeys } from './keys'

export const helmMutations = {
  removeRelease: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...helmKeys.all, 'delete-release'] as const,
      mutationFn: deleteHelmRelease,
      onSuccess: (_data, target) =>
        queryClient.invalidateQueries({ queryKey: helmKeys.releases(target.clusterId) }),
    }),
  updateValues: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...helmKeys.all, 'update-values'] as const,
      mutationFn: updateHelmReleaseValues,
      onSuccess: (_data, variables) =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: helmKeys.releaseValues(variables) }),
          queryClient.invalidateQueries({ queryKey: helmKeys.releaseDetail(variables) }),
          queryClient.invalidateQueries({ queryKey: helmKeys.releaseHistory(variables) }),
          queryClient.invalidateQueries({ queryKey: helmKeys.releases(variables.clusterId) }),
        ]),
    }),
  installChart: (queryClient: QueryClient) =>
    mutationOptions({
      mutationKey: [...helmKeys.all, 'install-chart'] as const,
      mutationFn: installHelmChart,
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({ queryKey: helmKeys.releases(variables.clusterId) }),
    }),
}
