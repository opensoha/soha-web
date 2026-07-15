import { describe, expect, it, vi } from 'vitest'
import { settingsRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  about: () => null,
  branding: () => null,
  center: () => null,
  login: () => null,
}))

vi.mock('./about/page', () => ({ AboutSettingsPage: routePages.about }))
vi.mock('./branding/page', () => ({ BrandingSettingsPage: routePages.branding }))
vi.mock('./center/page', () => ({ SettingsCenterPage: routePages.center }))
vi.mock('./identity/page', () => ({ LoginSettingsPage: routePages.login }))

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

    expect(pageRoutes).toHaveLength(4)
    expect(loaded.get('/settings')).toBe(routePages.center)
    expect(loaded.get('/settings/login')).toBe(routePages.login)
    expect(loaded.get('/settings/branding')).toBe(routePages.branding)
    expect(loaded.get('/settings/about')).toBe(routePages.about)
  })

  it('does not register obsolete settings aliases', () => {
    const paths = new Set<string>(settingsRoutes.map((route) => route.meta.path))

    expect(paths.has('/settings/identity')).toBe(false)
    expect(paths.has('/settings/monitoring')).toBe(false)
    expect(paths.has('/settings/ai')).toBe(false)
  })
})
