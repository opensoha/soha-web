/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildDetailPage } from './builds/detail-page'
import { ExecutionTaskDetailPage } from './execution-tasks/detail-page'
import { ReleaseDetailPage } from './releases/detail-page'
import { ApplicationWorkloadDetailPage } from './runtime/workload-detail-page'
import { I18nProvider } from '@/i18n'
import { usePreferencesStore } from '@/stores/preferences-store'

const testState = vi.hoisted(() => ({
  missingKind: '' as '' | 'build' | 'workflow' | 'release' | 'release_bundle' | 'execution_task',
  workloadRuntimePending: false,
  workloadRuntimeError: false,
  workloadRuntimeNotFound: false,
  workloadPodsEmpty: false,
  workloadAccessEmpty: false,
  apiGet: vi.fn(async (path: string) => {
    const application = {
      id: 'app-1',
      name: 'Checkout Platform',
      key: 'checkout-platform',
      group: 'commerce',
      language: 'go',
      enabled: true,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-08T00:00:00Z',
    }
    const binding = {
      id: 'binding-1',
      applicationId: 'app-1',
      environmentId: 'env-1',
      environmentKey: 'test',
      workflowTemplateId: 'wf-template-1',
      buildPolicy: { sourceId: 'source-api' },
      releasePolicy: { requiresApproval: false },
      targets: [],
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-08T00:00:00Z',
    }
    const environment = {
      id: 'env-1',
      key: 'test',
      name: '测试环境',
      stageLevel: 1,
      sortOrder: 1,
      isProduction: false,
      requiresApproval: false,
      enabled: true,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-08T00:00:00Z',
    }
    const workflowTemplate = {
      id: 'wf-template-1',
      key: 'release-dag',
      name: 'Release DAG',
      enabled: true,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-08T00:00:00Z',
    }
    const links = {
      application: '/applications/app-1?tab=delivery',
      audit: '/system/audit?metadataKey=runtime.execution_task.id&metadataValue=task-1',
      operations: '/system/operations?metadataKey=runtime.execution_task.id&metadataValue=task-1',
      artifacts: '/delivery/artifacts?executionTaskId=task-1',
    }
    const permissions = {
      canViewArtifacts: true,
      canViewAudit: true,
      canViewOperations: true,
      canRetry: true,
      canCancel: true,
    }
    if (path === '/delivery/runtime/builds/build-1') {
      const object = {
        id: 'build-1',
        applicationId: 'app-1',
        sourceSystem: 'application',
        status: 'completed',
        metadata: { applicationEnvironmentId: 'binding-1' },
        createdAt: '2026-05-08T00:00:00Z',
        updatedAt: '2026-05-08T01:00:00Z',
      }
      return {
        data: {
          kind: 'build',
          id: 'build-1',
          object,
          application,
          binding,
          environment,
          workflowTemplate,
          artifacts: [],
          evidence: {},
          links: { ...links, artifacts: '/delivery/artifacts' },
          permissions,
        },
      }
    }
    if (path === '/delivery/runtime/releases/release-1') {
      const object = {
        id: 'release-1',
        applicationId: 'app-1',
        clusterId: 'cluster-a',
        namespace: 'checkout',
        deploymentName: 'checkout-api',
        status: 'completed',
        metadata: { applicationEnvironmentId: 'binding-1' },
        createdAt: '2026-05-08T00:00:00Z',
        updatedAt: '2026-05-08T01:00:00Z',
      }
      return {
        data: {
          kind: 'release',
          id: 'release-1',
          object,
          application,
          binding,
          environment,
          workflowTemplate,
          artifacts: [],
          evidence: {},
          links,
          permissions,
        },
      }
    }
    if (path === '/delivery/runtime/execution-tasks/task-1') {
      const object = {
        id: 'task-1',
        releaseBundleId: 'bundle-1',
        applicationId: 'app-1',
        applicationEnvironmentId: 'binding-1',
        taskKind: 'build_release',
        providerKind: 'ci_agent_runner',
        targetKind: 'k8s_workload',
        status: 'running',
        maxRetries: 1,
        attemptCount: 1,
        timeoutSeconds: 600,
        createdAt: '2026-05-08T00:00:00Z',
        updatedAt: '2026-05-08T01:00:00Z',
      }
      const artifacts = [
        {
          id: 'artifact-2',
          kind: 'image',
          name: 'checkout-api',
          ref: 'registry.example.com/checkout/api:1.2.3',
          status: 'completed',
        },
      ]
      const evidence = {
        logs: [
          {
            id: 'log-1',
            logLevel: 'info',
            message: 'task running',
            createdAt: '2026-05-08T01:00:00Z',
          },
        ],
      }
      return {
        data: {
          kind: 'execution_task',
          id: 'task-1',
          object,
          application,
          binding,
          environment,
          workflowTemplate,
          artifacts,
          evidence,
          links,
          permissions,
        },
      }
    }
    if (
      path ===
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api/runtime'
    ) {
      if (testState.workloadRuntimePending) await new Promise<never>(() => {})
      if (testState.workloadRuntimeError) throw new Error('runtime unavailable')
      if (testState.workloadRuntimeNotFound) {
        const error = new Error('not found') as Error & { status: number }
        error.status = 404
        throw error
      }
      return {
        data: {
          application,
          binding,
          environment,
          workload: {
            applicationEnvironmentId: 'binding-1',
            clusterId: 'cluster-a',
            namespace: 'checkout',
            workloadKind: 'Deployment',
            workloadName: 'checkout-api',
            desiredReplicas: 2,
            readyReplicas: 2,
            updatedReplicas: 2,
            availableReplicas: 2,
          },
          deployment: {
            name: 'checkout-api',
            namespace: 'checkout',
            desiredReplicas: 2,
            readyReplicas: 2,
            updatedReplicas: 2,
            availableReplicas: 2,
            observedGeneration: 3,
            strategy: 'RollingUpdate',
            labels: { app: 'checkout-api' },
            relatedResources: [
              {
                kind: 'ConfigMap',
                name: 'checkout-config',
                namespace: 'checkout',
                relation: 'config',
              },
              {
                kind: 'Secret',
                name: 'checkout-secret',
                namespace: 'checkout',
                relation: 'secret',
              },
              {
                kind: 'PersistentVolumeClaim',
                name: 'checkout-data',
                namespace: 'checkout',
                relation: 'volume',
              },
              ...(testState.workloadAccessEmpty
                ? []
                : [
                    {
                      kind: 'HTTPRoute',
                      name: 'checkout-route',
                      namespace: 'checkout',
                      relation: 'routes-service',
                    },
                  ]),
            ],
            containers: [
              {
                name: 'checkout-api',
                image: 'registry.example.com/checkout/api:1.2.3',
              },
              {
                name: 'telemetry-sidecar',
                image: 'registry.example.com/observability/agent:2.0.0',
                role: 'sidecar',
              },
            ],
          },
          pods: testState.workloadPodsEmpty
            ? []
            : [
                {
                  name: 'checkout-api-7d9f6b7c5f-x2k9m',
                  namespace: 'checkout',
                  phase: 'Running',
                  nodeName: 'worker-01',
                  podIp: '10.42.0.18',
                  readyContainers: '2/2',
                  restarts: 0,
                  ageSeconds: 3600,
                },
              ],
          services: testState.workloadAccessEmpty
            ? []
            : [
                {
                  name: 'checkout-api',
                  namespace: 'checkout',
                  type: 'ClusterIP',
                  clusterIp: '10.43.18.24',
                  ports: ['http:8080/TCP'],
                  ageSeconds: 3600,
                },
              ],
          ingresses: testState.workloadAccessEmpty
            ? []
            : [
                {
                  name: 'checkout-public',
                  namespace: 'checkout',
                  className: 'nginx',
                  hosts: ['checkout.example.com'],
                  address: '10.0.0.20',
                  backendServices: ['checkout-api'],
                  ageSeconds: 3600,
                },
              ],
        },
      }
    }
    if (path.startsWith('/clusters/cluster-a/workloads/deployments/checkout-api/metrics?')) {
      return { data: { cpu: [], memory: [] } }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: (path: string) => testState.apiGet(path),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/services/api-error', () => ({
  isApiError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in error),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  usePermissionSnapshot: () => ({
    data: {
      data: {
        permissionKeys: [
          'delivery.applications.view',
          'delivery.workflows.view',
          'delivery.releases.view',
          'delivery.release-bundles.view',
          'delivery.execution-tasks.view',
        ],
      },
    },
    isLoading: false,
  }),
  hasPermission: () => true,
}))

vi.mock('@/components/pod-log-viewer', () => ({
  PodLogViewer: ({ container, podName }: { container?: string; podName: string }) => (
    <div data-testid="pod-log-viewer">{`${podName}:${container ?? ''}`}</div>
  ),
}))

vi.mock('@/components/pod-terminal', () => ({
  PodTerminal: ({
    container,
    podName,
    toolbarContent,
  }: {
    container?: string
    podName: string
    toolbarContent?: ReactNode
  }) => (
    <div data-testid="pod-terminal">
      {toolbarContent}
      {`${podName}:${container ?? ''}`}
    </div>
  ),
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => <div data-testid="resource-metrics-panel">metrics</div>,
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
      <I18nProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route path="/builds/:buildId" element={node} />
                <Route path="/workflows/:workflowId" element={node} />
                <Route path="/releases/:releaseId" element={node} />
                <Route path="/delivery/release-bundles/:releaseBundleId" element={node} />
                <Route path="/delivery/execution-tasks/:executionTaskId" element={node} />
                <Route
                  path="/applications/:applicationId/application-environments/:applicationEnvironmentId/workloads/:workloadName"
                  element={node}
                />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AntApp>
      </I18nProvider>,
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
    usePreferencesStore.setState({ localeCode: 'zh_CN' })
    testState.apiGet.mockClear()
    testState.workloadRuntimePending = false
    testState.workloadRuntimeError = false
    testState.workloadRuntimeNotFound = false
    testState.workloadPodsEmpty = false
    testState.workloadAccessEmpty = false
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
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
    const container = await renderWithProviders(
      <ExecutionTaskDetailPage />,
      '/delivery/execution-tasks/task-1',
    )
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

  it('keeps the application workspace visible around workload operations', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api',
    )

    expect(container.querySelector('.soha-management-detail-header')).not.toBeNull()
    expect(container.querySelector('.soha-page.soha-workload-detail-page')).not.toBeNull()
    expect(
      container.querySelector('.soha-page > .soha-resource-tabs.soha-application-context-tabs'),
    ).not.toBeNull()
    expect(
      container.querySelector('.soha-application-context-tabs .ant-tabs-tab-active')?.textContent,
    ).toBe('服务')
    const detailHeader = container.querySelector('.soha-management-detail-header')
    const runtimeWorkspace = container.querySelector('.soha-workload-runtime-workspace')
    const workloadTabs = container.querySelector('.soha-workload-detail-tabs')
    expect(runtimeWorkspace).not.toBeNull()
    expect(workloadTabs).not.toBeNull()
    expect(detailHeader?.nextElementSibling).toBe(runtimeWorkspace)
    expect(
      runtimeWorkspace?.children[0]?.classList.contains('soha-management-searchable-list-pane'),
    ).toBe(true)
    expect(runtimeWorkspace?.children[1]).toBe(workloadTabs)
    expect(container.querySelector('.soha-workload-detail-nav')).toBeNull()
    expect(
      container.querySelector('.soha-workload-detail-tabs .ant-tabs-tab-active')?.textContent,
    ).toBe('Pods 1')
    expect(
      Array.from(container.querySelectorAll('.soha-workload-detail-tabs .ant-tabs-tab')).some(
        (tab) => tab.textContent === '概览',
      ),
    ).toBe(false)
    expect(
      Array.from(container.querySelectorAll('.soha-workload-detail-tabs .ant-tabs-tab')).some(
        (tab) => tab.textContent?.startsWith('访问 '),
      ),
    ).toBe(false)
    expect(
      container.querySelectorAll('.soha-management-panel-card .soha-management-panel-card'),
    ).toHaveLength(0)
    expect(container.textContent).toContain('checkout-api')
    expect(detailHeader?.textContent).toContain('命名空间 checkout')
    expect(detailHeader?.querySelector('.soha-workload-access-overview__title')).toBeNull()
    expect(detailHeader?.textContent).toContain('Service')
    expect(detailHeader?.textContent).toContain('同命名空间checkout-api')
    expect(detailHeader?.textContent).toContain('跨命名空间checkout-api.checkout')
    expect(detailHeader?.textContent).toContain('Cluster IP10.43.18.24')
    expect(detailHeader?.textContent).toContain('端口http:8080/TCP')
    expect(detailHeader?.textContent).toContain('Ingress')
    expect(detailHeader?.textContent).toContain('访问域名checkout.example.com')
    expect(detailHeader?.textContent).toContain('地址10.0.0.20')
    expect(detailHeader?.textContent).toContain('HTTPRoute')
    expect(detailHeader?.textContent).toContain('未返回 Gateway 监听地址')
    expect(detailHeader?.textContent).not.toContain('Namespace checkout')
  })

  it('localizes workload operations in English', async () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api',
    )

    expect(container.textContent).toContain('Back to services')
    expect(container.textContent).toContain('View logs')
    expect(container.textContent).toContain('Related resources 3')
    expect(container.textContent).toContain('Containers')
    const detailHeader = container.querySelector('.soha-management-detail-header')
    expect(detailHeader?.textContent).toContain('Namespace checkout')
    expect(detailHeader?.textContent).toContain('Same namespacecheckout-api')
    expect(detailHeader?.textContent).toContain('Cross namespacecheckout-api.checkout')
    expect(detailHeader?.textContent).toContain('Gateway listener address was not returned')
    expect(container.textContent).not.toContain('返回服务')

    const terminalContainer = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=terminal',
    )
    expect(terminalContainer.querySelector('[data-testid="pod-terminal"]')?.textContent).toContain(
      'Shell',
    )
  })

  it('localizes workload terminal labels in Chinese', async () => {
    const terminalContainer = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=terminal',
    )
    expect(terminalContainer.querySelector('[data-testid="pod-terminal"]')?.textContent).toContain(
      '命令解释器',
    )
  })

  it('keeps application context visible with English copy while runtime is pending', async () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    testState.workloadRuntimePending = true

    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=pods',
    )

    expect(
      container.querySelector('.soha-page > .soha-resource-tabs.soha-application-context-tabs'),
    ).not.toBeNull()
    expect(container.textContent).toContain('checkout-api')
    expect(container.textContent).toContain('Loading workload')
    expect(container.textContent).toContain('Reading runtime detail')
    expect(container.querySelector('.soha-management-state.is-loading')).not.toBeNull()
  })

  it('renders English workload runtime failures as errors instead of not-found', async () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    testState.workloadRuntimeError = true

    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api',
    )

    expect(container.textContent).toContain('Failed to load runtime detail')
    expect(container.textContent).toContain('runtime unavailable')
    expect(container.textContent).not.toContain('Runtime detail not found')
  })

  it('renders an English not-found state for a missing workload', async () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    testState.workloadRuntimeNotFound = true

    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api',
    )

    expect(container.textContent).toContain('Runtime detail not found')
    expect(container.textContent).not.toContain('Failed to load runtime detail')
  })

  it('shows an empty state for log and terminal tabs when no Pod exists', async () => {
    testState.workloadPodsEmpty = true

    for (const tab of ['logs', 'terminal']) {
      const container = await renderWithProviders(
        <ApplicationWorkloadDetailPage />,
        `/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=${tab}`,
      )
      const activePane = container.querySelector(
        '.soha-workload-detail-tabs [role="tabpanel"][aria-hidden="false"]',
      )
      expect(activePane?.textContent).toContain('当前 Workload 暂无 Pod')
      expect(activePane?.querySelector('.soha-management-state')).not.toBeNull()
    }
  })

  it('opens the Pod layer requested by a service Workload card', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=pods',
    )

    expect(
      container.querySelector('.soha-workload-detail-tabs .ant-tabs-tab-active')?.textContent,
    ).toBe('Pods 1')
    expect(container.querySelector('.soha-workload-runtime-workspace')).not.toBeNull()
    expect(container.querySelector('.soha-workload-runtime-workspace .ant-table')).toBeNull()
    expect(container.textContent).toContain('checkout-api-7d9f6b7c5f-x2k9m')
    expect(container.textContent).toContain('worker-01')
    expect(container.textContent).toContain('2/2')
    expect(container.textContent).toContain('checkout-api')
    expect(container.textContent).toContain('telemetry-sidecar')
    expect(container.querySelectorAll('.soha-workload-pod-container-item')).toHaveLength(2)
  })

  it('keeps empty access categories visible in the workload header', async () => {
    testState.workloadAccessEmpty = true
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api',
    )

    const detailHeader = container.querySelector('.soha-management-detail-header')
    expect(detailHeader?.textContent).toContain('Service')
    expect(detailHeader?.textContent).toContain('Ingress')
    expect(detailHeader?.textContent).toContain('Gateway API')
    expect(detailHeader?.textContent).toContain('暂无关联 Service')
    expect(detailHeader?.textContent).toContain('暂无关联 Ingress')
    expect(detailHeader?.textContent).toContain('暂无关联 Gateway API Route')
  })

  it('renders mounted configuration and storage relations without a table', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=related-resources',
    )

    expect(
      container.querySelector('.soha-workload-detail-tabs .ant-tabs-tab-active')?.textContent,
    ).toBe('关联资源 3')
    expect(container.querySelector('.soha-workload-detail-tabs .ant-table')).toBeNull()
    expect(container.querySelectorAll('.soha-workload-related-resource-card')).toHaveLength(3)
    expect(container.textContent).toContain('checkout-config')
    expect(container.textContent).toContain('checkout-secret')
    expect(container.textContent).toContain('checkout-data')
  })

  it('reuses the Kubernetes Pod log viewer with the selected container', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=logs',
    )

    expect(container.querySelector('[data-testid="pod-log-viewer"]')?.textContent).toBe(
      'checkout-api-7d9f6b7c5f-x2k9m:checkout-api',
    )
  })

  it('opens the Kubernetes Pod terminal inline with container controls', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=terminal',
    )

    expect(container.querySelector('[data-testid="pod-terminal"]')?.textContent).toContain(
      'checkout-api-7d9f6b7c5f-x2k9m:checkout-api',
    )
    expect(container.querySelectorAll('.soha-terminal-controls .ant-select')).toHaveLength(2)
  })

  it('loads the shared resource metrics panel', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkloadDetailPage />,
      '/applications/app-1/application-environments/binding-1/workloads/checkout-api?tab=metrics',
    )

    expect(container.querySelector('[data-testid="resource-metrics-panel"]')).not.toBeNull()
    expect(testState.apiGet).toHaveBeenCalledWith(
      '/clusters/cluster-a/workloads/deployments/checkout-api/metrics?namespace=checkout&rangeMinutes=60',
    )
  })
})
