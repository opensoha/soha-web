import { describe, expect, it, vi } from 'vitest'
import { settingsRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  branding: () => null,
  legacySourceConnectionDetail: () => null,
  login: () => null,
  overview: () => null,
  runtimeConfiguration: () => null,
  sourceConnections: () => null,
  sourceConnectionDetail: () => null,
}))

vi.mock('./branding/page', () => ({ BrandingSettingsPage: routePages.branding }))
vi.mock('./identity/page', () => ({ LoginSettingsPage: routePages.login }))
vi.mock('./overview/page', () => ({ SettingsOverviewPage: routePages.overview }))
vi.mock('./runtime-configuration/page', () => ({
  RuntimeConfigurationPage: routePages.runtimeConfiguration,
}))
vi.mock('./system-integrations/source-list-page', () => ({
  SourceConnectionsPage: routePages.sourceConnections,
}))
vi.mock('./system-integrations/source-detail-page', () => ({
  SourceConnectionDetailPage: routePages.sourceConnectionDetail,
}))
vi.mock('./system-integrations/legacy-detail-redirect', () => ({
  LegacySourceConnectionDetailRedirect: routePages.legacySourceConnectionDetail,
}))

describe('Settings route manifest', () => {
  it('maps each UI route to a distinct leaf', async () => {
    type SettingsRoute = (typeof settingsRoutes)[number]
    type SettingsPageRoute = Extract<SettingsRoute, { readonly load: unknown }>
    const pageRoutes = settingsRoutes.filter((route): route is SettingsPageRoute => 'load' in route)
    const loaded = new Map(
      await Promise.all(
        pageRoutes.map(async (route) => [route.meta.path, (await route.load()).default] as const),
      ),
    )

    expect(pageRoutes).toHaveLength(7)
    expect(loaded.get('/settings/overview')).toBe(routePages.overview)
    expect(loaded.get('/settings/login')).toBe(routePages.login)
    expect(loaded.get('/settings/branding')).toBe(routePages.branding)
    expect(loaded.get('/settings/runtime-configuration')).toBe(routePages.runtimeConfiguration)
    expect(loaded.get('/settings/source-control')).toBe(routePages.sourceConnections)
    expect(loaded.get('/settings/source-control/:integrationId')).toBe(
      routePages.sourceConnectionDetail,
    )
    expect(loaded.get('/settings/system-integrations/source-control/:integrationId')).toBe(
      routePages.legacySourceConnectionDetail,
    )
  })

  it('does not register obsolete settings aliases', () => {
    const paths = new Set<string>(settingsRoutes.map((route) => route.meta.path))

    expect(paths.has('/settings/identity')).toBe(false)
    expect(paths.has('/settings/monitoring')).toBe(false)
    expect(paths.has('/settings/ai')).toBe(false)
    expect(paths.has('/settings/about')).toBe(false)
  })

  it('redirects the removed system integrations catalog to code sources', () => {
    const redirectByPath = new Map(
      settingsRoutes
        .filter(
          (route): route is (typeof settingsRoutes)[number] & { redirectTo: string } =>
            'redirectTo' in route,
        )
        .map((route) => [route.meta.path, route.redirectTo]),
    )

    expect(redirectByPath.get('/settings')).toBe('/settings/overview')
    expect(redirectByPath.get('/settings/system-integrations')).toBe('/settings/source-control')
    expect(redirectByPath.get('/settings/system-integrations/source-control')).toBe(
      '/settings/source-control',
    )
  })
})
