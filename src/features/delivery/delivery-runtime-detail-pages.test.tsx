/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildDetailPage, ExecutionTaskDetailPage, ReleaseDetailPage } from './delivery-runtime-detail-pages'

const testState = vi.hoisted(() => ({
  missingKind: '' as '' | 'build' | 'workflow' | 'release' | 'release_bundle' | 'execution_task',
  apiGet: vi.fn(async (path: string) => {
    const application = { id: 'app-1', name: 'Checkout Platform', key: 'checkout-platform', group: 'commerce', language: 'go', enabled: true, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-08T00:00:00Z' }
    const binding = { id: 'binding-1', applicationId: 'app-1', environmentId: 'env-1', environmentKey: 'test', workflowTemplateId: 'wf-template-1', buildPolicy: { sourceId: 'source-api' }, releasePolicy: { requiresApproval: false }, targets: [], createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-08T00:00:00Z' }
    const environment = { id: 'env-1', key: 'test', name: '测试环境', stageLevel: 1, sortOrder: 1, isProduction: false, requiresApproval: false, enabled: true, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-08T00:00:00Z' }
    const workflowTemplate = { id: 'wf-template-1', key: 'release-dag', name: 'Release DAG', enabled: true, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-08T00:00:00Z' }
    const links = {
      application: '/applications/app-1?tab=delivery',
      audit: '/system/audit?metadataKey=runtime.execution_task.id&metadataValue=task-1',
      operations: '/system/operations?metadataKey=runtime.execution_task.id&metadataValue=task-1',
      artifacts: '/delivery/artifacts?executionTaskId=task-1',
    }
    const permissions = { canViewArtifacts: true, canViewAudit: true, canViewOperations: true, canRetry: true, canCancel: true }
    if (path === '/delivery/runtime/builds/build-1') {
      const object = { id: 'build-1', applicationId: 'app-1', sourceSystem: 'application', status: 'completed', metadata: { applicationEnvironmentId: 'binding-1' }, createdAt: '2026-05-08T00:00:00Z', updatedAt: '2026-05-08T01:00:00Z' }
      return { data: { kind: 'build', id: 'build-1', object, application, binding, environment, workflowTemplate, artifacts: [], evidence: {}, links: { ...links, artifacts: '/delivery/artifacts' }, permissions } }
    }
    if (path === '/delivery/runtime/releases/release-1') {
      const object = { id: 'release-1', applicationId: 'app-1', clusterId: 'cluster-a', namespace: 'checkout', deploymentName: 'checkout-api', status: 'completed', metadata: { applicationEnvironmentId: 'binding-1' }, createdAt: '2026-05-08T00:00:00Z', updatedAt: '2026-05-08T01:00:00Z' }
      return { data: { kind: 'release', id: 'release-1', object, application, binding, environment, workflowTemplate, artifacts: [], evidence: {}, links, permissions } }
    }
    if (path === '/delivery/runtime/execution-tasks/task-1') {
      const object = { id: 'task-1', releaseBundleId: 'bundle-1', applicationId: 'app-1', applicationEnvironmentId: 'binding-1', taskKind: 'build_release', providerKind: 'ci_agent_runner', targetKind: 'k8s_workload', status: 'running', maxRetries: 1, attemptCount: 1, timeoutSeconds: 600, createdAt: '2026-05-08T00:00:00Z', updatedAt: '2026-05-08T01:00:00Z' }
      const artifacts = [{ id: 'artifact-2', kind: 'image', name: 'checkout-api', ref: 'registry.example.com/checkout/api:1.2.3', status: 'completed' }]
      const evidence = { logs: [{ id: 'log-1', logLevel: 'info', message: 'task running', createdAt: '2026-05-08T01:00:00Z' }] }
      return { data: { kind: 'execution_task', id: 'task-1', object, application, binding, environment, workflowTemplate, artifacts, evidence, links, permissions } }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: { get: (path: string) => testState.apiGet(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/services/api-error', () => ({
  isApiError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in error),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  usePermissionSnapshot: () => ({ data: { data: { permissionKeys: ['delivery.applications.view', 'delivery.workflows.view', 'delivery.releases.view', 'delivery.release-bundles.view', 'delivery.execution-tasks.view'] } }, isLoading: false }),
  hasPermission: () => true,
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

async function renderWithProviders(node: ReactNode, route: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/builds/:buildId" element={node} />
              <Route path="/workflows/:workflowId" element={node} />
              <Route path="/releases/:releaseId" element={node} />
              <Route path="/delivery/release-bundles/:releaseBundleId" element={node} />
              <Route path="/delivery/execution-tasks/:executionTaskId" element={node} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>,
    )
  })
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })
  return container
}

describe('delivery runtime detail pages', () => {
  beforeEach(() => {
    testState.apiGet.mockClear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) root.unmount()
    })
    roots = []
    for (const container of containers) container.remove()
    containers = []
  })

  it('loads a build detail route directly from the runtime get API', async () => {
    const container = await renderWithProviders(<BuildDetailPage />, '/builds/build-1')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/runtime/builds/build-1')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/builds')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/applications/app-1/detail')
    expect(container.textContent).toContain('构建详情')
    expect(container.textContent).toContain('build-1')
  })

  it('loads an execution task detail route and renders logs and artifacts', async () => {
    const container = await renderWithProviders(<ExecutionTaskDetailPage />, '/delivery/execution-tasks/task-1')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/runtime/execution-tasks/task-1')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/delivery/execution-tasks')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/delivery/execution-tasks/task-1/artifacts')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/delivery/execution-tasks/task-1/logs')
    expect(container.textContent).toContain('执行任务详情')
    expect(container.textContent).toContain('task-1')
    expect(container.textContent).toContain('task running')
  })

  it('shows a not-found state when the record does not exist', async () => {
    testState.apiGet.mockImplementationOnce(async (path: string) => {
      if (path === '/delivery/runtime/releases/release-missing') {
        const error = new Error('not found') as Error & { status: number }
        error.status = 404
        throw error
      }
      throw new Error(`Unhandled GET ${path}`)
    })
    const container = await renderWithProviders(<ReleaseDetailPage />, '/releases/release-missing')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/runtime/releases/release-missing')
    expect(container.textContent).toContain('未找到')
    expect(container.textContent).toContain('Release')
  })
})
