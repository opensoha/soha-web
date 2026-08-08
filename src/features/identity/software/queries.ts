import { queryOptions } from '@tanstack/react-query'
import { getSoftwareStorage, listSoftwarePackages } from './api'
import { softwarePackageKeys, softwareStorageKeys } from './keys'
import type { SoftwarePackageFilters } from './types'

export const softwarePackageQueries = {
  list: (filters: SoftwarePackageFilters) =>
    queryOptions({
      queryKey: softwarePackageKeys.list(filters),
      queryFn: () => listSoftwarePackages(filters),
    }),
  storage: () =>
    queryOptions({
      queryKey: softwareStorageKeys.detail(),
      queryFn: getSoftwareStorage,
    }),
}
