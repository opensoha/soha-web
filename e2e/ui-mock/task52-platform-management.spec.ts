import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installMocks, verifyBrowserEvidence } from '../fixtures/mock-app'
import { verifyGeometry } from '../fixtures/geometry'

const root = '/api/v1/clusters/cluster-a'
const hpaYAML =
  'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: autoscale-api\n  namespace: monitoring\nspec:\n  minReplicas: 2\n  maxReplicas: 8\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: api\n'
const allowedActions = [
  'view',
  'create',
  'update',
  'delete',
  'restart',
  'scale',
  'rollback',
  'drain',
]
const base = { namespace: 'monitoring', ageSeconds: 3600, allowedActions }
const lists = [
  {
    route: '/configuration/configmaps',
    path: '/configuration/configmaps',
    name: 'application-settings',
    data: [
      { ...base, name: 'application-settings', dataEntries: 3, binaryEntries: 0, immutable: false },
    ],
  },
  {
    route: '/configuration/hpas',
    path: '/configuration/hpas',
    name: 'autoscale-api',
    data: [
      {
        ...base,
        name: 'autoscale-api',
        minReplicas: 2,
        maxReplicas: 8,
        currentReplicas: 3,
        desiredReplicas: 3,
        target: 'Deployment/api',
      },
    ],
  },
  {
    route: '/network/services',
    path: '/network/services',
    name: 'frontend-service',
    data: [
      {
        ...base,
        name: 'frontend-service',
        type: 'ClusterIP',
        clusterIP: '10.10.0.10',
        externalIPs: [],
        ports: [{ port: 80, protocol: 'TCP', targetPort: '8080' }],
        selector: { app: 'frontend' },
      },
    ],
  },
  {
    route: '/storage/persistentvolumeclaims',
    path: '/storage/persistentvolumeclaims',
    name: 'database-data',
    data: [
      {
        ...base,
        name: 'database-data',
        status: 'Bound',
        capacity: '20Gi',
        accessModes: ['ReadWriteOnce'],
        storageClass: 'local',
        volumeName: 'pv-data',
      },
    ],
  },
  {
    route: '/platform-access-control/roles',
    path: '/access-control/roles',
    name: 'namespace-reader',
    data: [{ ...base, name: 'namespace-reader', rules: 2 }],
  },
  {
    route: '/workloads/deployments',
    path: '/workloads/deployments',
    name: 'api',
    data: [
      {
        ...base,
        name: 'api',
        desiredReplicas: 3,
        readyReplicas: 3,
        updatedReplicas: 3,
        availableReplicas: 3,
        images: ['example.test/api:v1'],
        labels: { app: 'api' },
      },
    ],
  },
  {
    route: '/cluster-resources/nodes',
    path: '/infrastructure/nodes',
    name: 'worker-prod-01',
    data: [
      {
        name: 'worker-prod-01',
        status: 'Ready',
        roles: ['worker'],
        version: 'v1.31.0',
        internalIP: '10.0.0.11',
        labels: {},
        taints: [],
        allowedActions,
        capacity: { cpu: '8', memory: '16Gi', pods: '110' },
        allocatable: { cpu: '8', memory: '16Gi', pods: '110' },
        conditions: [],
      },
    ],
  },
  {
    route: '/helm/releases',
    path: '/helm/releases',
    name: 'ingress-controller',
    data: [
      {
        ...base,
        name: 'ingress-controller',
        revision: '3',
        status: 'deployed',
        chart: 'ingress-1.2.0',
        appVersion: '1.2.0',
        updatedAt: '2026-10-16T00:00:00Z',
      },
    ],
  },
] as const

async function platformMocks(context: BrowserContext, page: Page) {
  const state = {
    failedPath: '',
    readStatus: 200,
    writeStatus: 503,
    writes: [] as string[],
    reads: [] as string[],
    deleted: [] as string[],
    configMapName: 'application-settings',
  }
  const failure = (status: number) => ({
    status,
    body: {
      error: {
        code: 'synthetic_failure',
        message: '平台资源请求暂时不可用',
        request_id: 'platform-original-request',
      },
    },
  })
  await context.addInitScript(() =>
    localStorage.setItem(
      'soha-scope',
      JSON.stringify({ state: { clusterId: 'cluster-a', namespace: 'monitoring' }, version: 0 }),
    ),
  )
  const permissions = [
    'workbench.platform.view',
    'workspace.resource.view',
    'platform.clusters.view',
    'platform.clusters.create',
    'platform.clusters.update',
    'platform.clusters.delete',
    'platform.nodes.view',
    'platform.namespaces.view',
    'platform.deployment.view',
    'platform.deployment.update',
    'platform.pods.view',
    'platform.configuration.config-maps.view',
    'platform.configuration.config-maps.update',
    'platform.configuration.horizontal-pod-autoscalers.view',
    'platform.configuration.horizontal-pod-autoscalers.update',
    'platform.network.services.view',
    'platform.storage.persistent-volume-claims.view',
    'platform.access-control.roles.view',
    'platform.helm.view',
    'platform.helm.releases.view',
    'platform.helm.charts.view',
  ]
  const evidence = await installMocks(context, page, (url, method, request) => {
    const path = url.pathname
    if (path === '/api/v1/auth/stream-ticket' && method === 'POST') return failure(403)
    if (path === '/api/v1/access/permission-snapshot')
      return {
        body: {
          data: {
            permissionKeys: permissions,
            visibleMenuIds: [
              'clusters',
              'configuration',
              'configuration-configmaps',
              'configuration-hpas',
              'workloads',
              'workloads-deployments',
              'network',
              'network-services',
              'storage',
              'storage-persistentvolumeclaims',
              'platform-access-control',
              'platform-access-control-roles',
              'helm',
              'helm-releases',
            ],
            visibleMenus: [],
          },
        },
      }
    if (method === 'GET') {
      state.reads.push(path)
      if (state.failedPath === path && state.readStatus !== 200) return failure(state.readStatus)
      if (path === '/api/v1/clusters')
        return {
          body: {
            data: [
              {
                id: 'cluster-a',
                name: 'production-east',
                region: 'standard_kubernetes',
                environment: 'production',
                connectionMode: 'direct',
                labels: {},
                version: 'v1.31.0',
                health: { status: 'healthy' },
                allowedActions,
              },
              {
                id: 'cluster-b',
                name: 'production-west',
                region: 'standard_kubernetes',
                environment: 'production',
                connectionMode: 'direct',
                labels: {},
                version: 'v1.31.0',
                health: { status: 'healthy' },
                allowedActions,
              },
            ].filter((item) => !state.deleted.includes(item.id)),
          },
        }
      if (path === '/api/v1/clusters/capabilities')
        return {
          body: {
            data: ['resource.yaml.apply', 'helm.releases', 'workload.mutations'].map((key) => ({
              key,
              category: 'configuration',
              label: key,
              direct: { status: 'available' },
              agent: { status: 'available' },
              requiredScopes: ['cluster', 'namespace'],
              riskLevel: 'mutate',
            })),
          },
        }
      const list = lists.find((item) => path === root + item.path)
      if (list) {
        if (list.path !== '/infrastructure/nodes')
          expect(url.searchParams.get('namespace')).toBe('monitoring')
        return {
          body: {
            data:
              list.path === '/configuration/configmaps'
                ? list.data.map((item) => ({ ...item, name: state.configMapName }))
                : list.data,
          },
        }
      }
      if (path === '/api/v1/clusters/cluster-b/namespaces')
        return { body: { data: [{ name: 'monitoring', status: 'Active', labels: {} }] } }
      if (path === root + '/configuration/hpas/autoscale-api/yaml')
        return { body: { data: { content: hpaYAML } } }
    }
    if (path === root + '/resource-creation/scope-decision' && method === 'POST')
      return { body: { data: { allowed: true, scopeMode: 'namespace', reason: '' } } }
    if (path === root + '/resources/update-plan' && method === 'POST') {
      const input = request.postDataJSON()
      expect(input.name).toBe('autoscale-api')
      expect(input.namespace).toBe('monitoring')
      return {
        body: {
          data: {
            id: 'plan-platform',
            ready: true,
            capability: 'resource.yaml.apply',
            target: 'HorizontalPodAutoscaler monitoring/autoscale-api',
            riskLevel: 'medium',
            requiresApproval: true,
            warnings: [],
            changes: [
              {
                action: 'update',
                resource: 'HorizontalPodAutoscaler',
                summary: '调整副本范围，保留现有目标与指标配置',
              },
            ],
          },
        },
      }
    }
    if (path === root + '/workloads/deployments/restart' && method === 'POST') {
      expect(request.postDataJSON()).toEqual({ namespace: 'monitoring', name: 'api' })
      state.writes.push(path)
      return failure(state.writeStatus)
    }
    if (path === root + '/configuration/hpas/autoscale-api/yaml' && method === 'PUT') {
      state.writes.push(path)
      if (state.writeStatus !== 200) return failure(state.writeStatus)
      return { body: { data: { content: request.postDataJSON().content } } }
    }
    if (
      ['/api/v1/clusters/cluster-a', '/api/v1/clusters/cluster-b'].includes(path) &&
      method === 'DELETE'
    ) {
      state.writes.push(path)
      if (path.endsWith('cluster-b')) return failure(state.writeStatus)
      state.deleted.push('cluster-a')
      return { body: { data: null } }
    }
    return undefined
  })
  return { state, evidence }
}

for (const item of lists)
  test(`Platform ${item.route} retains refresh evidence and hides denied cache`, async ({
    context,
    page,
  }) => {
    const { state, evidence } = await platformMocks(context, page)
    await page.goto(item.route)
    await expect(page.getByText(item.name, { exact: true })).toBeVisible()
    const refresh = page.getByRole('button', { name: '刷新', exact: true })
    await expect(refresh).toHaveCount(1)
    state.failedPath = root + item.path
    state.readStatus = 503
    await refresh.click()
    await expect(page.getByText('列表未更新，正在展示上次读取结果')).toBeVisible()
    await expect(page.getByText(item.name, { exact: true })).toBeVisible()
    state.readStatus = 403
    await refresh.click()
    await expect(page.getByText('列表无访问权限')).toBeVisible()
    await expect(page.getByText(item.name, { exact: true })).toHaveCount(0)
    expect(state.writes).toEqual([])
    verifyBrowserEvidence(evidence)
  })

for (const mode of ['light', 'dark', 'narrow'] as const)
  test(`Platform feedback design (${mode})`, async ({ context, page }, info) => {
    if (mode === 'dark')
      await context.addInitScript(() =>
        localStorage.setItem(
          'soha-prefs',
          JSON.stringify({ state: { themeMode: 'dark' }, version: 0 }),
        ),
      )
    if (mode === 'narrow') await page.setViewportSize({ width: 390, height: 1000 })
    await page.emulateMedia({ reducedMotion: mode === 'narrow' ? 'reduce' : 'no-preference' })
    const { state, evidence } = await platformMocks(context, page)
    await page.goto('/configuration/configmaps')
    await expect(page.getByText('application-settings', { exact: true })).toBeVisible()
    state.failedPath = root + '/configuration/configmaps'
    state.readStatus = 503
    await page.getByRole('button', { name: '刷新', exact: true }).press('Enter')
    await expect(page.getByText('列表未更新，正在展示上次读取结果')).toBeVisible()
    await expect(page.locator('.ant-notification-notice')).toHaveCount(0)
    if (mode === 'dark')
      await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark')
    await verifyGeometry(page, page.getByRole('button', { name: '刷新', exact: true }))
    await page.screenshot({ path: info.outputPath(`platform-${mode}.png`), fullPage: true })
    verifyBrowserEvidence(evidence)
  })

test('Platform long resource identity remains usable at 125 percent zoom', async ({
  context,
  page,
}) => {
  const { state, evidence } = await platformMocks(context, page)
  state.configMapName = 'production-payments-application-settings-feature-flags-20261016'
  await page.goto('/configuration/configmaps')
  await expect(page.getByText(state.configMapName, { exact: true })).toBeVisible()
  await page.addStyleTag({ content: 'html { zoom: 1.25; }' })
  const refresh = page.getByRole('button', { name: '刷新', exact: true })
  await verifyGeometry(page, refresh)
  await refresh.press('Enter')
  await expect(page.getByText(state.configMapName, { exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  verifyBrowserEvidence(evidence)
})

async function openHPAEditor(page: Page) {
  await page.goto('/configuration/hpas')
  await page.getByRole('button', { name: '编辑 autoscale-api', exact: true }).click()
  const editor = page.getByRole('dialog', { name: /编辑 HorizontalPodAutoscaler/ })
  await editor.getByLabel('最小副本数', { exact: true }).fill('3')
  await editor.getByRole('button', { name: '保存更改', exact: true }).press('Enter')
  const plan = page.getByRole('dialog', { name: '确认资源变更', exact: true })
  await expect(plan.getByRole('button', { name: '确认更新', exact: true })).toBeDisabled()
  await plan.getByRole('checkbox').check()
  return { editor, plan }
}

test('Platform edit keeps its exact draft and confirmation locked after an unknown write', async ({
  context,
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { state, evidence } = await platformMocks(context, page)
  const { editor, plan } = await openHPAEditor(page)
  await plan.getByRole('button', { name: '确认更新', exact: true }).click()
  await expect(plan.getByText('更新资源：请求结果不明')).toBeVisible()
  await expect(plan.getByRole('button', { name: '确认更新', exact: true })).toBeDisabled()
  await expect(editor.getByLabel('最小副本数', { exact: true })).toHaveValue('3')
  await page.keyboard.press('Escape')
  await expect(plan).toBeVisible()
  expect(state.writes).toHaveLength(1)
  await expect(
    plan.locator('.soha-operation-feedback').filter({ hasText: '更新资源：请求结果不明' }),
  ).toHaveAttribute('data-motion-disabled', 'true')
  await verifyGeometry(page, plan.getByRole('button', { name: /取\s*消/ }))
  await page.screenshot({ path: info.outputPath('platform-unknown.png'), fullPage: true })
  verifyBrowserEvidence(evidence)
})

test('Platform known rejection retains values and successful correction stays on its receipt', async ({
  context,
  page,
}, info) => {
  const { state, evidence } = await platformMocks(context, page)
  state.writeStatus = 409
  const { editor, plan } = await openHPAEditor(page)
  await plan.getByRole('button', { name: '确认更新', exact: true }).click()
  await expect(plan.getByText('更新资源：操作请求失败')).toBeVisible()
  await expect(editor.getByLabel('最小副本数', { exact: true })).toHaveValue('3')
  state.writeStatus = 200
  await plan.getByRole('button', { name: '确认更新', exact: true }).click()
  await expect(plan).toHaveCount(0)
  await expect(page.getByRole('dialog').getByText('更新资源：请求已返回')).toBeVisible()
  await page.screenshot({ path: info.outputPath('platform-receipt.png'), fullPage: true })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /完\s*成/ })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes).toHaveLength(2)
  verifyBrowserEvidence(evidence)
})

test('Platform cluster batch keeps per-target evidence and only failed selection', async ({
  context,
  page,
}, info) => {
  const { state, evidence } = await platformMocks(context, page)
  await page.goto('/clusters')
  await expect(page.getByText('production-west', { exact: true })).toBeVisible()
  await page.locator('.ant-table-thead input[type="checkbox"]').check()
  await page.getByRole('button', { name: '批量删除', exact: true }).click()
  const confirm = page.getByRole('tooltip')
  await expect(confirm).toContainText('确认删除 2 个集群')
  await confirm.getByRole('button', { name: /删\s*除/ }).click()
  const feedback = page.locator('.soha-operation-feedback')
  await expect(feedback).toContainText('批量删除集群：请求结果不明')
  await expect(feedback).toContainText('cluster-a · 请求成功')
  await expect(feedback).toContainText('cluster-b · 结果不明')
  await expect(page.getByText('已选 1 项', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '批量删除', exact: true })).toBeDisabled()
  expect(state.writes).toEqual(['/api/v1/clusters/cluster-a', '/api/v1/clusters/cluster-b'])
  await page.screenshot({ path: info.outputPath('platform-batch.png'), fullPage: true })
  verifyBrowserEvidence(evidence)
})

test('Deployment unknown batch restart also blocks the row restart and other writes', async ({
  context,
  page,
}) => {
  const { state, evidence } = await platformMocks(context, page)
  await page.goto('/workloads/deployments')
  const row = page.getByRole('row').filter({ has: page.getByText('api', { exact: true }) })
  await row.getByRole('checkbox').check()
  await page.getByRole('button', { name: '批量重启 (1)', exact: true }).click()
  await expect(page.getByText('批量重启 Deployment：请求结果不明', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '重启', exact: true })).toBeDisabled()
  await expect(row.getByRole('button', { name: '编辑 api', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '批量重启 (1)', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([root + '/workloads/deployments/restart'])
  verifyBrowserEvidence(evidence)
})
