import { describe, expect, it, vi } from 'vitest'
import { validateRouteDefinitions } from '@/routes/definitions'
import { deliveryRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  applications: () => null,
  applicationDetail: () => null,
  workloadDetail: () => null,
  environments: () => null,
  environmentDetail: () => null,
  buildTemplates: () => null,
  blueprints: () => null,
  onboarding: () => null,
  testing: () => null,
  analysis: () => null,
  releaseBundles: () => null,
  releaseBundleDetail: () => null,
  executionTasks: () => null,
  executionTaskDetail: () => null,
  workflowTemplates: () => null,
  releaseBoard: () => null,
  workflows: () => null,
  workflowDetail: () => null,
  releases: () => null,
  releaseDetail: () => null,
  buildDetail: () => null,
  registries: () => null,
}))

vi.mock('./applications/list-page', () => ({ ApplicationsPage: routePages.applications }))
vi.mock('./applications/detail-page', () => ({
  ApplicationDetailPage: routePages.applicationDetail,
}))
vi.mock('./runtime/workload-detail-page', () => ({
  ApplicationWorkloadDetailPage: routePages.workloadDetail,
}))
vi.mock('./environments/list-page', () => ({
  ApplicationEnvironmentsPage: routePages.environments,
}))
vi.mock('./environments/detail-page', () => ({
  ApplicationEnvironmentDetailPage: routePages.environmentDetail,
}))
vi.mock('./build-templates/page', () => ({ BuildTemplatesPage: routePages.buildTemplates }))
vi.mock('./blueprints/page', () => ({ DeliveryBlueprintsPage: routePages.blueprints }))
vi.mock('./workbench/onboarding-page', () => ({
  DeliveryOnboardingPage: routePages.onboarding,
}))
vi.mock('./workbench/testing-page', () => ({ DeliveryTestingPage: routePages.testing }))
vi.mock('./workbench/analysis-page', () => ({ DeliveryAnalysisPage: routePages.analysis }))
vi.mock('./release-bundles/list-page', () => ({ ReleaseBundlesPage: routePages.releaseBundles }))
vi.mock('./release-bundles/detail-page', () => ({
  ReleaseBundleDetailPage: routePages.releaseBundleDetail,
}))
vi.mock('./execution-tasks/list-page', () => ({ ExecutionTasksPage: routePages.executionTasks }))
vi.mock('./execution-tasks/detail-page', () => ({
  ExecutionTaskDetailPage: routePages.executionTaskDetail,
}))
vi.mock('./workflow-templates/page', () => ({
  WorkflowTemplatesPage: routePages.workflowTemplates,
}))
vi.mock('./release-board/page', () => ({ ReleaseBoardPage: routePages.releaseBoard }))
vi.mock('./workflows/list-page', () => ({ WorkflowsPage: routePages.workflows }))
vi.mock('./workflows/detail-page', () => ({ WorkflowDetailPage: routePages.workflowDetail }))
vi.mock('./releases/list-page', () => ({ ReleasesPage: routePages.releases }))
vi.mock('./releases/detail-page', () => ({ ReleaseDetailPage: routePages.releaseDetail }))
vi.mock('./builds/detail-page', () => ({ BuildDetailPage: routePages.buildDetail }))
vi.mock('./registries/page', () => ({ RegistriesPage: routePages.registries }))

describe('delivery route manifest', () => {
  it('maps all 22 routes directly to distinct leaf modules', async () => {
    const expectedPages = new Map([
      ['applications', routePages.applications],
      ['application-detail', routePages.applicationDetail],
      ['application-workload-detail', routePages.workloadDetail],
      ['application-environments', routePages.environments],
      ['application-environment-detail', routePages.environmentDetail],
      ['build-templates', routePages.buildTemplates],
      ['delivery-blueprints', routePages.blueprints],
      ['delivery-onboarding', routePages.onboarding],
      ['delivery-testing', routePages.testing],
      ['delivery-analysis', routePages.analysis],
      ['release-bundles', routePages.releaseBundles],
      ['release-bundles-detail', routePages.releaseBundleDetail],
      ['execution-tasks', routePages.executionTasks],
      ['execution-tasks-detail', routePages.executionTaskDetail],
      ['workflow-templates', routePages.workflowTemplates],
      ['release-board', routePages.releaseBoard],
      ['workflows', routePages.workflows],
      ['workflows-detail', routePages.workflowDetail],
      ['releases', routePages.releases],
      ['releases-detail', routePages.releaseDetail],
      ['builds-detail', routePages.buildDetail],
      ['registries', routePages.registries],
    ])

    const loadedPages = await Promise.all(
      deliveryRoutes.map(async (route) => {
        const module = await route.load()
        expect(module.default).toBe(expectedPages.get(route.meta.id))
        return module.default
      }),
    )

    expect(loadedPages).toHaveLength(expectedPages.size)
    expect(new Set(loadedPages).size).toBe(expectedPages.size)
  })

  it('preserves legacy paths, permissions, and navigation metadata', () => {
    expect(
      deliveryRoutes.map((route) => ({
        id: route.meta.id,
        menuId: 'menuId' in route.meta ? route.meta.menuId : undefined,
        navVisible: route.meta.navVisible,
        path: route.meta.path,
        permissionKey: 'permissionKey' in route.meta ? route.meta.permissionKey : undefined,
        permissionKeysAny:
          'permissionKeysAny' in route.meta ? route.meta.permissionKeysAny : undefined,
      })),
    ).toEqual([
      {
        id: 'applications',
        menuId: 'builds',
        navVisible: true,
        path: '/applications',
        permissionKey: 'delivery.applications.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'application-detail',
        menuId: undefined,
        navVisible: false,
        path: '/applications/:applicationId',
        permissionKey: undefined,
        permissionKeysAny: undefined,
      },
      {
        id: 'application-workload-detail',
        menuId: undefined,
        navVisible: false,
        path: '/applications/:applicationId/application-environments/:applicationEnvironmentId/workloads/:workloadName',
        permissionKey: undefined,
        permissionKeysAny: undefined,
      },
      {
        id: 'application-environments',
        menuId: 'application-environments',
        navVisible: true,
        path: '/application-environments',
        permissionKey: 'delivery.application-environments.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'application-environment-detail',
        menuId: undefined,
        navVisible: false,
        path: '/application-environments/:applicationEnvironmentId',
        permissionKey: undefined,
        permissionKeysAny: undefined,
      },
      {
        id: 'build-templates',
        menuId: 'build-templates',
        navVisible: true,
        path: '/build-templates',
        permissionKey: 'delivery.build-templates.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'delivery-blueprints',
        menuId: 'delivery-blueprints',
        navVisible: true,
        path: '/delivery/blueprints',
        permissionKey: 'delivery.applications.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'delivery-onboarding',
        menuId: 'delivery-onboarding',
        navVisible: true,
        path: '/delivery/onboarding',
        permissionKey: 'delivery.applications.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'delivery-testing',
        menuId: 'delivery-testing',
        navVisible: true,
        path: '/delivery/testing',
        permissionKey: undefined,
        permissionKeysAny: [
          'delivery.release-bundles.view',
          'delivery.execution-tasks.view',
          'delivery.release-board.view',
        ],
      },
      {
        id: 'delivery-analysis',
        menuId: 'delivery-analysis',
        navVisible: true,
        path: '/delivery/analysis',
        permissionKey: undefined,
        permissionKeysAny: [
          'delivery.execution-tasks.view',
          'delivery.release-board.view',
          'delivery.release-bundles.view',
        ],
      },
      {
        id: 'release-bundles',
        menuId: 'release-bundles',
        navVisible: true,
        path: '/delivery/release-bundles',
        permissionKey: 'delivery.release-bundles.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'release-bundles-detail',
        menuId: undefined,
        navVisible: false,
        path: '/delivery/release-bundles/:releaseBundleId',
        permissionKey: 'delivery.release-bundles.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'execution-tasks',
        menuId: 'execution-tasks',
        navVisible: true,
        path: '/delivery/execution-tasks',
        permissionKey: 'delivery.execution-tasks.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'execution-tasks-detail',
        menuId: undefined,
        navVisible: false,
        path: '/delivery/execution-tasks/:executionTaskId',
        permissionKey: 'delivery.execution-tasks.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'workflow-templates',
        menuId: 'workflow-templates',
        navVisible: true,
        path: '/workflow-templates',
        permissionKey: 'delivery.workflow-templates.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'release-board',
        menuId: 'release-board',
        navVisible: true,
        path: '/release-board',
        permissionKey: 'delivery.release-board.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'workflows',
        menuId: 'workflows',
        navVisible: true,
        path: '/workflows',
        permissionKey: 'delivery.workflows.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'workflows-detail',
        menuId: undefined,
        navVisible: false,
        path: '/workflows/:workflowId',
        permissionKey: 'delivery.workflows.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'releases',
        menuId: 'releases',
        navVisible: true,
        path: '/releases',
        permissionKey: 'delivery.releases.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'releases-detail',
        menuId: undefined,
        navVisible: false,
        path: '/releases/:releaseId',
        permissionKey: 'delivery.releases.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'builds-detail',
        menuId: undefined,
        navVisible: false,
        path: '/builds/:buildId',
        permissionKey: 'delivery.applications.view',
        permissionKeysAny: undefined,
      },
      {
        id: 'registries',
        menuId: 'registries',
        navVisible: true,
        path: '/registries',
        permissionKey: 'delivery.registries.view',
        permissionKeysAny: undefined,
      },
    ])
  })

  it('passes standalone route-definition validation', () => {
    expect(validateRouteDefinitions(deliveryRoutes)).toEqual([])
  })
})
