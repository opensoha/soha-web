import { describe, expect, it, vi } from 'vitest'
import { validateRouteDefinitions } from '@/routes/definitions'
import { copilotGatewayRoutes, copilotRouteManifests } from './routes'

const routePages = vi.hoisted(() => ({
  overview: () => null,
  relay: () => null,
  manifest: () => null,
  clients: () => null,
  tokens: () => null,
  governance: () => null,
  callLogs: () => null,
  gatewayRedirect: () => null,
  gatewayOverviewRedirect: () => null,
  upstreamsRedirect: () => null,
  modelRoutesRedirect: () => null,
  wildcardRedirect: () => null,
}))

vi.mock('./gateway/pages/overview-page', () => ({
  AIGatewayOverviewPage: routePages.overview,
}))
vi.mock('./gateway/pages/relay-page', () => ({ AIGatewayRelayPage: routePages.relay }))
vi.mock('./gateway/pages/manifest-page', () => ({
  AIGatewayManifestPage: routePages.manifest,
}))
vi.mock('./gateway/pages/clients-page', () => ({
  AIGatewayClientsPage: routePages.clients,
}))
vi.mock('./gateway/pages/tokens-page', () => ({ AIGatewayTokensPage: routePages.tokens }))
vi.mock('./gateway/pages/governance-page', () => ({
  AIGatewayGovernancePage: routePages.governance,
}))
vi.mock('./gateway/pages/call-logs-page', () => ({
  AIGatewayCallLogsPage: routePages.callLogs,
}))
vi.mock('./gateway/redirects', () => ({
  AIGatewayRedirectPage: routePages.gatewayRedirect,
  AIGatewayOverviewRedirectPage: routePages.gatewayOverviewRedirect,
  AIGatewayUpstreamsRedirectPage: routePages.upstreamsRedirect,
  AIGatewayModelRoutesRedirectPage: routePages.modelRoutesRedirect,
  AIGatewayWildcardRedirectPage: routePages.wildcardRedirect,
}))

describe('Copilot route manifests', () => {
  it('loads every Gateway UI route from its own leaf module', async () => {
    const expectedPages = new Map([
      ['/ai-gateway', routePages.gatewayRedirect],
      ['/ai-gateway/overview', routePages.gatewayOverviewRedirect],
      ['/ai-gateway/relay', routePages.relay],
      ['/ai-gateway/upstreams', routePages.upstreamsRedirect],
      ['/ai-gateway/model-routes', routePages.modelRoutesRedirect],
      ['/ai-gateway/manifest', routePages.manifest],
      ['/ai-gateway/clients', routePages.clients],
      ['/ai-gateway/tokens', routePages.tokens],
      ['/ai-gateway/governance', routePages.governance],
      ['/ai-gateway/call-logs', routePages.callLogs],
      ['/ai-workbench/gateway', routePages.gatewayRedirect],
      ['/ai-gateway/*', routePages.wildcardRedirect],
    ])

    for (const route of copilotGatewayRoutes) {
      expect((await route.load()).default).toBe(expectedPages.get(route.meta.path))
    }
  })

  it('preserves Gateway permissions and wildcard behavior', () => {
    expect(copilotGatewayRoutes).toHaveLength(12)
    expect(
      copilotGatewayRoutes.find((route) => route.meta.id === 'ai-gateway')?.meta,
    ).toMatchObject({
      menuId: 'ai-gateway',
      permissionStrategy: 'any-child',
      workspace: 'resource',
    })
    expect(
      copilotGatewayRoutes.find((route) => route.meta.id === 'ai-gateway-wildcard'),
    ).toMatchObject({
      wildcard: true,
      inheritMetaFrom: 'ai-gateway',
    })
  })

  it('places Gateway and AI engineering routes in one workbench', () => {
    const routes = copilotRouteManifests.flatMap((manifest) => [...manifest])
    const ids = [
      'ai-workbench-overview',
      'ai-workbench-knowledge',
      'ai-workbench-context',
      'ai-workbench-agent-runs',
      'ai-workbench-agent-providers',
      'ai-workbench-evaluations',
      'ai-gateway-relay',
      'ai-gateway-governance',
    ]
    for (const id of ids) {
      const meta = routes.find((route) => route.meta.id === id)?.meta as
        { workbenchId?: string } | undefined
      expect(meta?.workbenchId).toBe('ai')
    }
    const gatewayOverviewMeta = routes.find((route) => route.meta.id === 'ai-gateway-overview')
      ?.meta as { redirectTo?: string } | undefined
    expect(gatewayOverviewMeta?.redirectTo).toBe('/ai-workbench/overview')
  })

  it('forms one valid Copilot registry', () => {
    const routes = copilotRouteManifests.flatMap((manifest) => [...manifest])
    expect(routes).toHaveLength(43)
    expect(validateRouteDefinitions(routes)).toEqual([])
  })
})
