import { test as base, expect } from '@playwright/test'
import { baselineResponse } from './baseline-data'
import { installMocks, verifyBrowserEvidence, type BrowserEvidence } from './mock-app'

export const definitions = Array.from({ length: 18 }, (_, i) => ({
  uid: `synthetic-uid-${i}`,
  name: `widgets.group${String(i).padStart(2, '0')}.quality.example`,
  group: `group${String(i).padStart(2, '0')}.quality.example`,
  kind: 'Widget',
  plural: 'widgets',
  version: 'v1',
  scope: 'Namespaced',
  allowedActions: ['get', 'list', 'delete'],
}))
export type CRDState = {
  data: typeof definitions
  deleteCalls: string[]
  failDelete: boolean
  allowDelete: boolean
  failCatalog: boolean
}
export const test = base.extend<{ catalog: CRDState; evidence: BrowserEvidence }>({
  catalog: async ({ browserName: _browserName }, provide) =>
    provide({
      data: structuredClone(definitions),
      deleteCalls: [],
      failDelete: true,
      allowDelete: true,
      failCatalog: false,
    }),
  evidence: [
    async ({ context, page, catalog }, use) => {
      await context.addInitScript(() =>
        localStorage.setItem(
          'soha-scope',
          JSON.stringify({
            state: { clusterId: 'cluster-a', namespace: 'monitoring' },
            version: 0,
          }),
        ),
      )
      const evidence = await installMocks(context, page, (url, method) => {
        if (url.pathname === '/api/v1/clusters/capabilities')
          return {
            body: {
              data: [
                {
                  key: 'custom.resources',
                  direct: { status: 'available' },
                  agent: { status: 'available' },
                  requiredScopes: [],
                  requiresApproval: false,
                  riskLevel: 'read',
                },
              ],
            },
          }
        if (url.pathname === '/api/v1/access/permission-snapshot') {
          const result = baselineResponse(url.pathname) as any
          result.data.permissionKeys.push(
            'platform.extensions.view',
            ...(catalog.allowDelete ? ['platform.extensions.crds.delete'] : []),
          )
          result.data.visibleMenuIds.push('extensions')
          result.data.visibleMenus.push({ id: 'extensions', path: '/extensions', labelZh: 'CRD' })
          return { body: result }
        }
        const path = '/api/v1/clusters/cluster-a/extensions/crds'
        if (url.pathname === path && method === 'GET')
          return {
            status: catalog.failCatalog ? 503 : 200,
            body: catalog.failCatalog
              ? { error: { code: 'unavailable', message: 'Synthetic catalog unavailable' } }
              : { data: catalog.data },
          }
        if (url.pathname.startsWith(path + '/') && url.pathname.endsWith('/access'))
          return { body: { data: { allowedActions: ['get', 'list'] } } }
        if (url.pathname.startsWith(path + '/') && url.pathname.endsWith('/resources'))
          return {
            body: {
              data: [
                {
                  uid: 'synthetic-widget',
                  name: url.pathname.includes('/gadgets.') ? 'sample-gadget' : 'sample-widget',
                  namespace: 'monitoring',
                  kind: 'Widget',
                  status: 'Ready',
                  allowedActions: ['get'],
                },
              ],
            },
          }
        if (url.pathname.startsWith(path + '/') && method === 'DELETE') {
          catalog.deleteCalls.push(url.pathname + url.search)
          const item = catalog.data.find((row) => url.pathname === path + '/' + row.name)
          if (!catalog.allowDelete)
            return {
              status: 403,
              body: { error: { code: 'forbidden', message: 'Synthetic permission rejected' } },
            }
          if (item?.uid !== url.searchParams.get('expectedUid'))
            return {
              status: 409,
              body: { error: { code: 'conflict', message: 'Synthetic UID changed' } },
            }
          if (catalog.failDelete)
            return {
              status: 503,
              body: { error: { code: 'unavailable', message: 'Synthetic retryable failure' } },
            }
          catalog.data = catalog.data.filter((row) => row !== item)
          return { body: { data: null } }
        }
        return undefined
      })
      await use(evidence)
      verifyBrowserEvidence(evidence)
    },
    { auto: true },
  ],
})
export { expect }
