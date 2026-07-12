import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import type {
  WorkbenchGlobalAssistantOpenRequest,
  WorkbenchSendMessageStreamRequest,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { hasPermission } from '@/features/auth'
import { api } from '@/services/api-client'
import type { ApiResponse, PermissionSnapshot } from '@/types'
import { getAIWorkbenchPathForMode } from '../workbench/navigation'
import {
  createWorkbenchStreamState,
  reduceWorkbenchStreamState,
  streamWorkbenchMessage,
  workbenchStreamEventKey,
  type WorkbenchStreamState,
} from '../workbench/stream'
import type { WorkbenchSession } from '../workbench/types'
import { workbenchKeys } from '../workbench/keys'
import { AIContextMenu, type AIContextMenuState } from './ai-context-menu'
import {
  contextIdentityKey,
  decodeAIContextFromElement,
  inferSelectionKind,
  mergeAIPageContext,
  pinnedContextFromAIContext,
  sanitizeSelectionText,
  workbenchScopeFromAIContext,
  type AIGlobalAssistantAction,
  type AIGlobalAssistantLaunchRequest,
  type AIGlobalAssistantMessage,
  type AIPageContext,
  type AISelectionContext,
} from './ai-context'
import { AIPageContextRegistry, type AIPageContextRegistryValue } from './ai-context-provider'
import { AIFloatButton } from './ai-float-button'
import { buildGlobalAssistantPrompt, buildGlobalAssistantTitle } from './ai-prompts'
import { AISelectionToolbar, type AISelectionToolbarState } from './ai-selection-toolbar'
import './global-assistant.css'

const AIFloatingAssistantPanel = lazy(async () => {
  const module = await import('./ai-floating-assistant-panel')
  return { default: module.AIFloatingAssistantPanel }
})

interface AIPageContextRegistration {
  context: AIPageContext
  id: string
  key: string
}

interface GlobalAIAssistantProviderProps {
  children: ReactNode
  permissionSnapshot?: PermissionSnapshot
}

function sourceWorkbenchFromPath(pathname: string): AIPageContext['sourceWorkbench'] {
  if (pathname.startsWith('/platform')) return 'platform'
  if (pathname.startsWith('/monitoring-workbench')) return 'monitoring'
  if (pathname.startsWith('/delivery') || pathname.startsWith('/applications')) return 'delivery'
  if (pathname.startsWith('/docker') || pathname.startsWith('/docker-workbench')) return 'docker'
  if (pathname.startsWith('/virtualization') || pathname.startsWith('/virtualization-workbench'))
    return 'virtualization'
  return 'ai'
}

function recordGlobalAssistantEvent(
  action: WorkbenchGlobalAssistantOpenRequest['action'],
  context: AIPageContext,
  sessionId?: string,
) {
  const body: WorkbenchGlobalAssistantOpenRequest = {
    action,
    launchContext: context,
    sessionId,
    source: 'global-assistant',
  }
  void api.post('/copilot/global-assistant/events', body).catch(() => undefined)
}

function routeContext(pathname: string, search: string): AIPageContext {
  return {
    sourceWorkbench: sourceWorkbenchFromPath(pathname),
    sourceRoute: `${pathname}${search}`,
    sourceTitle:
      pathname === '/' ? 'Soha Overview' : pathname.split('/').filter(Boolean).join(' / '),
  }
}

function canUseWorkspaceSelection(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (!target.closest('.soha-pro-content-host')) return false
  return !target.closest(
    [
      'input',
      'textarea',
      'select',
      'button',
      'a',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '.monaco-editor',
      '.ant-modal',
      '.ant-drawer',
      '.ant-dropdown',
    ].join(','),
  )
}

function selectionAnchorElement(selection: Selection) {
  const node = selection.anchorNode
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

function selectionSnapshotFromWindow(): {
  context: AISelectionContext
  toolbar: AISelectionToolbarState
} | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const anchorElement = selectionAnchorElement(selection)
  if (!canUseWorkspaceSelection(anchorElement)) return null

  const text = sanitizeSelectionText(selection.toString())
  if (text.length < 2) return null

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const fallbackRect = range.getClientRects()[0]
  const activeRect = rect.width || rect.height ? rect : fallbackRect
  const left = Math.min(
    Math.max((activeRect?.left ?? 16) + (activeRect?.width ?? 0) / 2, 16),
    window.innerWidth - 16,
  )
  const top = Math.max((activeRect?.top ?? 48) - 10, 16)

  return {
    context: {
      text,
      kind: inferSelectionKind(text),
      sourceElementLabel:
        anchorElement?.getAttribute('aria-label') ??
        anchorElement?.textContent?.trim().slice(0, 80),
    },
    toolbar: {
      left,
      top,
      text,
    },
  }
}

function streamMessageStatus(state: WorkbenchStreamState): AIGlobalAssistantMessage['status'] {
  if (state.error || state.agentStatus?.status === 'failed') return 'error'
  if (state.agentStatus?.status === 'cancelled') return 'abort'
  if (state.done || state.message.done) return 'success'
  return 'loading'
}

function streamContent(state: WorkbenchStreamState, fallback: string) {
  if (state.message.content) return state.message.content
  if (state.error) return state.error.message
  if (state.agentStatus?.status === 'failed') return 'Agent 执行失败。'
  if (state.agentStatus?.status === 'cancelled') return '已取消本次回复。'
  return fallback
}

function nextMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

class WorkbenchStreamEventError extends Error {
  code?: string
  retryable?: boolean

  constructor(error: NonNullable<WorkbenchStreamState['error']>) {
    super(error.message)
    this.name = 'WorkbenchStreamEventError'
    this.code = error.code
    this.retryable = error.retryable
  }
}

export function GlobalAIAssistantProvider({
  children,
  permissionSnapshot,
}: GlobalAIAssistantProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const canUseChat = hasPermission(permissionSnapshot, 'observe.ai.chat')
  const routeFallbackContext = useMemo(
    () => routeContext(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const [registrations, setRegistrations] = useState<AIPageContextRegistration[]>([])
  const pageContext = registrations[registrations.length - 1]?.context ?? routeFallbackContext
  const [panelOpen, setPanelOpen] = useState(false)
  const [assistantInput, setAssistantInput] = useState('')
  const [messages, setMessages] = useState<AIGlobalAssistantMessage[]>([])
  const [streamState, setStreamState] = useState<WorkbenchStreamState>(() =>
    createWorkbenchStreamState(),
  )
  const [currentSession, setCurrentSession] = useState<WorkbenchSession | null>(null)
  const [currentSessionContextKey, setCurrentSessionContextKey] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [selectionContext, setSelectionContext] = useState<AISelectionContext | null>(null)
  const [selectionToolbar, setSelectionToolbar] = useState<AISelectionToolbarState | null>(null)
  const [contextMenu, setContextMenu] = useState<AIContextMenuState | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeContext = useMemo(() => mergeAIPageContext(pageContext), [pageContext])

  const registerPageContext = useCallback((id: string, context: AIPageContext, key: string) => {
    setRegistrations((items) => {
      const existing = items.find((item) => item.id === id)
      if (existing?.key === key) return items
      const next = { id, context, key }
      if (!existing) return [...items, next]
      return items.map((item) => (item.id === id ? next : item))
    })
    return () => {
      setRegistrations((items) => items.filter((item) => item.id !== id))
    }
  }, [])

  const ensureSession = useCallback(
    async (context: AIPageContext, action: AIGlobalAssistantAction) => {
      const key = contextIdentityKey(context)
      if (currentSession && currentSessionContextKey === key) {
        return currentSession
      }

      const response = await api.post<ApiResponse<WorkbenchSession>>('/copilot/sessions', {
        title: buildGlobalAssistantTitle(action, context),
        mode: 'root_cause',
        scope: workbenchScopeFromAIContext(context),
        pinnedContext: pinnedContextFromAIContext(context),
        source: 'global-assistant',
        tags: ['global-assistant'],
      })
      setCurrentSession(response.data)
      setCurrentSessionContextKey(key)
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
      return response.data
    },
    [currentSession, currentSessionContextKey, queryClient],
  )

  const sendPrompt = useCallback(
    async (
      action: AIGlobalAssistantAction,
      context: AIPageContext,
      prompt: string,
      selection?: AISelectionContext,
    ) => {
      if (!canUseChat) {
        void message.warning('当前账号没有 AI 助手权限')
        return
      }
      if (running) {
        void message.warning('当前回复仍在生成')
        return
      }

      setPanelOpen(true)
      setContextMenu(null)
      setSelectionToolbar(null)

      const userMessageId = nextMessageId('ai-user')
      const assistantMessageId = nextMessageId('ai-assistant')
      setMessages((items) =>
        items.concat(
          { id: userMessageId, role: 'user', content: prompt, status: 'success' },
          { id: assistantMessageId, role: 'assistant', content: '', status: 'loading' },
        ),
      )
      setStreamState(createWorkbenchStreamState())
      setRunning(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const session = await ensureSession(context, action)
        let nextStreamState = createWorkbenchStreamState()
        const seenEvents = new Set<string>()
        const request: WorkbenchSendMessageStreamRequest = {
          content: prompt,
          mode: 'root_cause',
          scopeOverrides: workbenchScopeFromAIContext(context),
          source: 'global-assistant',
          launchContext: context,
          selectionContext: selection,
          pinnedContext: pinnedContextFromAIContext(context),
        }

        await streamWorkbenchMessage(
          `/copilot/sessions/${session.id}/messages/stream`,
          request,
          (event) => {
            const eventKey = workbenchStreamEventKey(event)
            if (seenEvents.has(eventKey)) return
            seenEvents.add(eventKey)
            nextStreamState = reduceWorkbenchStreamState(nextStreamState, event)
            setStreamState(nextStreamState)
            setMessages((items) =>
              items.map((item) => {
                if (item.id !== assistantMessageId) return item
                return {
                  ...item,
                  id:
                    nextStreamState.message.done && nextStreamState.message.id
                      ? nextStreamState.message.id
                      : item.id,
                  content: streamContent(nextStreamState, item.content),
                  status: streamMessageStatus(nextStreamState),
                }
              }),
            )
            if (nextStreamState.error) {
              throw new WorkbenchStreamEventError(nextStreamState.error)
            }
          },
          controller.signal,
        )

        await queryClient.invalidateQueries({
          queryKey: workbenchKeys.sessions.messages(session.id),
        })
        await queryClient.invalidateQueries({
          queryKey: workbenchKeys.sessions.detail(session.id),
        })
        await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
        await queryClient.invalidateQueries({ queryKey: workbenchKeys.agentRuns.all() })
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError'
        setMessages((items) =>
          items.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: isAbort
                    ? '已取消本次回复。'
                    : error instanceof Error
                      ? error.message
                      : 'AI 请求失败。',
                  status: isAbort ? 'abort' : 'error',
                }
              : item,
          ),
        )
        if (!isAbort) {
          void message.error(error instanceof Error ? error.message : 'AI 请求失败')
        }
      } finally {
        abortRef.current = null
        setRunning(false)
      }
    },
    [canUseChat, ensureSession, message, queryClient, running],
  )

  const launchAssistant = useCallback(
    async (request: AIGlobalAssistantLaunchRequest) => {
      const context = mergeAIPageContext(activeContext, request.contextOverride)
      const selection =
        request.selection ??
        (request.action.includes('selection') ? (selectionContext ?? undefined) : undefined)
      if (request.action === 'open') {
        setPanelOpen(true)
        recordGlobalAssistantEvent('open', context, currentSession?.id)
        return
      }
      const prompt = buildGlobalAssistantPrompt(request.action, context, selection, request.prompt)
      await sendPrompt(request.action, context, prompt, selection)
    },
    [activeContext, currentSession?.id, selectionContext, sendPrompt],
  )

  const openWorkbench = useCallback(() => {
    const params = new URLSearchParams()
    const scope = workbenchScopeFromAIContext(activeContext)
    Object.entries(scope).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    })
    ;(['service', 'pod', 'node', 'entityKind', 'entityName', 'sourceWorkbench'] as const).forEach(
      (key) => {
        const value = activeContext[key]
        if (value) params.set(key, String(value))
      },
    )
    if (currentSession?.id) params.set('session', currentSession.id)
    recordGlobalAssistantEvent('open-workbench', activeContext, currentSession?.id)
    navigate(getAIWorkbenchPathForMode('root_cause', params))
  }, [activeContext, currentSession?.id, navigate])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!canUseChat) {
      setSelectionToolbar(null)
      return undefined
    }

    const updateSelection = () => {
      window.setTimeout(() => {
        const snapshot = selectionSnapshotFromWindow()
        setSelectionContext(snapshot?.context ?? null)
        setSelectionToolbar(snapshot?.toolbar ?? null)
      }, 0)
    }
    const clearSelection = () => {
      setSelectionToolbar(null)
      setContextMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection()
    }

    document.addEventListener('mouseup', updateSelection)
    document.addEventListener('keyup', updateSelection)
    document.addEventListener('selectionchange', updateSelection)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', clearSelection, true)
    return () => {
      document.removeEventListener('mouseup', updateSelection)
      document.removeEventListener('keyup', updateSelection)
      document.removeEventListener('selectionchange', updateSelection)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', clearSelection, true)
    }
  }, [canUseChat])

  useEffect(() => {
    if (!canUseChat) return undefined

    const onContextMenu = (event: MouseEvent) => {
      if (!canUseWorkspaceSelection(event.target)) return
      event.preventDefault()
      const snapshot = selectionSnapshotFromWindow()
      const contextElement =
        event.target instanceof Element ? event.target.closest('[data-ai-context]') : null
      if (snapshot) {
        setSelectionContext(snapshot.context)
      }
      setContextMenu({
        contextOverride: decodeAIContextFromElement(contextElement),
        left: Math.min(Math.max(event.clientX, 12), window.innerWidth - 220),
        top: Math.min(Math.max(event.clientY, 12), window.innerHeight - 180),
        hasSelection: Boolean(snapshot?.context.text || selectionContext?.text),
      })
      setSelectionToolbar(null)
    }
    const closeMenu = () => setContextMenu(null)

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('click', closeMenu)
    return () => {
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('click', closeMenu)
    }
  }, [canUseChat, selectionContext?.text])

  const contextValue = useMemo<AIPageContextRegistryValue>(
    () => ({
      currentContext: activeContext,
      launchAssistant,
      openAssistant: () => setPanelOpen(true),
      openWorkbench,
      registerPageContext,
    }),
    [activeContext, launchAssistant, openWorkbench, registerPageContext],
  )

  return (
    <AIPageContextRegistry.Provider value={contextValue}>
      {children}
      <AIFloatButton
        disabled={!canUseChat}
        hasSelection={Boolean(selectionContext?.text)}
        running={running}
        onAction={(action) => {
          void launchAssistant({ action })
        }}
        onOpenAssistant={() => setPanelOpen(true)}
        onOpenWorkbench={openWorkbench}
      />
      {panelOpen ? (
        <Suspense fallback={null}>
          <AIFloatingAssistantPanel
            context={activeContext}
            disabled={!canUseChat}
            inputValue={assistantInput}
            messages={messages}
            open
            running={running}
            sources={streamState.sources}
            thinkingSummary={streamState.thinking?.summary}
            toolCalls={streamState.toolCalls}
            onCancel={cancelStream}
            onClose={() => setPanelOpen(false)}
            onInputChange={setAssistantInput}
            onOpenWorkbench={openWorkbench}
            onQuickPrompt={(prompt) => {
              void launchAssistant({ action: 'freeform', prompt })
            }}
            onSubmit={(value) => {
              const prompt = value.trim()
              if (!prompt) return
              setAssistantInput('')
              void launchAssistant({ action: 'freeform', prompt })
            }}
          />
        </Suspense>
      ) : null}
      <AISelectionToolbar
        disabled={!canUseChat}
        state={selectionToolbar}
        onAction={(action) => {
          void launchAssistant({ action })
        }}
        onClose={() => setSelectionToolbar(null)}
      />
      <AIContextMenu
        disabled={!canUseChat}
        state={contextMenu}
        onAction={(action) => {
          void launchAssistant({ action, contextOverride: contextMenu?.contextOverride })
        }}
        onClose={() => setContextMenu(null)}
        onOpenWorkbench={openWorkbench}
      />
    </AIPageContextRegistry.Provider>
  )
}
