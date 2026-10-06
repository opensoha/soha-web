import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { aiPreflight } from './quality-guards.mjs'
import { createModelProxy } from './model-proxy.mjs'
import { randomUUID } from 'node:crypto'

mkdirSync('test-results', { recursive: true })
let result = { result: 'NOT_RUN' }
let proxy
let timer
try {
  const approval = aiPreflight(process.env)
  if (approval.result === 'NOT_RUN') {
    result.reason = 'SOHA_AI_ENABLED=1 was not explicitly requested'
  } else {
    const capability = 'soha-proxy-' + randomUUID().replace(/-/g, '')
    proxy = createModelProxy(
      process.env.MIDSCENE_MODEL_BASE_URL,
      process.env.MIDSCENE_MODEL_API_KEY,
      approval.maxCalls,
      fetch,
      capability,
    )
    await new Promise((resolve) => proxy.server.listen(0, '127.0.0.1', resolve))
    const env = Object.fromEntries(
      ['PATH', 'TMPDIR', 'USERPROFILE', 'LOCALAPPDATA', 'SystemRoot', 'CI']
        .filter((key) => process.env[key])
        .map((key) => [key, process.env[key]]),
    )
    // Only this fixed endpoint/key reaches the SDK. Real credentials remain in the proxy.
    Object.assign(env, {
      MIDSCENE_MODEL_BASE_URL: `http://127.0.0.1:${proxy.server.address().port}/v1`,
      MIDSCENE_MODEL_API_KEY: capability,
      SOHA_AI_GUARDED_RUN: '1',
      SOHA_AI_PROXY_PORT: String(proxy.server.address().port),
      MIDSCENE_MODEL_NAME: process.env.MIDSCENE_MODEL_NAME,
      MIDSCENE_MODEL_FAMILY: process.env.MIDSCENE_MODEL_FAMILY,
      SOHA_TEST_MODE: 'ai-ui-mock',
    })
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.ai.config.ts'],
      { env, stdio: 'inherit' },
    )
    timer = setTimeout(() => child.kill('SIGTERM'), 930_000)
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
    clearTimeout(timer)
    result = {
      result: code === 0 && proxy.summary().rejected === 0 ? 'PASS' : 'FAIL',
      ...proxy.summary(),
      approvalId: process.env.SOHA_AI_APPROVAL_ID,
    }
    process.exitCode = result.result === 'PASS' ? 0 : 1
  }
} catch (error) {
  result = { result: 'BLOCKED', reason: error.message }
  process.exitCode = 2
} finally {
  clearTimeout(timer)
  if (proxy) {
    proxy.server.closeAllConnections()
    await new Promise((resolve) => proxy.server.close(resolve))
  }
  writeFileSync('test-results/ai-run.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
}
