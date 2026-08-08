import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const root = resolve(new URL('..', import.meta.url).pathname)
const distDir = resolve(root, 'dist')
const chromePath =
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome')
const clusterRoute = '/clusters'
const deploymentRoute = '/workloads/deployments/api?clusterId=cluster-a&namespace=monitoring'
const viewport = { width: 1440, height: 1000 }
const fatalConsolePatterns = [
  /Uncaught/i,
  /Failed to load module script/i,
  /Minified React error/i,
  /Error:.*React/i,
]

async function main() {
  await requireDist()

  const server = await startStaticServer(distDir)
  const userDataDir = await mkdtemp(join(tmpdir(), 'soha-web-browser-smoke-'))
  let chrome

  try {
    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${userDataDir}`,
        `--remote-debugging-port=0`,
        'about:blank',
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )

    const webSocketURL = await waitForChromeDebugger(chrome)
    const browser = await CDPClient.connect(webSocketURL)
    try {
      const targetID = await browser.createTarget(`http://127.0.0.1:${server.port}${clusterRoute}`)
      const pageWsURL = await browser.pageWebSocketURL(targetID)
      const page = await CDPClient.connect(pageWsURL)
      try {
        await runBrowserBaseline(page, server.port)
      } finally {
        page.close()
      }
    } finally {
      browser.close()
    }
  } finally {
    await stopChrome(chrome)
    await server.close()
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }

  console.log('browser regression baseline verified: Kubernetes workbench')
  console.log(`viewport: ${viewport.width}x${viewport.height}`)
  console.log(`routes: ${clusterRoute}, ${deploymentRoute}`)
}

async function stopChrome(chrome) {
  if (!chrome || chrome.exitCode !== null || chrome.signalCode !== null) return

  const exit = once(chrome, 'exit')
  chrome.kill('SIGTERM')
  const stopped = await Promise.race([
    exit.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
  ])
  if (!stopped && chrome.exitCode === null && chrome.signalCode === null) {
    chrome.kill('SIGKILL')
    await exit
  }
}

async function runBrowserBaseline(page, port) {
  const consoleErrors = []
  const failedRequests = []
  const missingMocks = []
  const requestedAPIs = []

  page.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') {
      consoleErrors.push(entry.text || '')
    }
  })
  page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    consoleErrors.push(
      exceptionDetails?.text || exceptionDetails?.exception?.description || 'runtime exception',
    )
  })
  page.on('Network.loadingFailed', ({ errorText, canceled, blockedReason, requestId }) => {
    if (!canceled) {
      failedRequests.push(`${requestId}: ${blockedReason || errorText}`)
    }
  })
  page.on('Fetch.requestPaused', async (event) => {
    const url = new URL(event.request.url)
    requestedAPIs.push(`${url.pathname}${url.search}`)
    await handleMockedAPI(page, event, missingMocks)
  })

  await page.send('Log.enable')
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Network.enable')
  await page.send('Fetch.enable', {
    patterns: [{ urlPattern: `http://127.0.0.1:${port}/api/v1/*` }],
  })
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await navigate(page, port, clusterRoute)
  await waitForExpression(page, `document.body.innerText.includes('prod-cluster')`)
  await assertPage(page, clusterRoute, ['prod-cluster', 'v1.31.0'])

  await navigate(page, port, deploymentRoute)
  await waitForExpression(
    page,
    `document.body.innerText.includes('monitoring') && document.body.innerText.includes('滚动发布')`,
  )
  await assertPage(page, deploymentRoute, ['api', 'monitoring', '滚动发布'])

  const detailRequest =
    '/api/v1/clusters/cluster-a/workloads/deployments/api/detail?namespace=monitoring'
  if (!requestedAPIs.includes(detailRequest)) {
    throw new Error(`deployment deep link did not request the scoped API: ${detailRequest}`)
  }

  const fatalErrors = consoleErrors.filter((item) =>
    fatalConsolePatterns.some((pattern) => pattern.test(item)),
  )
  if (fatalErrors.length > 0) {
    throw new Error(
      `browser console contains fatal errors:\n${fatalErrors.map((item) => `- ${item}`).join('\n')}`,
    )
  }
  if (failedRequests.length > 0) {
    throw new Error(
      `browser request failures:\n${failedRequests.map((item) => `- ${item}`).join('\n')}`,
    )
  }
  if (missingMocks.length > 0) {
    throw new Error(
      `browser API mocks missing:\n${missingMocks.map((item) => `- ${item}`).join('\n')}`,
    )
  }
}

async function navigate(page, port, route) {
  const loadEvent = page.waitFor('Page.loadEventFired')
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` })
  await waitForLoad(loadEvent)
}

async function assertPage(page, route, expectedText) {
  const snapshot = await page.evaluate(`(() => ({
    path: window.location.pathname + window.location.search,
    text: document.body.innerText,
    rootChildren: document.getElementById('root')?.children.length || 0,
  }))()`)
  const missing = []
  if (snapshot.path !== route) missing.push(`route ${route}, got ${snapshot.path}`)
  if (snapshot.rootChildren < 1) missing.push('React root did not render')
  for (const text of expectedText) {
    if (!snapshot.text.includes(text)) missing.push(`page text: ${text}`)
  }
  if (missing.length > 0) {
    throw new Error(`browser baseline missing:\n${missing.map((item) => `- ${item}`).join('\n')}`)
  }
}

async function handleMockedAPI(page, event, missingMocks) {
  const url = new URL(event.request.url)
  const path = url.pathname
  if (path === '/api/v1/auth/refresh') {
    await fulfillJSON(page, event.requestId, {
      data: {
        tokens: {
          accessToken: 'browser-regression-token',
          refreshToken: 'browser-regression-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: '2099-01-01T00:00:00Z',
        },
        user: {
          userId: 'browser-regression-user',
          userName: 'browser-regression',
          email: 'browser-regression@soha.local',
          roles: [],
          teams: [],
          projects: [],
          tags: [],
        },
      },
    })
    return
  }
  if (path === '/api/v1/access/permission-snapshot') {
    await fulfillJSON(page, event.requestId, {
      data: {
        permissionKeys: [
          'workspace.resource.view',
          'platform.clusters.view',
          'platform.deployment.view',
        ],
        visibleMenuIds: ['clusters', 'workloads', 'workloads-deployments'],
        visibleMenus: [
          { id: 'clusters', path: '/clusters', labelZh: '集群' },
          { id: 'workloads', path: '/workloads', labelZh: '工作负载' },
          {
            id: 'workloads-deployments',
            parentId: 'workloads',
            path: '/workloads/deployments',
            labelZh: 'Deployments',
          },
        ],
      },
    })
    return
  }
  if (path === '/api/v1/settings/branding') {
    await fulfillJSON(page, event.requestId, {
      data: {
        appTitle: 'Soha',
        sidebarTitle: 'Soha',
        loginLogoUrl: '',
        expandedLogoUrl: '',
        collapsedLogoUrl: '',
        faviconUrl: '',
      },
    })
    return
  }
  if (path === '/api/v1/modules') {
    await fulfillJSON(page, event.requestId, { data: [] })
    return
  }
  if (path === '/api/v1/clusters') {
    await fulfillJSON(page, event.requestId, {
      data: [
        {
          id: 'cluster-a',
          name: 'prod-cluster',
          region: 'standard_kubernetes',
          environment: 'production',
          labels: {},
          connectionMode: 'agent',
          version: 'v1.31.0',
          health: { status: 'healthy' },
        },
      ],
    })
    return
  }
  if (path === '/api/v1/clusters/capabilities') {
    await fulfillJSON(page, event.requestId, { data: [] })
    return
  }
  if (path === '/api/v1/clusters/cluster-a/namespaces') {
    await fulfillJSON(page, event.requestId, {
      data: [{ name: 'monitoring', status: 'Active', labels: {} }],
    })
    return
  }
  if (path === '/api/v1/clusters/cluster-a/workloads/deployments/api/detail') {
    await fulfillJSON(page, event.requestId, {
      data: {
        name: 'api',
        namespace: 'monitoring',
        desiredReplicas: 2,
        readyReplicas: 2,
        updatedReplicas: 2,
        availableReplicas: 2,
        observedGeneration: 1,
        strategy: 'RollingUpdate',
        labels: { app: 'api' },
        selector: { app: 'api' },
        pods: [],
        relatedResources: [],
      },
    })
    return
  }
  if (path === '/api/v1/clusters/cluster-a/workloads/deployments/api/rollout-status') {
    await fulfillJSON(page, event.requestId, {
      data: {
        name: 'api',
        namespace: 'monitoring',
        revision: '3',
        status: 'ready',
        message: 'Deployment is available',
        desiredReplicas: 2,
        updatedReplicas: 2,
        readyReplicas: 2,
        availableReplicas: 2,
        observedGeneration: 1,
        conditions: [],
      },
    })
    return
  }
  if (path === '/api/v1/clusters/cluster-a/workloads/deployments/api/rollouts') {
    await fulfillJSON(page, event.requestId, { data: [] })
    return
  }
  if (
    [
      '/api/v1/application-environments',
      '/api/v1/applications',
      '/api/v1/builds',
      '/api/v1/workflows',
      '/api/v1/releases',
    ].includes(path)
  ) {
    await fulfillJSON(page, event.requestId, { data: [] })
    return
  }
  missingMocks.push(`${event.request.method} ${path}${url.search}`)
  await fulfillJSON(
    page,
    event.requestId,
    { error: { code: 'mock_missing', message: `mock missing for ${path}` } },
    500,
  )
}

async function fulfillJSON(page, requestId, payload, status = 200) {
  await page.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
  })
}

async function requireDist() {
  const index = join(distDir, 'index.html')
  const info = await stat(index).catch(() => null)
  if (!info?.isFile()) {
    throw new Error(
      'dist/index.html is missing; run npm run build before browser regression baseline',
    )
  }
}

async function startStaticServer(rootDir) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const filePath = await resolveStaticFile(rootDir, url.pathname)
    if (!filePath) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': contentType(filePath) })
    createReadStream(filePath).pipe(res)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}

async function resolveStaticFile(rootDir, pathname) {
  const normalized = decodeURIComponent(pathname).replace(/^\/+/, '')
  const candidate = resolve(rootDir, normalized || 'index.html')
  if (!candidate.startsWith(rootDir)) return null
  const info = await stat(candidate).catch(() => null)
  if (info?.isFile()) return candidate
  return join(rootDir, 'index.html')
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.json':
      return 'application/json; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

async function waitForChromeDebugger(chrome) {
  let stderr = ''
  chrome.stderr.setEncoding('utf8')
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match) return match[1]
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready:\n${stderr}`)
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for Chrome DevTools endpoint:\n${stderr}`)
}

async function waitForLoad(loadEvent) {
  await Promise.race([
    loadEvent,
    delay(10_000).then(() => {
      throw new Error('Timed out waiting for page load')
    }),
  ])
}

async function waitForExpression(page, expression) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const result = await page.evaluate(expression)
    if (result) return
    await delay(150)
  }
  const snapshot = await page.evaluate(`(() => ({
    path: window.location.pathname + window.location.search,
    text: document.body.innerText.slice(0, 2000),
  }))()`)
  throw new Error(
    `Timed out waiting for browser expression: ${expression}\n${JSON.stringify(snapshot, null, 2)}`,
  )
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class CDPClient {
  static async connect(webSocketURL) {
    const socket = new WebSocket(webSocketURL)
    await once(socket, 'open')
    return new CDPClient(socket)
  }

  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.onceListeners = new Map()
    socket.addEventListener('message', (event) => this.handleMessage(event.data))
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  async createTarget(url) {
    const result = await this.send('Target.createTarget', { url })
    return result.targetId
  }

  async pageWebSocketURL(targetID) {
    const versionURL = new URL(this.socket.url)
    const protocol = versionURL.protocol === 'wss:' ? 'https:' : 'http:'
    const response = await fetch(`${protocol}//${versionURL.host}/json/list`)
    const targets = await response.json()
    const target = targets.find((item) => item.id === targetID)
    if (!target?.webSocketDebuggerUrl) {
      throw new Error(`Unable to find page target ${targetID}`)
    }
    return target.webSocketDebuggerUrl
  }

  evaluate(expression) {
    return this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }).then((result) => {
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed')
      }
      return result.result?.value
    })
  }

  waitFor(method) {
    return new Promise((resolve) => {
      const listeners = this.onceListeners.get(method) ?? []
      listeners.push(resolve)
      this.onceListeners.set(method, listeners)
    })
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? []
    listeners.push(listener)
    this.listeners.set(method, listeners)
  }

  handleMessage(raw) {
    const message = JSON.parse(raw)
    if (message.id) {
      const pending = this.pending.get(message.id)
      if (pending) {
        this.pending.delete(message.id)
        if (message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message.result)
        }
      }
      return
    }
    const listeners = this.listeners.get(message.method) ?? []
    for (const listener of listeners) {
      void listener(message.params)
    }
    const onceListeners = this.onceListeners.get(message.method) ?? []
    if (onceListeners.length > 0) {
      const [first, ...rest] = onceListeners
      this.onceListeners.set(message.method, rest)
      first(message.params)
    }
  }

  close() {
    this.socket.close()
  }
}

await main()
