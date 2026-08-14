export type RealtimeSessionKind = 'logs' | 'terminal'

export interface RealtimeSessionInput {
  clusterId: string
  container?: string
  kind: RealtimeSessionKind
  namespace: string
  podName: string
  shell?: string
  streamingDisabledReason?: string
}

export interface RealtimeSession extends RealtimeSessionInput {
  id: string
}

export function normalizeRealtimeSession(input: RealtimeSessionInput): RealtimeSession | null {
  const clusterId = input.clusterId.trim()
  const namespace = input.namespace.trim()
  const podName = input.podName.trim()
  if (!clusterId || !namespace || !podName) return null

  const container = input.container?.trim() || undefined
  const shell = input.kind === 'terminal' ? input.shell?.trim() || '/bin/sh' : undefined
  const id = JSON.stringify([
    input.kind,
    clusterId,
    namespace,
    podName,
    container ?? '',
    shell ?? '',
  ])

  return {
    ...input,
    clusterId,
    container,
    id,
    namespace,
    podName,
    shell,
  }
}
