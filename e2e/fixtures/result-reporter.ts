import { readFileSync, writeFileSync } from 'node:fs'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

export default class ResultReporter implements Reporter {
  tests: { name: string; result: string }[] = []
  onTestEnd(test: TestCase, result: TestResult) {
    this.tests.push({ name: test.title, result: result.status })
  }
  onEnd(result: FullResult) {
    const path = 'test-results/run-manifest.json'
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    if (manifest.result === 'BLOCKED') return
    Object.assign(manifest, {
      result:
        result.status === 'passed' &&
        this.tests.length > 0 &&
        this.tests.every((test) => test.result === 'passed')
          ? 'PASS'
          : 'FAIL',
      elapsedMs: result.duration,
      tests: this.tests,
    })
    writeFileSync(path, JSON.stringify(manifest, null, 2))
  }
}
