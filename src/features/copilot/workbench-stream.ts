import type {
  WorkbenchSendMessageStreamRequest,
  WorkbenchStreamEvent,
  WorkbenchToolCall,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { API_BASE_URL, getStoredAccessToken } from '@/features/auth/auth-api'

export interface WorkbenchSSEParseResult {
  events: WorkbenchStreamEvent[]
  rest: string
}

export interface WorkbenchStreamMessageState {
  id?: string
  sessionId?: string
  content: string
  done: boolean
  metadata?: Record<string, unknown>
}

export interface WorkbenchStreamThinkingState {
  summary: string
  collapsed: boolean
}

export interface WorkbenchStreamState {
  message: WorkbenchStreamMessageState
  toolCalls: WorkbenchToolCall[]
  artifacts: unknown[]
  sources: unknown[]
  thinking?: WorkbenchStreamThinkingState
  done: boolean
}

function parseSSEFrame(frame: string): WorkbenchStreamEvent[] {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => {
      const value = line.slice(5)
      return value.startsWith(' ') ? value.slice(1) : value
    })
    .join('\n')
    .trim()

  if (!data || data === '[DONE]') {
    return []
  }
  return [JSON.parse(data) as WorkbenchStreamEvent]
}

export function parseSSEChunk(chunk: string, rest = ''): WorkbenchSSEParseResult {
  const frames = `${rest}${chunk}`.split(/\r?\n\r?\n/)
  return {
    events: frames.slice(0, -1).flatMap(parseSSEFrame),
    rest: frames[frames.length - 1] ?? '',
  }
}

export function createWorkbenchStreamState(): WorkbenchStreamState {
  return {
    message: { content: '', done: false },
    toolCalls: [],
    artifacts: [],
    sources: [],
    done: false,
  }
}

function upsertToolCall(toolCalls: WorkbenchToolCall[], next: WorkbenchToolCall) {
  const index = toolCalls.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [...toolCalls, next]
  }
  return toolCalls.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item))
}

export function reduceWorkbenchStreamState(
  state: WorkbenchStreamState,
  event: WorkbenchStreamEvent,
): WorkbenchStreamState {
  switch (event.type) {
    case 'message.delta':
      return {
        ...state,
        done: false,
        message: {
          ...state.message,
          id: event.messageId ?? state.message.id,
          sessionId: event.sessionId,
          content: `${state.message.content}${event.contentDelta}`,
          done: false,
        },
      }
    case 'message.done':
      return {
        ...state,
        done: true,
        message: {
          ...state.message,
          id: event.messageId ?? state.message.id,
          sessionId: event.sessionId,
          content: event.content,
          done: true,
          metadata: event.metadata,
        },
      }
    case 'tool.started':
    case 'tool.completed':
      return {
        ...state,
        toolCalls: upsertToolCall(state.toolCalls, event.toolCall),
      }
    case 'artifact.updated':
      return {
        ...state,
        artifacts: [...state.artifacts, event.artifact],
      }
    case 'source.updated':
      return {
        ...state,
        sources: [...state.sources, event.source],
      }
    case 'thinking.delta':
      return {
        ...state,
        thinking: {
          summary: `${state.thinking?.summary ?? ''}${event.textDelta}`,
          collapsed: false,
        },
      }
    case 'thinking.done':
      return {
        ...state,
        thinking: {
          summary: event.summary,
          collapsed: event.collapsed,
        },
      }
    default:
      return state
  }
}

export async function streamWorkbenchMessage(
  path: string,
  body: WorkbenchSendMessageStreamRequest,
  onEvent: (event: WorkbenchStreamEvent) => void | Promise<void>,
  signal?: AbortSignal,
) {
  const headers = new Headers({
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  })
  const accessToken = getStoredAccessToken()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const streamPath = path.startsWith('/') ? path : `/${path}`
  const response = await fetch(`${API_BASE_URL}${streamPath}`, {
    method: 'POST',
    body: JSON.stringify(body),
    credentials: 'include',
    headers,
    signal,
  })

  if (!response.ok) {
    throw new Error(`Workbench stream failed: ${response.status} ${response.statusText}`)
  }
  if (!response.body) {
    throw new Error('Workbench stream response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let rest = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      const parsed = parseSSEChunk(decoder.decode(value, { stream: true }), rest)
      rest = parsed.rest
      for (const event of parsed.events) {
        await onEvent(event)
      }
    }

    const parsed = parseSSEChunk(`${decoder.decode()}\n\n`, rest)
    for (const event of parsed.events) {
      await onEvent(event)
    }
  } finally {
    reader.releaseLock()
  }
}
