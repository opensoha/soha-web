import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const root = resolve(new URL('..', import.meta.url).pathname)
const distDir = resolve(root, 'dist')
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const routePath = '/login'
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
    chrome = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=0`,
      'about:blank',
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    const webSocketURL = await waitForChromeDebugger(chrome)
    const browser = await CDPClient.connect(webSocketURL)
    try {
      const targetID = await browser.createTarget(`http://127.0.0.1:${server.port}${routePath}`)
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
    if (chrome && !chrome.killed) {
      chrome.kill('SIGTERM')
      await Promise.race([
        once(chrome, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
    }
    await server.close()
    await rm(userDataDir, { recursive: true, force: true })
  }

  console.log('browser regression baseline verified: login route')
  console.log(`viewport: ${viewport.width}x${viewport.height}`)
  console.log(`route: http://127.0.0.1:${server.port}${routePath}`)
}

async function runBrowserBaseline(page, port) {
  const consoleErrors = []
  const failedRequests = []

  page.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') {
      consoleErrors.push(entry.text || '')
    }
  })
  page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails?.text || exceptionDetails?.exception?.description || 'runtime exception')
  })
  page.on('Network.loadingFailed', ({ errorText, canceled, blockedReason, requestId }) => {
    if (!canceled) {
      failedRequests.push(`${requestId}: ${blockedReason || errorText}`)
    }
  })
  page.on('Fetch.requestPaused', async (event) => {
    await handleMockedAPI(page, event)
  })

  await page.send('Log.enable')
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Network.enable')
  await page.send('Fetch.enable', { patterns: [{ urlPattern: `http://127.0.0.1:${port}/api/v1/*` }] })
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  })

  const loadEvent = page.waitFor('Page.loadEventFired')
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}${routePath}` })
  await waitForLoad(loadEvent)
  await waitForExpression(page, `document.querySelector('.soha-auth-panel') && document.body.innerText.includes('登录控制台')`)

  const snapshot = await page.evaluate(`(() => ({
    title: document.title,
    text: document.body.innerText,
    rootChildren: document.getElementById('root')?.children.length || 0,
    panelCount: document.querySelectorAll('.soha-auth-panel').length,
    inputCount: document.querySelectorAll('input').length,
    submitCount: Array.from(document.querySelectorAll('button')).filter((button) => button.innerText.includes('登录控制台')).length,
    canvasRendered: Boolean(document.querySelector('.soha-auth-background')),
  }))()`)

  const missing = []
  if (snapshot.rootChildren < 1) missing.push('React root did not render')
  if (snapshot.panelCount < 1) missing.push('login panel')
  if (snapshot.inputCount < 2) missing.push('username/password inputs')
  if (snapshot.submitCount < 1) missing.push('login submit button')
  if (!snapshot.canvasRendered) missing.push('login visual background')
  for (const text of ['Soha 让工作快乐起来', 'AI Gateway', '多工作台统一控制台']) {
    if (!snapshot.text.includes(text)) {
      missing.push(`login copy: ${text}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(`login browser baseline missing:\n${missing.map((item) => `- ${item}`).join('\n')}`)
  }

  const fatalErrors = consoleErrors.filter((item) => fatalConsolePatterns.some((pattern) => pattern.test(item)))
  if (fatalErrors.length > 0) {
    throw new Error(`browser console contains fatal errors:\n${fatalErrors.map((item) => `- ${item}`).join('\n')}`)
  }
  if (failedRequests.length > 0) {
    throw new Error(`browser request failures:\n${failedRequests.map((item) => `- ${item}`).join('\n')}`)
  }
}

async function handleMockedAPI(page, event) {
  const url = new URL(event.request.url)
  const path = url.pathname
  if (path === '/api/v1/auth/providers') {
    await fulfillJSON(page, event.requestId, { data: [{ id: 'password', type: 'password', name: 'Password', enabled: true }] })
    return
  }
  if (path === '/api/v1/auth/login-options') {
    await fulfillJSON(page, event.requestId, { data: { verification: { sliderEnabled: false } } })
    return
  }
  await fulfillJSON(page, event.requestId, { error: { code: 'not_found', message: `mock missing for ${path}` } }, 404)
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
    throw new Error('dist/index.html is missing; run npm run build before browser regression baseline')
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
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
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
  throw new Error(`Timed out waiting for browser expression: ${expression}`)
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
