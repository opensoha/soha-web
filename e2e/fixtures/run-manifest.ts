import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { sourceEvidence } from '../../scripts/quality-guards.mjs'

export default function setup() {
  mkdirSync('test-results', { recursive: true })
  const manifest = {
    runId: randomUUID(),
    mode: process.env.SOHA_TEST_MODE || 'ui-mock',
    sources: {
      web: sourceEvidence('.'),
      contracts: existsSync('../soha-contracts/.git') ? sourceEvidence('../soha-contracts') : null,
    },
    environment: { id: 'synthetic-mocks', disposable: true },
    toolchain: { node: process.version, playwright: '1.63.0' },
    result: 'RUNNING',
  }
  writeFileSync('test-results/run-manifest.json', JSON.stringify(manifest, null, 2))
}
