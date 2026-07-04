/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import type { WorkbenchStreamEvent } from '@opensoha/contracts/gen/ts/sohaapi'
import {
  createWorkbenchStreamState,
  parseSSEChunk,
  reduceWorkbenchStreamState,
} from './workbench-stream'

const createdAt = '2026-07-03T00:00:00Z'

describe('workbench stream helpers', () => {
  it('parses complete SSE events across chunks', () => {
    const delta: WorkbenchStreamEvent = {
      id: 'evt-1',
      sessionId: 'session-1',
      messageId: 'message-1',
      sequence: 1,
      createdAt,
      type: 'message.delta',
      role: 'assistant',
      contentDelta: 'hel',
    }
    const done: WorkbenchStreamEvent = {
      id: 'evt-2',
      sessionId: 'session-1',
      messageId: 'message-1',
      sequence: 2,
      createdAt,
      type: 'message.done',
      role: 'assistant',
      content: 'hello',
    }
    const payload = `event: message.delta\ndata: ${JSON.stringify(delta)}\n\n:data ignored\n\ndata: ${JSON.stringify(done)}\n\n`
    const first = parseSSEChunk(payload.slice(0, 24))
    const second = parseSSEChunk(payload.slice(24), first.rest)

    expect(first.events).toEqual([])
    expect(second.rest).toBe('')
    expect(second.events).toEqual([delta, done])
  })

  it('accumulates message, tools, artifacts, and thinking state', () => {
    const artifact = { kind: 'root_cause', summary: 'Restart loop detected' }
    const events: WorkbenchStreamEvent[] = [
      {
        id: 'evt-1',
        sessionId: 'session-1',
        messageId: 'message-1',
        sequence: 1,
        createdAt,
        type: 'message.delta',
        role: 'assistant',
        contentDelta: 'hel',
      },
      {
        id: 'evt-2',
        sessionId: 'session-1',
        messageId: 'message-1',
        sequence: 2,
        createdAt,
        type: 'message.delta',
        role: 'assistant',
        contentDelta: 'lo',
      },
      {
        id: 'evt-3',
        sessionId: 'session-1',
        sequence: 3,
        createdAt,
        type: 'tool.started',
        toolCall: {
          id: 'tool-1',
          adapterId: 'logs',
          toolName: 'logs.query',
          status: 'running',
          startedAt: createdAt,
        },
      },
      {
        id: 'evt-4',
        sessionId: 'session-1',
        sequence: 4,
        createdAt,
        type: 'source.updated',
        source: {
          id: 'source-1',
          kind: 'log',
          title: 'pod logs',
          summary: 'CrashLoopBackOff entries',
        },
      },
      {
        id: 'evt-5',
        sessionId: 'session-1',
        sequence: 5,
        createdAt,
        type: 'thinking.delta',
        textDelta: 'Checked ',
      },
      {
        id: 'evt-6',
        sessionId: 'session-1',
        sequence: 6,
        createdAt,
        type: 'thinking.delta',
        textDelta: 'workload logs.',
      },
      {
        id: 'evt-7',
        sessionId: 'session-1',
        sequence: 7,
        createdAt,
        type: 'artifact.updated',
        artifact,
      },
      {
        id: 'evt-8',
        sessionId: 'session-1',
        sequence: 8,
        createdAt,
        type: 'thinking.done',
        summary: 'Checked workload logs.',
        collapsed: true,
      },
      {
        id: 'evt-9',
        sessionId: 'session-1',
        sequence: 9,
        createdAt,
        type: 'tool.completed',
        toolCall: {
          id: 'tool-1',
          adapterId: 'logs',
          toolName: 'logs.query',
          status: 'success',
          summary: 'Found CrashLoopBackOff entries',
          startedAt: createdAt,
          completedAt: createdAt,
        },
      },
      {
        id: 'evt-10',
        sessionId: 'session-1',
        messageId: 'message-1',
        sequence: 10,
        createdAt,
        type: 'message.done',
        role: 'assistant',
        content: 'hello',
        metadata: { source: 'stream' },
      },
    ]

    const state = events.reduce(reduceWorkbenchStreamState, createWorkbenchStreamState())

    expect(state.done).toBe(true)
    expect(state.message).toEqual({
      id: 'message-1',
      sessionId: 'session-1',
      content: 'hello',
      done: true,
      metadata: { source: 'stream' },
    })
    expect(state.toolCalls).toEqual([
      expect.objectContaining({
        id: 'tool-1',
        status: 'success',
        summary: 'Found CrashLoopBackOff entries',
      }),
    ])
    expect(state.artifacts).toEqual([artifact])
    expect(state.sources).toEqual([
      {
        id: 'source-1',
        kind: 'log',
        title: 'pod logs',
        summary: 'CrashLoopBackOff entries',
      },
    ])
    expect(state.thinking).toEqual({
      summary: 'Checked workload logs.',
      collapsed: true,
    })
  })
})
