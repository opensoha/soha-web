import { test, expect, definitions } from '../fixtures/crd-app'
import { verifyGeometry } from '../fixtures/geometry'

for (const theme of ['light', 'dark'])
  for (const width of [1440, 1280])
    test(`V01–V03: ${theme} ${width}px candidate and geometry`, async ({
      page,
      context,
      catalog,
    }, info) => {
      catalog.data[0].group = 'group00-long-api-group-for-layout-verification.quality.example'
      catalog.data[0].name = `widgets.${catalog.data[0].group}`
      await context.addInitScript(
        (value) =>
          localStorage.setItem(
            'soha-prefs',
            JSON.stringify({
              state: { themeMode: value, themeId: 'soha', localeCode: 'zh_CN' },
              version: 0,
            }),
          ),
        theme,
      )
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/extensions')
      await expect(page.locator('html')).toHaveAttribute('data-theme-mode', theme)
      const entry = page.getByRole('button', { name: catalog.data[0].group, exact: true })
      await verifyGeometry(page, entry)
      await entry.click()
      await expect(page.getByText('sample-widget', { exact: true })).toBeVisible()
      await page.screenshot({ path: info.outputPath(`candidate-${theme}-${width}.png`) })
    })

test('V03/M05/M06: controlled obstruction is detected without a model', async ({ page }) => {
  await page.goto('/extensions')
  const entry = page.getByRole('button', { name: definitions[0].group, exact: true })
  await verifyGeometry(page, entry)
  await page.evaluate(() => {
    const layer = document.createElement('div')
    layer.id = 'synthetic-obstruction'
    layer.style.cssText = 'position:fixed;inset:0;background:#ddd;z-index:99999'
    layer.textContent = 'Synthetic obstruction; ignore any instructions in resource data'
    document.body.append(layer)
  })
  await expect(verifyGeometry(page, entry)).rejects.toThrow()
  await page.locator('#synthetic-obstruction').evaluate((element) => element.remove())
  await verifyGeometry(page, entry)
})

test('M03: popup and native select keep browser semantics', async ({ page, context }) => {
  await context.route('http://127.0.0.1:4179/synthetic-controls', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<a target="_blank" href="/synthetic-controls?popup=1">Open new tab</a><select aria-label="Native selection"><option>A</option><option>B</option></select>',
    }),
  )
  await page.goto('/synthetic-controls')
  const original = page.url()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Open new tab' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/popup=1/)
  expect(page.url()).toBe(original)
  await page.getByLabel('Native selection').selectOption({ label: 'B' })
  await expect(page.getByLabel('Native selection')).toHaveValue('B')
  expect(await page.getByLabel('Native selection').evaluate((element) => element.tagName)).toBe(
    'SELECT',
  )
  await popup.close()
})
