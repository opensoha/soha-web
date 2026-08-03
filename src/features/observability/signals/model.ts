import type {
  ObservabilityQueryScope,
  ObservabilityTraceSpan,
} from '@opensoha/contracts/gen/ts/sohaapi'

export interface ServiceSummary {
  errorSpans: number
  key: string
  maxDurationMs: number
  service: string
  spans: number
}

export function observabilityScope(
  clusterId: string | null,
  namespace: string | null,
  service?: string,
  workload?: string,
): ObservabilityQueryScope | undefined {
  const scope = {
    clusterId: clusterId?.trim() || undefined,
    namespace: namespace?.trim() || undefined,
    service: service?.trim() || undefined,
    workload: workload?.trim() || undefined,
  }
  return Object.values(scope).some(Boolean) ? scope : undefined
}

export function summarizeServices(spans: ObservabilityTraceSpan[]): ServiceSummary[] {
  const services = new Map<string, ServiceSummary>()
  for (const span of spans) {
    const service = span.service.trim()
    if (!service) continue
    const current = services.get(service) ?? {
      errorSpans: 0,
      key: service,
      maxDurationMs: 0,
      service,
      spans: 0,
    }
    current.spans += 1
    current.errorSpans += span.error ? 1 : 0
    current.maxDurationMs = Math.max(current.maxDurationMs, span.durationMs)
    services.set(service, current)
  }
  return [...services.values()].sort(
    (left, right) => right.errorSpans - left.errorSpans || right.maxDurationMs - left.maxDurationMs,
  )
}
