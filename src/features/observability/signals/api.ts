import type {
  ObservabilityMetricQueryInput,
  ObservabilityMetricQueryResult,
  ObservabilityTraceQueryInput,
  ObservabilityTraceQueryResult,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

export async function queryMetrics(input: ObservabilityMetricQueryInput) {
  const response = await api.post<ApiResponse<ObservabilityMetricQueryResult>>(
    '/observability/metrics/query',
    input,
  )
  return response.data
}

export async function queryTraces(input: ObservabilityTraceQueryInput) {
  const response = await api.post<ApiResponse<ObservabilityTraceQueryResult>>(
    '/observability/traces/query',
    input,
  )
  return response.data
}
