import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ApiOutlined,
  BranchesOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import {
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Sources,
  ThoughtChain,
  Welcome,
} from '@ant-design/x'
import type { SenderRef } from '@ant-design/x/es/sender'
import '../copilot-pages.css'
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Flex,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import type { WorkbenchSendMessageStreamRequest } from '@opensoha/contracts/gen/ts/sohaapi'
import {
  getAIModelSettingsPath,
  getAIOperationsPath,
  getAIToolsPath,
  getAIWorkbenchPathForMode,
  getAIWorkbenchPathForSession,
} from './navigation'
import { displayWorkbenchSessionTitle } from './model'
import { observeKeys } from '../observe/keys'
import {
  agentRunReplayMessage,
  agentRunTimestamp,
  isExternalAgentRun,
  isExternalAgentRunReplayMessage,
  isRunningExternalAgentRun,
  messageAgentRunRefs,
  sortedAgentRunReplayEvents,
} from './agent-run-replay'
import {
  artifactContextLinks,
  artifactMeta,
  artifactSnapshotText,
  artifactTitle,
  graphNodeLabel,
  type ArtifactContextLink,
  type WorkbenchArtifactEntry,
} from './artifacts'
import {
  bubbleItems,
  isLegacyPlatformContextMessage,
  mergeConversationMessages,
  modelStatusDetail,
  modelStatusValue,
  pendingConversationMessages,
  type ConversationMessage,
  type WorkbenchBubbleStatus,
} from './conversation'
import { LazyWorkbenchGraphView } from './components/graph-view-loader'
import { useWorkbenchRouteState } from './hooks/use-workbench-route-state'
import { workbenchKeys } from './keys'
import {
  RUNNABLE_ANALYSIS_MODE_OPTIONS,
  WORKBENCH_MODE_OPTIONS,
  buildPromptItems,
  defaultAnalysisProfileIdForMode,
  defaultAnalysisQuestion,
  modeDescription,
  modeIcon,
  modeLabel,
} from './mode'
import { workbenchMutations } from './mutations'
import { workbenchQueries } from './queries'
import { WorkbenchShell } from './components/shell'
import {
  WorkbenchStreamEventError,
  agentStatusLabel,
  isRetryableWorkbenchStreamError,
  metadataAgentStatus,
  metadataThinkingSummary,
  replayArtifactsForMessage,
  sourceItemsForArtifactEntry,
  streamBubbleStatus,
  streamFallbackContent,
  streamMessageMetadata,
  thoughtChainStatus,
  toolCallSummaryText,
  workbenchStreamErrorMessage,
  type ThoughtChainStatus,
} from './stream-presentation'
import {
  TOOLSET_BUDGET_FIELDS,
  buildDisabledToolOptions,
  canonicalDisabledToolNames,
  cleanToolsetPayload,
  countObjectKeys,
  numberRecord,
  recommendedAdapterIds,
  scopeOverrideState,
} from './toolset'
import {
  canonicalWorkbenchAgentStatus,
  createWorkbenchStreamState,
  isTerminalWorkbenchAgentStatus,
  reduceWorkbenchStreamState,
  streamWorkbenchMessage,
  workbenchStreamEventKey,
  type WorkbenchStreamState,
} from './stream'
import type { WorkbenchMode, WorkbenchSession, WorkbenchSessionScope } from './types'

const { Paragraph, Text } = Typography

type InspectorView = 'context' | 'evidence' | 'hypotheses' | 'actions'
type WorkbenchStreamRetryInput = {
  sessionId: string
  request: WorkbenchSendMessageStreamRequest
  closeAnalysisOnSuccess?: boolean
  navigateMode?: WorkbenchMode
  openThinkingOnSuccess?: boolean
}
type WorkbenchStreamSubmission = WorkbenchStreamRetryInput & {
  pendingMessages: { user: ConversationMessage; assistant: ConversationMessage }
}
type GeneralChatStatusItem = {
  key: string
  label: string
  value: string | number
  detail: string
  icon: ReactNode
  action?: () => void
}

function formatSessionTimestamp(value?: string) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildScopeSummary(scope?: WorkbenchSessionScope) {
  if (!scope) return '未固定上下文'
  return (
    [
      scope.clusterId,
      scope.namespace,
      scope.workload || scope.service || scope.pod || scope.node,
      scope.alertId,
    ]
      .filter(Boolean)
      .join(' / ') || '未固定上下文'
  )
}

function isSyntheticSession(item: WorkbenchSession) {
  const title = String(item.title || '')
    .trim()
    .toLowerCase()
  return title === 'new chat' || title === '新对话' || title.startsWith('e2e-')
}

export function AIWorkbenchController() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {
    draftScope,
    isExplicitRouteMode,
    location,
    pathMode,
    requestedSessionId,
    searchParams,
    setSearchParams,
    updateSearchParams,
  } = useWorkbenchRouteState()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canUseChat = hasPermission(permissionSnapshotQuery.data?.data, 'observe.ai.chat')
  const canManageInspection = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.ai.inspection.manage',
  )
  const canCreateInspectionTask = canUseChat && canManageInspection
  const canRunRootCause = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.ai.root-cause.run',
  )
  const autoSessionScopeKeyRef = useRef<string>('')
  const routeModePatchKeyRef = useRef<string>('')
  const senderRef = useRef<SenderRef>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const externalRunReplayRef = useRef<
    Record<string, { state: WorkbenchStreamState; seenEventKeys: Set<string> }>
  >({})
  const terminalRunRefreshRef = useRef<Record<string, string>>({})

  const initialMode = pathMode

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameTargetId, setRenameTargetId] = useState<string>()
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [toolsetOpen, setToolsetOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorView, setInspectorView] = useState<InspectorView>('context')
  const [draftMode, setDraftMode] = useState<WorkbenchMode>(initialMode)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<WorkbenchMode>(initialMode)
  const [analysisQuestion, setAnalysisQuestion] = useState('')
  const [selectedAnalysisProfileId, setSelectedAnalysisProfileId] = useState('')
  const [selectedAgentProviderId, setSelectedAgentProviderId] = useState('internal')
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [selectedAdapterIds, setSelectedAdapterIds] = useState<string[]>([])
  const [disabledToolNames, setDisabledToolNames] = useState<string[]>([])
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, number>>({})
  const [scopeOverrides, setScopeOverrides] = useState<Partial<WorkbenchSessionScope>>({})
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string>()
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null)
  const [senderValue, setSenderValue] = useState('')
  const [senderResetVersion, setSenderResetVersion] = useState(0)
  const [localMessages, setLocalMessages] = useState<ConversationMessage[]>([])
  const [lastRetryableInput, setLastRetryableInput] = useState<WorkbenchStreamRetryInput | null>(
    null,
  )

  useEffect(
    () => () => {
      streamAbortRef.current?.abort()
      streamAbortRef.current = null
    },
    [],
  )

  useEffect(() => {
    externalRunReplayRef.current = {}
    terminalRunRefreshRef.current = {}
  }, [requestedSessionId])

  const sessionsQuery = useQuery(workbenchQueries.sessions.all())
  const catalogQuery = useQuery(workbenchQueries.catalog())
  const sessionDetailQuery = useQuery(workbenchQueries.sessions.detail(requestedSessionId))
  const messagesQuery = useQuery(workbenchQueries.sessions.messages(requestedSessionId))
  const agentRunsQuery = useQuery({
    ...workbenchQueries.agentRuns.session(requestedSessionId),
    enabled: Boolean(requestedSessionId),
    refetchInterval: (query) => {
      const runs = query.state.data?.data ?? []
      return runs.some(
        (run) => run.sessionId === requestedSessionId && isRunningExternalAgentRun(run),
      )
        ? 2500
        : false
    },
  })

  const visibleSessions = useMemo(
    () => (sessionsQuery.data?.data ?? []).filter((item) => !isSyntheticSession(item)),
    [sessionsQuery.data?.data],
  )
  const currentSession =
    (sessionDetailQuery.data?.data && !isSyntheticSession(sessionDetailQuery.data.data)
      ? sessionDetailQuery.data.data
      : undefined) ?? visibleSessions.find((item) => item.id === requestedSessionId)
  const currentSessionTitle = displayWorkbenchSessionTitle(currentSession?.title)
  const serverMessages = messagesQuery.data?.data ?? []
  const finalAgentRunIds = useMemo(
    () =>
      serverMessages.reduce((ids, item) => {
        for (const runId of messageAgentRunRefs(item)) {
          ids.add(runId)
        }
        return ids
      }, new Set<string>()),
    [serverMessages],
  )
  const runningExternalAgentRuns = useMemo(() => {
    return (agentRunsQuery.data?.data ?? [])
      .filter(
        (run) =>
          run.sessionId === requestedSessionId &&
          isRunningExternalAgentRun(run) &&
          !finalAgentRunIds.has(run.id),
      )
      .sort(
        (left, right) =>
          agentRunTimestamp(left) - agentRunTimestamp(right) || left.id.localeCompare(right.id),
      )
  }, [agentRunsQuery.data?.data, finalAgentRunIds, requestedSessionId])
  const legacyPlatformMessages = useMemo(
    () => serverMessages.filter(isLegacyPlatformContextMessage),
    [serverMessages],
  )
  const messages = useMemo(
    () => mergeConversationMessages(serverMessages, localMessages, requestedSessionId),
    [localMessages, requestedSessionId, serverMessages],
  )
  const adapters = useMemo(
    () => catalogQuery.data?.data?.adapters ?? [],
    [catalogQuery.data?.data?.adapters],
  )
  const dataSources = useMemo(
    () => catalogQuery.data?.data?.dataSources ?? [],
    [catalogQuery.data?.data?.dataSources],
  )
  const globalSkills = useMemo(
    () => catalogQuery.data?.data?.skillsRegistry ?? [],
    [catalogQuery.data?.data?.skillsRegistry],
  )
  const analysisProfiles = useMemo(
    () => catalogQuery.data?.data?.analysisProfiles ?? [],
    [catalogQuery.data?.data?.analysisProfiles],
  )
  const agentProviders = useMemo(
    () => catalogQuery.data?.data?.agentProviders ?? [],
    [catalogQuery.data?.data?.agentProviders],
  )
  const agentCapabilities = useMemo(
    () => catalogQuery.data?.data?.capabilities ?? [],
    [catalogQuery.data?.data?.capabilities],
  )
  const defaultAgentProviderId = useMemo(() => {
    return (
      agentProviders.find((item) => item.default && item.enabled)?.id ??
      agentProviders.find((item) => item.enabled)?.id ??
      'internal'
    )
  }, [agentProviders])
  const defaultInspectionProfileId = useMemo(() => {
    return analysisProfiles.find((item) => item.enabled && item.mode === 'inspection')?.id
  }, [analysisProfiles])

  useEffect(() => {
    if (!requestedSessionId) return
    if (
      runningExternalAgentRuns.length === 0 &&
      Object.keys(externalRunReplayRef.current).length === 0
    ) {
      return
    }
    const activeRunIds = new Set(runningExternalAgentRuns.map((run) => run.id))
    const replayMessages = runningExternalAgentRuns.map((run) => {
      const replay = externalRunReplayRef.current[run.id] ?? {
        state: createWorkbenchStreamState(),
        seenEventKeys: new Set<string>(),
      }
      let state = replay.state
      for (const event of sortedAgentRunReplayEvents(run, requestedSessionId)) {
        const eventKey = workbenchStreamEventKey(event)
        if (replay.seenEventKeys.has(eventKey)) continue
        replay.seenEventKeys.add(eventKey)
        state = reduceWorkbenchStreamState(state, event)
      }
      replay.state = state
      externalRunReplayRef.current[run.id] = replay
      return agentRunReplayMessage(run, state)
    })

    for (const runId of Object.keys(externalRunReplayRef.current)) {
      if (!activeRunIds.has(runId)) {
        delete externalRunReplayRef.current[runId]
      }
    }

    setLocalMessages((items) => {
      let changed = false
      const next = items.filter((item) => {
        if (!isExternalAgentRunReplayMessage(item)) return true
        const agentRunId = artifactSnapshotText(item.metadata, 'agentRunId', 'agentRuntimeId')
        const keep = agentRunId ? activeRunIds.has(agentRunId) : false
        if (!keep) changed = true
        return keep
      })
      const indexById = new Map(next.map((item, index) => [item.id, index]))
      for (const replayMessage of replayMessages) {
        const index = indexById.get(replayMessage.id)
        if (index === undefined) {
          indexById.set(replayMessage.id, next.length)
          next.push(replayMessage)
          changed = true
        } else {
          const updated = {
            ...replayMessage,
            createdAt: next[index].createdAt,
          }
          if (
            next[index].content !== updated.content ||
            next[index].deliveryStatus !== updated.deliveryStatus ||
            next[index].metadata !== updated.metadata
          ) {
            next[index] = updated
            changed = true
          }
        }
      }
      return changed ? next : items
    })
  }, [requestedSessionId, runningExternalAgentRuns])

  useEffect(() => {
    if (!requestedSessionId) return
    const terminalRuns = (agentRunsQuery.data?.data ?? []).filter(
      (run) =>
        run.sessionId === requestedSessionId &&
        isExternalAgentRun(run) &&
        isTerminalWorkbenchAgentStatus(run.status) &&
        !finalAgentRunIds.has(run.id),
    )
    if (terminalRuns.length === 0) return
    let shouldRefresh = false
    for (const run of terminalRuns) {
      const status = canonicalWorkbenchAgentStatus(run.status)
      const refreshKey = `${run.id}:${status}:${run.updatedAt ?? ''}:${run.completedAt ?? ''}`
      if (terminalRunRefreshRef.current[run.id] === refreshKey) continue
      terminalRunRefreshRef.current[run.id] = refreshKey
      delete externalRunReplayRef.current[run.id]
      shouldRefresh = true
    }
    if (!shouldRefresh) return
    void queryClient.invalidateQueries({
      queryKey: workbenchKeys.sessions.messages(requestedSessionId),
    })
    void queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
    void queryClient.invalidateQueries({
      queryKey: workbenchKeys.sessions.detail(requestedSessionId),
    })
  }, [agentRunsQuery.data?.data, finalAgentRunIds, queryClient, requestedSessionId])

  useEffect(() => {
    if (!requestedSessionId && visibleSessions[0]?.id) {
      updateSearchParams({ session: visibleSessions[0].id })
    }
  }, [requestedSessionId, searchParams, setSearchParams, visibleSessions])

  useEffect(() => {
    setDraftMode(isExplicitRouteMode ? pathMode : currentSession?.metadata?.mode || pathMode)
  }, [currentSession?.id, currentSession?.metadata?.mode, isExplicitRouteMode, pathMode])

  const patchSessionMutation = useMutation({
    ...workbenchMutations.sessions.patch(),
    onSuccess: async (_response, payload) => {
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
      await queryClient.invalidateQueries({
        queryKey: workbenchKeys.sessions.detail(payload.sessionId),
      })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  useEffect(() => {
    if (!currentSession || !isExplicitRouteMode || currentSession.metadata?.mode === pathMode) {
      routeModePatchKeyRef.current = ''
      return
    }
    const patchKey = `${currentSession.id}:${pathMode}`
    if (patchSessionMutation.isPending || routeModePatchKeyRef.current === patchKey) {
      return
    }
    routeModePatchKeyRef.current = patchKey
    patchSessionMutation.mutate({ sessionId: currentSession.id, body: { mode: pathMode } })
  }, [
    currentSession?.id,
    currentSession?.metadata?.mode,
    isExplicitRouteMode,
    pathMode,
    patchSessionMutation.isPending,
    patchSessionMutation.mutate,
  ])

  const createSessionMutation = useMutation({
    ...workbenchMutations.sessions.create(),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
      navigate(
        getAIWorkbenchPathForMode(draftMode, new URLSearchParams({ session: response.data.id })),
      )
      void message.success('已创建会话')
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const createSession = (payload?: { title?: string; scope?: WorkbenchSessionScope }) => {
    createSessionMutation.mutate({
      title: payload?.title || '',
      mode: draftMode,
      agentProviderId: selectedAgentProviderId || defaultAgentProviderId,
      scope: payload?.scope || draftScope,
      tags: [],
    })
  }

  useEffect(() => {
    const scopeKey = JSON.stringify(draftScope)
    const hasScopedEntry = Boolean(
      draftScope.alertId ||
      draftScope.clusterId ||
      draftScope.namespace ||
      draftScope.workload ||
      draftScope.service ||
      draftScope.pod ||
      draftScope.node,
    )
    if (
      !hasScopedEntry ||
      requestedSessionId ||
      !canUseChat ||
      createSessionMutation.isPending ||
      autoSessionScopeKeyRef.current === scopeKey
    ) {
      return
    }
    autoSessionScopeKeyRef.current = scopeKey
    createSessionMutation.mutate({
      title: draftScope.alertId
        ? `Alert ${draftScope.alertId}`
        : draftScope.workload || draftScope.service || draftScope.pod || draftScope.node
          ? `${draftScope.workload || draftScope.service || draftScope.pod || draftScope.node} 分析`
          : '新的会话',
      mode: draftMode,
      agentProviderId: selectedAgentProviderId || defaultAgentProviderId,
      scope: draftScope,
      tags: [],
    })
  }, [canUseChat, createSessionMutation, draftScope, requestedSessionId])

  const deleteSessionMutation = useMutation({
    ...workbenchMutations.sessions.archive(),
    onSuccess: async (_response, sessionId) => {
      if (requestedSessionId === sessionId) {
        updateSearchParams({ session: undefined })
      }
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
      void message.success('会话已归档')
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const buildWorkbenchStreamRequest = (
    content: string,
    mode: WorkbenchMode,
  ): WorkbenchSendMessageStreamRequest => {
    const requestScopeOverrides = scopeOverrideState(scopeOverrides)
    return {
      content,
      mode,
      agentProviderId: selectedAgentProviderId || defaultAgentProviderId,
      toolset: cleanToolsetPayload({
        enabledAdapterIds: selectedAdapterIds,
        enabledSkillIds: selectedSkillIds,
        disabledToolNames: canonicalDisabledToolNames(disabledToolNames, adapters),
        budgetOverrides: numberRecord(budgetOverrides),
        scopeOverrides: requestScopeOverrides,
      }),
      scopeOverrides: requestScopeOverrides,
    }
  }

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: WorkbenchStreamSubmission) => {
      const controller = new AbortController()
      const seenEvents = new Set<string>()
      let streamState = createWorkbenchStreamState()
      streamAbortRef.current = controller
      await streamWorkbenchMessage(
        `/copilot/sessions/${payload.sessionId}/messages/stream`,
        payload.request,
        (event) => {
          const eventKey = workbenchStreamEventKey(event)
          if (seenEvents.has(eventKey)) return
          seenEvents.add(eventKey)
          streamState = reduceWorkbenchStreamState(streamState, event)
          setLocalMessages((items) =>
            items.map((item) => {
              if (item.id === payload.pendingMessages.user.id) {
                return { ...item, deliveryStatus: 'success' as WorkbenchBubbleStatus }
              }
              if (item.id !== payload.pendingMessages.assistant.id) {
                return item
              }
              return {
                ...item,
                id:
                  streamState.message.done && streamState.message.id
                    ? streamState.message.id
                    : item.id,
                content: streamFallbackContent(streamState, item.content),
                deliveryStatus: streamBubbleStatus(streamState),
                metadata: streamMessageMetadata(item.metadata, streamState),
              }
            }),
          )
          if (streamState.toolCalls.length > 0) {
            setThinkingOpen(true)
          }
          if (streamState.error) {
            throw new WorkbenchStreamEventError(streamState.error)
          }
        },
        controller.signal,
      )
      return streamState
    },
    onSuccess: async (streamState, payload) => {
      streamAbortRef.current = null
      setLastRetryableInput(null)
      await queryClient.invalidateQueries({
        queryKey: workbenchKeys.sessions.messages(payload.sessionId),
      })
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.sessions.all() })
      await queryClient.invalidateQueries({
        queryKey: workbenchKeys.sessions.detail(payload.sessionId),
      })
      await queryClient.invalidateQueries({ queryKey: workbenchKeys.agentRuns.all() })
      setLocalMessages((items) =>
        items.filter(
          (item) =>
            item.id !== payload.pendingMessages.user.id &&
            (item.id !== payload.pendingMessages.assistant.id || !streamState.message.id),
        ),
      )
      if (payload.navigateMode) {
        navigate(
          getAIWorkbenchPathForMode(
            payload.navigateMode,
            new URLSearchParams({ session: payload.sessionId }),
          ),
        )
      }
      if (payload.closeAnalysisOnSuccess) {
        setAnalysisOpen(false)
      }
      if (streamState.toolCalls.length > 0 || streamState.artifacts.length > 0) {
        setThinkingOpen(true)
      }
      if (payload.openThinkingOnSuccess) {
        setThinkingOpen(true)
      }
    },
    onError: (err: Error, payload) => {
      streamAbortRef.current = null
      const aborted = err.name === 'AbortError'
      const errorMessage = aborted ? '已取消本次回复。' : workbenchStreamErrorMessage(err)
      setLastRetryableInput(
        !aborted && isRetryableWorkbenchStreamError(err)
          ? {
              sessionId: payload.sessionId,
              request: payload.request,
              closeAnalysisOnSuccess: payload.closeAnalysisOnSuccess,
              navigateMode: payload.navigateMode,
              openThinkingOnSuccess: payload.openThinkingOnSuccess,
            }
          : null,
      )
      setLocalMessages((items) =>
        items.map((item) =>
          item.id === payload.pendingMessages.user.id
            ? {
                ...item,
                deliveryStatus: aborted ? 'abort' : 'error',
                metadata: {
                  ...(item.metadata ?? {}),
                  error: errorMessage,
                  errorRetryable: isRetryableWorkbenchStreamError(err),
                },
              }
            : item.id === payload.pendingMessages.assistant.id
              ? {
                  ...item,
                  content: errorMessage,
                  deliveryStatus: aborted ? 'abort' : 'error',
                  metadata: {
                    ...(item.metadata ?? {}),
                    error: errorMessage,
                    errorCode: err instanceof WorkbenchStreamEventError ? err.code : undefined,
                    errorRetryable: isRetryableWorkbenchStreamError(err),
                  },
                }
              : item,
        ),
      )
      if (!aborted) {
        void message.error(errorMessage)
      }
    },
  })

  const submitWorkbenchStream = (input: WorkbenchStreamRetryInput) => {
    setLastRetryableInput(null)
    const pendingMessages = pendingConversationMessages(input.sessionId, input.request.content)
    setLocalMessages((items) => [...items, pendingMessages.user, pendingMessages.assistant])
    sendMessageMutation.mutate({ ...input, pendingMessages })
  }

  const submitMessage = (value: string) => {
    const content = value.trim()
    if (
      !content ||
      !canUseChat ||
      !currentSession ||
      !requestedSessionId ||
      sendMessageMutation.isPending
    ) {
      return
    }
    setSenderValue('')
    senderRef.current?.clear()
    setSenderResetVersion((version) => version + 1)
    submitWorkbenchStream({
      sessionId: requestedSessionId,
      request: buildWorkbenchStreamRequest(
        content,
        isExplicitRouteMode ? pathMode : currentSession.metadata?.mode || draftMode,
      ),
    })
  }

  const cancelMessageStream = () => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
  }

  const createInspectionFromSessionMutation = useMutation({
    ...workbenchMutations.sessions.createInspectionTask(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.tasks() })
      void message.success('已从当前会话生成巡检任务')
      navigate(getAIOperationsPath(location.search))
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const createInspectionFromSession = () => {
    if (!requestedSessionId) return
    createInspectionFromSessionMutation.mutate({
      sessionId: requestedSessionId,
      body: {
        title: `${currentSessionTitle || '会话'} 巡检模板`,
        scopeType: currentSession?.metadata?.scope?.namespace
          ? 'namespace'
          : currentSession?.metadata?.scope?.clusterId
            ? 'cluster'
            : 'platform',
        clusterId: currentSession?.metadata?.scope?.clusterId,
        namespace: currentSession?.metadata?.scope?.namespace,
        checks: ['cluster_health', 'alert_pressure', 'audit_denials'],
        enabled: true,
        intervalMinutes: 30,
        metadata: {
          ...(defaultInspectionProfileId ? { analysisProfileId: defaultInspectionProfileId } : {}),
        },
      },
    })
  }

  useEffect(() => {
    setSelectedSkillIds(currentSession?.metadata?.toolset?.enabledSkillIds ?? [])
    setSelectedAdapterIds(currentSession?.metadata?.toolset?.enabledAdapterIds ?? [])
    setDisabledToolNames(
      canonicalDisabledToolNames(
        currentSession?.metadata?.toolset?.disabledToolNames ?? [],
        adapters,
      ),
    )
    setBudgetOverrides(numberRecord(currentSession?.metadata?.toolset?.budgetOverrides))
    setScopeOverrides(scopeOverrideState(currentSession?.metadata?.toolset?.scopeOverrides))
  }, [
    adapters,
    currentSession?.id,
    currentSession?.metadata?.toolset?.enabledSkillIds,
    currentSession?.metadata?.toolset?.enabledAdapterIds,
    currentSession?.metadata?.toolset?.disabledToolNames,
    currentSession?.metadata?.toolset?.budgetOverrides,
    currentSession?.metadata?.toolset?.scopeOverrides,
  ])

  useEffect(() => {
    setSelectedAgentProviderId(currentSession?.metadata?.agentProviderId || defaultAgentProviderId)
  }, [currentSession?.id, currentSession?.metadata?.agentProviderId, defaultAgentProviderId])

  const artifactEntries = useMemo<WorkbenchArtifactEntry[]>(() => {
    const entries: WorkbenchArtifactEntry[] = []
    for (const item of [...messages].reverse()) {
      if (item.role !== 'assistant') continue
      const artifacts = replayArtifactsForMessage(item)
      artifacts.forEach((artifact, index) => {
        entries.push({
          key: `${item.id}:${artifact.runId || artifact.kind}:${index}`,
          artifact,
          message: item,
          index,
        })
      })
    }
    return entries
  }, [messages])

  useEffect(() => {
    if (artifactEntries.length === 0) {
      if (selectedArtifactKey) setSelectedArtifactKey(undefined)
      return
    }
    if (!selectedArtifactKey || !artifactEntries.some((item) => item.key === selectedArtifactKey)) {
      setSelectedArtifactKey(artifactEntries[0].key)
    }
  }, [artifactEntries, selectedArtifactKey])

  const activeArtifactEntry =
    artifactEntries.find((item) => item.key === selectedArtifactKey) ?? artifactEntries[0]
  const activeArtifact = activeArtifactEntry?.artifact
  const activeArtifactLinks = activeArtifactEntry
    ? artifactContextLinks(activeArtifactEntry, currentSession)
    : []
  const activeArtifactToolCalls = activeArtifact?.toolExecutions ?? []
  const latestToolArtifactEntry = artifactEntries.find(
    (item) => (item.artifact.toolExecutions ?? []).length > 0,
  )
  const chainArtifactEntry =
    activeArtifactToolCalls.length > 0 ? activeArtifactEntry : latestToolArtifactEntry
  const toolCalls = chainArtifactEntry?.artifact.toolExecutions ?? []
  const hasToolCalls = toolCalls.length > 0
  const chainThinkingSummary =
    metadataThinkingSummary(chainArtifactEntry?.message.metadata) ||
    chainArtifactEntry?.artifact.summary ||
    ''
  const chainAgentStatus = metadataAgentStatus(chainArtifactEntry?.message.metadata)
  const chainToolCallSummary = toolCallSummaryText(toolCalls)
  const activeGraph = activeArtifact?.graph
  const queryError =
    sessionsQuery.error || sessionDetailQuery.error || messagesQuery.error || catalogQuery.error
  const activeMode = isExplicitRouteMode ? pathMode : currentSession?.metadata?.mode || draftMode
  const isGeneralChatMode = activeMode === 'general'
  const visibleUserMessageCount = messages.filter((item) => item.role === 'user').length
  const visibleAssistantMessageCount = messages.filter((item) => item.role === 'assistant').length
  const latestAssistantMessage = [...messages].reverse().find((item) => item.role === 'assistant')
  const promptItems = buildPromptItems(activeMode)
  const conversationItems = visibleSessions.map((item) => {
    const title = displayWorkbenchSessionTitle(item.title)
    const scopeSummary = buildScopeSummary(item.metadata?.scope)
    const modeText = modeLabel(item.metadata?.mode)
    const timeText = formatSessionTimestamp(item.updatedAt)
    const isArchiving =
      deleteSessionMutation.isPending && deleteSessionMutation.variables === item.id
    return {
      key: item.id,
      icon: modeIcon(item.metadata?.mode),
      label: (
        <div
          className="soha-ai-workbench__conversation-label"
          title={`${title} · ${modeText} · ${timeText} · ${scopeSummary}`}
        >
          <span className="soha-ai-workbench__conversation-label-main">
            <span className="soha-ai-workbench__conversation-label-title">{title}</span>
            <span className="soha-ai-workbench__conversation-label-meta">
              {modeText} · {timeText}
            </span>
          </span>
          <span className="soha-ai-workbench__conversation-label-actions">
            <Tooltip title="重命名">
              <Button
                aria-label={`重命名 ${title}`}
                className="soha-ai-workbench__conversation-action"
                icon={<EditOutlined />}
                size="small"
                type="text"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setRenameTargetId(item.id)
                  setRenameValue(title)
                  setRenameOpen(true)
                }}
              />
            </Tooltip>
            <span onClick={(event) => event.stopPropagation()}>
              <Popconfirm
                title="确认归档此会话？"
                description="归档后会话将从当前工作台列表移除。"
                okText="归档"
                cancelText="取消"
                okButtonProps={{ danger: true, loading: isArchiving }}
                onConfirm={() => deleteSessionMutation.mutate(item.id)}
              >
                <Button
                  aria-label={`归档 ${title}`}
                  className="soha-ai-workbench__conversation-action soha-ai-workbench__conversation-action--danger"
                  danger
                  disabled={deleteSessionMutation.isPending && !isArchiving}
                  icon={<DeleteOutlined />}
                  loading={isArchiving}
                  size="small"
                  type="text"
                />
              </Popconfirm>
            </span>
          </span>
        </div>
      ),
    }
  })
  const artifactSummary = [
    {
      key: 'context' as const,
      label: '上下文',
      value: artifactEntries.length,
      description: buildScopeSummary(currentSession?.metadata?.scope),
      icon: <EyeOutlined />,
    },
    {
      key: 'evidence' as const,
      label: '证据',
      value: activeArtifact?.evidence?.length ?? 0,
      description: activeArtifact?.summary || '还没有提取证据摘要',
      icon: <RadarChartOutlined />,
    },
    {
      key: 'hypotheses' as const,
      label: '假设',
      value: activeArtifact?.hypotheses?.length ?? 0,
      description: activeArtifact?.hypotheses?.[0]?.summary || '还没有形成假设',
      icon: <RobotOutlined />,
    },
    {
      key: 'actions' as const,
      label: '建议',
      value: activeArtifact?.recommendations?.length ?? 0,
      description: activeArtifact?.recommendations?.[0] || '还没有建议动作',
      icon: <ToolOutlined />,
    },
  ]
  const enabledDataSources = dataSources.filter((item) => item.enabled)
  const enabledAgentProviders = agentProviders.filter((item) => item.enabled)
  const providerOptions = enabledAgentProviders.map((item) => ({
    value: item.id,
    label: `${item.name}${item.supportsAsync ? ' / async' : ' / inline'}`,
  }))
  const analysisProfileOptions = analysisProfiles
    .filter((item) => item.enabled)
    .map((item) => ({ value: item.id, label: `${item.name} / ${item.mode}` }))
  const selectedAnalysisProfile = analysisProfiles.find(
    (item) => item.id === selectedAnalysisProfileId,
  )
  const activeAgentProvider =
    agentProviders.find((item) => item.id === selectedAgentProviderId) ??
    agentProviders.find((item) => item.id === currentSession?.metadata?.agentProviderId) ??
    agentProviders.find((item) => item.id === defaultAgentProviderId)
  const currentAlertId = currentSession?.metadata?.scope?.alertId
  const activeCapability = agentCapabilities.find(
    (item) => (item.analysisKinds ?? []).includes(activeMode) || item.id === activeMode,
  )
  const analysisCapability = agentCapabilities.find(
    (item) => (item.analysisKinds ?? []).includes(analysisMode) || item.id === analysisMode,
  )
  const disabledToolOptions = useMemo(() => buildDisabledToolOptions(adapters), [adapters])
  const cleanedBudgetOverrides = useMemo(() => numberRecord(budgetOverrides), [budgetOverrides])
  const cleanedScopeOverrides = useMemo(() => scopeOverrideState(scopeOverrides), [scopeOverrides])
  const effectiveAdapterIds =
    selectedAdapterIds.length > 0 ? selectedAdapterIds : adapters.map((item) => item.id)
  const activeDataSourceAdapters = [
    ...new Set(enabledDataSources.map((item) => item.mcpAdapter).filter(Boolean)),
  ]
  const unavailableSelectedAdapterIds = selectedAdapterIds.filter(
    (adapterId) =>
      adapterId !== 'platform-native.v1' && !activeDataSourceAdapters.includes(adapterId),
  )
  const toolsetPolicySummary = [
    {
      label: 'Agent Provider',
      value: activeAgentProvider?.name || selectedAgentProviderId || 'Auto',
      detail:
        activeAgentProvider?.description ||
        '会话级 provider 决定显式分析由内置分析还是外部 agent runner 执行。',
    },
    {
      label: 'Capability',
      value: activeCapability?.name || activeMode,
      detail: activeCapability?.toolRefs?.length
        ? activeCapability.toolRefs.join(', ')
        : '按当前分析模式自动选择 capability 与工具绑定。',
    },
    {
      label: 'Adapter',
      value: selectedAdapterIds.length > 0 ? `${selectedAdapterIds.length} selected` : 'Auto',
      detail:
        selectedAdapterIds.length > 0
          ? selectedAdapterIds.join(', ')
          : '默认允许已注册 adapter，运行时按数据源可用性选择。',
    },
    {
      label: 'Disabled Tools',
      value: disabledToolNames.length,
      detail: disabledToolNames.length > 0 ? disabledToolNames.join(', ') : '没有屏蔽具体工具。',
    },
    {
      label: 'Budget',
      value: countObjectKeys(cleanedBudgetOverrides),
      detail:
        countObjectKeys(cleanedBudgetOverrides) > 0
          ? Object.entries(cleanedBudgetOverrides)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ')
          : '沿用 profile 和数据源默认预算。',
    },
    {
      label: 'Scope Override',
      value: countObjectKeys(cleanedScopeOverrides as Record<string, unknown>),
      detail:
        countObjectKeys(cleanedScopeOverrides as Record<string, unknown>) > 0
          ? buildScopeSummary(cleanedScopeOverrides)
          : '沿用会话固定范围。',
    },
  ]
  const selectedSkillNames = globalSkills
    .filter((item) => selectedSkillIds.includes(item.id))
    .map((item) => item.name)
  const canRunExplicitAnalysis = canUseChat && (activeMode !== 'root_cause' || canRunRootCause)
  const explicitAnalysisTitle = canRunExplicitAnalysis
    ? undefined
    : activeMode === 'root_cause'
      ? '缺少 observe.ai.root-cause.run 权限'
      : '缺少 observe.ai.chat 权限'
  const createInspectionTitle = canCreateInspectionTask
    ? undefined
    : !canUseChat
      ? '缺少 observe.ai.chat 权限'
      : '缺少 observe.ai.inspection.manage 权限'
  const enabledSkills = globalSkills.filter((item) => item.enabled)
  const skillRelevanceTokens = useMemo(() => {
    if (activeMode === 'root_cause') return ['logs', 'metrics', 'traces', 'events', 'alerts']
    if (activeMode === 'performance') return ['metrics', 'traces', 'capacity', 'latency']
    if (activeMode === 'trace') return ['traces', 'logs', 'spans', 'service']
    if (activeMode === 'inspection_review') return ['inspection', 'automation', 'policy', 'events']
    return ['logs', 'metrics', 'traces', 'events', 'platform']
  }, [activeMode])
  const rankedSkills = useMemo(() => {
    const scoreSkill = (skill: (typeof enabledSkills)[number]) => {
      const haystack = [
        skill.name,
        skill.description,
        ...(skill.scopes ?? []),
        ...(skill.capabilityRefs ?? []),
        ...(skill.scopeRules ?? []),
        skill.category,
      ]
        .join(' ')
        .toLowerCase()
      const relevance = skillRelevanceTokens.reduce(
        (score, token) => score + (haystack.includes(token) ? 2 : 0),
        0,
      )
      const selected = selectedSkillIds.includes(skill.id) ? 6 : 0
      return relevance + selected
    }
    return [...enabledSkills].sort(
      (left, right) => scoreSkill(right) - scoreSkill(left) || left.name.localeCompare(right.name),
    )
  }, [enabledSkills, selectedSkillIds, skillRelevanceTokens])
  const primarySkills = rankedSkills.slice(0, showAllSkills ? rankedSkills.length : 3)
  const hiddenSkillCount = Math.max(rankedSkills.length - 3, 0)
  const selectedGraphNode = useMemo(
    () => activeGraph?.nodes?.find((item) => item.id === selectedGraphNodeId) ?? null,
    [activeGraph?.nodes, selectedGraphNodeId],
  )
  const graphFitKey = useMemo(
    () =>
      `${activeGraph?.nodes?.map((item) => item.id).join(',') || ''}::${activeGraph?.edges?.map((item) => item.id).join(',') || ''}`,
    [activeGraph?.edges, activeGraph?.nodes],
  )

  useEffect(() => {
    setSelectedGraphNodeId(activeGraph?.focusNodeId ?? activeGraph?.nodes?.[0]?.id ?? null)
  }, [activeGraph?.focusNodeId, activeGraph?.nodes])

  const canSubmitExplicitAnalysis = canUseChat && (analysisMode !== 'root_cause' || canRunRootCause)
  const handleModeChange = (next: WorkbenchMode) => {
    setDraftMode(next)
    navigate(getAIWorkbenchPathForMode(next, searchParams))
    if (currentSession && currentSession.metadata?.mode !== next) {
      patchSessionMutation.mutate({ sessionId: currentSession.id, body: { mode: next } })
    }
  }
  const handleSessionChange = (sessionId: string) => {
    const selected = visibleSessions.find((item) => item.id === sessionId)
    if (selected) {
      navigate(getAIWorkbenchPathForSession(selected, searchParams))
      return
    }
    updateSearchParams({ session: sessionId })
  }
  const openArtifactLink = (link: ArtifactContextLink) => {
    navigate(link.path)
    if (link.kind === 'inspection') {
      return
    }
    if (link.kind === 'root_cause' || link.kind === 'agent') {
      setThinkingOpen(true)
    }
  }
  const openExplicitAnalysis = () => {
    if (!currentSession || !canRunExplicitAnalysis) return
    const nextMode = activeMode
    const runnableMode = RUNNABLE_ANALYSIS_MODE_OPTIONS.some((item) => item.value === nextMode)
      ? nextMode
      : 'root_cause'
    setAnalysisMode(runnableMode)
    setSelectedAgentProviderId(currentSession.metadata?.agentProviderId || defaultAgentProviderId)
    setSelectedAnalysisProfileId(defaultAnalysisProfileIdForMode(runnableMode, analysisProfiles))
    setAnalysisQuestion(defaultAnalysisQuestion(runnableMode, currentSession))
    setAnalysisOpen(true)
  }
  const submitExplicitAnalysis = () => {
    if (!currentSession || !canSubmitExplicitAnalysis || sendMessageMutation.isPending) return
    const question =
      analysisQuestion.trim() || defaultAnalysisQuestion(analysisMode, currentSession)
    submitWorkbenchStream({
      sessionId: currentSession.id,
      request: buildWorkbenchStreamRequest(question, analysisMode),
      closeAnalysisOnSuccess: true,
      navigateMode: analysisMode,
      openThinkingOnSuccess: true,
    })
  }
  const openInspector = (view: InspectorView) => {
    setInspectorView(view)
    setInspectorOpen(true)
  }
  const generalChatStatusItems: GeneralChatStatusItem[] = [
    {
      key: 'messages',
      label: '消息',
      value: `${visibleUserMessageCount}/${visibleAssistantMessageCount}`,
      detail: '用户消息 / AI 回复',
      icon: <RobotOutlined />,
    },
    {
      key: 'model',
      label: '模型',
      value: modelStatusValue(latestAssistantMessage, sendMessageMutation.isPending),
      detail: modelStatusDetail(latestAssistantMessage, sendMessageMutation.isPending),
      icon: <ApiOutlined />,
      action: () => navigate(getAIModelSettingsPath(location.search)),
    },
    {
      key: 'legacy',
      label: '旧回复',
      value: legacyPlatformMessages.length,
      detail:
        legacyPlatformMessages.length > 0
          ? '已隐藏旧版平台上下文兜底回复'
          : '当前会话没有旧版兜底回复',
      icon: <EyeOutlined />,
    },
    {
      key: 'analysis',
      label: '分析',
      value: artifactEntries.length,
      detail: artifactEntries.length > 0 ? '当前会话已有显式分析工件' : '普通聊天不会自动运行工具',
      icon: <BranchesOutlined />,
      action: artifactEntries.length > 0 ? () => openInspector('context') : openExplicitAnalysis,
    },
  ]
  const assemblyItems = [
    {
      key: 'adapters',
      label: '适配器',
      value: selectedAdapterIds.length || effectiveAdapterIds.length || 'Auto',
      detail:
        selectedAdapterIds.length > 0 ? selectedAdapterIds.join(', ') : '自动允许已注册 adapter',
      icon: <ApiOutlined />,
    },
    {
      key: 'skills',
      label: '技能',
      value: selectedSkillNames.length || globalSkills.filter((item) => item.enabled).length,
      detail: selectedSkillNames.length > 0 ? selectedSkillNames.join(', ') : '沿用全局技能',
      icon: <RobotOutlined />,
    },
    {
      key: 'sources',
      label: '数据源',
      value: enabledDataSources.length,
      detail:
        enabledDataSources.length > 0
          ? enabledDataSources.map((item) => item.name).join(', ')
          : '暂无可用数据源',
      icon: <RadarChartOutlined />,
    },
    {
      key: 'budget',
      label: '预算',
      value: `${disabledToolNames.length}/${countObjectKeys(cleanedBudgetOverrides)}`,
      detail: `${disabledToolNames.length} 个工具屏蔽，${countObjectKeys(cleanedBudgetOverrides)} 项预算覆盖`,
      icon: <ToolOutlined />,
    },
  ]
  const quickActionItems = [
    ...(currentAlertId
      ? [
          {
            key: 'alert',
            label: '原告警',
            detail: currentAlertId,
            icon: <LinkOutlined />,
            disabled: false,
            tooltip: '回到原告警',
            onClick: () => navigate(`/monitoring-workbench/alerts/${currentAlertId}`),
          },
        ]
      : []),
    {
      key: 'context',
      label: '上下文',
      detail: buildScopeSummary(currentSession?.metadata?.scope),
      icon: <EyeOutlined />,
      disabled: !currentSession,
      tooltip: currentSession ? '查看当前会话上下文' : '先选择会话',
      onClick: () => openInspector('context'),
    },
    {
      key: 'analysis',
      label: '显式分析',
      detail: activeMode === 'general' ? '结构化输出' : modeLabel(activeMode),
      icon: <ThunderboltOutlined />,
      disabled: !currentSession || !canRunExplicitAnalysis,
      tooltip: !currentSession ? '先选择会话' : explicitAnalysisTitle || '运行显式分析',
      onClick: openExplicitAnalysis,
    },
    {
      key: 'inspection',
      label: '生成巡检任务',
      detail: '自动化任务',
      icon: <PlayCircleOutlined />,
      disabled: !currentSession || !canCreateInspectionTask,
      tooltip: !currentSession ? '先选择会话' : createInspectionTitle || '生成巡检任务',
      onClick: createInspectionFromSession,
    },
    {
      key: 'trace',
      label: '分析链路',
      detail: `${toolCalls.length} 步`,
      icon: <BranchesOutlined />,
      disabled: !hasToolCalls,
      tooltip: hasToolCalls ? '查看分析链路' : '当前会话还没有工具调用步骤',
      onClick: () => setThinkingOpen(true),
    },
  ]
  const setBudgetOverrideValue = (key: string, value: number | string | null) => {
    setBudgetOverrides((current) => {
      const next = { ...current }
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        next[key] = numberValue
      } else {
        delete next[key]
      }
      return next
    })
  }
  const setScopeOverrideValue = (key: keyof WorkbenchSessionScope, value: string) => {
    setScopeOverrides((current) => {
      const next = { ...current }
      const trimmed = value.trim()
      if (trimmed) {
        next[key] = trimmed as never
      } else {
        delete next[key]
      }
      return next
    })
  }
  const setScopeOverrideNumberValue = (
    key: keyof WorkbenchSessionScope,
    value: number | string | null,
  ) => {
    setScopeOverrides((current) => {
      const next = { ...current }
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        next[key] = numberValue as never
      } else {
        delete next[key]
      }
      return next
    })
  }
  const saveToolset = () => {
    if (!currentSession) return
    const payload = cleanToolsetPayload({
      enabledAdapterIds: selectedAdapterIds,
      enabledSkillIds: selectedSkillIds,
      disabledToolNames: canonicalDisabledToolNames(disabledToolNames, adapters),
      budgetOverrides: cleanedBudgetOverrides,
      scopeOverrides: cleanedScopeOverrides,
    })
    patchSessionMutation.mutate(
      {
        sessionId: currentSession.id,
        body: {
          toolset: payload,
          agentProviderId: selectedAgentProviderId || defaultAgentProviderId,
        },
      },
      {
        onSuccess: () => void message.success('已更新会话级工具装配'),
      },
    )
  }
  const applyRecommendedToolset = () => {
    setSelectedAdapterIds(recommendedAdapterIds(adapters, dataSources))
    setSelectedSkillIds(globalSkills.filter((item) => item.enabled).map((item) => item.id))
    setDisabledToolNames([])
    setBudgetOverrides({ timeoutSeconds: 60, maxEvidenceItems: 20 })
    setScopeOverrides({})
  }
  const clearToolset = () => {
    setSelectedAdapterIds([])
    setSelectedSkillIds([])
    setDisabledToolNames([])
    setBudgetOverrides({})
    setScopeOverrides({})
  }

  const renderInspectorBody = () => {
    if (!currentSession && inspectorView === 'context') {
      return (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          title="未选择会话"
          description="选择一个 AI 会话后查看上下文范围、证据和建议。"
        />
      )
    }

    if (inspectorView === 'context') {
      return currentSession ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small" title="上下文范围">
            <Paragraph style={{ marginBottom: 0 }}>
              {buildScopeSummary(currentSession.metadata?.scope)}
            </Paragraph>
            {currentSession.metadata?.scope?.alertId ? (
              <Button
                style={{ marginTop: 12 }}
                size="small"
                onClick={() =>
                  navigate(
                    `/monitoring-workbench/alerts/${currentSession.metadata?.scope?.alertId}`,
                  )
                }
              >
                查看原始告警详情
              </Button>
            ) : null}
          </Card>
          <Card size="small" title="分析运行">
            {(currentSession.metadata?.analysisRunRefs ?? []).length === 0 ? (
              <ManagementState
                bordered={false}
                compact
                title="暂无运行记录"
                description="当前会话还没有关联的分析运行。"
              />
            ) : (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {(currentSession.metadata?.analysisRunRefs ?? []).map((item) => (
                  <Flex key={item.id} justify="space-between">
                    <Text>{item.kind}</Text>
                    <StatusTag value={item.status || 'completed'} />
                  </Flex>
                ))}
              </Space>
            )}
          </Card>
        </Space>
      ) : (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          title="未选择会话"
          description="选择一个 AI 会话后查看上下文。"
        />
      )
    }

    if (inspectorView === 'evidence') {
      const sources = sourceItemsForArtifactEntry(activeArtifactEntry)
      return activeArtifact ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {(activeArtifact.evidence ?? []).length === 0 && sources.length === 0 ? (
            <ManagementState
              bordered={false}
              compact
              title="暂无证据"
              description="当前分析工件还没有结构化证据。"
            />
          ) : (
            <>
              {sources.length > 0 ? <Sources title="证据来源" items={sources} /> : null}
              {(activeArtifact.evidence ?? []).map((item) => (
                <Card key={item.id} size="small">
                  <Flex justify="space-between">
                    <Text strong>{item.title}</Text>
                    {item.severity ? <StatusTag value={item.severity} /> : null}
                  </Flex>
                  <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                    {item.summary}
                  </Paragraph>
                </Card>
              ))}
            </>
          )}
        </Space>
      ) : (
        <ManagementState
          bordered={false}
          compact
          title="暂无分析工件"
          description="会话产生分析结果后这里会展示证据。"
        />
      )
    }

    if (inspectorView === 'hypotheses') {
      return activeArtifact ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {(activeArtifact.hypotheses ?? []).length === 0 ? (
            <ManagementState
              bordered={false}
              compact
              title="暂无假设"
              description="当前分析工件还没有形成候选根因。"
            />
          ) : (
            (activeArtifact.hypotheses ?? []).map((item) => (
              <Card key={item.id} size="small">
                <Flex justify="space-between">
                  <Text strong>{item.title}</Text>
                  <Tag color="gold">{item.confidence}%</Tag>
                </Flex>
                <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                  {item.summary}
                </Paragraph>
              </Card>
            ))
          )}
        </Space>
      ) : (
        <ManagementState
          bordered={false}
          compact
          title="暂无假设"
          description="选择一个分析工件后查看候选根因。"
        />
      )
    }

    return activeArtifact ? (
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {(activeArtifact.recommendations ?? []).length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title="暂无建议动作"
            description="当前分析工件还没有生成下一步操作。"
          />
        ) : (
          (activeArtifact.recommendations ?? []).map((item) => (
            <Card key={item} size="small">
              <Paragraph style={{ marginBottom: 0 }}>{item}</Paragraph>
            </Card>
          ))
        )}
      </Space>
    ) : (
      <ManagementState
        bordered={false}
        compact
        title="暂无建议"
        description="选择一个分析工件后查看建议动作。"
      />
    )
  }

  return (
    <>
      <WorkbenchShell
        alerts={
          <>
            {!canUseChat ? (
              <Alert
                type="warning"
                showIcon
                title="当前账号缺少 observe.ai.chat 权限，无法发送消息或创建会话。"
              />
            ) : null}

            {queryError ? (
              <Alert
                type="error"
                showIcon
                title="工作台数据加载失败"
                description={
                  queryError instanceof Error
                    ? queryError.message
                    : '请检查当前 API 服务和权限快照。'
                }
              />
            ) : null}

            {lastRetryableInput ? (
              <Alert
                type="warning"
                showIcon
                title="上一次 Workbench 流式调用可重试"
                description={
                  <Space size={10} wrap>
                    <Text>{lastRetryableInput.request.content}</Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => submitWorkbenchStream(lastRetryableInput)}
                      disabled={sendMessageMutation.isPending}
                    >
                      重试
                    </Button>
                  </Space>
                }
              />
            ) : null}
          </>
        }
      >
        <aside className="soha-ai-workbench-sidebar">
          <div className="soha-ai-workbench__tools-header">
            <div className="soha-ai-workbench__tools-title">
              <span className="soha-ai-workbench__tools-icon">{modeIcon(activeMode)}</span>
              <span>
                <Text strong>会话记录</Text>
                <Text type="secondary">
                  {visibleSessions.length > 0
                    ? `${visibleSessions.length} 个会话`
                    : '从这里切换当前会话'}
                </Text>
              </span>
            </div>
            <Tooltip title="模型设置">
              <Button
                aria-label="模型设置"
                className="soha-ai-workbench__header-menu-button"
                icon={<RobotOutlined />}
                size="small"
                type="text"
                onClick={() => navigate(getAIModelSettingsPath(location.search))}
              />
            </Tooltip>
          </div>

          <div className="soha-ai-workbench__session-mode">
            <Text type="secondary">对话类型</Text>
            <Select<WorkbenchMode>
              className="soha-ai-workbench__mode-select"
              size="small"
              value={activeMode}
              prefix={modeIcon(activeMode)}
              options={WORKBENCH_MODE_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              onChange={handleModeChange}
              optionRender={(option) => {
                const mode = option.value as WorkbenchMode
                return (
                  <div className="soha-ai-workbench__mode-option">
                    <span>{modeLabel(mode)}</span>
                    <small>{modeDescription(mode)}</small>
                  </div>
                )
              }}
            />
            <Paragraph className="soha-ai-workbench__mode-description">
              {modeDescription(activeMode)}
            </Paragraph>
          </div>

          <Conversations
            items={conversationItems}
            activeKey={currentSession?.id}
            onActiveChange={(value) => handleSessionChange(String(value))}
            className="soha-ai-workbench__conversations"
            creation={{
              icon: <EditOutlined />,
              label: '新建会话',
              onClick: () => createSession({ scope: draftScope }),
              disabled: !canUseChat || createSessionMutation.isPending,
            }}
          />
        </aside>

        <main className="soha-ai-workbench__canvas">
          <div className="soha-ai-workbench__dialog-shell">
            {!currentSession ? (
              <div className="soha-ai-workbench__empty-state">
                <Welcome
                  icon={<ExperimentOutlined />}
                  title={visibleSessions.length > 0 ? '正在准备会话' : '开始新的对话'}
                  description={
                    visibleSessions.length > 0
                      ? '正在同步当前会话，请稍候。'
                      : '从左侧会话记录选择已有会话，或直接新建一个会话开始聊天和分析。'
                  }
                  extra={
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={createSessionMutation.isPending}
                        onClick={() => createSession({ scope: draftScope })}
                        disabled={!canUseChat}
                      >
                        新建会话
                      </Button>
                      <Button onClick={() => navigate(getAIOperationsPath(location.search))}>
                        查看巡检与自动化
                      </Button>
                      <Button onClick={() => navigate(getAIToolsPath(location.search))}>
                        查看工具与技能
                      </Button>
                    </Space>
                  }
                />
              </div>
            ) : (
              <div className="soha-ai-workbench__conversation-card">
                {artifactEntries.length > 0 ? (
                  <div className="soha-ai-workbench__artifact-strip">
                    <div className="soha-ai-workbench__artifact-strip-head">
                      <Text strong>分析工件历史</Text>
                      <Tag>{artifactEntries.length}</Tag>
                    </div>
                    <div className="soha-ai-workbench__artifact-list">
                      {artifactEntries.map((entry) => {
                        const selected = entry.key === activeArtifactEntry?.key
                        const contextLinks = artifactContextLinks(entry, currentSession)
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            className={`soha-ai-workbench__artifact-item ${selected ? 'is-active' : ''}`}
                            onClick={() => setSelectedArtifactKey(entry.key)}
                          >
                            <span className="soha-ai-workbench__artifact-title">
                              {artifactTitle(entry)}
                            </span>
                            <span className="soha-ai-workbench__artifact-meta">
                              {artifactMeta(entry)}
                            </span>
                            <span className="soha-ai-workbench__artifact-counts">
                              {entry.artifact.evidence?.length ?? 0} 证据 ·{' '}
                              {entry.artifact.recommendations?.length ?? 0} 建议
                            </span>
                            {contextLinks.length > 0 ? (
                              <span className="soha-ai-workbench__artifact-context">
                                {contextLinks.slice(0, 3).map((link) => (
                                  <Tag key={`${entry.key}-${link.key}`} variant="filled">
                                    {link.label}
                                  </Tag>
                                ))}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {activeGraph?.nodes?.length ? (
                  <div className="soha-ai-workbench__graph-panel">
                    <div className="soha-ai-workbench__graph-head">
                      <div>
                        <Text strong>分析工件图谱</Text>
                        <Paragraph className="soha-ai-workbench__conversation-subtitle">
                          {activeArtifact?.summary ||
                            '把 traces、logs、metrics 与假设收敛成一张会话内动态图。'}
                        </Paragraph>
                      </div>
                      <Space size={8} wrap>
                        <Tag color="blue">{activeArtifact?.kind || activeMode}</Tag>
                        {activeArtifact?.runId ? <Tag>{activeArtifact.runId}</Tag> : null}
                        <Tag>{activeGraph.nodes?.length || 0} 节点</Tag>
                        <Tag>{activeGraph.edges?.length || 0} 连线</Tag>
                      </Space>
                    </div>
                    {activeArtifactLinks.length > 0 ? (
                      <div className="soha-ai-workbench__artifact-linkbar">
                        <Text type="secondary">关联入口</Text>
                        <Space size={[6, 6]} wrap>
                          {activeArtifactLinks.map((link) => (
                            <Button
                              key={link.key}
                              size="small"
                              type="text"
                              icon={<LinkOutlined />}
                              onClick={() => openArtifactLink(link)}
                            >
                              {`${link.label}: ${link.value}`}
                            </Button>
                          ))}
                        </Space>
                      </div>
                    ) : null}
                    {!enabledDataSources.some((item) =>
                      ['logs', 'metrics', 'traces'].includes(item.sourceKind),
                    ) ? (
                      <Alert
                        type="info"
                        showIcon
                        title="当前还没有可用的 logs / metrics / traces 数据源"
                        description="现在展示的是会话范围根节点。配置 Elasticsearch/Loki、Prometheus、Jaeger 之后，根因图会自动扩展成错误链路、日志签名和指标挂件。"
                      />
                    ) : null}
                    <div className="soha-ai-workbench__graph-layout">
                      <LazyWorkbenchGraphView
                        fitKey={graphFitKey}
                        graph={activeGraph}
                        onSelectNode={setSelectedGraphNodeId}
                      />
                      <div className="soha-workbench-graph-selection">
                        {selectedGraphNode ? (
                          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                            <div>
                              <Space size={[8, 8]} wrap>
                                <Text strong>{selectedGraphNode.title}</Text>
                                <Tag>{graphNodeLabel(selectedGraphNode.kind)}</Tag>
                                {selectedGraphNode.severity ? (
                                  <StatusTag value={selectedGraphNode.severity} />
                                ) : null}
                              </Space>
                              {selectedGraphNode.subtitle ? (
                                <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                                  {selectedGraphNode.subtitle}
                                </Paragraph>
                              ) : null}
                            </div>
                            {selectedGraphNode.sourceRefs?.length ? (
                              <div className="soha-ai-workbench__tool-chip-list">
                                {selectedGraphNode.sourceRefs.map((item) => (
                                  <Tag key={`${selectedGraphNode.id}-${item}`}>{item}</Tag>
                                ))}
                              </div>
                            ) : null}
                            {selectedGraphNode.kind === 'missing_source' ? (
                              <Alert
                                type="info"
                                showIcon
                                title="当前会话缺少这类观测源"
                                description="先到“工具与技能”或“模型设置 / 数据源配置”里补上对应连接，再重新执行显式分析。"
                              />
                            ) : null}
                            {selectedGraphNode.kind === 'recommendation' ? (
                              <Alert
                                type="success"
                                showIcon
                                title="建议的下一步动作"
                                description={
                                  selectedGraphNode.subtitle || '优先缩小 scope，再重新分析。'
                                }
                              />
                            ) : null}
                            {selectedGraphNode.evidenceIds?.length ? (
                              <Card size="small" title="关联证据">
                                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                                  {(activeArtifact?.evidence ?? [])
                                    .filter((item) =>
                                      selectedGraphNode.evidenceIds?.includes(item.id),
                                    )
                                    .map((item) => (
                                      <div key={item.id}>
                                        <Text strong>{item.title}</Text>
                                        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                                          {item.summary}
                                        </Paragraph>
                                      </div>
                                    ))}
                                </Space>
                              </Card>
                            ) : null}
                            {selectedGraphNode.attributes ? (
                              <Card size="small" title="节点属性">
                                <pre className="soha-workbench-graph-json">
                                  {JSON.stringify(selectedGraphNode.attributes, null, 2)}
                                </pre>
                              </Card>
                            ) : null}
                          </Space>
                        ) : (
                          <ManagementState
                            bordered={false}
                            compact
                            kind="select-scope"
                            title="未选择图谱节点"
                            description="点击图中的节点查看链路明细。"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="soha-ai-workbench__conversation-scroll">
                  {messages.length === 0 ? (
                    <Welcome
                      icon={<ExperimentOutlined />}
                      title="开始新的对话"
                      description="围绕当前会话发起提问，AI 会把工具调用、证据和建议回流到这里。"
                      extra={
                        <Prompts
                          title="建议起手问题"
                          wrap
                          items={promptItems.map((item) => ({
                            key: item.key,
                            label: item.label,
                            description: item.label,
                          }))}
                          onItemClick={({ data }) => {
                            submitMessage(String(data.label))
                          }}
                        />
                      }
                    />
                  ) : (
                    <Bubble.List
                      autoScroll
                      items={bubbleItems(messages)}
                      role={{
                        ai: {
                          placement: 'start',
                          avatar: <RobotOutlined />,
                          variant: 'borderless',
                        },
                        user: { placement: 'end', variant: 'filled' },
                        system: { placement: 'start', variant: 'outlined' },
                      }}
                      style={{ flex: 1, overflow: 'auto', paddingRight: 8 }}
                    />
                  )}
                </div>

                <Sender
                  key={senderResetVersion}
                  ref={senderRef}
                  placeholder="输入问题、分析目标或进一步追问"
                  loading={sendMessageMutation.isPending}
                  disabled={!canUseChat || !currentSession}
                  value={senderValue}
                  onChange={setSenderValue}
                  onCancel={cancelMessageStream}
                  onSubmit={submitMessage}
                  header={
                    <Prompts
                      wrap
                      items={promptItems}
                      onItemClick={({ data }) => {
                        submitMessage(String(data.label))
                      }}
                    />
                  }
                />
              </div>
            )}
          </div>
        </main>
        <aside className="soha-ai-workbench__tools-pane">
          {isGeneralChatMode ? (
            <>
              <div className="soha-ai-workbench__tools-header">
                <div className="soha-ai-workbench__tools-title">
                  <span className="soha-ai-workbench__tools-icon">
                    <RobotOutlined />
                  </span>
                  <span>
                    <Text strong>聊天状态</Text>
                    <Text type="secondary">模型调用、消息状态</Text>
                  </span>
                </div>
                <Tooltip title="模型设置">
                  <Button
                    aria-label="模型设置"
                    icon={<ApiOutlined />}
                    size="small"
                    type="text"
                    onClick={() => navigate(getAIModelSettingsPath(location.search))}
                  />
                </Tooltip>
              </div>

              <div className="soha-ai-workbench__focus-grid">
                {generalChatStatusItems.map((item) => (
                  <Tooltip key={item.key} title={item.detail}>
                    <button
                      className="soha-ai-workbench__focus-tile"
                      type="button"
                      onClick={() => item.action?.()}
                    >
                      <span className="soha-ai-workbench__insight-icon">{item.icon}</span>
                      <span className="soha-ai-workbench__focus-value">{item.value}</span>
                      <span className="soha-ai-workbench__focus-label">{item.label}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>

              {legacyPlatformMessages.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  className="soha-ai-workbench__legacy-chat-alert"
                  title="已隐藏旧版平台上下文回复"
                  description="这些历史回复来自早期兜底逻辑，不是大模型输出；后续普通聊天只展示真实用户消息、模型回复和明确错误状态。"
                />
              ) : null}

              <div className="soha-ai-workbench__tool-section soha-ai-workbench__tool-section--compact">
                <div className="soha-ai-workbench__tool-section-title">
                  <Text strong>快捷入口</Text>
                  <Button
                    size="small"
                    type="text"
                    onClick={openExplicitAnalysis}
                    disabled={!currentSession || !canRunExplicitAnalysis}
                  >
                    显式分析
                  </Button>
                </div>
                <div className="soha-ai-workbench__quick-grid">
                  <button
                    className="soha-ai-workbench__quick-action"
                    type="button"
                    onClick={() => navigate(getAIModelSettingsPath(location.search))}
                  >
                    <span className="soha-ai-workbench__assembly-icon">
                      <ApiOutlined />
                    </span>
                    <span>
                      <strong>模型设置</strong>
                      <small>选择 Gateway 默认模型和 route</small>
                    </span>
                  </button>
                  <button
                    className="soha-ai-workbench__quick-action"
                    type="button"
                    onClick={openExplicitAnalysis}
                    disabled={!currentSession || !canRunExplicitAnalysis}
                  >
                    <span className="soha-ai-workbench__assembly-icon">
                      <ThunderboltOutlined />
                    </span>
                    <span>
                      <strong>显式分析</strong>
                      <small>需要工具和证据时手动触发</small>
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="soha-ai-workbench__tools-header">
                <div className="soha-ai-workbench__tools-title">
                  <span className="soha-ai-workbench__tools-icon">
                    <BranchesOutlined />
                  </span>
                  <span>
                    <Text strong>会话洞察</Text>
                    <Text type="secondary">证据、假设、建议</Text>
                  </span>
                </div>
                <Tooltip title={hasToolCalls ? '分析链路' : '当前会话还没有工具调用步骤'}>
                  <Button
                    aria-label="分析链路"
                    disabled={!hasToolCalls}
                    icon={<BranchesOutlined />}
                    size="small"
                    type="text"
                    onClick={() => setThinkingOpen(true)}
                  />
                </Tooltip>
              </div>

              <div className="soha-ai-workbench__focus-grid">
                {artifactSummary.map((item) => (
                  <Tooltip key={item.key} title={item.description}>
                    <button
                      className="soha-ai-workbench__focus-tile"
                      type="button"
                      onClick={() => openInspector(item.key)}
                    >
                      <span className="soha-ai-workbench__insight-icon">{item.icon}</span>
                      <span className="soha-ai-workbench__focus-value">{item.value}</span>
                      <span className="soha-ai-workbench__focus-label">{item.label}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>

              <div className="soha-ai-workbench__tool-section soha-ai-workbench__tool-section--compact">
                <div className="soha-ai-workbench__tool-section-title">
                  <Text strong>会话装配</Text>
                  <Button size="small" icon={<ToolOutlined />} onClick={() => setToolsetOpen(true)}>
                    工具装配
                  </Button>
                </div>
                <div className="soha-ai-workbench__assembly-grid">
                  {assemblyItems.map((item) => (
                    <Tooltip key={item.key} title={item.detail}>
                      <button
                        className="soha-ai-workbench__assembly-tile"
                        type="button"
                        onClick={() => setToolsetOpen(true)}
                      >
                        <span className="soha-ai-workbench__assembly-icon">{item.icon}</span>
                        <span className="soha-ai-workbench__assembly-main">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </span>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="soha-ai-workbench__tool-section soha-ai-workbench__tool-section--compact">
                <div className="soha-ai-workbench__tool-section-title">
                  <Text strong>快捷动作</Text>
                  <Button
                    size="small"
                    type="text"
                    onClick={() => navigate(getAIToolsPath(location.search))}
                  >
                    工具与技能
                  </Button>
                </div>
                <div className="soha-ai-workbench__quick-grid">
                  {quickActionItems.map((item) => (
                    <Tooltip key={item.key} title={item.tooltip}>
                      <button
                        className={`soha-ai-workbench__quick-action ${item.disabled ? 'is-disabled' : ''}`}
                        disabled={item.disabled}
                        title={item.tooltip}
                        type="button"
                        onClick={() => {
                          if (item.disabled) return
                          item.onClick()
                        }}
                      >
                        <span className="soha-ai-workbench__assembly-icon">{item.icon}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="soha-ai-workbench__tool-section soha-ai-workbench__tool-section--compact">
                <div className="soha-ai-workbench__tool-section-title">
                  <Text strong>Skills</Text>
                  {hiddenSkillCount > 0 ? (
                    <Button
                      size="small"
                      type="text"
                      onClick={() => setShowAllSkills((current) => !current)}
                    >
                      {showAllSkills ? '收起' : `更多 ${hiddenSkillCount}`}
                    </Button>
                  ) : null}
                </div>
                {primarySkills.length === 0 ? (
                  <div className="soha-ai-workbench__skill-empty">暂无启用 Skills</div>
                ) : (
                  <div className="soha-ai-workbench__skill-chip-grid">
                    {primarySkills.map((skill) => {
                      const selected = selectedSkillIds.includes(skill.id)
                      return (
                        <Tooltip
                          key={skill.id}
                          title={
                            skill.description || (skill.scopes ?? []).join(', ') || '未填写说明'
                          }
                        >
                          <button
                            className={`soha-ai-workbench__skill-chip ${selected ? 'is-selected' : ''}`}
                            type="button"
                            onClick={() => setToolsetOpen(true)}
                          >
                            <span>{skill.name}</span>
                            {selected ? (
                              <StatusTag value="enabled" />
                            ) : skill.category ? (
                              <Tag>{skill.category}</Tag>
                            ) : null}
                          </button>
                        </Tooltip>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </WorkbenchShell>

      <Drawer
        title="分析链路"
        placement="right"
        open={thinkingOpen}
        onClose={() => setThinkingOpen(false)}
        size="large"
      >
        {toolCalls.length > 0 ? (
          <Alert
            type={toolCalls.some((item) => item.status === 'error') ? 'warning' : 'info'}
            showIcon
            title={chainToolCallSummary}
            description={
              <Space orientation="vertical" size={4}>
                {chainThinkingSummary ? <Text>{chainThinkingSummary}</Text> : null}
                {chainAgentStatus ? (
                  <Text type="secondary">Agent: {agentStatusLabel(chainAgentStatus)}</Text>
                ) : null}
              </Space>
            }
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <ThoughtChain
          items={
            toolCalls.length === 0
              ? [
                  {
                    key: 'idle',
                    title: '暂无分析链路',
                    description:
                      '通用聊天不会自动执行工具；执行显式分析或产生工具调用后，这里会显示步骤。',
                    status: 'abort' satisfies ThoughtChainStatus,
                  },
                ]
              : toolCalls.map((item) => ({
                  key: item.id,
                  title: item.toolName,
                  description: item.summary || item.adapterId,
                  content: item.output ? (
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {JSON.stringify(item.output, null, 2)}
                    </pre>
                  ) : undefined,
                  status: thoughtChainStatus(item.status),
                  blink: item.status === 'running',
                }))
          }
        />
      </Drawer>

      <Drawer
        title="会话上下文"
        placement="right"
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        size="large"
        extra={
          <Segmented
            size="small"
            value={inspectorView}
            options={[
              { value: 'context', label: '上下文' },
              { value: 'evidence', label: '证据' },
              { value: 'hypotheses', label: '假设' },
              { value: 'actions', label: '建议' },
            ]}
            onChange={(value) => setInspectorView(value as InspectorView)}
          />
        }
      >
        {renderInspectorBody()}
      </Drawer>

      <Drawer
        title="会话级工具集"
        placement="right"
        open={toolsetOpen}
        onClose={() => setToolsetOpen(false)}
        size="large"
        extra={
          <Tag color={currentSession ? 'blue' : 'default'}>
            {currentSession ? currentSessionTitle : '未选择会话'}
          </Tag>
        }
        footer={
          <Flex justify="space-between" gap={12} wrap="wrap">
            <Space wrap>
              <Button onClick={clearToolset} disabled={!currentSession}>
                恢复自动选择
              </Button>
              <Button onClick={applyRecommendedToolset} disabled={!currentSession}>
                应用推荐预设
              </Button>
            </Space>
            <Button
              type="primary"
              loading={patchSessionMutation.isPending}
              onClick={saveToolset}
              disabled={!currentSession}
            >
              保存会话级装配
            </Button>
          </Flex>
        }
      >
        {!currentSession ? (
          <ManagementState
            bordered={false}
            compact
            kind="select-scope"
            title="未选择会话"
            description="先选择会话，再配置工具装配。"
          />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="有效执行策略">
              <div className="soha-ai-workbench__tool-stack">
                {toolsetPolicySummary.map((item) => (
                  <div key={item.label} className="soha-ai-workbench__tool-row">
                    <span>
                      <Text strong>{item.label}</Text>
                      <Text type="secondary">{item.detail}</Text>
                    </span>
                    <Tag>{item.value}</Tag>
                  </div>
                ))}
              </div>
              {unavailableSelectedAdapterIds.length > 0 ? (
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  title="部分已选 adapter 当前没有启用数据源"
                  description={`${unavailableSelectedAdapterIds.join(', ')} 会保留在会话策略中，但相关工具运行时会因为没有可用数据源而跳过或失败。`}
                />
              ) : null}
            </Card>

            <Card size="small" title="Agent Provider">
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Select
                  value={selectedAgentProviderId || defaultAgentProviderId}
                  options={providerOptions}
                  onChange={(value: string) => setSelectedAgentProviderId(value)}
                  placeholder="选择本会话默认执行器"
                />
                {activeAgentProvider ? (
                  <Alert
                    type={activeAgentProvider.supportsAsync ? 'info' : 'success'}
                    showIcon
                    title={`${activeAgentProvider.name} · ${activeAgentProvider.supportsAsync ? '异步 runner' : '内置同步分析'}`}
                    description={activeAgentProvider.description}
                  />
                ) : null}
                {agentCapabilities.length > 0 ? (
                  <div className="soha-ai-workbench__tool-chip-list">
                    {agentCapabilities.slice(0, 8).map((item) => (
                      <Tag key={item.id}>{item.name}</Tag>
                    ))}
                  </div>
                ) : null}
              </Space>
            </Card>

            <Card size="small" title="Adapters 与工具">
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="留空表示自动允许所有已注册 adapter"
                  value={selectedAdapterIds}
                  onChange={(value: string[]) => setSelectedAdapterIds(value)}
                  options={adapters.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.sourceKind})`,
                  }))}
                />
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="选择要屏蔽的工具，保存为 adapter.tool"
                  value={disabledToolNames}
                  onChange={(value: string[]) =>
                    setDisabledToolNames(canonicalDisabledToolNames(value, adapters))
                  }
                  options={disabledToolOptions}
                />
                <div className="soha-ai-workbench__tool-stack">
                  {dataSources.length === 0 ? (
                    <ManagementState
                      bordered={false}
                      compact
                      title="暂无全局数据源"
                      description="全局数据源配置完成后会在这里展示。"
                    />
                  ) : (
                    dataSources.map((item) => (
                      <div key={item.id} className="soha-ai-workbench__tool-row">
                        <span>
                          <Text strong>{item.name}</Text>
                          <Text type="secondary">
                            {item.sourceKind} / {item.backendType} / {item.mcpAdapter}
                          </Text>
                        </span>
                        <StatusTag
                          value={item.validationStatus || (item.enabled ? 'enabled' : 'disabled')}
                        />
                      </div>
                    ))
                  )}
                </div>
              </Space>
            </Card>

            <Card size="small" title="Skills">
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  这里选择本会话允许暴露给 AI coding 客户端的企业 skills；不影响全局 registry
                  的启用状态。
                </Paragraph>
                <Space wrap>
                  {globalSkills.length === 0 ? (
                    <ManagementState
                      bordered={false}
                      compact
                      title="暂无全局 Skills 配置"
                      description="全局 registry 尚未启用可分配的 skills。"
                    />
                  ) : (
                    globalSkills.map((item) => (
                      <Tag.CheckableTag
                        key={item.id}
                        checked={selectedSkillIds.includes(item.id)}
                        onChange={(checked) => {
                          setSelectedSkillIds((current) =>
                            checked
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id),
                          )
                        }}
                      >
                        {item.name}
                      </Tag.CheckableTag>
                    ))
                  )}
                </Space>
              </Space>
            </Card>

            <Card size="small" title="Budget Overrides">
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {TOOLSET_BUDGET_FIELDS.map((field) => (
                  <Flex key={field.key} justify="space-between" align="center" gap={12}>
                    <span>
                      <Text strong>{field.label}</Text>
                      <Text type="secondary" style={{ display: 'block' }}>
                        {field.description}
                      </Text>
                    </span>
                    <InputNumber
                      min={0}
                      suffix={field.suffix}
                      value={budgetOverrides[field.key]}
                      onChange={(value) => setBudgetOverrideValue(field.key, value)}
                    />
                  </Flex>
                ))}
              </Space>
            </Card>

            <Card size="small" title="Scope Overrides">
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  title="Scope override 会叠加到当前会话范围"
                  description={`当前会话范围：${buildScopeSummary(currentSession.metadata?.scope)}`}
                />
                <Input
                  placeholder="Override cluster"
                  value={scopeOverrides.clusterId || ''}
                  onChange={(event) => setScopeOverrideValue('clusterId', event.target.value)}
                />
                <Input
                  placeholder="Override namespace"
                  value={scopeOverrides.namespace || ''}
                  onChange={(event) => setScopeOverrideValue('namespace', event.target.value)}
                />
                <Input
                  placeholder="Override workload"
                  value={scopeOverrides.workload || ''}
                  onChange={(event) => setScopeOverrideValue('workload', event.target.value)}
                />
                <Input
                  placeholder="Override service"
                  value={scopeOverrides.service || ''}
                  onChange={(event) => setScopeOverrideValue('service', event.target.value)}
                />
                <Input
                  placeholder="Override alert ID"
                  value={scopeOverrides.alertId || ''}
                  onChange={(event) => setScopeOverrideValue('alertId', event.target.value)}
                />
                <InputNumber
                  min={0}
                  suffix="minutes"
                  placeholder="Override time range"
                  value={scopeOverrides.timeRangeMinutes}
                  onChange={(value) => setScopeOverrideNumberValue('timeRangeMinutes', value)}
                />
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="显式分析设置"
        open={analysisOpen}
        onCancel={() => {
          if (sendMessageMutation.isPending) {
            cancelMessageStream()
          }
          setAnalysisOpen(false)
        }}
        onOk={submitExplicitAnalysis}
        okText="开始分析"
        cancelText="取消"
        confirmLoading={sendMessageMutation.isPending}
        okButtonProps={{
          disabled: !currentSession || !canSubmitExplicitAnalysis || sendMessageMutation.isPending,
        }}
        width={680}
      >
        {currentSession ? (
          <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              title="本次分析会写回当前会话"
              description="分析结果会追加为 assistant 消息，并进入分析工件历史、图谱、证据和建议面板。"
            />
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>分析模式</Text>
              <Segmented
                block
                value={analysisMode}
                options={RUNNABLE_ANALYSIS_MODE_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                onChange={(value) => {
                  const next = value as WorkbenchMode
                  const currentDefault = defaultAnalysisQuestion(analysisMode, currentSession)
                  setAnalysisMode(next)
                  setSelectedAnalysisProfileId(
                    defaultAnalysisProfileIdForMode(next, analysisProfiles),
                  )
                  if (!analysisQuestion.trim() || analysisQuestion === currentDefault) {
                    setAnalysisQuestion(defaultAnalysisQuestion(next, currentSession))
                  }
                }}
              />
            </Space>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>Agent Provider</Text>
              <Select
                value={selectedAgentProviderId || defaultAgentProviderId}
                options={providerOptions}
                onChange={(value: string) => setSelectedAgentProviderId(value)}
              />
              <Text type="secondary">
                {agentProviders.find((item) => item.id === selectedAgentProviderId)?.description ||
                  '选择本次分析使用内置分析还是外部 agent runner。'}
              </Text>
            </Space>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>分析模板</Text>
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                value={selectedAnalysisProfileId || undefined}
                placeholder="使用当前模式的默认 profile"
                options={analysisProfileOptions}
                onChange={(value?: string) => setSelectedAnalysisProfileId(value || '')}
              />
              <Text type="secondary">
                {selectedAnalysisProfile
                  ? `${selectedAnalysisProfile.name} 会约束数据源、playbook、预算和输出风格。`
                  : '未选择时由后端使用会话和 provider 默认策略。'}
              </Text>
            </Space>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>分析目标</Text>
              <Input.TextArea
                value={analysisQuestion}
                onChange={(event) => setAnalysisQuestion(event.target.value)}
                autoSize={{ minRows: 4, maxRows: 8 }}
                maxLength={600}
                showCount
                placeholder="描述这轮分析要回答的问题"
              />
            </Space>
            <Card size="small" title="执行上下文">
              <Space size={[8, 8]} wrap>
                <Tag color="blue">{modeLabel(analysisMode)}</Tag>
                <Tag
                  color={
                    agentProviders.find((item) => item.id === selectedAgentProviderId)
                      ?.supportsAsync
                      ? 'purple'
                      : 'default'
                  }
                >
                  {agentProviders.find((item) => item.id === selectedAgentProviderId)?.name ||
                    selectedAgentProviderId ||
                    '内置分析'}
                </Tag>
                {analysisCapability ? <Tag>{analysisCapability.name}</Tag> : null}
                {selectedAnalysisProfile ? <Tag>{selectedAnalysisProfile.name}</Tag> : null}
                <Tag>{buildScopeSummary(currentSession.metadata?.scope)}</Tag>
                <Tag>{currentSession.metadata?.toolset ? '会话级工具集' : '全局工具集'}</Tag>
              </Space>
            </Card>
            {analysisMode === 'root_cause' && !canRunRootCause ? (
              <Alert
                type="warning"
                showIcon
                title="缺少 observe.ai.root-cause.run 权限，无法运行根因分析。"
              />
            ) : null}
          </Space>
        ) : (
          <ManagementState
            bordered={false}
            compact
            kind="select-scope"
            title="未选择会话"
            description="先选择会话，再运行显式分析。"
          />
        )}
      </Modal>

      <Modal
        title="重命名会话"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => {
          if (!renameTargetId) return
          patchSessionMutation.mutate({ sessionId: renameTargetId, body: { title: renameValue } })
          setRenameOpen(false)
        }}
      >
        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
      </Modal>
    </>
  )
}
