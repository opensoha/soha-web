/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from 'antd'
import { VirtualizationConnectionStepModal } from './clusters/create-page'
import { VirtualizationClustersPage } from './clusters/list-page'
import { VirtualizationFlavorsPage } from './flavors/list-page'
import { VirtualizationImagesPage } from './images/list-page'
import { VirtualizationOperationsPage } from './operations/page'
import { VirtualizationOverviewPage } from './overview/page'
import { VirtualizationSyncPage } from './sync/page'
import { VirtualizationVmDetailPage } from './virtual-machines/detail-page'
import { VirtualizationVmsPage } from './virtual-machines/list-page'
import { buildClusterPayload, buildCreateVmPayload } from './virtualization-model'
import type { CreateVirtualMachineInput, VirtualizationClusterInput } from './virtualization-types'

const lazyRuntimeState = vi.hoisted(() => ({
  metricsLoads: 0,
  consoleLoads: 0,
}))

vi.mock('@visactor/react-vchart', () => {
  lazyRuntimeState.metricsLoads += 1
  return { LineChart: () => null }
})

vi.mock('@novnc/novnc', () => {
  lazyRuntimeState.consoleLoads += 1
  return {
    default: class MockRFB {
      scaleViewport = false
      resizeSession = false
      addEventListener() {}
      clipboardPasteFrom() {}
      disconnect() {}
      sendCtrlAltDel() {}
    },
  }
})

vi.mock('@/components/resource-metrics-panel', () => ({
  buildCompactChartSpec: () => ({}),
  compactMetricColors: {
    cpu: '#000',
    memory: '#000',
    networkRx: '#000',
    networkTx: '#000',
    default: '#000',
  },
  formatMetricValue: (value: unknown) => String(value ?? '-'),
}))

const testState = vi.hoisted(() => ({
  modules: {
    virtualization: true,
  },
  permissionSnapshot: {
    permissionKeys: [
      'virtualization.vms.manage',
      'virtualization.sync.manage',
      'virtualization.clusters.manage',
      'virtualization.operations.manage',
    ],
    visibleMenuIds: [],
    visibleMenus: [],
  },
  apiGet: vi.fn(async (path: string) => {
    if (path === '/modules') {
      return {
        data: [
          {
            descriptor: {
              id: 'virtualization',
              name: 'Virtualization',
              defaultPath: '/virtualization',
            },
            enabled: testState.modules.virtualization,
          },
        ],
      }
    }
    if (path === '/virtualization/vms?page=1&pageSize=10') {
      return {
        data: {
          items: [
            {
              id: 'vm-1',
              name: 'build-vm',
              provider: 'kubevirt',
              status: 'running',
              flavorName: 'standard-2c4g',
              bootImageName: 'ubuntu-24.04',
              cpu: 2,
              memoryMiB: 4096,
              diskGiB: 40,
            },
            {
              id: 'vm-stale',
              name: 'stale-vm',
              provider: 'kubevirt',
              status: 'stale',
              powerState: 'running',
              flavorName: 'standard-2c4g',
              bootImageName: 'ubuntu-24.04',
              cpu: 2,
              memoryMiB: 4096,
              diskGiB: 40,
            },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        },
      }
    }
    if (path === '/virtualization/vms/vm-1/detail') {
      return {
        data: {
          vm: {
            id: 'vm-1',
            name: 'build-vm',
            provider: 'kubevirt',
            status: 'running',
            flavorName: 'standard-2c4g',
            bootImageName: 'ubuntu-24.04',
            ipAddresses: ['10.0.0.8'],
          },
          providerRaw: { kind: 'VirtualMachine', metadata: { name: 'build-vm' } },
          operations: [
            {
              id: 'op-vm-failed',
              operationType: 'vm_action',
              status: 'failed',
              targetName: 'build-vm',
              message: 'restart failed',
              createdAt: '2026-05-21T01:00:00Z',
            },
            {
              id: 'op-vm',
              operationType: 'vm_create',
              status: 'completed',
              targetName: 'build-vm',
              createdAt: '2026-05-21T00:00:00Z',
            },
          ],
          logs: [
            {
              id: 'log-vm',
              taskId: 'op-vm',
              logLevel: 'info',
              message: 'vm ready',
              createdAt: '2026-05-21T00:00:00Z',
            },
          ],
        },
      }
    }
    if (path === '/virtualization/vms/vm-stale/detail') {
      return {
        data: {
          vm: {
            id: 'vm-stale',
            name: 'stale-vm',
            provider: 'kubevirt',
            status: 'stale',
            powerState: 'running',
            flavorName: 'standard-2c4g',
            bootImageName: 'ubuntu-24.04',
          },
          providerRaw: { kind: 'VirtualMachine', metadata: { name: 'stale-vm' } },
          operations: [],
          logs: [],
        },
      }
    }
    if (path === '/virtualization/vms/vm-1/metrics?rangeMinutes=60&stepSeconds=60') {
      return { data: { ready: true, series: [] } }
    }
    if (path === '/virtualization/vms/vm-1/console') {
      return { data: { ready: false, message: 'Console disabled in tests' } }
    }
    if (path === '/virtualization/overview') {
      return {
        data: {
          stats: {
            connections: { total: 2, healthy: 0, degraded: 1, unavailable: 1 },
            vmCount: 3,
            runningVmCount: 2,
            stoppedVmCount: 1,
            pendingTaskCount: 1,
            failedTaskCount: 1,
          },
          connectionSummary: {
            total: 2,
            healthy: 0,
            degraded: 1,
            unavailable: 1,
            neverSynced: 1,
            credentialMissing: 1,
          },
          taskSummary: { queued: 0, running: 1, failed: 1, timeout: 0, canceled: 0, completed: 1 },
          providerSummary: [
            { provider: 'pve', connections: 1, unavailable: 1 },
            { provider: 'kubevirt', connections: 1, degraded: 1 },
          ],
          recentOperations: [
            {
              id: 'op-recent',
              operationType: 'vm_create',
              status: 'running',
              targetName: 'build-vm',
              createdAt: '2026-05-21T00:00:00Z',
            },
          ],
          attention: {
            riskyConnections: [
              {
                id: 'conn-pve',
                name: 'pve-a',
                provider: 'pve',
                endpoint: 'https://pve.example:8006',
                enabled: true,
                verifyTls: true,
                health: 'unavailable',
                credentialConfigured: false,
                riskLevel: 'critical',
                riskReasons: ['连接不可用', '未配置凭证', '尚未同步'],
              },
            ],
            failedSyncTasks: [
              {
                id: 'op-retry',
                operationType: 'asset_sync',
                status: 'failed',
                targetName: 'conn-a',
                message: 'sync failed',
                allowedActions: ['retry'],
              },
            ],
            failedOperations: [
              {
                id: 'op-retry',
                operationType: 'asset_sync',
                status: 'failed',
                targetName: 'conn-a',
                message: 'sync failed',
                allowedActions: ['retry'],
              },
            ],
          },
        },
      }
    }
    if (path === '/virtualization/clusters') {
      return {
        data: [
          {
            id: 'conn-pve',
            name: 'pve-a',
            provider: 'pve',
            endpoint: 'https://pve.example:8006',
            enabled: true,
            verifyTls: true,
            health: 'unavailable',
            credentialConfigured: false,
            config: {
              defaultNode: 'pve-1',
              defaultStorage: 'local-lvm',
              defaultBridge: 'vmbr0',
              defaultSnippetStorage: 'local',
            },
          },
          {
            id: 'conn-1',
            name: 'kubevirt-a',
            provider: 'kubevirt',
            kubernetesClusterId: 'cluster-a',
            enabled: true,
            verifyTls: true,
            health: 'degraded',
            credentialConfigured: true,
            lastSyncedAt: '2026-05-21T00:00:00Z',
            config: {
              backendUrl: 'https://kube.example:6443',
              prometheusBearerTokenConfigured: true,
            },
          },
        ],
      }
    }
    if (path === '/clusters') {
      return {
        data: [
          {
            id: 'cluster-a',
            name: 'prod-k8s',
            region: 'cn',
            environment: 'prod',
            labels: {},
            connectionMode: 'direct_kubeconfig',
            version: 'v1.30.0',
            health: { status: 'healthy' },
          },
          {
            id: 'cluster-agent',
            name: 'edge-agent',
            region: 'cn',
            environment: 'edge',
            labels: {},
            connectionMode: 'agent',
            version: 'v1.30.0',
            health: { status: 'healthy' },
          },
        ],
      }
    }
    if (path === '/virtualization/clusters/conn-pve/delete-dependencies') {
      return {
        data: {
          connection: { id: 'conn-pve', name: 'pve-a', provider: 'pve' },
          vmCount: 1,
          imageCount: 2,
          flavorCount: 0,
          taskCount: 3,
          pendingTaskCount: 0,
          dockerHostCount: 1,
          vmSamples: [{ id: 'vm-1', name: 'build-vm', externalId: '101' }],
          taskSamples: [{ id: 'op-1', name: 'vm_create', status: 'completed' }],
          forceRequired: true,
          blocking: true,
          blockingReasons: ['virtual_machines', 'docker_hosts'],
        },
      }
    }
    if (path === '/virtualization/images' || path === '/virtualization/images?page=1&pageSize=10') {
      return {
        data: {
          items: [
            {
              id: 'image-1',
              name: 'ubuntu-24.04',
              provider: 'kubevirt',
              connectionId: 'conn-1',
              sourceKind: 'datasource',
              sourceRef: 'default/ubuntu',
              osType: 'ubuntu',
            },
            {
              id: 'image-2',
              name: 'debian-template',
              provider: 'pve',
              connectionId: 'conn-pve',
              sourceKind: 'template',
              sourceRef: 'local:vztmpl/debian.tar.zst',
              node: 'pve-1',
              storage: 'local',
              osType: 'debian',
            },
            {
              id: 'storage-local',
              name: 'local',
              provider: 'pve',
              connectionId: 'conn-pve',
              sourceKind: 'storage',
              assetKind: 'storage',
              node: 'pve-1',
              storage: 'local',
              config: { supportsSnippets: true, supportsISO: true, content: 'iso,snippets' },
            },
            {
              id: 'network-vmbr0',
              name: 'vmbr0',
              provider: 'pve',
              connectionId: 'conn-pve',
              sourceKind: 'network',
              assetKind: 'network',
              node: 'pve-1',
              config: { bridge: true, network: 'vmbr0' },
            },
          ],
          total: 4,
          page: 1,
          pageSize: 10,
        },
      }
    }
    if (path === '/virtualization/flavors') {
      return {
        data: [
          {
            id: 'flavor-1',
            name: 'standard-2c4g',
            cpu: 2,
            memoryMiB: 4096,
            diskGiB: 40,
            enabled: true,
          },
        ],
      }
    }
    if (path === '/virtualization/operations?assetType=asset_sync') {
      return {
        data: [
          {
            id: 'op-1',
            operationType: 'asset_sync',
            status: 'completed',
            targetName: 'kubevirt-a',
          },
        ],
      }
    }
    if (path === '/virtualization/operations?abnormal=true') {
      return {
        data: [
          {
            id: 'op-retry',
            operationType: 'asset_sync',
            status: 'failed',
            targetName: 'conn-a',
            connectionId: 'conn-a',
            message: 'sync failed',
            allowedActions: ['retry'],
          },
        ],
      }
    }
    if (path === '/virtualization/operations?abnormal=true&connectionId=conn-a') {
      return {
        data: [
          {
            id: 'op-retry',
            operationType: 'asset_sync',
            status: 'failed',
            targetName: 'conn-a',
            connectionId: 'conn-a',
            message: 'sync failed',
            allowedActions: ['retry'],
          },
        ],
      }
    }
    if (path === '/virtualization/operations') {
      return {
        data: [
          {
            id: 'op-cancel',
            operationType: 'vm_create',
            status: 'running',
            targetName: 'vm-a',
            allowedActions: ['cancel'],
          },
          {
            id: 'op-retry',
            operationType: 'asset_sync',
            status: 'failed',
            targetName: 'conn-a',
            connectionId: 'conn-a',
            message: 'sync failed',
            allowedActions: ['retry'],
          },
        ],
      }
    }
    if (path === '/virtualization/operations/op-1/logs') {
      return {
        data: [
          {
            id: 'log-1',
            taskId: 'op-1',
            logLevel: 'info',
            message: 'sync completed',
            createdAt: '2026-05-21T00:00:00Z',
          },
        ],
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
  apiPost: vi.fn(async (_path: string, _body?: unknown) => ({ data: { id: 'op-new' } })),
  apiPut: vi.fn(async (_path: string, _body?: unknown) => ({ data: { id: 'updated' } })),
  apiDelete: vi.fn(async (_path: string) => ({ data: undefined })),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  hasAllowedAction: (actions: string[] | undefined, action: string) =>
    actions?.includes(action) ?? false,
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, key: string) =>
    snapshot?.permissionKeys?.includes(key) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: testState.permissionSnapshot },
    isLoading: false,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: (path: string) => testState.apiGet(path),
    post: (path: string, body?: unknown) => testState.apiPost(path, body),
    put: (path: string, body?: unknown) => testState.apiPut(path, body),
    delete: (path: string) => testState.apiDelete(path),
  },
}))

vi.mock('@/stores/preferences-store', () => ({
  usePreferencesStore: {
    getState: () => ({ localeCode: 'zh_CN' }),
  },
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

async function renderWithProviders(node: ReactNode, route = '/virtualization/vms') {
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
        <MemoryRouter initialEntries={[route]}>
          <App>{node}</App>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  await settleQueries(queryClient)

  return container
}

async function settleQueries(queryClient: QueryClient) {
  let idleTicks = 0
  for (let index = 0; index < 50; index += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (queryClient.isFetching() === 0 && queryClient.isMutating() === 0) {
      idleTicks += 1
      if (idleTicks >= 3) {
        return
      }
    } else {
      idleTicks = 0
    }
  }
}

async function waitForText(text: string) {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (document.body.textContent?.includes(text)) {
      return
    }
  }
}

async function waitForDeleteCall(path: string) {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (testState.apiDelete.mock.calls.some(([calledPath]) => calledPath === path)) {
      return
    }
  }
}

async function waitForGetCall(path: string) {
  for (let index = 0; index < 50; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (testState.apiGet.mock.calls.some(([calledPath]) => calledPath === path)) {
      return
    }
  }
  throw new Error(`GET call not observed: ${path}`)
}

async function clickTabByText(container: ParentNode, text: string) {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (node) => node.textContent?.trim() === text,
  )
  if (!(tab instanceof HTMLElement)) {
    throw new Error(`tab not found by text: ${text}`)
  }
  await act(async () => {
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function clickButtonByLabel(container: ParentNode, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (node) => node.getAttribute('aria-label') === label,
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found by aria-label: ${label}`)
  }
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

async function clickButtonByText(container: ParentNode, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) =>
    node.textContent?.includes(text),
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found by text: ${text}`)
  }
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

function hasButtonByLabel(container: ParentNode, label: string) {
  return Array.from(container.querySelectorAll('button')).some(
    (node) => node.getAttribute('aria-label') === label,
  )
}

describe('virtualization pages', () => {
  beforeEach(() => {
    testState.modules = {
      virtualization: true,
    }
    testState.permissionSnapshot = {
      permissionKeys: [
        'virtualization.vms.manage',
        'virtualization.sync.manage',
        'virtualization.clusters.manage',
        'virtualization.operations.manage',
      ],
      visibleMenuIds: [],
      visibleMenus: [],
    }
    testState.apiGet.mockClear()
    testState.apiPost.mockClear()
    testState.apiPut.mockClear()
    testState.apiDelete.mockClear()
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
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: () => '',
        }) as unknown as CSSStyleDeclaration,
    )
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
    vi.clearAllMocks()
  })

  it('surfaces abnormal clusters and failed operations in overview', async () => {
    const container = await renderWithProviders(
      <VirtualizationOverviewPage />,
      '/virtualization/overview',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/overview')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/clusters')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/operations')
    expect(container.textContent).toContain('高风险连接')
    expect(container.textContent).toContain('失败与超时任务')
    expect(container.textContent).toContain('连接不可用')
    expect(container.textContent).toContain('sync failed')
    expect(container.textContent).toContain('Provider 分布')
  })

  it('loads paginated VMs and creates from flavor plus image with provider fields', async () => {
    const container = await renderWithProviders(<VirtualizationVmsPage />)

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/vms?page=1&pageSize=10')
    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/clusters')
    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/images')
    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/flavors')
    expect(container.textContent).toContain('build-vm')

    await act(async () => {
      const createButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('创建虚拟机'),
      )
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(document.body.textContent).toContain('Cloud Init')
    expect(document.body.textContent).toContain('规格')
    expect(document.body.textContent).toContain('启动镜像')
    expect(document.body.textContent).toContain('StorageClass')
    expect(document.body.textContent).toContain('DataSource 克隆')
    expect(document.body.textContent).toContain('DataVolume')
    expect(document.body.textContent).toContain('KubeVirt 网络类型')
    expect(document.body.textContent).toContain('Interface Model')
    expect(document.body.textContent).not.toContain('raw YAML')
    expect(document.body.textContent).not.toContain('raw PVE config')
  })

  it('shows stale VM records before their old power state', async () => {
    const listContainer = await renderWithProviders(<VirtualizationVmsPage />)
    const staleRow = Array.from(listContainer.querySelectorAll('tr')).find((row) =>
      row.textContent?.includes('stale-vm'),
    )

    expect(staleRow?.textContent).toContain('stale')
    expect(staleRow?.textContent).not.toContain('running')

    const detailContainer = await renderWithProviders(
      <VirtualizationVmDetailPage />,
      '/virtualization/vms/vm-stale',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/vms/vm-stale/detail')
    expect(detailContainer.textContent).toContain('stale-vm')
    expect(detailContainer.textContent).toContain('stale')
  })

  it('keeps the VM filter row on the compact aligned query layout', async () => {
    const container = await renderWithProviders(<VirtualizationVmsPage />)
    const query = container.querySelector('.soha-vrt-query.soha-vrt-vms-query')
    const fields = Array.from(
      query?.querySelectorAll<HTMLElement>('.soha-management-query-field') ?? [],
    )

    expect(query).not.toBeNull()
    expect(fields).toHaveLength(4)
    expect(fields.map((field) => field.textContent)).toEqual([
      expect.stringContaining('关键字'),
      expect.stringContaining('连接'),
      expect.stringContaining('状态'),
      expect.stringContaining('Provider'),
    ])
    expect(
      fields.map((field) => field.style.getPropertyValue('--soha-management-query-field-width')),
    ).toEqual(['300px', '180px', '136px', '160px'])
    expect(
      fields.map((field) =>
        field.style.getPropertyValue('--soha-management-query-field-min-width'),
      ),
    ).toEqual(['300px', '180px', '136px', '160px'])
  })

  it('uses the aligned query shell across virtualization list pages', async () => {
    const pages: Array<[ReactNode, string]> = [
      [<VirtualizationClustersPage />, '/virtualization/clusters'],
      [<VirtualizationImagesPage />, '/virtualization/images'],
      [<VirtualizationFlavorsPage />, '/virtualization/flavors'],
      [<VirtualizationOperationsPage />, '/virtualization/operations'],
      [<VirtualizationSyncPage />, '/virtualization/sync'],
    ]

    for (const [page, route] of pages) {
      const container = await renderWithProviders(page, route)
      expect(container.querySelector('.soha-vrt-query .soha-management-query-card')).not.toBeNull()
    }
  })

  it('builds VM create payload from the selected source mode', () => {
    const payload = buildCreateVmPayload({
      provider: 'kubevirt',
      connectionId: 'conn-1',
      name: 'build-vm',
      flavorId: 'flavor-1',
      bootImageId: 'image-pvc',
      sourceMode: 'pvc_clone',
      startAfterCreate: true,
      kubevirtStorageClass: 'fast-ssd',
      kubevirtDataVolumeName: 'build-vm-root',
      kubevirtNetworkType: 'multus',
      kubevirtNetworkAttachmentDefinition: 'apps/docker-build-net',
      kubevirtInterfaceModel: 'virtio',
      kubevirtInterfaceBinding: 'bridge',
      kubevirtInterfaceName: 'net1',
    }) satisfies CreateVirtualMachineInput

    expect(payload.sourceMode).toBe('pvc_clone')
    expect(payload.sourceId).toBe('image-pvc')
    expect(payload.imageId).toBe('image-pvc')
    expect(payload.providerParams).toMatchObject({
      storageClass: 'fast-ssd',
      dataVolumeName: 'build-vm-root',
      networkType: 'multus',
      networkAttachmentDefinition: 'apps/docker-build-net',
      interfaceModel: 'virtio',
      interfaceBinding: 'bridge',
      interfaceName: 'net1',
    })
    expect(payload).not.toHaveProperty('kubevirtStorageClass')
    expect(payload).not.toHaveProperty('kubevirtDataVolumeName')
  })

  it('builds PVE VM create payload with raw cloud-init snippet fields', () => {
    const payload = buildCreateVmPayload({
      provider: 'pve',
      connectionId: 'conn-pve',
      name: 'pve-vm',
      flavorId: 'flavor-1',
      bootImageId: 'image-pve-template',
      sourceMode: 'template_clone',
      cloudInit: '#cloud-config\npackages:\n  - docker.io',
      pveStorage: 'local-lvm',
      pveBridge: 'vmbr0',
      pveCloudInitUser: 'ubuntu',
      pveCloudInitSSHKeys: 'ssh-rsa AAAA',
      pveSnippetStorage: 'local',
      pveCICustom: 'user=local:snippets/docker-agent.yaml',
      startAfterCreate: true,
    }) satisfies CreateVirtualMachineInput

    expect(payload.sourceMode).toBe('template_clone')
    expect(payload.sourceId).toBe('image-pve-template')
    expect(payload.imageId).toBe('image-pve-template')
    expect(payload.cloudInit).toBe('#cloud-config\npackages:\n  - docker.io')
    expect(payload.providerParams).toMatchObject({
      storage: 'local-lvm',
      bridge: 'vmbr0',
      ciuser: 'ubuntu',
      sshkeys: 'ssh-rsa AAAA',
      snippetStorage: 'local',
      cicustom: 'user=local:snippets/docker-agent.yaml',
    })
    expect(payload).not.toHaveProperty('pveSnippetStorage')
    expect(payload).not.toHaveProperty('pveCICustom')
  })

  it('builds provider connection config for PVE and KubeVirt runtime fields', () => {
    const pvePayload = buildClusterPayload({
      provider: 'pve',
      name: 'pve-a',
      endpoint: 'https://pve.example:8006',
      defaultNode: 'pve-1',
      defaultStorage: 'local-lvm',
      defaultBridge: 'vmbr0',
      defaultSnippetStorage: 'local',
      tokenID: 'root@pam!soha',
      tokenSecret: 'secret',
    }) satisfies VirtualizationClusterInput
    expect(pvePayload.config).toMatchObject({
      defaultNode: 'pve-1',
      defaultStorage: 'local-lvm',
      defaultBridge: 'vmbr0',
      defaultSnippetStorage: 'local',
      snippetStorage: 'local',
    })
    expect(pvePayload.credential).toMatchObject({ tokenID: 'root@pam!soha', tokenSecret: 'secret' })
    expect(pvePayload).not.toHaveProperty('tokenID')
    expect(pvePayload).not.toHaveProperty('defaultNode')

    const kubevirtPayload = buildClusterPayload({
      provider: 'kubevirt',
      name: 'kubevirt-a',
      kubernetesClusterId: 'cluster-a',
      backendUrl: 'https://kube.example:6443',
      prometheusUrl: 'https://prometheus.example',
      prometheusBearerToken: 'secret',
      prometheusBearerTokenSecretRef: 'observability/prometheus-token',
      mode: 'direct_kubeconfig',
    }) satisfies VirtualizationClusterInput
    expect(kubevirtPayload.config).toMatchObject({
      backendUrl: 'https://kube.example:6443',
      prometheusUrl: 'https://prometheus.example',
      prometheusBearerTokenSecretRef: 'observability/prometheus-token',
      mode: 'direct_kubeconfig',
    })
    expect(kubevirtPayload.credential).toMatchObject({ prometheusBearerToken: 'secret' })
    expect(kubevirtPayload.endpoint).toBeUndefined()
    expect(kubevirtPayload).not.toHaveProperty('backendUrl')
    expect(kubevirtPayload).not.toHaveProperty('prometheusUrl')
    expect(kubevirtPayload.config).not.toHaveProperty('prometheusBearerToken')
  })

  it('renders VM detail with provider raw, operations, logs and AI investigation entry', async () => {
    const container = await renderWithProviders(
      <VirtualizationVmDetailPage />,
      '/virtualization/vms/vm-1',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/vms/vm-1/detail')
    expect(container.textContent).toContain('build-vm')
    expect(container.textContent).toContain('standard-2c4g')
    expect(container.textContent).toContain('ubuntu-24.04')
    expect(container.textContent).toContain('10.0.0.8')
    expect(container.textContent).toContain('Provider Raw')
    expect(container.textContent).toContain('任务历史')
    expect(container.textContent).toContain('vm ready')
    expect(container.textContent).toContain('最近异常任务')
    expect(container.textContent).toContain('restart failed')
    expect(container.textContent).toContain('AI调查')
    expect(container.textContent).toContain('来源模式')
    expect(container.textContent).toContain('来源引用')
    expect(container.textContent).toContain('Console 能力摘要')
    expect(container.textContent).toContain('Metrics 能力摘要')
  })

  it('hides VM actions without manage permission', async () => {
    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.vms.view'],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const container = await renderWithProviders(<VirtualizationVmsPage />)

    expect(container.textContent).not.toContain('创建虚拟机')
    expect(container.textContent).not.toContain('启动')
    expect(container.textContent).not.toContain('停止')
  })

  it('treats virtualization.manage as the aggregate virtualization permission', async () => {
    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.manage'],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const listContainer = await renderWithProviders(<VirtualizationVmsPage />)
    expect(listContainer.textContent).toContain('创建虚拟机')

    const detailContainer = await renderWithProviders(
      <VirtualizationVmDetailPage />,
      '/virtualization/vms/vm-1',
    )
    const tabTexts = Array.from(detailContainer.querySelectorAll('.ant-tabs-tab-btn'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
    expect(tabTexts).toContain('监控指标')
    expect(tabTexts).toContain('控制台')
    const metricsPath = '/virtualization/vms/vm-1/metrics?rangeMinutes=60&stepSeconds=60'
    const consolePath = '/virtualization/vms/vm-1/console'
    expect(testState.apiGet).not.toHaveBeenCalledWith(metricsPath)
    expect(testState.apiGet).not.toHaveBeenCalledWith(consolePath)
    expect(lazyRuntimeState.metricsLoads).toBe(0)
    expect(lazyRuntimeState.consoleLoads).toBe(0)

    await clickTabByText(detailContainer, '监控指标')
    await waitForGetCall(metricsPath)

    expect(testState.apiGet).toHaveBeenCalledWith(metricsPath)
    expect(lazyRuntimeState.metricsLoads).toBeGreaterThan(0)
    expect(testState.apiGet).not.toHaveBeenCalledWith(consolePath)
    expect(lazyRuntimeState.consoleLoads).toBe(0)

    await clickTabByText(detailContainer, '控制台')
    await waitForGetCall(consolePath)
    await waitForText('Console disabled in tests')

    expect(testState.apiGet).toHaveBeenCalledWith(consolePath)
    expect(lazyRuntimeState.consoleLoads).toBe(1)
    expect(detailContainer.textContent).toContain('控制台暂不可用')
    expect(detailContainer.textContent).toContain('Console disabled in tests')
  })

  it('does not load virtualization data or expose actions when the module is disabled', async () => {
    testState.modules = {
      virtualization: false,
    }
    testState.permissionSnapshot = {
      permissionKeys: [
        'virtualization.manage',
        'virtualization.vms.manage',
        'virtualization.sync.manage',
        'virtualization.clusters.manage',
        'virtualization.operations.manage',
      ],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const container = await renderWithProviders(<VirtualizationVmsPage />)

    expect(testState.apiGet).toHaveBeenCalledWith('/modules')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/vms?page=1&pageSize=10')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/clusters')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/images')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/virtualization/flavors')
    expect(container.textContent).not.toContain('创建虚拟机')
  })

  it('requires explicit VM allowed actions for power and delete controls', async () => {
    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.vms.manage'],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const container = await renderWithProviders(<VirtualizationVmsPage />)

    expect(container.textContent).toContain('build-vm')
    expect(hasButtonByLabel(container, '启动虚拟机')).toBe(false)
    expect(hasButtonByLabel(container, '停止虚拟机')).toBe(false)
    expect(hasButtonByLabel(container, '删除虚拟机')).toBe(false)
  })

  it('gates VM metrics query and console tab by dedicated permissions', async () => {
    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.vms.view'],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const container = await renderWithProviders(
      <VirtualizationVmDetailPage />,
      '/virtualization/vms/vm-1',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/vms/vm-1/detail')
    const tabTexts = Array.from(container.querySelectorAll('.ant-tabs-tab-btn'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
    expect(tabTexts).toContain('Provider Raw')
    expect(tabTexts).not.toContain('监控指标')
    expect(tabTexts).not.toContain('控制台')
    expect(testState.apiGet).not.toHaveBeenCalledWith(
      '/virtualization/vms/vm-1/metrics?rangeMinutes=60&stepSeconds=60',
    )
  })

  it('uses asset_sync filtering for the sync task page', async () => {
    const container = await renderWithProviders(<VirtualizationSyncPage />, '/virtualization/sync')

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/operations?assetType=asset_sync')
    expect(container.textContent).toContain('asset_sync')

    await clickButtonByLabel(container, '查看日志')
    await waitForText('sync completed')

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/operations/op-1/logs')
    expect(document.body.textContent).toContain('sync completed')
  })

  it('shows provider-specific cluster connection fields', async () => {
    await renderWithProviders(
      <VirtualizationConnectionStepModal
        initialProvider="kubevirt"
        onClose={() => undefined}
        open
      />,
      '/compute/virtualization/clusters',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/clusters')
    expect(document.body.textContent).toContain('Kubernetes 集群')
    expect(document.body.textContent).toContain('Prometheus Token SecretRef')
    expect(document.body.textContent).not.toContain('Other')
    expect(document.body.textContent).toContain('校验 TLS')
  })

  it('renders PVE credential fields without raw config editing', async () => {
    const container = await renderWithProviders(
      <VirtualizationClustersPage />,
      '/virtualization/clusters',
    )

    await clickButtonByLabel(container, '编辑连接')

    expect(document.body.textContent).toContain('Token ID')
    expect(document.body.textContent).toContain('Token Secret')
    expect(document.body.textContent).toContain('默认节点')
    expect(document.body.textContent).toContain('默认存储')
    expect(document.body.textContent).not.toContain('raw JSON')
    expect(container.textContent).toContain('风险等级')
    expect(container.textContent).toContain('最近失败同步')
    expect(container.textContent).toContain('最近异常任务')
  })

  it('previews dependencies before force deleting a virtualization connection', async () => {
    const container = await renderWithProviders(
      <VirtualizationClustersPage />,
      '/virtualization/clusters',
    )

    await clickButtonByLabel(container, '删除连接')
    await waitForText('删除将影响关联资源')

    expect(testState.apiGet).toHaveBeenCalledWith(
      '/virtualization/clusters/conn-pve/delete-dependencies',
    )
    expect(document.body.textContent).toContain('Docker Host')
    expect(document.body.textContent).toContain('build-vm')

    await clickButtonByText(document.body, '确认强制删除')
    await waitForDeleteCall('/virtualization/clusters/conn-pve?force=true')

    expect(testState.apiDelete).toHaveBeenCalledWith('/virtualization/clusters/conn-pve?force=true')
  })

  it('shows image management entries for KubeVirt and PVE sources', async () => {
    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.images.view', 'virtualization.images.manage'],
      visibleMenuIds: [],
      visibleMenus: [],
    }
    const container = await renderWithProviders(
      <VirtualizationImagesPage />,
      '/virtualization/images',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/virtualization/images?page=1&pageSize=10')
    expect(container.textContent).toContain('KubeVirt')
    expect(container.textContent).toContain('PVE')
    expect(container.textContent).toContain('datasource')
    expect(container.textContent).toContain('template')
    expect(container.textContent).toContain('新增镜像入口')

    await act(async () => {
      const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('新增镜像入口'),
      )
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(document.body.textContent).toContain('KubeVirt DataSource')
    expect(document.body.textContent).toContain('来源类型')
  })

  it('uses image and flavor allowed actions for row edit and delete controls', async () => {
    testState.permissionSnapshot = {
      permissionKeys: [
        'virtualization.images.view',
        'virtualization.images.manage',
        'virtualization.flavors.view',
        'virtualization.flavors.manage',
      ],
      visibleMenuIds: [],
      visibleMenus: [],
    }

    const imageContainer = await renderWithProviders(
      <VirtualizationImagesPage />,
      '/virtualization/images',
    )
    expect(imageContainer.textContent).toContain('ubuntu-24.04')
    expect(imageContainer.textContent).toContain('新增镜像入口')
    expect(hasButtonByLabel(imageContainer, '编辑镜像')).toBe(false)
    expect(hasButtonByLabel(imageContainer, '删除镜像')).toBe(false)

    const flavorContainer = await renderWithProviders(
      <VirtualizationFlavorsPage />,
      '/virtualization/flavors',
    )
    expect(flavorContainer.textContent).toContain('standard-2c4g')
    expect(flavorContainer.textContent).toContain('新增规格')
    expect(hasButtonByLabel(flavorContainer, '编辑规格')).toBe(false)
    expect(hasButtonByLabel(flavorContainer, '删除规格')).toBe(false)
  })

  it('initializes operations view from abnormal query preset', async () => {
    const container = await renderWithProviders(
      <VirtualizationOperationsPage />,
      '/virtualization/operations?abnormal=true',
    )

    expect(container.textContent).toContain('失败/超时')
    expect(container.textContent).toContain('sync failed')
    expect(container.textContent).not.toContain('vm-a')
  })

  it('initializes operations view from connection abnormal query preset', async () => {
    const container = await renderWithProviders(
      <VirtualizationOperationsPage />,
      '/virtualization/operations?connectionId=conn-a&abnormal=true',
    )

    expect(testState.apiGet).toHaveBeenCalledWith(
      '/virtualization/operations?abnormal=true&connectionId=conn-a',
    )
    expect(container.textContent).toContain('sync failed')
    expect(container.textContent).not.toContain('vm-a')
  })

  it('gates operation cancel and retry by manage permission and allowed actions', async () => {
    const container = await renderWithProviders(
      <VirtualizationOperationsPage />,
      '/virtualization/operations',
    )

    expect(hasButtonByLabel(container, '取消任务')).toBe(true)
    expect(hasButtonByLabel(container, '重试任务')).toBe(true)

    testState.permissionSnapshot = {
      permissionKeys: ['virtualization.operations.view'],
      visibleMenuIds: [],
      visibleMenus: [],
    }
    const readonlyContainer = await renderWithProviders(
      <VirtualizationOperationsPage />,
      '/virtualization/operations',
    )

    expect(hasButtonByLabel(readonlyContainer, '取消任务')).toBe(false)
    expect(hasButtonByLabel(readonlyContainer, '重试任务')).toBe(false)
  })
})
