import { describe, expect, it } from 'vitest'
import {
  agentRunReplayMessage,
  isFinalAgentRunMessage,
  isNativeAgentRun,
  isRunningAgentRun,
} from './agent-run-replay'
import { createWorkbenchStreamState } from './stream'
import type { WorkbenchAgentRun } from './types'

describe('durable Native replay', () => {
  const run: WorkbenchAgentRun = {
    id: 'native',
    sessionId: 'session',
    providerId: 'internal',
    providerKind: 'native',
    capabilityId: 'general',
    status: 'queued',
    queuedAt: '2026-10-08T00:00:00Z',
  }
  it('keeps a queued reply after the user request before a worker starts', () => {
    expect(isNativeAgentRun(run)).toBe(true)
    expect(isRunningAgentRun(run)).toBe(true)
    expect(
      new Date(agentRunReplayMessage(run, createWorkbenchStreamState()).createdAt).getTime(),
    ).toBeGreaterThan(new Date(run.queuedAt!).getTime())
  })
  it('keeps progress out of reply text and preserves streamed content while cancelling', () => {
    const state = createWorkbenchStreamState()
    const message = agentRunReplayMessage({ ...run, status: 'running', phase: 'cancelling' }, state)
    expect(message.content).toBe('')
    expect(message.metadata?.agentPhase).toBe('cancelling')
    expect(message.deliveryStatus).toBe('loading')
    state.message.content = '已经输出的正文'
    expect(
      agentRunReplayMessage({ ...run, status: 'running', phase: 'cancelling' }, state).content,
    ).toBe('已经输出的正文')
  })
  it('does not mistake the request or a running response for a final projection', () => {
    const message = {
      id: 'request',
      sessionId: 'session',
      role: 'user' as const,
      content: 'Question',
      createdAt: run.queuedAt!,
      metadata: { agentRunId: run.id },
    }
    expect(isFinalAgentRunMessage(message)).toBe(false)
    expect(
      isFinalAgentRunMessage({
        ...message,
        role: 'assistant',
        metadata: {
          agentStatus: { providerId: 'internal', providerKind: 'native', status: 'running' },
        },
      }),
    ).toBe(false)
    expect(
      isFinalAgentRunMessage({
        ...message,
        role: 'system',
        metadata: {
          agentStatus: { providerId: 'internal', providerKind: 'native', status: 'canceled' },
        },
      }),
    ).toBe(true)
  })
})
