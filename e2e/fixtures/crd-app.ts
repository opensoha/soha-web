import { test as base, expect } from '@playwright/test'
import type { CRDResourceInstance } from '../../src/features/platform/extensions/crds/types'
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
  deleteFailureStatus: 409 | 503
  allowDelete: boolean
  failCatalog: boolean
  extraPermissions: string[]
  userName?: string
  resource?: Partial<CRDResourceInstance>
}
export const test = base.extend<{ catalog: CRDState; evidence: BrowserEvidence }>({
  catalog: async ({ browserName: _browserName }, provide) =>
    provide({
      data: structuredClone(definitions),
      deleteCalls: [],
      failDelete: true,
      deleteFailureStatus: 409,
      allowDelete: true,
      failCatalog: false,
      extraPermissions: [],
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
        if (url.pathname === '/api/v1/auth/refresh' && catalog.userName) {
          const result = baselineResponse(url.pathname) as { data: { user: { userName: string } } }
          result.data.user.userName = catalog.userName
          return { body: result }
        }
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
            ...catalog.extraPermissions,
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
        if (method === 'GET' && url.pathname.endsWith('/yaml')) {
          const definition = catalog.data.find((item) =>
            url.pathname.startsWith(`${path}/${item.name}/resources/`),
          )
          if (definition)
            return {
              body: {
                data: {
                  content: `apiVersion: ${definition.group}/${definition.version}\nkind: ${definition.kind}\nmetadata:\n  name: ${catalog.resource?.name ?? 'sample-widget'}\n`,
                },
              },
            }
        }
        if (url.pathname.startsWith(path + '/') && url.pathname.endsWith('/resources')) {
          const definition = catalog.data.find(
            (item) => url.pathname === `${path}/${item.name}/resources`,
          )
          return {
            body: {
              data: [
                {
                  uid: 'synthetic-widget',
                  name:
                    definition?.kind === 'ClusterWidget'
                      ? 'sample-clusterwidget'
                      : url.pathname.includes('/gadgets.')
                        ? 'sample-gadget'
                        : 'sample-widget',
                  ...(definition?.scope === 'Cluster' ? {} : { namespace: 'monitoring' }),
                  kind: definition?.kind ?? 'Widget',
                  status: 'Ready',
                  allowedActions: ['get'],
                  ...catalog.resource,
                },
              ],
            },
          }
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
              status: catalog.deleteFailureStatus,
              body: {
                error: {
                  code: catalog.deleteFailureStatus === 409 ? 'conflict' : 'unavailable',
                  message: 'Synthetic deletion response',
                  request_id: 'crd-delete-original-request',
                },
              },
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
