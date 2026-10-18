import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installMocks, verifyBrowserEvidence } from '../fixtures/mock-app'
import { verifyGeometry } from '../fixtures/geometry'

const time = '2026-10-18T01:00:00Z'
const device = {
  id: 'endpoint-engineering-long-identifier',
  name: '研发终端 MacBook · engineering-endpoint-with-a-long-name',
  hostname: 'engineering-mac.local',
  platform: 'macOS',
  deviceType: 'laptop',
  ownershipType: 'company',
  ownerUserId: 'user-engineering-long-identifier',
  siteId: 'site-office',
  status: 'active',
  postureStatus: 'compliant',
  lastSeenAt: time,
  reportedFacts: {
    osName: 'macOS',
    osVersion: '27.0',
    collectedAt: time,
    networkInterfaces: [
      {
        name: 'en0',
        kind: 'ethernet',
        status: 'up',
        ipv6Addresses: ['2001:db8:1234:5678:abcd:1234:5678:9012'],
        ipv4Addresses: ['192.0.2.10'],
        dnsServers: ['192.0.2.1'],
      },
    ],
  },
}
const profile = {
  id: 'vpn-office',
  revision: 2,
  publishedRevision: 1,
  configuration: {
    name: '研发 VPN 方案',
    enabled: true,
    gatewayIds: [],
    networkSpaceIds: [],
    allowedPathModes: ['relay'],
    preferredPathMode: 'relay',
  },
}
const routes = [
  'devices',
  'sites',
  'spaces',
  'resources',
  'gateways',
  'user-admission',
  'settings',
  'site-profile-bindings',
  'sessions',
  'enrollments',
  'access-grants',
  'policy',
  'mihomo-profiles',
  'telemetry',
  'vpn/profiles',
  'vpn/selection-policies',
  'vpn/dashboard',
]
const permissions = [
  'endpoint_devices',
  'sites',
  'spaces',
  'resources',
  'gateways',
  'mihomo_profiles',
  'enrollments',
  'access_grants',
  'policy',
  'telemetry',
  'vpn_profiles',
  'vpn_selection_policies',
  'vpn_dashboard',
].map((key) => `network_access.${key}.view`)

async function setup(context: BrowserContext, page: Page) {
  const state = {
    snapshotError: false,
    telemetryError: false,
    dashboardStatus: 200,
    dashboardReads: [] as URL[],
    writes: [] as string[],
  }
  const lists = [
    'sites',
    'spaces',
    'resources',
    'gateways',
    'mihomo-profiles',
    'nas-bindings',
    'site-profile-bindings',
    'sessions',
    'policies',
  ]
  const evidence = await installMocks(context, page, (url, method) => {
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/access/permission-snapshot')
      return {
        body: {
          data: {
            permissionKeys: ['workbench.security.view', ...permissions],
            visibleMenuIds: routes.map((route) => `network-access-${route.replace(/\//g, '-')}`),
            visibleMenus: routes.map((route) => ({
              id: `network-access-${route.replace(/\//g, '-')}`,
              path: `/network-access/${route}`,
              labelZh:
                route === 'devices'
                  ? '终端资产'
                  : route === 'vpn/dashboard'
                    ? 'VPN Dashboard'
                    : route,
            })),
          },
        },
      }
    if (method !== 'GET') {
      if (path.startsWith('/network-access/')) state.writes.push(`${method} ${path}`)
      return undefined
    }
    if (path === '/network-access/devices')
      return {
        body: {
          data: [
            device,
            { ...device, id: 'endpoint-lab', name: '验收终端 Linux', status: 'offline' },
          ],
        },
      }
    if (path === '/network-access/enrollments')
      return {
        body: {
          data: [
            {
              id: 'registration-1',
              runtimeId: 'runtime-office',
              runtimeKind: 'gateway',
              deviceId: device.id,
              subjectId: device.ownerUserId,
              status: 'pending',
              expiresAt: time,
            },
          ],
        },
      }
    if (path === '/network-access/access-grants')
      return {
        body: {
          data: [
            {
              id: 'grant-1',
              subjectId: device.ownerUserId,
              deviceId: device.id,
              siteId: device.siteId,
              networkSpaceId: 'office',
              mode: 'internal_ztna',
              resourceIds: ['resource-engineering'],
              status: 'issued',
              expiresAt: time,
            },
          ],
        },
      }
    if (lists.some((list) => path === `/network-access/${list}`)) return { body: { data: [] } }
    if (path === '/network-access/policy/snapshot')
      return state.snapshotError
        ? {
            status: 404,
            body: {
              error: { code: 'not_found', message: '未找到策略快照', request_id: 'snapshot-read' },
            },
          }
        : {
            body: {
              data: {
                policyVersion: 3,
                policyCount: 0,
                protectedResourceCount: 0,
                contentHash: 'hash-fixture',
                publishedAt: time,
              },
            },
          }
    if (path === '/network-access/telemetry/summary')
      return state.telemetryError
        ? {
            status: 503,
            body: {
              error: { code: 'unavailable', message: '遥测暂不可用', request_id: 'telemetry-read' },
            },
          }
        : {
            body: {
              data: {
                from: time,
                to: time,
                eventCount: 0,
                heartbeatCount: 0,
                radiusAccountingCount: 0,
                networkFlowCount: 0,
                connectionSummaryCount: 0,
                proxyFlowCount: 0,
                uploadBytes: 0,
                downloadBytes: 0,
                activeConnections: 0,
                producers: [],
                proxyFlows: [],
              },
            },
          }
    if (
      path === '/network-access/vpn/profiles' ||
      path === '/network-access/vpn/selection-policies'
    )
      return { body: { data: [profile] } }
    if (path === '/network-access/vpn/dashboard') {
      state.dashboardReads.push(url)
      if (state.dashboardStatus !== 200)
        return {
          status: state.dashboardStatus,
          body: {
            error: { code: 'unavailable', message: '看板暂不可用', request_id: 'dashboard-read' },
          },
        }
      return {
        body: {
          data: {
            from: url.searchParams.get('from'),
            to: url.searchParams.get('to'),
            asOf: time,
            activeSessions: 0,
            availableGateways: 0,
            totalGateways: 0,
            attempts: 0,
            successes: 0,
            fallbacks: 0,
            telemetryAvailable: false,
            gateways: [],
            sessions: [],
            decisions: [],
            series: [
              {
                at: time,
                attempts: 0,
                successes: 0,
                fallbacks: 0,
                uploadBytes: 0,
                downloadBytes: 0,
              },
            ],
          },
        },
      }
    }
  })
  return { state, evidence }
}

for (const view of [
  { width: 1440, dark: false },
  { width: 1166, dark: true },
  { width: 390, dark: false },
  { width: 390, dark: true },
]) {
  test(`intranet assets query and detail ${view.width} ${view.dark ? 'dark' : 'light'}`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: view.width, height: 1000 })
    const { state, evidence } = await setup(context, page)
    await page.goto('/network-access/devices')
    if (view.dark) await page.getByRole('button', { name: '切换到深色模式' }).click()
    const query = page.locator('.soha-management-query-card')
    await expect(query).toBeVisible()
    await expect(page.getByRole('button', { name: device.name, exact: true })).toBeVisible()
    await query.getByRole('textbox').fill('MacBook')
    await query.getByRole('textbox').press('Enter')
    await expect(page.getByRole('button', { name: '验收终端 Linux', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await expect(query.getByRole('textbox')).toHaveValue('MacBook')
    await expect(page.getByRole('button', { name: '验收终端 Linux', exact: true })).toHaveCount(0)
    await query.getByRole('button', { name: '重置', exact: true }).click()
    await expect(page.getByRole('button', { name: '验收终端 Linux', exact: true })).toBeVisible()
    await verifyGeometry(page, query.getByRole('button', { name: '查询', exact: true }))
    await page.getByRole('button', { name: device.name, exact: true }).press('Enter')
    const drawer = page.getByRole('dialog')
    await expect(drawer).toContainText('合规')
    await expect(drawer).toContainText(device.id)
    await page.screenshot({
      path: test.info().outputPath('intranet-device-candidate.png'),
      animations: 'disabled',
    })
    await verifyGeometry(page, drawer.getByRole('button', { name: '关闭', exact: true }))
    await drawer.getByRole('tab', { name: '网卡信息', exact: true }).click()
    await expect(drawer).toContainText('2001:db8:1234:5678:abcd:1234:5678:9012')
    await drawer.getByRole('button', { name: '关闭', exact: true }).click()
    expect(state.writes).toEqual([])
    verifyBrowserEvidence(evidence)
  })

  test(`VPN monitor hierarchy ${view.width} ${view.dark ? 'dark' : 'light'}`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: view.width, height: 1000 })
    const { state, evidence } = await setup(context, page)
    await page.goto('/network-access/vpn/dashboard')
    if (view.dark) await page.getByRole('button', { name: '切换到深色模式' }).click()
    await expect(page.getByText('遥测暂不可用；未知指标不会按零计算。')).toBeVisible()
    const query = page.locator('.soha-management-query-card')
    await verifyGeometry(page, query.getByRole('button', { name: '查询', exact: true }))
    await query.getByRole('button', { name: /更多筛选/ }).click()
    await expect(page.getByText('全部方案', { exact: true })).toBeVisible()
    await query.getByRole('textbox', { name: /^站点 ID/ }).fill('site-office')
    await query.getByRole('button', { name: '查询', exact: true }).click()
    await expect
      .poll(() => state.dashboardReads.at(-1)?.searchParams.get('siteId'))
      .toBe('site-office')
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await expect.poll(() => state.dashboardReads.length).toBeGreaterThanOrEqual(3)
    expect(state.dashboardReads.at(-1)?.searchParams.get('siteId')).toBe('site-office')
    await page.getByRole('tab', { name: '趋势', exact: true }).click()
    await expect(page.getByRole('columnheader', { name: '上传量（B）', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'uploadBytes', exact: true })).toHaveCount(
      0,
    )
    await query.getByRole('button', { name: '重置', exact: true }).click()
    await expect.poll(() => state.dashboardReads.at(-1)?.searchParams.has('siteId')).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('intranet-monitor-candidate.png'),
      fullPage: true,
      animations: 'disabled',
    })
    expect(state.writes).toEqual([])
    verifyBrowserEvidence(evidence)
  })
}

for (const route of [
  'sites',
  'spaces',
  'resources',
  'gateways',
  'user-admission',
  'site-profile-bindings',
  'sessions',
  'enrollments',
  'access-grants',
  'mihomo-profiles',
  'vpn/profiles',
  'vpn/selection-policies',
]) {
  test(`intranet list has a separate query region: ${route}`, async ({ context, page }) => {
    const { evidence } = await setup(context, page)
    await page.goto(`/network-access/${route}`)
    await expect(page.locator('.soha-management-query-card')).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新', exact: true })).toBeVisible()
    if (route === 'enrollments') await expect(page.locator('main')).toContainText('等待中')
    if (route === 'access-grants') await expect(page.locator('main')).toContainText('已签发')
    verifyBrowserEvidence(evidence)
  })
}

test('snapshot errors use the snapshot owner and remain retryable', async ({ context, page }) => {
  const { state, evidence } = await setup(context, page)
  state.snapshotError = true
  await page.goto('/network-access/policy')
  await expect(page.getByText('策略快照读取失败', { exact: true })).toBeVisible()
  await expect(page.getByText('连接采样读取失败', { exact: true })).toHaveCount(0)
  await expect(page.getByText('尚未发布策略快照', { exact: true })).toHaveCount(0)
  state.snapshotError = false
  await page.getByRole('button', { name: '重试读取策略快照', exact: true }).click()
  await expect(page.getByText('策略快照读取失败', { exact: true })).toHaveCount(0)
  await expect(page.getByText('hash-fixture')).toBeVisible()
  verifyBrowserEvidence(evidence)
})

test('runtime category and state labels follow the language switch', async ({ context, page }) => {
  const { evidence } = await setup(context, page)
  await page.goto('/network-access/enrollments')
  await expect(page.locator('main')).toContainText('网关')
  await page.getByRole('button', { name: '切换到英文', exact: true }).click()
  await expect(page.locator('main')).toContainText('Gateway')
  await expect(page.locator('main')).toContainText('Pending')
  verifyBrowserEvidence(evidence)
})

test('VPN refresh retains the submitted range and cache, then hides denied observations', async ({
  context,
  page,
}) => {
  const { state, evidence } = await setup(context, page)
  await page.goto('/network-access/vpn/dashboard')
  await expect(page.locator('.soha-network-summary')).toContainText('0 / 0')
  const initialRange = state.dashboardReads.at(-1)!.search
  state.dashboardStatus = 503
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(
    page.getByText('当前记录未更新，正在展示上次读取结果', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.soha-network-summary')).toContainText('0 / 0')
  expect(state.dashboardReads.at(-1)!.search).toBe(initialRange)
  state.dashboardStatus = 403
  await page.getByRole('button', { name: '重试读取当前记录', exact: true }).click()
  await expect(page.getByText('当前记录无访问权限', { exact: true })).toBeVisible()
  await expect(page.locator('.soha-network-summary')).not.toContainText('0 / 0')
  await expect(page.locator('.soha-network-summary')).not.toContainText('2026/10/18 09:00')
  verifyBrowserEvidence(evidence)
})

test('admission settings preserve their tab scopes and reveal the runtime guide on demand', async ({
  context,
  page,
}) => {
  const { evidence } = await setup(context, page)
  await page.goto('/network-access/settings')
  await expect(page.locator('.soha-management-query-card')).toBeVisible()
  const guide = page.getByRole('button', { name: /接入 FreeRADIUS 服务/ })
  await expect(guide).toHaveAttribute('aria-expanded', 'false')
  await guide.click()
  await expect(page.getByText(/先创建一次性注册令牌/)).toBeVisible()
  await page.getByRole('tab', { name: 'SSID', exact: true }).click()
  await expect(page).toHaveURL(/tab=ssids/)
  await expect(page.locator('.soha-management-query-card')).toBeVisible()
  await page.getByRole('tab', { name: '网络设备', exact: true }).click()
  await expect(page).toHaveURL(/tab=nas-bindings/)
  await expect(page.locator('.soha-management-query-card')).toBeVisible()
  verifyBrowserEvidence(evidence)
})

test('telemetry first-load errors are owned inline and recover without a global duplicate', async ({
  context,
  page,
}) => {
  const { state, evidence } = await setup(context, page)
  state.telemetryError = true
  await page.goto('/network-access/telemetry')
  await expect(page.getByText('遥测读取失败', { exact: true })).toBeVisible()
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0)
  state.telemetryError = false
  await page.getByRole('button', { name: '重试读取遥测', exact: true }).click()
  await expect(page.getByText('遥测读取失败', { exact: true })).toHaveCount(0)
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0)
  verifyBrowserEvidence(evidence)
})
