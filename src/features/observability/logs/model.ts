import type { LogEntry, LogQuery } from '@opensoha/contracts/gen/ts/sohaapi'

export type LogExplorerMode = 'live' | 'history'

export interface LogExplorerPreset {
  source?: 'kubernetes' | 'docker' | 'delivery'
  clusterId?: string | null
  namespace?: string | null
  dockerProjectId?: string | null
  dockerService?: string | null
  applicationId?: string | null
  environmentId?: string | null
  workloadKind?: string
  workloadName?: string
  podNames?: string[]
  containers?: string[]
  labelSelector?: string
  text?: string
  mode?: LogExplorerMode
  sinceSeconds?: number
  tail?: number
  allContainers?: boolean
  previous?: boolean
}

export interface RuntimeLogFilters {
  workloadKind?: string
  workloadName?: string
  podNames?: string[]
  containers?: string[]
  labelSelector?: string
  text?: string
  sinceSeconds?: number
  tail?: number
  allContainers?: boolean
  previous?: boolean
}

const MAX_BROWSER_ENTRIES = 10000

function clean(value?: string | null) {
  return value?.trim() || undefined
}

function cleanList(values?: string[]) {
  const normalized = values?.map((value) => value.trim()).filter(Boolean) ?? []
  return normalized.length > 0 ? [...new Set(normalized)] : undefined
}

export function buildRuntimeLogQuery(namespace: string, filters: RuntimeLogFilters): LogQuery {
  const workloadKind = clean(filters.workloadKind)
  const workloadName = clean(filters.workloadName)
  if (Boolean(workloadKind) !== Boolean(workloadName)) {
    throw new Error('工作负载类型和名称必须同时填写')
  }

  const containers = filters.allContainers ? undefined : cleanList(filters.containers)
  return {
    sourceMode: 'runtime',
    selector: {
      namespace: namespace.trim(),
      workloadKind,
      workloadName,
      podNames: cleanList(filters.podNames),
      containers,
      labelSelector: clean(filters.labelSelector),
      allContainers: Boolean(filters.allContainers),
    },
    tail: filters.tail || 200,
    limit: 5000,
    direction: 'forward',
    text: clean(filters.text),
    runtimeOptions: {
      previous: Boolean(filters.previous),
      sinceSeconds: filters.sinceSeconds || undefined,
    },
  }
}

export function buildDockerRuntimeLogQuery(
  serviceName: string,
  filters: RuntimeLogFilters,
): LogQuery {
  return {
    sourceMode: 'runtime',
    selector: { dockerService: serviceName.trim() },
    tail: Math.min(filters.tail || 200, 2000),
    limit: Math.min(filters.tail || 200, 2000),
    direction: 'forward',
    text: clean(filters.text),
    runtimeOptions: { sinceSeconds: filters.sinceSeconds || undefined },
  }
}

export function buildDurableLogQuery(
  namespace: string,
  filters: RuntimeLogFilters,
  now = Date.now(),
): LogQuery {
  const workloadKind = clean(filters.workloadKind)
  const workloadName = clean(filters.workloadName)
  if (Boolean(workloadKind) !== Boolean(workloadName)) {
    throw new Error('工作负载类型和名称必须同时填写')
  }
  const podNames = cleanList(filters.podNames)
  const containers = filters.allContainers ? undefined : cleanList(filters.containers)
  if ((podNames?.length ?? 0) > 1 || (containers?.length ?? 0) > 1) {
    throw new Error('历史日志每次只能筛选一个 Pod 和一个容器')
  }
  if (clean(filters.labelSelector)) {
    throw new Error('历史日志暂不支持 Kubernetes 标签选择器')
  }
  const rangeSeconds = filters.sinceSeconds && filters.sinceSeconds > 0 ? filters.sinceSeconds : 900
  return {
    sourceMode: 'durable',
    selector: {
      namespace: namespace.trim(),
      workloadKind,
      workloadName,
      podNames,
      containers,
      allContainers: Boolean(filters.allContainers),
    },
    from: new Date(now - rangeSeconds * 1000).toISOString(),
    to: new Date(now).toISOString(),
    limit: Math.min(filters.tail || 200, 1000),
    direction: 'backward',
    text: clean(filters.text),
  }
}

export function readLogExplorerPreset(params: URLSearchParams): LogExplorerPreset {
  const numberValue = Number(params.get('range'))
  const tailValue = Number(params.get('tail'))
  const podNames = cleanList(params.getAll('pod'))
  const containers = cleanList(params.getAll('container'))
  return {
    source:
      params.get('source') === 'docker'
        ? 'docker'
        : params.get('source') === 'delivery'
          ? 'delivery'
          : 'kubernetes',
    clusterId: clean(params.get('cluster')),
    namespace: clean(params.get('namespace')),
    dockerProjectId: clean(params.get('dockerProject')),
    dockerService: clean(params.get('dockerService')),
    applicationId: clean(params.get('application')),
    environmentId: clean(params.get('environment')),
    workloadKind: clean(params.get('workloadKind')),
    workloadName: clean(params.get('workload')),
    podNames,
    containers,
    labelSelector: clean(params.get('labelSelector')),
    text: clean(params.get('text')),
    mode: params.get('mode') === 'history' ? 'history' : 'live',
    sinceSeconds: Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined,
    tail: Number.isFinite(tailValue) && tailValue > 0 ? tailValue : undefined,
    allContainers: params.get('allContainers') === 'true',
    previous: params.get('previous') === 'true',
  }
}

export function buildLogExplorerPath(preset: LogExplorerPreset) {
  const params = new URLSearchParams()
  const values: Array<[string, string | null | undefined]> = [
    ['source', preset.source && preset.source !== 'kubernetes' ? preset.source : undefined],
    ['cluster', preset.clusterId],
    ['namespace', preset.namespace],
    ['dockerProject', preset.dockerProjectId],
    ['dockerService', preset.dockerService],
    ['application', preset.applicationId],
    ['environment', preset.environmentId],
    ['workloadKind', preset.workloadKind],
    ['workload', preset.workloadName],
    ['labelSelector', preset.labelSelector],
    ['text', preset.text],
    ['mode', preset.mode && preset.mode !== 'live' ? preset.mode : undefined],
    ['range', preset.sinceSeconds ? String(preset.sinceSeconds) : undefined],
    ['tail', preset.tail ? String(preset.tail) : undefined],
    ['allContainers', preset.allContainers ? 'true' : undefined],
    ['previous', preset.previous ? 'true' : undefined],
  ]
  for (const [key, value] of values) {
    if (value) params.set(key, value)
  }
  for (const podName of cleanList(preset.podNames) ?? []) params.append('pod', podName)
  for (const container of cleanList(preset.containers) ?? []) params.append('container', container)
  const search = params.toString()
  return `/monitoring-workbench/logs${search ? `?${search}` : ''}`
}

export function logEntryKey(entry: LogEntry) {
  const source = entry.source
  return [
    entry.timestamp,
    source.podUid || source.podName || source.dockerProjectId || source.applicationId,
    source.containerName || source.dockerService || source.environmentKey,
    entry.stream,
    entry.message,
  ].join('\u0000')
}

export function mergeLogEntries(current: LogEntry[], incoming: LogEntry[]) {
  if (incoming.length === 0) return current
  const seen = new Set(current.map(logEntryKey))
  const additions = incoming.filter((entry) => {
    const key = logEntryKey(entry)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (additions.length === 0) return current
  return [...current, ...additions]
    .sort(
      (left, right) =>
        left.timestamp.localeCompare(right.timestamp) ||
        logEntryKey(left).localeCompare(logEntryKey(right)),
    )
    .slice(-MAX_BROWSER_ENTRIES)
}

export function formatLogSource(entry: LogEntry) {
  const source = entry.source
  return (
    [source.podName || source.workloadName || source.dockerService, source.containerName]
      .filter(Boolean)
      .join(' / ') || source.domain
  )
}

export function formatLogExport(entries: LogEntry[]) {
  return entries
    .map((entry) => `${entry.timestamp} ${formatLogSource(entry)} ${entry.message}`)
    .join('\n')
}
