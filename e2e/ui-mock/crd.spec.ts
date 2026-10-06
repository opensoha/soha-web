import { test, expect, definitions } from '../fixtures/crd-app'

test('U07: multiple kinds switch the exact scoped resource request', async ({
  page,
  catalog,
  evidence,
}) => {
  catalog.data.push({
    ...definitions[0],
    uid: 'synthetic-gadget',
    name: `gadgets.${definitions[0].group}`,
    kind: 'Gadget',
    plural: 'gadgets',
  })
  await page.goto(`/extensions/apis/${definitions[0].group}`)
  await expect(page.getByText('sample-gadget', { exact: true })).toBeVisible()
  await page
    .getByRole('button')
    .filter({ hasText: /^Widget/ })
    .click()
  await expect(page.getByText('sample-widget', { exact: true })).toBeVisible()
  expect(
    evidence.requests.some(
      (url) =>
        url.includes(`/widgets.${definitions[0].group}/resources`) &&
        url.includes('namespace=monitoring'),
    ),
  ).toBe(true)
})

test('U08: browser return preserves catalog query, page and scope', async ({ page }) => {
  await page.goto('/extensions?q=group&page=2')
  await page.getByRole('button', { name: definitions[17].group, exact: true }).click()
  await expect(page.getByText('sample-widget', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/extensions\?q=group&page=2$/)
  await expect(page.getByPlaceholder('搜索 API Group / CRD / Kind / Version')).toHaveValue('group')
  await expect(page.getByRole('button', { name: definitions[17].group, exact: true })).toBeVisible()
})

test('U02–U04: complete local catalog query, pagination, sorting and reset', async ({
  page,
  evidence,
}) => {
  await page.goto('/extensions')
  await expect(page.getByRole('button', { name: definitions[0].group, exact: true })).toBeVisible()
  await page.getByTitle('2', { exact: true }).click()
  await expect(page.getByRole('button', { name: definitions[17].group, exact: true })).toBeVisible()
  const search = page.getByPlaceholder('搜索 API Group / CRD / Kind / Version')
  await search.fill('group17')
  await expect(page.getByRole('button', { name: definitions[17].group, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: definitions[16].group, exact: true })).toHaveCount(
    0,
  )
  await search.fill('')
  await page.getByTitle('1', { exact: true }).click()
  await page.getByRole('columnheader', { name: 'API Group' }).click()
  await expect(page.getByRole('button', { name: definitions[0].group, exact: true })).toBeVisible()
  await page.getByRole('columnheader', { name: 'API Group' }).click()
  await expect(page.getByRole('button', { name: definitions[17].group, exact: true })).toBeVisible()
  expect(evidence.requests.filter((url) => url.includes('/extensions/crds'))).toEqual([
    '/api/v1/clusters/cluster-a/extensions/crds',
  ])
})

for (const keyboard of [false, true])
  test(`U05/U06: ${keyboard ? 'keyboard' : 'mouse'} name enters exact API group`, async ({
    page,
  }) => {
    await page.goto('/extensions')
    const entry = page.getByRole('button', { name: definitions[0].group, exact: true })
    if (keyboard) {
      await entry.focus()
      await expect(entry).toBeFocused()
      await entry.press('Enter')
    } else await entry.click()
    await expect(page).toHaveURL(
      new RegExp('/extensions/apis/' + definitions[0].group.replace(/\./g, '\\.')),
    )
    await expect(page.getByText('sample-widget', { exact: true })).toBeVisible()
  })

test('U09–U11: exact deletion confirmation, failure context, retry and duplicate submission', async ({
  page,
  catalog,
}) => {
  await page.goto('/extensions')
  await page.getByRole('button', { name: '删除 CRD 定义', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('所有命名空间')
  await dialog.getByLabel('选择具体 CRD 定义').click()
  await page.getByTitle(`${definitions[0].name} · Widget`, { exact: true }).click()
  const input = dialog.getByLabel('输入完整 CRD 名称确认')
  const submit = dialog.getByRole('button', { name: '删除定义及实例' })
  await input.fill('wrong-name')
  await expect(submit).toBeDisabled()
  expect(catalog.deleteCalls).toEqual([])
  await input.fill(definitions[0].name)
  await submit.click()
  await expect(dialog).toContainText('删除请求失败')
  await expect(input).toHaveValue(definitions[0].name)
  expect(catalog.deleteCalls[0]).toContain('expectedUid=synthetic-uid-0')
  catalog.failDelete = false
  await submit.dblclick()
  await expect(dialog).toHaveCount(0)
  expect(catalog.deleteCalls).toHaveLength(2)
  expect(catalog.data.some((item) => item.uid === definitions[0].uid)).toBe(false)
})

test('U12: no deletion permission removes dangerous UI entry', async ({ page, catalog }) => {
  catalog.allowDelete = false
  await page.goto('/extensions')
  await expect(page.getByRole('button', { name: definitions[0].group, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '删除 CRD 定义', exact: true })).toHaveCount(0)
})

test('U12: catalog failure stays distinguishable from empty results', async ({ page, catalog }) => {
  catalog.failCatalog = true
  await page.goto('/extensions')
  await expect(page.getByText(/加载失败|Synthetic catalog unavailable/).first()).toBeVisible({
    timeout: 15_000,
  })
})
