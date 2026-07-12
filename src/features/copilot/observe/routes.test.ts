import { describe, expect, it, vi } from 'vitest'
import { validateRouteDefinitions } from '@/routes/definitions'
import {
  copilotObserveCompatibilityRoutes,
  copilotObserveRouteManifests,
  copilotObserveRoutes,
} from './routes'

const routePages = vi.hoisted(() => ({
  chat: () => null,
  rootCause: () => null,
  performance: () => null,
  operations: () => null,
  tools: () => null,
  modelSettings: () => null,
  modeRedirect: () => null,
  operationsRedirect: () => null,
  toolsRedirect: () => null,
  rootCauseRedirect: () => null,
  performanceRedirect: () => null,
}))

vi.mock('../workbench/pages/chat-page', () => ({ AIWorkbenchChatPage: routePages.chat }))
vi.mock('../workbench/pages/root-cause-page', () => ({
  AIWorkbenchRootCausePage: routePages.rootCause,
}))
vi.mock('../workbench/pages/performance-page', () => ({
  AIWorkbenchPerformancePage: routePages.performance,
}))
vi.mock('./operations/page', () => ({ AIOperationsPage: routePages.operations }))
vi.mock('./tools/page', () => ({ AIToolsPage: routePages.tools }))
vi.mock('./model-settings/page', () => ({
  AIModelSettingsPage: routePages.modelSettings,
}))
vi.mock('./redirects', () => ({
  AIWorkbenchModeRedirect: routePages.modeRedirect,
  AIWorkbenchOperationsRedirect: routePages.operationsRedirect,
  AIWorkbenchToolsRedirect: routePages.toolsRedirect,
  AIWorkbenchRootCauseRedirect: routePages.rootCauseRedirect,
  AIWorkbenchPerformanceRedirect: routePages.performanceRedirect,
}))

describe('Copilot Observe route manifests', () => {
  it('loads each canonical UI from its leaf module', async () => {
    const loaded = new Map<string, unknown>()
    for (const route of copilotObserveRoutes) {
      loaded.set(route.meta.path, (await route.load()).default)
    }

    expect(loaded.get('/ai-workbench')).toBe(routePages.modeRedirect)
    expect(loaded.get('/ai-workbench/chat')).toBe(routePages.chat)
    expect(loaded.get('/ai-workbench/root-cause')).toBe(routePages.rootCause)
    expect(loaded.get('/ai-workbench/performance')).toBe(routePages.performance)
    expect(loaded.get('/ai-workbench/inspection')).toBe(routePages.operations)
    expect(loaded.get('/ai-workbench/tool-settings')).toBe(routePages.tools)
    expect(loaded.get('/ai-workbench/model-settings')).toBe(routePages.modelSettings)
  })

  it('preserves compatibility URLs as loader-backed redirects', async () => {
    const loaded = new Map<string, unknown>()
    for (const route of copilotObserveCompatibilityRoutes) {
      loaded.set(route.meta.path, (await route.load()).default)
    }

    expect(loaded.get('/ai-workbench/automation')).toBe(routePages.operationsRedirect)
    expect(loaded.get('/ai-workbench/tools')).toBe(routePages.toolsRedirect)
    expect(loaded.get('/ai-observe/root-cause')).toBe(routePages.rootCauseRedirect)
    expect(loaded.get('/ai-observe/performance')).toBe(routePages.performanceRedirect)
    expect(loaded.get('/chat')).toBe(routePages.modeRedirect)
  })

  it('has unique, valid route definitions', () => {
    const routes = copilotObserveRouteManifests.flatMap((manifest) => [...manifest])
    expect(routes).toHaveLength(19)
    expect(validateRouteDefinitions(routes)).toEqual([])
  })
})
