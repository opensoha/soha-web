/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchStreamEvent } from '@opensoha/contracts/gen/ts/sohaapi'
import { AIWorkbenchPage, RUNNABLE_ANALYSIS_MODE_OPTIONS } from './page'
import type { PermissionSnapshot } from '@/types'
import type {
  WorkbenchAgentRun,
  WorkbenchMessage,
  WorkbenchMessageEnvelope,
  WorkbenchSession,
} from './types'

type TestWorkbenchMode = NonNullable<NonNullable<WorkbenchSession['metadata']>['mode']>
type MessageScenario =
  | 'plain'
  | 'default'
  | 'tool-artifact'
  | 'legacy-platform'
  | 'metadata-sources'
  | 'final-agent-run-metadata'

const testState = vi.hoisted(() => ({
  snapshot: {
    permissionKeys: ['observe.ai.view', 'observe.ai.chat'],
    visibleMenuIds: [],
    visibleMenus: [],
  } as PermissionSnapshot,
  sessionAgentProviderId: undefined as string | undefined,
  sessionMode: 'root_cause' as TestWorkbenchMode,
  messageScenario: 'default' as MessageScenario,
  sendMessageGate: undefined as Promise<void> | undefined,
  sendMessageEnvelope: {
    messages: [],
    analysisArtifacts: [],
  } as WorkbenchMessageEnvelope,
  streamEvents: undefined as Array<Record<string, unknown>> | undefined,
  streamError: undefined as { message: string; code?: string; retryable?: boolean } | undefined,
  agentRuns: [] as WorkbenchAgentRun[],
  agentProviders: [
    {
      id: 'internal',
      kind: 'internal',
      name: '内置分析',
      description: '由 soha 内置分析链路同步执行。',
      enabled: true,
      default: true,
      supportsAsync: false,
      supportsSkills: true,
      supportsToolsets: true,
    },
    {
      id: 'hermes',
      kind: 'hermes',
      capabilities: ['general', 'root_cause', 'performance', 'inspection_review'],
      runtimeStatus: { state: 'ready', queuedRuns: 0, runningRuns: 0, recentFailures: 0 },
      name: 'Hermes Agent',
      description: '通过外部 Hermes runner 异步执行。',
      enabled: true,
      supportsAsync: true,
      supportsSkills: true,
      supportsToolsets: true,
    },
  ],
}))

const apiGetMock = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    if (path === '/copilot/sessions/source-2')
      return { data: { id: 'source-2', title: '源会话', updatedAt: '' } }
    if (path === '/copilot/sessions/source-2/messages')
      return {
        data: [
          {
            id: 'source-message',
            sessionId: 'source-2',
            role: 'assistant',
            content: '源会话已经确认使用 PostgreSQL。',
            createdAt: '2026-09-10T00:00:00Z',
          },
        ],
      }
    if (path === '/copilot/sessions') {
      return {
        data: [
          {
            id: 'session-1',
            title: '支付告警调查',
            updatedAt: '2026-05-12T10:00:00Z',
            metadata: {
              summary: '确认异常来源与影响面',
              scope: {
                clusterId: 'local-k3s',
                namespace: 'payments',
                workload: 'payment-api',
              },
              mode: testState.sessionMode,
              analysisRunRefs: [{ id: 'run-1', kind: 'root_cause', status: 'completed' }],
              tags: ['P1'],
              ...(testState.sessionAgentProviderId
                ? { agentProviderId: testState.sessionAgentProviderId }
                : {}),
              toolset: {
                enabledAdapterIds: ['metrics.v1'],
                enabledSkillIds: ['root-cause-skill'],
                disabledToolNames: ['metrics.anomaly_summary'],
                budgetOverrides: { timeoutSeconds: 45, maxEvidenceItems: 12 },
                scopeOverrides: { namespace: 'payments-shadow', timeRangeMinutes: 30 },
              },
            },
          },
        ],
      }
    }
    if (path === '/copilot/sessions/session-1') {
      return {
        data: {
          id: 'session-1',
          title: '支付告警调查',
          updatedAt: '2026-05-12T10:00:00Z',
          metadata: {
            summary: '确认异常来源与影响面',
            scope: {
              clusterId: 'local-k3s',
              namespace: 'payments',
              workload: 'payment-api',
            },
            mode: testState.sessionMode,
            analysisRunRefs: [{ id: 'run-1', kind: 'root_cause', status: 'completed' }],
            tags: ['P1'],
            ...(testState.sessionAgentProviderId
              ? { agentProviderId: testState.sessionAgentProviderId }
              : {}),
            toolset: {
              enabledAdapterIds: ['metrics.v1'],
              enabledSkillIds: ['root-cause-skill'],
              disabledToolNames: ['metrics.anomaly_summary'],
              budgetOverrides: { timeoutSeconds: 45, maxEvidenceItems: 12 },
              scopeOverrides: { namespace: 'payments-shadow', timeRangeMinutes: 30 },
            },
          },
        },
      }
    }
    if (path === '/copilot/sessions/session-1/messages') {
      if (testState.messageScenario === 'plain')
        return {
          data: [
            {
              id: 'plain-user',
              sessionId: 'session-1',
              role: 'user',
              content: '解释一下这个概念',
              createdAt: '2026-05-12T10:01:00Z',
            },
            {
              id: 'plain-answer',
              sessionId: 'session-1',
              role: 'assistant',
              content: '我们可以从一个简单例子开始。',
              createdAt: '2026-05-12T10:02:00Z',
            },
          ],
        }

      const baseMessages: WorkbenchMessage[] = [
        {
          id: 'msg-0',
          sessionId: 'session-1',
          role: 'assistant',
          content: '已从巡检运行创建复盘。',
          createdAt: '2026-05-12T09:58:00Z',
          metadata: {
            analysisArtifacts: [
              {
                kind: 'inspection_review',
                runId: 'inspection-run-1',
                title: '巡检复盘',
                summary: '巡检完成，发现一项配置风险。',
                dataSourceSnapshot: {
                  sessionId: 'session-1',
                  inspectionRunId: 'inspection-run-1',
                  analysisKind: 'inspection_review',
                },
                evidence: [
                  {
                    id: 'inspection-e1',
                    kind: 'inspection.finding',
                    title: '巡检发现',
                    summary: '发布窗口内存在异常告警',
                  },
                ],
                recommendations: ['先确认发布窗口内的告警是否已经恢复'],
                graph: {
                  layout: 'LR',
                  focusNodeId: 'scope:workload:payment-api',
                  nodes: [
                    {
                      id: 'scope:workload:payment-api',
                      kind: 'scope',
                      title: 'payment-api',
                      subtitle: 'local-k3s / payments',
                    },
                    {
                      id: 'inspection-finding:inspection-e1',
                      kind: 'inspection_finding',
                      title: '巡检发现',
                      subtitle: '发布窗口内存在异常告警',
                      severity: 'warning',
                      evidenceIds: ['inspection-e1'],
                    },
                  ],
                  edges: [
                    {
                      id: 'scope:workload:payment-api->inspection-finding:inspection-e1',
                      source: 'scope:workload:payment-api',
                      target: 'inspection-finding:inspection-e1',
                      relation: 'finds',
                      severity: 'warning',
                      evidenceIds: ['inspection-e1'],
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'user',
          content: '最近告警为什么爆发？',
          createdAt: '2026-05-12T10:01:00Z',
        },
        {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'assistant',
          content: '初步判断与数据库连接耗尽有关。',
          createdAt: '2026-05-12T10:02:00Z',
          metadata: {
            source: 'platform-context',
            analysisArtifacts: [
              {
                kind: 'root_cause',
                runId: 'run-1',
                title: '根因分析',
                summary: '发现数据库连接异常',
                dataSourceSnapshot: {
                  sessionId: 'session-1',
                  rootCauseRunId: 'run-1',
                  agentRunId: 'agent-run-1',
                  analysisKind: 'root_cause',
                },
                evidence: [
                  {
                    id: 'e1',
                    kind: 'metric',
                    title: '连接数升高',
                    summary: '连接池在 5 分钟内升高到上限',
                  },
                ],
                hypotheses: [
                  {
                    id: 'h1',
                    title: '连接池泄漏',
                    summary: '连接未及时释放',
                    confidence: 81,
                    evidenceIds: ['e1'],
                  },
                ],
                recommendations: ['先限制新流量并检查连接归还链路'],
                graph: {
                  layout: 'LR',
                  focusNodeId: 'scope:workload:payment-api',
                  nodes: [
                    {
                      id: 'scope:workload:payment-api',
                      kind: 'scope',
                      title: 'payment-api',
                      subtitle: 'local-k3s / payments',
                    },
                    {
                      id: 'metric:db-connections',
                      kind: 'metric_signal',
                      title: '数据库连接数',
                      subtitle: 'latest=92 avg=35 trend=spike',
                      severity: 'warning',
                      evidenceIds: ['e1'],
                    },
                    {
                      id: 'hypothesis:h1',
                      kind: 'hypothesis',
                      title: '连接池泄漏',
                      subtitle: '连接未及时释放',
                      severity: 'critical',
                      evidenceIds: ['e1'],
                    },
                  ],
                  edges: [
                    {
                      id: 'scope:workload:payment-api->metric:db-connections',
                      source: 'scope:workload:payment-api',
                      target: 'metric:db-connections',
                      relation: 'measures',
                      severity: 'warning',
                      evidenceIds: ['e1'],
                    },
                    {
                      id: 'metric:db-connections->hypothesis:h1',
                      source: 'metric:db-connections',
                      target: 'hypothesis:h1',
                      relation: 'supports',
                      evidenceIds: ['e1'],
                    },
                  ],
                },
              },
            ],
          },
        },
      ]
      if (testState.messageScenario === 'legacy-platform') {
        baseMessages.push(
          {
            id: 'msg-hi',
            sessionId: 'session-1',
            role: 'user',
            content: 'hi',
            createdAt: '2026-05-12T10:03:00Z',
          },
          {
            id: 'msg-legacy-platform',
            sessionId: 'session-1',
            role: 'assistant',
            content: '当前平台上下文：平台可见 1 个集群，其中 0 个处于异常状态。',
            createdAt: '2026-05-12T10:03:01Z',
            metadata: { source: 'platform-context' },
          },
        )
      }
      if (testState.messageScenario === 'tool-artifact') {
        baseMessages.push({
          id: 'msg-tool',
          sessionId: 'session-1',
          role: 'assistant',
          content: '已完成工具分析。',
          createdAt: '2026-05-12T10:03:00Z',
          metadata: {
            analysisArtifacts: [
              {
                kind: 'root_cause',
                runId: 'run-tool',
                title: '工具分析',
                summary: '执行指标异常分析。',
                toolExecutions: [
                  {
                    id: 'tool-1',
                    adapterId: 'metrics.v1',
                    toolName: 'metrics.anomaly_summary',
                    status: 'success',
                    summary: '发现错误率突增。',
                    input: { namespace: 'payments' },
                    output: { errorRate: '12%' },
                    startedAt: '2026-05-12T10:03:00Z',
                    completedAt: '2026-05-12T10:03:03Z',
                  },
                ],
              },
            ],
          },
        })
      }
      if (testState.messageScenario === 'metadata-sources') {
        baseMessages.push({
          id: 'msg-metadata-sources',
          sessionId: 'session-1',
          role: 'assistant',
          content: '已完成来源回放。',
          createdAt: '2026-05-12T10:04:00Z',
          metadata: {
            thinkingSummary: '从 final message metadata 恢复来源。',
            sources: [
              {
                id: 'source-metadata',
                kind: 'document',
                title: 'Runbook source from metadata',
                url: 'https://docs.example/runbook',
                summary: '最终消息快照里的来源。',
              },
            ],
            toolExecutions: [
              {
                id: 'tool-metadata',
                adapterId: 'docs.v1',
                toolName: 'docs.lookup',
                status: 'success',
                summary: '读取 runbook。',
                startedAt: '2026-05-12T10:04:00Z',
                completedAt: '2026-05-12T10:04:01Z',
              },
            ],
            analysisArtifacts: [
              {
                kind: 'root_cause',
                runId: 'run-metadata',
                title: 'metadata 回放',
                summary: 'metadata sources should render even without evidence.',
                evidence: [],
              },
            ],
            agentStatus: {
              providerId: 'internal',
              providerKind: 'internal',
              status: 'succeeded',
            },
          },
        })
      }
      if (testState.messageScenario === 'final-agent-run-metadata') {
        baseMessages.push({
          id: 'msg-final-agent-run',
          sessionId: 'session-1',
          role: 'assistant',
          content: '最终 agent 结果已经落库。',
          createdAt: '2026-05-12T10:06:00Z',
          metadata: {
            source: 'agent-runtime',
            agentRunId: 'agent-run-final',
            thinkingSummary: 'final message metadata wins',
            toolExecutions: [
              {
                id: 'tool-final',
                adapterId: 'metrics.v1',
                toolName: 'metrics.final_summary',
                status: 'success',
                summary: '最终 metadata 工具快照。',
                startedAt: '2026-05-12T10:05:00Z',
                completedAt: '2026-05-12T10:05:30Z',
              },
            ],
            analysisArtifacts: [
              {
                kind: 'root_cause',
                runId: 'agent-run-final',
                title: 'final metadata artifact',
                summary: 'final metadata artifact summary',
                evidence: [],
              },
            ],
            agentStatus: {
              providerId: 'hermes',
              providerKind: 'hermes',
              status: 'completed',
              agentRunId: 'agent-run-final',
            },
          },
        })
      }
      return {
        data: baseMessages,
      }
    }
    if (path.startsWith('/copilot/agent-runs')) {
      return {
        data: [...testState.agentRuns],
      }
    }
    if (path === '/copilot/workbench/catalog') {
      return {
        data: {
          defaultPublicModel: 'reasoning-model',
          modelOptions: [
            { publicModel: 'reasoning-model', reasoningEfforts: ['low', 'medium', 'high'] },
          ],
          adapters: [
            {
              id: 'metrics.v1',
              name: 'Metrics',
              description: 'Prometheus metrics',
              sourceKind: 'metrics',
              tools: [{ name: 'metrics.anomaly_summary', description: 'Run anomaly summary' }],
            },
          ],
          dataSources: [
            {
              id: 'ds-1',
              name: 'Prometheus',
              sourceKind: 'metrics',
              backendType: 'prometheus',
              enabled: true,
              mcpAdapter: 'metrics.v1',
              validationStatus: 'enabled',
            },
          ],
          analysisProfiles: [
            { id: 'profile:inspection', name: '巡检模板', mode: 'inspection', enabled: true },
          ],
          skillsRegistry: [{ id: 'root-cause-skill', name: 'Root Cause', enabled: true }],
          agentProviders: testState.agentProviders,
          capabilities: [
            {
              id: 'root_cause',
              name: '根因分析能力',
              analysisKinds: ['root_cause'],
              toolRefs: ['metrics.v1.metrics.anomaly_summary'],
            },
          ],
        },
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
)

const apiPostMock = vi.hoisted(() =>
  vi.fn(async (path: string, body?: Record<string, unknown>) => {
    if (path === '/copilot/sessions')
      return { data: { id: 'session-1', metadata: { mode: body?.mode } } }
    if (path === '/copilot/sessions/session-1/messages') {
      if (testState.sendMessageGate) {
        await testState.sendMessageGate
      }
      if (
        (testState.sendMessageEnvelope.analysisArtifacts ?? []).some(
          (artifact) => (artifact.toolExecutions ?? []).length > 0,
        )
      ) {
        testState.messageScenario = 'tool-artifact'
      }
      return { data: testState.sendMessageEnvelope }
    }
    if (path === '/copilot/sessions/session-1/analyze') {
      return {
        data: {
          messages: [],
          sessionPatch: {
            mode: body?.mode,
            summary: '分析完成',
          },
        },
      }
    }
    return { data: {} }
  }),
)
const apiPatchMock = vi.hoisted(() => vi.fn(async () => ({ data: {} })))
const apiDeleteMock = vi.hoisted(() => vi.fn(async () => undefined))
const streamWorkbenchMessageMock = vi.hoisted(() =>
  vi.fn(
    async (
      path: string,
      _body: Record<string, unknown>,
      onEvent: (event: WorkbenchStreamEvent) => void | Promise<void>,
      signal?: AbortSignal,
    ) => {
      if (path !== '/copilot/sessions/session-1/messages/stream') {
        throw new Error(`Unhandled stream ${path}`)
      }
      const abortError = () => new DOMException('Aborted', 'AbortError')
      const throwIfAborted = () => {
        if (signal?.aborted) throw abortError()
      }
      if (testState.sendMessageGate) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => reject(abortError())
          signal?.addEventListener('abort', abort, { once: true })
          testState.sendMessageGate?.then(
            () => {
              signal?.removeEventListener('abort', abort)
              resolve()
            },
            (error) => {
              signal?.removeEventListener('abort', abort)
              reject(error)
            },
          )
        })
      }
      throwIfAborted()
      const envelope = testState.sendMessageEnvelope
      if (
        (envelope.analysisArtifacts ?? []).some(
          (artifact) => (artifact.toolExecutions ?? []).length > 0,
        )
      ) {
        testState.messageScenario = 'tool-artifact'
      }
      const createdAt = '2026-05-12T10:04:00Z'
      let sequence = 1
      const emit = async (event: Record<string, unknown>) => {
        throwIfAborted()
        await onEvent({
          id: `evt-${sequence}`,
          sessionId: 'session-1',
          sequence: sequence++,
          createdAt,
          ...event,
        } as WorkbenchStreamEvent)
        throwIfAborted()
      }
      if (testState.streamError) {
        await emit({
          type: 'error',
          message: testState.streamError.message,
          code: testState.streamError.code,
          retryable: testState.streamError.retryable,
        })
        return
      }
      if (testState.streamEvents) {
        for (const event of testState.streamEvents) {
          await emit(event)
        }
        return
      }
      for (const artifact of envelope.analysisArtifacts ?? []) {
        await emit({ type: 'thinking.delta', textDelta: artifact.summary })
        for (const tool of artifact.toolExecutions ?? []) {
          await emit({
            type: 'tool.started',
            toolCall: {
              id: tool.id,
              adapterId: tool.adapterId,
              toolName: tool.toolName,
              status: 'running',
              summary: tool.summary,
              inputPreview: tool.input,
              outputPreview: tool.output,
              startedAt: tool.startedAt,
              completedAt: tool.completedAt,
            },
          })
          await emit({
            type: 'tool.completed',
            toolCall: {
              id: tool.id,
              adapterId: tool.adapterId,
              toolName: tool.toolName,
              status:
                tool.status === 'completed'
                  ? 'success'
                  : (tool.status as 'pending' | 'running' | 'success' | 'error' | 'skipped'),
              summary: tool.summary,
              inputPreview: tool.input,
              outputPreview: tool.output,
              startedAt: tool.startedAt,
              completedAt: tool.completedAt,
            },
          })
        }
        await emit({ type: 'artifact.updated', runId: artifact.runId, artifact })
        await emit({
          type: 'thinking.done',
          runId: artifact.runId,
          summary: artifact.summary,
          collapsed: true,
        })
      }
      const assistant = envelope.messages.find((item) => item.role === 'assistant')
      if (assistant) {
        await emit({
          type: 'message.delta',
          messageId: assistant.id,
          role: 'assistant',
          contentDelta: assistant.content,
        })
        await emit({
          type: 'message.done',
          messageId: assistant.id,
          role: 'assistant',
          content: assistant.content,
          metadata: assistant.metadata,
        })
      }
      await emit({
        type: 'agent.status',
        providerId: 'internal',
        providerKind: 'internal',
        status: 'succeeded',
      })
    },
  ),
)

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth')
  return {
    ...actual,
    usePermissionSnapshot: () => ({
      data: { data: testState.snapshot },
      isLoading: false,
    }),
  }
})

vi.mock('@/services/api-client', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    patch: apiPatchMock,
    delete: apiDeleteMock,
    put: vi.fn(),
  },
}))

vi.mock('./components/graph-view-loader', () => ({
  LazyWorkbenchGraphView: ({
    graph,
  }: {
    graph: { nodes?: Array<{ id: string; title: string }> }
  }) => (
    <div data-testid="workbench-graph-view">
      {(graph.nodes ?? []).map((node) => (
        <span key={node.id}>{node.title}</span>
      ))}
    </div>
  ),
}))

vi.mock('./stream', async () => {
  const actual = await vi.importActual<typeof import('./stream')>('./stream')
  return {
    ...actual,
    streamWorkbenchMessage: streamWorkbenchMessageMock,
  }
})

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []
let latestRoute = ''

function LocationProbe() {
  const location = useLocation()
  latestRoute = `${location.pathname}${location.search}`
  return null
}

async function renderPage(route = '/ai-workbench?session=session-1&mode=root_cause') {
  latestRoute = ''
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <MemoryRouter initialEntries={[route]}>
            <LocationProbe />
            <AIWorkbenchPage />
          </MemoryRouter>
        </AntdApp>
      </QueryClientProvider>,
    )
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  return Object.assign(container, { queryClient })
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function messageAction(container: HTMLElement, label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      '.soha-ai-workbench__message-results button, .soha-ai-workbench__message-activity button',
    ),
  )
    .reverse()
    .find((item) => item.textContent?.replace(/\s/g, '').includes(label.replace(/\s/g, '')))
}

async function openWorkbenchPanel(container: HTMLElement, label: string) {
  const button =
    label === '会话设置'
      ? Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            '.soha-ai-workbench__toolbar-actions button',
          ),
        ).find((item) => item.textContent?.includes('会话设置'))
      : messageAction(container, label)
  expect(button).toBeTruthy()
  await act(async () => {
    button?.focus()
    button?.click()
    await flushAsyncWork()
  })
}

async function waitForWorkbenchText(container: HTMLElement, text: string) {
  for (let i = 0; i < 20 && !container.textContent?.includes(text); i += 1) {
    await act(async () => {
      await flushAsyncWork()
    })
  }
  expect(container.textContent).toContain(text)
}

function senderInput(container: HTMLElement) {
  return container.querySelector(
    'textarea[placeholder="提问，或输入 / 选择功能"]',
  ) as HTMLTextAreaElement | null
}

async function typeSenderMessage(container: HTMLElement, value: string) {
  const input = container.querySelector(
    'textarea[placeholder="提问，或输入 / 选择功能"]',
  ) as HTMLTextAreaElement | null
  expect(input).toBeTruthy()

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    valueSetter?.call(input, value)
    input?.dispatchEvent(new Event('input', { bubbles: true }))
    input?.dispatchEvent(new Event('change', { bubbles: true }))
    await flushAsyncWork()
  })
}

async function pressSenderEnter(container: HTMLElement) {
  const input = senderInput(container)
  expect(input).toBeTruthy()

  await act(async () => {
    input?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
      }),
    )
    await flushAsyncWork()
  })
}

async function submitSenderMessage(container: HTMLElement, value: string) {
  await typeSenderMessage(container, value)
  await pressSenderEnter(container)
}

function expectedStreamBody(
  content: string,
  mode: TestWorkbenchMode = 'root_cause',
  agentProviderId = 'internal',
) {
  return {
    content,
    mode,
    agentProviderId,
    ...(mode === 'general'
      ? { contextSelection: {}, knowledgeContext: { enabled: false, knowledgeBaseIds: [] } }
      : {}),
    ...(mode === 'general' && agentProviderId === 'internal' ? { modelPreferences: {} } : {}),
    toolset: {
      enabledAdapterIds: ['metrics.v1'],
      enabledSkillIds: ['root-cause-skill'],
      disabledToolNames: ['metrics.v1.metrics.anomaly_summary'],
      budgetOverrides: { timeoutSeconds: 45, maxEvidenceItems: 12 },
      scopeOverrides: { namespace: 'payments-shadow', timeRangeMinutes: 30 },
    },
    scopeOverrides: { namespace: 'payments-shadow', timeRangeMinutes: 30 },
  }
}

function externalAgentRun(events: WorkbenchStreamEvent[], status = 'running'): WorkbenchAgentRun {
  return {
    id: status === 'running' ? 'agent-run-live' : `agent-run-${status}`,
    providerId: 'hermes',
    providerKind: 'hermes',
    capabilityId: 'root_cause',
    sessionId: 'session-1',
    rootCauseRunId: 'run-live',
    status,
    output: { workbenchEvents: events },
    queuedAt: '2026-05-12T10:05:00Z',
    startedAt: '2026-05-12T10:05:01Z',
    lastHeartbeatAt: '2026-05-12T10:05:10Z',
    createdAt: '2026-05-12T10:05:00Z',
    updatedAt: '2026-05-12T10:05:10Z',
  }
}

describe('AIWorkbenchPage', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    class IntersectionObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
      root = null
      rootMargin = '0px'
      thresholds = []
    }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width'),
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const originalGetComputedStyle = window.getComputedStyle.bind(window)
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn((element: Element) => originalGetComputedStyle(element)),
    })

    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  })

  beforeEach(() => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.chat'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    testState.sessionAgentProviderId = undefined
    testState.sessionMode = 'root_cause'
    testState.messageScenario = 'default'
    testState.sendMessageGate = undefined
    testState.sendMessageEnvelope = {
      messages: [],
      analysisArtifacts: [],
    }
    testState.streamEvents = undefined
    testState.streamError = undefined
    testState.agentRuns = []
    apiGetMock.mockClear()
    apiPostMock.mockClear()
    apiPatchMock.mockClear()
    apiDeleteMock.mockClear()
    streamWorkbenchMessageMock.mockClear()
  })

  it('keeps explicit analysis modes aligned with backend runnable artifact modes', () => {
    expect(RUNNABLE_ANALYSIS_MODE_OPTIONS.map((item) => item.value)).toEqual([
      'root_cause',
      'performance',
      'trace',
      'inspection_review',
    ])
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots = []
    for (const container of containers) {
      container.remove()
    }
    containers = []
  })

  it('renders the conversation canvas without duplicated mode navigation', async () => {
    const container = await renderPage()

    expect(container.querySelector('.soha-ai-workbench__function-bar')).toBeNull()
    expect(container.querySelector('.soha-ai-workbench__session-card')).toBeNull()
    expect(container.querySelector('.soha-ai-workbench__conversation-topbar')).toBeNull()
    expect(container.textContent).not.toContain('当前对话类型')
    expect(container.textContent).toContain('支付告警调查')
    expect(container.textContent).toContain('巡检')
    expect(container.querySelector('.soha-ai-workbench__detail')).toBeNull()
    expect(container.querySelector('.soha-ai-workbench__tools-pane')).toBeNull()
    expect(container.querySelector('[data-testid="workbench-graph-view"]')).toBeNull()
    await openWorkbenchPanel(container, '查看结果')
    expect(container.textContent).toContain('会话结果')
    expect(container.textContent).toContain('分析工件图谱')
    expect(container.textContent).toContain('根因分析')
    expect(container.textContent).toContain('巡检复盘')
    expect(container.textContent).toContain('数据库连接数')
  })

  it('sends model preferences and opens the context summary from the composer', async () => {
    testState.sessionMode = 'general'
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    expect(container.querySelector('[aria-label="选择模型"]')?.getAttribute('disabled')).toBeNull()
    expect(container.querySelector('[aria-label="思考强度"]')?.getAttribute('disabled')).toBeNull()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="上下文背景信息"]')?.click()
    })
    await flushAsyncWork()
    expect(document.body.textContent).toContain('上下文背景')
    expect(document.body.textContent).toContain('历史消息')
    await submitSenderMessage(container, '你好')
    expect(streamWorkbenchMessageMock.mock.calls[0]?.[1]).toMatchObject({ modelPreferences: {} })
  })

  it('preserves the chat and draft while switching one detail panel at a time', async () => {
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    const chat = container.querySelector('.soha-ai-workbench__canvas')
    const input = senderInput(container)
    await typeSenderMessage(container, '还未发送的排查补充')

    expect(
      container.querySelector('.soha-ai-workbench__workspace')?.classList.contains('has-sidebar'),
    ).toBe(true)
    for (const label of ['来源', '查看结果', '会话设置']) {
      await openWorkbenchPanel(container, label)
      expect(container.querySelectorAll('.soha-ai-workbench__detail')).toHaveLength(1)
      expect(container.querySelector('.soha-ai-workbench__canvas')).toBe(chat)
      expect(senderInput(container)).toBe(input)
      expect(input?.value).toBe('还未发送的排查补充')
    }

    await act(async () => {
      container
        .querySelector('.soha-ai-workbench__detail')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('.soha-ai-workbench__detail')).toBeNull()
    expect(document.activeElement?.textContent).toContain('会话设置')
    expect(senderInput(container)?.value).toBe('还未发送的排查补充')
    expect(latestRoute).toBe('/ai-workbench/chat?session=session-1')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
    expect(apiPatchMock).not.toHaveBeenCalled()
  })

  it('keeps plain chat free of result and OPS controls', async () => {
    testState.sessionMode = 'general'
    testState.messageScenario = 'plain'
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    expect(container.textContent).toContain('我们可以从一个简单例子开始。')
    expect(container.querySelector('.soha-ai-workbench__toolbar-actions')?.textContent).toContain(
      '会话设置',
    )
    expect(container.querySelector('.soha-ai-workbench__message-result')).toBeNull()
    for (const label of ['根因分析', '假设', '巡检', '分析链路', '证据']) {
      expect(container.textContent).not.toContain(label)
    }
  })

  it('starts a general conversation without inheriting the previous investigation scope', async () => {
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    const createButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.includes('新建会话'),
    )
    await act(async () => {
      createButton?.click()
      await flushAsyncWork()
    })
    expect(apiPostMock).toHaveBeenCalledWith(
      '/copilot/sessions',
      expect.objectContaining({ mode: 'general', scope: {} }),
    )
    expect(apiPatchMock).not.toHaveBeenCalled()
  })

  it('opens evidence from the clicked message rather than the latest artifact', async () => {
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    const olderReply = container.querySelector<HTMLElement>('[data-message-id="msg-0"]')!
    await act(async () => {
      messageAction(olderReply, '来源')?.click()
      await flushAsyncWork()
    })
    const panel = container.querySelector('.soha-ai-workbench__detail')
    expect(panel?.textContent).toContain('巡检发现')
    expect(panel?.textContent).not.toContain('连接数升高')
    const latestReply = container.querySelector<HTMLElement>('[data-message-id="msg-2"]')!
    await act(async () => {
      messageAction(latestReply, '来源')?.click()
      await flushAsyncWork()
    })
    expect(container.querySelector('.soha-ai-workbench__detail')?.textContent).toContain(
      '连接数升高',
    )
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('keeps the composer free of auxiliary buttons and removes session mode labels', async () => {
    const container = await renderPage()
    const composer = container.querySelector('.soha-ai-workbench__composer')!
    expect(composer.querySelector('[aria-label="输入辅助功能"]')).toBeNull()
    expect(composer.querySelector('[aria-label="上下文背景信息"]')).not.toBeNull()
    expect(
      container.querySelector('.soha-ai-workbench__conversation-label-meta')?.textContent,
    ).not.toMatch(/根因分析|通用聊天/)
    expect(container.querySelector('.soha-ai-workbench__brand-logo')?.getAttribute('src')).toBe(
      '/logo.svg',
    )
  })

  it('selects a slash prompt with Enter without submitting a chat request', async () => {
    testState.sessionMode = 'general'
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    await typeSenderMessage(container, '/pla')
    expect(document.body.textContent).toContain('/plan')
    await pressSenderEnter(container)
    expect(senderInput(container)?.value).toContain('先不要执行操作')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('uses arrow keys to open context while preserving the draft', async () => {
    const container = await renderPage()
    await typeSenderMessage(container, '保留草稿 /')
    await act(async () => {
      senderInput(container)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      )
      await flushAsyncWork()
    })
    await pressSenderEnter(container)
    expect(container.querySelector('.soha-ai-workbench__detail')?.textContent).toContain(
      '上下文范围',
    )
    expect(senderInput(container)?.value).toBe('保留草稿 ')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('dismisses suggestions with Escape and does not select during IME composition', async () => {
    const container = await renderPage()
    await typeSenderMessage(container, '/pla')
    await act(async () => {
      senderInput(container)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
      )
      await flushAsyncWork()
    })
    expect(senderInput(container)?.value).toBe('/pla')
    await act(async () => {
      senderInput(container)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
      await flushAsyncWork()
    })
    expect(container.querySelector('.ant-cascader-open')).toBeNull()
    expect(senderInput(container)?.value).toBe('/pla')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('reads another session and sends a removable reference without replacing the draft', async () => {
    testState.sessionMode = 'general'
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    await submitSenderMessage(container, '/session source-2 根据来源继续讨论')
    await waitForWorkbenchText(container, '源会话已经确认使用 PostgreSQL。')
    expect(apiGetMock).toHaveBeenCalledWith('/copilot/sessions/source-2')
    expect(apiGetMock).toHaveBeenCalledWith('/copilot/sessions/source-2/messages')
    expect(container.querySelector('.soha-ai-workbench__detail')?.textContent).toContain(
      '源会话已经确认使用 PostgreSQL。',
    )
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
    const insert = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.includes('插入会话引用'),
    )
    expect(insert).toBeTruthy()
    await act(async () => {
      insert?.click()
      await flushAsyncWork()
    })
    expect(senderInput(container)?.value).toContain('根据来源继续讨论')
    expect(senderInput(container)?.value).not.toContain('源会话已经确认使用 PostgreSQL。')
    expect(container.querySelector('.ant-tag')?.textContent).toContain('session')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
    await pressSenderEnter(container)
    expect(streamWorkbenchMessageMock.mock.calls[0][1].content).toBe('根据来源继续讨论')
    expect(streamWorkbenchMessageMock.mock.calls[0][1]).toMatchObject({
      contextSelection: { references: [{ kind: 'session', sessionId: 'source-2' }] },
    })
  })

  it('does not quote inaccessible sessions or send session commands to the model', async () => {
    const container = await renderPage()
    await submitSenderMessage(container, '/session inaccessible')
    await waitForWorkbenchText(container, '无法读取此会话')
    expect(container.textContent).toContain('无法读取此会话')
    expect(container.textContent).not.toContain('插入会话引用')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('rejects malformed session IDs before making a read request', async () => {
    const container = await renderPage()
    await submitSenderMessage(container, '/session ../admin')
    expect(container.textContent).toContain('请输入有效的会话 ID')
    expect(apiGetMock).not.toHaveBeenCalledWith('/copilot/sessions/../admin')
    expect(streamWorkbenchMessageMock).not.toHaveBeenCalled()
  })

  it('copies the exact session ID and exposes manual copy when clipboard access fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const container = await renderPage()
      const copy = container.querySelector<HTMLButtonElement>('[aria-label="复制会话 ID"]')!
      await act(async () => {
        copy.click()
        await flushAsyncWork()
      })
      expect(writeText).toHaveBeenCalledWith('session-1')
      writeText.mockRejectedValueOnce(new Error('NotAllowedError'))
      await act(async () => {
        copy.click()
        await flushAsyncWork()
      })
      expect(container.querySelector('.soha-ai-workbench__detail')?.textContent).toContain(
        '会话 ID：session-1',
      )
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('lets explicit performance routes override and persist the selected session mode', async () => {
    const container = await renderPage('/ai-workbench/performance?session=session-1')
    await openWorkbenchPanel(container, '会话设置')

    expect(container.querySelector('.soha-ai-workbench__session-mode')?.textContent).toContain(
      '性能分析',
    )
    expect(apiPatchMock).toHaveBeenCalledWith('/copilot/sessions/session-1', {
      mode: 'performance',
    })
  })

  it('keeps legacy investigation mode redirects authoritative for the selected session', async () => {
    const container = await renderPage('/ai-workbench/chat?session=session-1&mode=trace')
    await openWorkbenchPanel(container, '会话设置')

    expect(container.querySelector('.soha-ai-workbench__session-mode')?.textContent).toContain(
      '链路分析',
    )
    expect(apiPatchMock).toHaveBeenCalledWith('/copilot/sessions/session-1', { mode: 'trace' })
  })

  it('switches graph context between session artifact history items', async () => {
    const container = await renderPage()
    await openWorkbenchPanel(container, '查看结果')

    expect(container.textContent).toContain('数据库连接数')
    expect(container.textContent).toContain('关联入口')
    expect(container.textContent).toContain('根因运行: run-1')
    expect(container.textContent).toContain('Agent Run: agent-run-1')

    const inspectionArtifactButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('巡检复盘'),
    )
    expect(inspectionArtifactButton).toBeTruthy()

    await act(async () => {
      inspectionArtifactButton?.click()
    })

    expect(container.textContent).toContain('巡检发现')
    expect(container.textContent).toContain('巡检完成，发现一项配置风险。')
    expect(container.textContent).toContain('巡检运行: inspection-run-1')
  })

  it('opens artifact context links from the active artifact graph', async () => {
    const container = await renderPage()
    await openWorkbenchPanel(container, '查看结果')

    const rootCauseLink = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('根因运行: run-1'),
    )
    expect(rootCauseLink).toBeTruthy()

    await act(async () => {
      rootCauseLink?.click()
    })

    expect(latestRoute).toContain('/ai-workbench/root-cause')
    expect(latestRoute).toContain('session=session-1')
    expect(latestRoute).toContain('rootCauseRunId=run-1')
    await openWorkbenchPanel(container, '查看结果')

    const inspectionArtifactButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('巡检复盘'),
    )
    expect(inspectionArtifactButton).toBeTruthy()

    await act(async () => {
      inspectionArtifactButton?.click()
    })

    const inspectionLink = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('巡检运行: inspection-run-1'),
    )
    expect(inspectionLink).toBeTruthy()

    await act(async () => {
      inspectionLink?.click()
    })

    expect(latestRoute).toContain('/ai-workbench/inspection')
    expect(latestRoute).toContain('view=runs')
    expect(latestRoute).toContain('inspectionRunId=inspection-run-1')
  })

  it('opens the session toolset drawer with canonical execution policy details', async () => {
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const toolsetButtons = Array.from(container.querySelectorAll('button')).filter((button) =>
      button.textContent?.includes('工具装配'),
    )
    expect(toolsetButtons.length).toBeGreaterThan(0)

    await act(async () => {
      toolsetButtons[0].click()
    })

    expect(document.body.textContent).toContain('有效执行策略')
    expect(document.body.textContent).toContain('metrics.v1.metrics.anomaly_summary')
    expect(document.body.textContent).toContain('timeoutSeconds=45')
    expect(document.body.textContent).toContain('payments-shadow')
  })

  it('does not open the analysis chain drawer after an ordinary general chat message', async () => {
    testState.sessionMode = 'general'
    testState.sendMessageEnvelope = {
      messages: [],
      analysisArtifacts: [],
    }
    const container = await renderPage('/ai-workbench/chat?session=session-1')

    expect(
      container.querySelector('.soha-ai-workbench-sidebar .soha-ai-workbench__session-mode'),
    ).toBeNull()

    await submitSenderMessage(container, '只是问个普通问题')

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('只是问个普通问题', 'general'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(document.body.textContent).not.toContain('暂无分析链路')
    expect(document.body.textContent).not.toContain('通用聊天不会自动执行工具')
  })

  it('hides legacy platform-context fallback replies in general chat', async () => {
    testState.sessionMode = 'general'
    testState.messageScenario = 'legacy-platform'

    const container = await renderPage('/ai-workbench/chat?session=session-1')
    await openWorkbenchPanel(container, '会话设置')

    expect(container.textContent).toContain('模型与工具')
    expect(container.textContent).toContain('hi')
    expect(container.textContent).toContain('已隐藏旧版平台上下文回复')
    expect(container.textContent).not.toContain('当前平台上下文：平台可见 1 个集群')
  })

  it('shows submitted chat messages immediately and clears the sender while the reply is pending', async () => {
    testState.sessionMode = 'general'
    let releaseReply = () => {}
    testState.sendMessageGate = new Promise<void>((resolve) => {
      releaseReply = resolve
    })
    testState.sendMessageEnvelope = {
      messages: [
        {
          id: 'msg-sent-user',
          sessionId: 'session-1',
          role: 'user',
          content: '帮我梳理当前问题',
          createdAt: '2026-05-12T10:04:00Z',
        },
        {
          id: 'msg-sent-assistant',
          sessionId: 'session-1',
          role: 'assistant',
          content: '我先按当前会话把问题拆成现象、上下文和下一步动作。',
          createdAt: '2026-05-12T10:04:03Z',
          metadata: { source: 'provider' },
        },
      ],
      analysisArtifacts: [],
    }
    const container = await renderPage('/ai-workbench/chat?session=session-1')
    const input = senderInput(container)
    expect(input).toBeTruthy()

    await typeSenderMessage(container, '帮我梳理当前问题')

    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
        }),
      )
      await flushAsyncWork()
    })

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('帮我梳理当前问题', 'general'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('帮我梳理当前问题')
    expect(container.textContent).toContain('正在思考...')

    await act(async () => {
      releaseReply()
      await flushAsyncWork()
    })

    expect(senderInput(container)?.value).toBe('')
    expect(container.textContent).not.toContain('正在思考...')
    expect(container.textContent).toContain('我先按当前会话把问题拆成现象、上下文和下一步动作。')
  })

  it('does not show execution actions for messages without tool calls', async () => {
    const container = await renderPage()
    expect(messageAction(container, '执行记录')).toBeUndefined()
    expect(container.querySelector('.soha-ai-workbench__toolbar-actions')?.textContent).toContain(
      '会话设置',
    )
    expect(container.querySelector('.soha-ai-workbench__detail')).toBeNull()
  })

  it('keeps tool steps available without interrupting the conversation with a panel', async () => {
    testState.sendMessageEnvelope = {
      messages: [],
      analysisArtifacts: [
        {
          kind: 'root_cause',
          runId: 'run-tool',
          title: '工具分析',
          summary: '执行指标异常分析。',
          toolExecutions: [
            {
              id: 'tool-1',
              adapterId: 'metrics.v1',
              toolName: 'metrics.anomaly_summary',
              status: 'success',
              summary: '发现错误率突增。',
              input: { namespace: 'payments' },
              output: { errorRate: '12%' },
              startedAt: '2026-05-12T10:03:00Z',
              completedAt: '2026-05-12T10:03:03Z',
            },
          ],
        },
      ],
    }
    const container = await renderPage()

    await submitSenderMessage(container, '请执行一次指标分析')

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('请执行一次指标分析'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(container.querySelector('.soha-ai-workbench__detail')).toBeNull()
    await openWorkbenchPanel(container, '执行记录')
    expect(document.body.textContent).toContain('metrics.anomaly_summary')
    expect(document.body.textContent).toContain('发现错误率突增。')
    expect(document.body.textContent).toContain('1 个工具调用，1 成功，0 失败')
  })

  it('aborts an in-flight explicit analysis stream from the shared stream cancel control', async () => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.chat', 'observe.ai.root-cause.run'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    testState.sendMessageGate = new Promise<void>(() => {})
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const explicitAnalysisButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('显式分析'),
    )
    expect(explicitAnalysisButton).toBeTruthy()

    await act(async () => {
      explicitAnalysisButton?.click()
      await flushAsyncWork()
    })

    const startAnalysisButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('开始分析'),
    )
    expect(startAnalysisButton).toBeTruthy()

    await act(async () => {
      startAnalysisButton?.click()
      await flushAsyncWork()
    })

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('确认异常来源与影响面'),
      expect.any(Function),
      expect.any(AbortSignal),
    )

    const cancelButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Stop loading'),
    )
    expect(cancelButton).toBeTruthy()

    await act(async () => {
      cancelButton?.click()
      await flushAsyncWork()
    })

    expect(document.body.textContent).toContain('停止当前任务？')
    expect(document.body.textContent).not.toContain('已取消本次回复。')
    await act(async () => {
      Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('停止任务'))
        ?.click()
      await flushAsyncWork()
    })
    expect(document.body.textContent).toContain('已取消本次回复。')
  })

  it('offers retry for retryable stream errors and resubmits the last input', async () => {
    testState.sessionMode = 'general'
    testState.streamError = {
      message: 'provider overloaded',
      code: 'provider_busy',
      retryable: true,
    }
    const container = await renderPage('/ai-workbench/chat?session=session-1')

    await submitSenderMessage(container, '请重试这次请求')

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('请重试这次请求', 'general'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('上一次 Workbench 流式调用可重试')
    expect(container.textContent).toContain('provider overloaded')

    testState.streamError = undefined
    testState.sendMessageEnvelope = {
      messages: [
        {
          id: 'msg-retry-assistant',
          sessionId: 'session-1',
          role: 'assistant',
          content: 'retry ok',
          createdAt: '2026-05-12T10:05:00Z',
          metadata: { source: 'workbench-stream' },
        },
      ],
      analysisArtifacts: [],
    }

    const retryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('重试'),
    )
    expect(retryButton).toBeTruthy()

    await act(async () => {
      retryButton?.click()
      await flushAsyncWork()
    })

    expect(streamWorkbenchMessageMock).toHaveBeenCalledTimes(2)
    expect(streamWorkbenchMessageMock.mock.calls[1][1]).toEqual(
      expectedStreamBody('请重试这次请求', 'general'),
    )
    expect(container.textContent).toContain('retry ok')
  })

  it('renders Sources from source.updated stream snapshots', async () => {
    testState.streamEvents = [
      {
        type: 'source.updated',
        source: {
          id: 'source-stream',
          kind: 'metric',
          title: 'Prometheus stream source',
          summary: 'error rate range query',
        },
      },
      {
        type: 'artifact.updated',
        artifact: {
          kind: 'root_cause',
          runId: 'run-stream-source',
          title: 'stream source artifact',
          summary: 'stream source summary',
          evidence: [],
        },
      },
      {
        type: 'agent.status',
        providerId: 'internal',
        providerKind: 'internal',
        status: 'succeeded',
      },
    ]
    const container = await renderPage()

    await submitSenderMessage(container, '请收集实时来源')
    await openWorkbenchPanel(container, '查看结果')

    const streamArtifactButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('stream source artifact'),
    )
    expect(streamArtifactButton).toBeTruthy()

    await act(async () => {
      streamArtifactButton?.click()
      await flushAsyncWork()
    })

    const evidenceButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '.soha-ai-workbench__message-results button, .soha-ai-workbench__message-activity button',
      ),
    )
      .reverse()
      .find((button) => button.textContent?.replace(/\s/g, '').includes('来源'))
    expect(evidenceButton).toBeTruthy()

    await act(async () => {
      evidenceButton?.click()
      await flushAsyncWork()
    })

    expect(document.body.textContent).toContain('Prometheus stream source')
  })

  it('replays final message metadata for tools, sources, thinking, and agent status', async () => {
    testState.sessionMode = 'general'
    testState.messageScenario = 'metadata-sources'
    const container = await renderPage()

    const chainButton = messageAction(container, '执行记录')
    expect(chainButton).toBeTruthy()
    expect(chainButton?.disabled).toBe(false)

    await act(async () => {
      chainButton?.click()
      await flushAsyncWork()
    })

    expect(document.body.textContent).toContain('1 个工具调用，1 成功，0 失败')
    expect(document.body.textContent).toContain('从 final message metadata 恢复来源。')
    expect(document.body.textContent).toContain('Agent: internal / succeeded')
    expect(document.body.textContent).toContain('docs.lookup')

    const evidenceButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '.soha-ai-workbench__message-results button, .soha-ai-workbench__message-activity button',
      ),
    )
      .reverse()
      .find((button) => button.textContent?.replace(/\s/g, '').includes('来源'))
    expect(evidenceButton).toBeTruthy()

    await act(async () => {
      evidenceButton?.click()
      await flushAsyncWork()
    })

    expect(document.body.textContent).toContain('Runbook source from metadata')
  })

  it('replays running external agent run workbenchEvents from polling', async () => {
    testState.sessionAgentProviderId = 'hermes'
    testState.agentRuns = [
      externalAgentRun([
        {
          id: 'evt-live-thinking',
          sessionId: 'session-1',
          runId: 'agent-run-live',
          sequence: 1,
          createdAt: '2026-05-12T10:05:02Z',
          type: 'thinking.delta',
          textDelta: 'Checking live run.',
        },
        {
          id: 'evt-live-tool-started',
          sessionId: 'session-1',
          runId: 'agent-run-live',
          sequence: 2,
          createdAt: '2026-05-12T10:05:03Z',
          type: 'tool.started',
          toolCall: {
            id: 'tool-live',
            adapterId: 'logs.v1',
            toolName: 'logs.query',
            status: 'running',
            summary: '查询 payment-api 错误日志。',
            startedAt: '2026-05-12T10:05:03Z',
          },
        },
        {
          id: 'evt-live-tool-completed',
          sessionId: 'session-1',
          runId: 'agent-run-live',
          sequence: 3,
          createdAt: '2026-05-12T10:05:05Z',
          type: 'tool.completed',
          toolCall: {
            id: 'tool-live',
            adapterId: 'logs.v1',
            toolName: 'logs.query',
            status: 'success',
            summary: '发现连接池错误日志。',
            startedAt: '2026-05-12T10:05:03Z',
            completedAt: '2026-05-12T10:05:05Z',
          },
        },
      ]),
    ]

    const container = await renderPage()

    expect(apiGetMock).toHaveBeenCalledWith('/copilot/agent-runs?sessionId=session-1')
    expect(container.textContent).toContain('Checking live run.')
    expect(container.querySelector('.soha-ai-workbench__detail')).toBeNull()
    expect(container.textContent).toContain('执行记录 1')

    const activity = container.querySelector('.soha-ai-tool-activity')
    expect(activity).not.toBeNull()
    expect(activity?.textContent).toContain('logs.query')
    expect(activity?.textContent).toContain('发现连接池错误日志。')
    expect(activity?.textContent).toContain('已完成')
  })

  it('does not duplicate running external run replay when polling returns the same events', async () => {
    testState.sessionAgentProviderId = 'hermes'
    testState.agentRuns = [
      externalAgentRun([
        {
          id: 'evt-live-thinking',
          sessionId: 'session-1',
          runId: 'agent-run-live',
          sequence: 1,
          createdAt: '2026-05-12T10:05:02Z',
          type: 'thinking.delta',
          textDelta: 'Checking live run.',
        },
        {
          id: 'evt-live-tool-started',
          sessionId: 'session-1',
          runId: 'agent-run-live',
          sequence: 2,
          createdAt: '2026-05-12T10:05:03Z',
          type: 'tool.started',
          toolCall: {
            id: 'tool-live',
            adapterId: 'logs.v1',
            toolName: 'logs.query',
            status: 'running',
            summary: '查询 payment-api 错误日志。',
            startedAt: '2026-05-12T10:05:03Z',
          },
        },
      ]),
    ]
    const container = await renderPage()

    await act(async () => {
      await container.queryClient.refetchQueries({ queryKey: ['copilot-agent-runs', 'session-1'] })
      await flushAsyncWork()
    })

    expect(container.textContent?.match(/Checking live run\./g)?.length).toBe(1)

    const activity = container.querySelector('.soha-ai-tool-activity')
    expect(activity).not.toBeNull()
    expect(activity?.querySelectorAll(':scope > details')).toHaveLength(1)
    expect(activity?.textContent).toContain('logs.query')
  })

  it('keeps final message metadata ahead of stale running external run replay', async () => {
    testState.sessionAgentProviderId = 'hermes'
    testState.messageScenario = 'final-agent-run-metadata'
    testState.agentRuns = [
      {
        id: 'agent-run-final',
        providerId: 'hermes',
        providerKind: 'hermes',
        capabilityId: 'root_cause',
        sessionId: 'session-1',
        rootCauseRunId: 'agent-run-final',
        status: 'running',
        output: {
          workbenchEvents: [
            {
              id: 'evt-stale-thinking',
              sessionId: 'session-1',
              runId: 'agent-run-final',
              sequence: 1,
              createdAt: '2026-05-12T10:05:01Z',
              type: 'thinking.delta',
              textDelta: 'stale polling event',
            },
          ],
        },
        queuedAt: '2026-05-12T10:05:00Z',
        startedAt: '2026-05-12T10:05:01Z',
        updatedAt: '2026-05-12T10:05:02Z',
      },
    ]

    const container = await renderPage()

    expect(container.textContent).toContain('最终 agent 结果已经落库。')
    expect(container.textContent).not.toContain('stale polling event')

    const chainButton = messageAction(container, '执行记录')
    expect(chainButton).toBeTruthy()
    expect(chainButton?.disabled).toBe(false)

    await act(async () => {
      chainButton?.click()
      await flushAsyncWork()
    })

    expect(document.body.textContent).toContain('final message metadata wins')
    expect(document.body.textContent).toContain('metrics.final_summary')
    expect(document.body.textContent).toContain('Agent: hermes / succeeded')
    expect(document.body.textContent).not.toContain('stale polling event')
  })

  it('archives sessions from the left session list', async () => {
    const container = await renderPage()

    const archiveButton = container.querySelector(
      'button[aria-label="归档 支付告警调查"]',
    ) as HTMLButtonElement | null
    expect(archiveButton).toBeTruthy()

    await act(async () => {
      archiveButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.body.textContent).toContain('确认归档此会话？')

    const popover = document.body.querySelector('.ant-popover')
    expect(popover?.innerHTML).toContain('归档')
    const confirmButton = popover?.querySelector<HTMLButtonElement>('.ant-btn-primary')
    expect(confirmButton).toBeTruthy()

    await act(async () => {
      confirmButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(apiDeleteMock).toHaveBeenCalledWith('/copilot/sessions/session-1')
  })

  it('persists the session agent provider together with the toolset contract', async () => {
    testState.sessionAgentProviderId = 'hermes'
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const toolsetButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('工具装配'),
    )
    expect(toolsetButton).toBeTruthy()

    await act(async () => {
      toolsetButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.body.textContent).toContain('Hermes Agent')
    expect(document.body.textContent).toContain('异步 runner')

    const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('保存会话级装配'),
    )
    expect(saveButton).toBeTruthy()

    await act(async () => {
      saveButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(apiPatchMock).toHaveBeenCalledWith('/copilot/sessions/session-1', {
      agentProviderId: 'hermes',
      toolset: {
        enabledAdapterIds: ['metrics.v1'],
        enabledSkillIds: ['root-cause-skill'],
        disabledToolNames: ['metrics.v1.metrics.anomaly_summary'],
        budgetOverrides: { timeoutSeconds: 45, maxEvidenceItems: 12 },
        scopeOverrides: { namespace: 'payments-shadow', timeRangeMinutes: 30 },
      },
    })
  })

  it('confirms explicit analysis mode and prompt before running the session analysis', async () => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.chat', 'observe.ai.root-cause.run'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const explicitAnalysisButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('显式分析'),
    )
    expect(explicitAnalysisButton).toBeTruthy()

    await act(async () => {
      explicitAnalysisButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.body.textContent).toContain('显式分析设置')
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    const dialogText = dialog?.textContent ?? ''
    expect(dialogText).toContain('性能分析')
    expect(dialogText).toContain('链路分析')
    expect(dialogText).toContain('巡检复盘')
    expect(dialogText).not.toContain('通用聊天')
    const analysisTextarea = Array.from(document.body.querySelectorAll('textarea')).find(
      (textarea) => textarea.placeholder === '描述这轮分析要回答的问题',
    )
    expect(analysisTextarea?.value).toBe('确认异常来源与影响面')
    expect(document.body.textContent).toContain('local-k3s / payments / payment-api')

    const startAnalysisButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('开始分析'),
    )
    expect(startAnalysisButton).toBeTruthy()

    await act(async () => {
      startAnalysisButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('确认异常来源与影响面'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(apiPostMock).not.toHaveBeenCalledWith(
      '/copilot/sessions/session-1/analyze',
      expect.anything(),
    )
    expect(latestRoute).toBe('/ai-workbench/root-cause?session=session-1')
  })

  it('runs explicit analysis through the session-level Hermes provider when selected', async () => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.chat', 'observe.ai.root-cause.run'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    testState.sessionAgentProviderId = 'hermes'
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const explicitAnalysisButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('显式分析'),
    )
    expect(explicitAnalysisButton).toBeTruthy()

    await act(async () => {
      explicitAnalysisButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.body.textContent).toContain('Hermes Agent')
    expect(document.body.textContent).toContain('通过外部 Hermes runner 异步执行。')

    const startAnalysisButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('开始分析'),
    )
    expect(startAnalysisButton).toBeTruthy()

    await act(async () => {
      startAnalysisButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(streamWorkbenchMessageMock).toHaveBeenCalledWith(
      '/copilot/sessions/session-1/messages/stream',
      expectedStreamBody('确认异常来源与影响面', 'root_cause', 'hermes'),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(apiPostMock).not.toHaveBeenCalledWith(
      '/copilot/sessions/session-1/analyze',
      expect.anything(),
    )
  })

  it('creates an inspection task from the current session with the inspection profile', async () => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.chat', 'observe.ai.inspection.create'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const createInspectionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('生成巡检任务'),
    )
    expect(createInspectionButton).toBeTruthy()

    await act(async () => {
      createInspectionButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(apiPostMock).toHaveBeenCalledWith('/copilot/sessions/session-1/inspection-task', {
      title: '支付告警调查 巡检模板',
      scopeType: 'namespace',
      clusterId: 'local-k3s',
      namespace: 'payments',
      checks: ['cluster_health', 'alert_pressure', 'audit_denials'],
      enabled: true,
      intervalMinutes: 30,
      metadata: {
        analysisProfileId: 'profile:inspection',
      },
    })
  })

  it('requires chat and inspection create permissions before creating an inspection task from a session', async () => {
    testState.snapshot = {
      permissionKeys: ['observe.ai.view', 'observe.ai.inspection.create'],
      visibleMenuIds: [],
      visibleMenus: [],
    } as PermissionSnapshot
    const container = await renderPage()
    await openWorkbenchPanel(container, '会话设置')

    const createInspectionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('生成巡检任务'),
    ) as HTMLButtonElement | undefined
    expect(createInspectionButton).toBeTruthy()
    expect(createInspectionButton?.disabled).toBe(true)
    expect(createInspectionButton?.getAttribute('title')).toBe('缺少 observe.ai.chat 权限')
  })
})
