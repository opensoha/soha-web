import type { WorkbenchStreamEvent } from '@opensoha/contracts/gen/ts/sohaapi'

import {
  canonicalWorkbenchAgentStatus,
  isRunningWorkbenchAgentStatus,
  type WorkbenchStreamState,
} from './stream'
import type { WorkbenchAgentRun, WorkbenchMessage } from './types'
import { artifactSnapshotText } from './artifacts'
import type { ConversationMessage } from './conversation'
import {
  isRecord,
  metadataAgentStatus,
  metadataArtifacts,
  streamBubbleStatus,
  streamMessageMetadata,
} from './stream-presentation'

const EXTERNAL_AGENT_REPLAY_SOURCE = 'agent-run-replay'

export function isExternalAgentRun(run: WorkbenchAgentRun) {
  const providerKind = run.providerKind.trim().toLowerCase()
  const providerId = run.providerId.trim().toLowerCase()
  return providerKind !== 'internal' && providerId !== 'internal'
}

export function isRunningExternalAgentRun(run: WorkbenchAgentRun) {
  return isExternalAgentRun(run) && isRunningWorkbenchAgentStatus(run.status)
}

export function isExternalAgentRunReplayMessage(item: ConversationMessage) {
  return (
    item.id.startsWith('local:agent-run:') || item.metadata?.source === EXTERNAL_AGENT_REPLAY_SOURCE
  )
}

function externalAgentRunReplayMessageId(run: WorkbenchAgentRun) {
  return `local:agent-run:${run.sessionId || 'session'}:${run.id}`
}

export function agentRunTimestamp(run: WorkbenchAgentRun) {
  const candidates = [
    run.updatedAt,
    run.lastHeartbeatAt,
    run.completedAt,
    run.startedAt,
    run.queuedAt,
    run.createdAt,
  ]
  return candidates.reduce((latest, value) => {
    if (!value) return latest
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest
  }, 0)
}

function agentRunMessageCreatedAt(run: WorkbenchAgentRun) {
  return run.startedAt || run.queuedAt || run.createdAt || run.updatedAt || new Date().toISOString()
}

export function messageAgentRunRefs(item: WorkbenchMessage | ConversationMessage) {
  const ids = new Set<string>()
  const metadata = item.metadata
  const topLevelId = artifactSnapshotText(metadata, 'agentRunId', 'agentRuntimeId')
  if (topLevelId) ids.add(topLevelId)
  if (isRecord(metadata?.agentStatus)) {
    const statusId = artifactSnapshotText(metadata.agentStatus, 'agentRunId', 'agentRuntimeId')
    if (statusId) ids.add(statusId)
  }
  for (const artifact of metadataArtifacts(metadata)) {
    const artifactRunId = artifactSnapshotText(
      artifact.dataSourceSnapshot,
      'agentRunId',
      'agentRuntimeId',
    )
    if (artifactRunId) ids.add(artifactRunId)
  }
  return [...ids]
}

function isWorkbenchStreamEvent(value: unknown): value is WorkbenchStreamEvent {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.createdAt === 'string'
  )
}

function agentRunWorkbenchEvents(run: WorkbenchAgentRun) {
  const raw = run.output?.workbenchEvents
  return Array.isArray(raw) ? raw.filter(isWorkbenchStreamEvent) : []
}

function agentRunStatusReplayEvent(
  run: WorkbenchAgentRun,
  sessionId: string,
): WorkbenchStreamEvent {
  const status = canonicalWorkbenchAgentStatus(run.status)
  return {
    id: `evt:${sessionId}:${run.id}:status:${status}`,
    type: 'agent.status',
    sessionId,
    runId: run.rootCauseRunId || run.id,
    sequence: 0,
    createdAt:
      run.updatedAt ||
      run.lastHeartbeatAt ||
      run.startedAt ||
      run.queuedAt ||
      run.createdAt ||
      new Date().toISOString(),
    providerId: run.providerId,
    providerKind: run.providerKind,
    status,
  } as WorkbenchStreamEvent
}

export function sortedAgentRunReplayEvents(run: WorkbenchAgentRun, sessionId: string) {
  return [agentRunStatusReplayEvent(run, sessionId), ...agentRunWorkbenchEvents(run)].sort(
    (left, right) =>
      left.sequence - right.sequence ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
}

function agentRunStatusSnapshot(run: WorkbenchAgentRun, state: WorkbenchStreamState) {
  return {
    providerId: state.agentStatus?.providerId || run.providerId,
    providerKind: state.agentStatus?.providerKind || run.providerKind,
    status: canonicalWorkbenchAgentStatus(state.agentStatus?.status || run.status),
    runId: run.rootCauseRunId || run.id,
    agentRunId: run.id,
    externalRunId: run.externalRunId,
  }
}

function agentRunReplayArtifacts(metadata: Record<string, unknown>, run: WorkbenchAgentRun) {
  const artifacts = metadataArtifacts(metadata)
  if (artifacts.length === 0 && (run.analysisArtifacts ?? []).length > 0)
    return run.analysisArtifacts
  const fallbackRunId = run.rootCauseRunId || run.id
  return artifacts.map((artifact) =>
    artifact.runId === 'stream' ? { ...artifact, runId: fallbackRunId } : artifact,
  )
}

function agentRunReplayMetadata(run: WorkbenchAgentRun, state: WorkbenchStreamState) {
  const metadata = streamMessageMetadata(
    {
      source: EXTERNAL_AGENT_REPLAY_SOURCE,
      agentRunId: run.id,
      externalRunId: run.externalRunId,
      agentProviderId: run.providerId,
    },
    state,
  )
  return {
    ...metadata,
    source: EXTERNAL_AGENT_REPLAY_SOURCE,
    agentRunId: run.id,
    externalRunId: run.externalRunId,
    agentProviderId: run.providerId,
    agentStatus: metadataAgentStatus(metadata) ?? agentRunStatusSnapshot(run, state),
    analysisArtifacts: agentRunReplayArtifacts(metadata, run),
  }
}

function agentRunReplayContent(run: WorkbenchAgentRun, state: WorkbenchStreamState) {
  if (state.message.content) return state.message.content
  if (state.error) return state.error.message
  if (state.thinking?.summary) return state.thinking.summary
  switch (canonicalWorkbenchAgentStatus(run.status)) {
    case 'queued':
      return '外部 Agent 已排队，等待 runner 接收。'
    case 'running':
      return '外部 Agent 正在分析当前会话。'
    default:
      return '正在思考...'
  }
}

export function agentRunReplayMessage(
  run: WorkbenchAgentRun,
  state: WorkbenchStreamState,
): ConversationMessage {
  const sessionId = run.sessionId || state.message.sessionId || ''
  return {
    id: externalAgentRunReplayMessageId(run),
    sessionId,
    role: 'assistant',
    content: agentRunReplayContent(run, state),
    metadata: agentRunReplayMetadata(run, state),
    createdAt: agentRunMessageCreatedAt(run),
    deliveryStatus: streamBubbleStatus(state),
  }
}
