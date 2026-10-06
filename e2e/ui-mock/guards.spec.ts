import { test, expect } from '@playwright/test'
import { installMocks, verifyBrowserEvidence, verifyPage } from '../fixtures/mock-app'

test('unknown mock and wrong namespace fail evidence validation', async ({ page, context }) => {
  const evidence = await installMocks(context, page)
  await page.goto('/clusters')
  await verifyPage(page, '/clusters', ['prod-cluster'])
  await page.evaluate(async () => {
    await fetch('/api/v1/unknown-test-endpoint')
    await fetch('/api/v1/clusters/cluster-a/workloads/deployments/api/detail?namespace=wrong')
  })
  expect(evidence.missing).toHaveLength(2)
  expect(() => verifyBrowserEvidence(evidence)).toThrow()
})

test('blank render and forbidden origin cannot pass', async ({ page, context }) => {
  const evidence = await installMocks(context, page)
  await page.goto('/clusters')
  await verifyPage(page, '/clusters', ['prod-cluster'])
  await page.evaluate(() => document.getElementById('root')?.replaceChildren())
  await expect(page.locator('#root > *')).toHaveCount(0)
  await expect(verifyPage(page, '/clusters', ['prod-cluster'])).rejects.toThrow()
  await page.evaluate(() => fetch('https://unauthorized.invalid/exfiltrate').catch(() => undefined))
  expect(evidence.missing).toContain('external origin blocked')
  expect(() => verifyBrowserEvidence(evidence)).toThrow()
})
