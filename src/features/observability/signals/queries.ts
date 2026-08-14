import { queryOptions } from '@tanstack/react-query'
import { observabilityKeys } from '../keys'
import {
  getService,
  getServiceTopology,
  listMetricCatalog,
  listServices,
  type ObservabilityServiceQuery,
} from './api'

export const observabilitySignalQueries = {
  metricCatalog: () =>
    queryOptions({
      queryKey: observabilityKeys.signals.metricCatalog(),
      queryFn: listMetricCatalog,
      staleTime: 30_000,
    }),
  services: (query?: ObservabilityServiceQuery) =>
    queryOptions({
      queryKey: observabilityKeys.signals.services(query),
      queryFn: () => listServices(query!),
      enabled: Boolean(query),
    }),
  service: (serviceId: string, query?: ObservabilityServiceQuery) =>
    queryOptions({
      queryKey: observabilityKeys.signals.service(serviceId, query),
      queryFn: () => getService(serviceId, query!),
      enabled: Boolean(serviceId && query),
    }),
  topology: (serviceId: string, query?: ObservabilityServiceQuery) =>
    queryOptions({
      queryKey: observabilityKeys.signals.topology(serviceId, query),
      queryFn: () => getServiceTopology(serviceId, query!),
      enabled: Boolean(serviceId && query),
    }),
}
