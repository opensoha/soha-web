// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppRouter } from './index'

vi.mock('@/features/auth/auth-guard', async () => {
  const { createElement } = await import('react')
  const { Outlet } = await import('react-router-dom')
  return { AuthGuard: () => createElement(Outlet) }
})

vi.mock('@/layouts/app-layout', async () => {
  const { createElement } = await import('react')
  const { Outlet } = await import('react-router-dom')
  return { AppLayout: () => createElement(Outlet) }
})

vi.mock('@/features/auth/login-page', async () => {
  const { createElement } = await import('react')
  return {
    LoginPage: () => createElement('div', { 'data-route-page': 'LoginPage' }, 'LoginPage'),
  }
})

const mockRoutePage = vi.hoisted(() => (exportName: string) => async () => {
  const { createElement } = await import('react')
  return {
    [exportName]: () => createElement('div', { 'data-route-page': exportName }, exportName),
  }
})

vi.mock('@/features/provider-portal/catalog/page', mockRoutePage('SohaProviderPortalPage'))
vi.mock('@/features/auth/oidc-callback-page', mockRoutePage('OIDCCallbackPage'))
vi.mock('@/features/auth/user-profile-page', mockRoutePage('UserProfilePage'))
vi.mock('@/features/platform/overview-page', mockRoutePage('OverviewPage'))
vi.mock(
  '@/features/provider-portal/application-detail/page',
  mockRoutePage('PortalApplicationDetailPage'),
)
vi.mock('@/features/provider-portal/security/page', mockRoutePage('PortalSecurityPage'))
vi.mock('@/features/identity/outposts/list-page', mockRoutePage('IdentityOutpostsPage'))
vi.mock('@/features/identity/policies/list-page', mockRoutePage('IdentityPoliciesPage'))
vi.mock('@/features/identity/applications/list-page', mockRoutePage('IdentityApplicationsPage'))
vi.mock('@/features/identity/overview/page', mockRoutePage('IdentityOverviewPage'))
vi.mock('@/features/identity/providers/list-page', mockRoutePage('IdentityProvidersPage'))
vi.mock('@/features/access/center/page', mockRoutePage('AccessCenterPage'))
vi.mock('@/features/access/users/page', mockRoutePage('AccessUsersPage'))
vi.mock('@/features/access/roles/page', mockRoutePage('AccessRolesPage'))
vi.mock('@/features/access/teams/page', mockRoutePage('AccessTeamsPage'))
vi.mock('@/features/access/policies/page', mockRoutePage('AccessPoliciesPage'))
vi.mock('@/features/access/scope-grants/page', mockRoutePage('AccessScopeGrantsPage'))
vi.mock('@/features/system/sessions/page', mockRoutePage('OnlineUsersPage'))
vi.mock('@/features/system/announcements/page', mockRoutePage('AnnouncementsPage'))
vi.mock('@/features/system/menus/page', mockRoutePage('MenusPage'))
vi.mock('@/features/system/audit/page', mockRoutePage('AuditLogsPage'))
vi.mock('@/features/system/operation-logs/page', mockRoutePage('OperationLogsPage'))
vi.mock('@/features/settings/center/page', mockRoutePage('SettingsCenterPage'))
vi.mock('@/features/settings/identity/page', mockRoutePage('LoginSettingsPage'))
vi.mock('@/features/settings/branding/page', mockRoutePage('BrandingSettingsPage'))
vi.mock('@/features/settings/about/page', mockRoutePage('AboutSettingsPage'))
vi.mock('@/features/copilot/workbench/pages/chat-page', mockRoutePage('AIWorkbenchChatPage'))
vi.mock('@/features/copilot/observe/operations/page', mockRoutePage('AIOperationsPage'))
vi.mock('@/features/copilot/observe/tools/page', mockRoutePage('AIToolsPage'))
vi.mock('@/features/copilot/observe/model-settings/page', mockRoutePage('AIModelSettingsPage'))
vi.mock('@/features/copilot/observe/overview/page', mockRoutePage('AIObserveOverviewPage'))
vi.mock(
  '@/features/virtualization/virtual-machines/detail-page',
  mockRoutePage('VirtualizationVmDetailPage'),
)
vi.mock('@/features/docker/projects/detail-page', mockRoutePage('DockerProjectDetailPage'))

vi.mock('@/features/platform/workloads/overview/page', mockRoutePage('WorkloadsOverviewPage'))
vi.mock('@/features/platform/clusters/list-page', mockRoutePage('ClustersPage'))
vi.mock('@/features/platform/clusters/detail-page', mockRoutePage('ClusterDetailPage'))
vi.mock('@/features/platform/cluster-resources/nodes-list-page', mockRoutePage('ClusterNodesPage'))
vi.mock('@/features/platform/cluster-resources/node-detail-page', mockRoutePage('NodeDetailPage'))
vi.mock(
  '@/features/platform/cluster-resources/namespaces-list-page',
  mockRoutePage('ClusterNamespacesPage'),
)
vi.mock(
  '@/features/platform/configuration/configmaps/list-page',
  mockRoutePage('ConfigurationConfigMapsPage'),
)
vi.mock(
  '@/features/platform/configuration/configmaps/detail-page',
  mockRoutePage('ConfigMapDetailPage'),
)
vi.mock(
  '@/features/platform/configuration/secrets/list-page',
  mockRoutePage('ConfigurationSecretsPage'),
)
vi.mock('@/features/platform/configuration/secrets/detail-page', mockRoutePage('SecretDetailPage'))
vi.mock('@/features/platform/network/services/list-page', mockRoutePage('NetworkServicesPage'))
vi.mock('@/features/platform/network/services/detail-page', mockRoutePage('ServiceDetailPage'))
vi.mock('@/features/platform/network/ingresses/list-page', mockRoutePage('NetworkIngressesPage'))
vi.mock('@/features/platform/network/ingresses/detail-page', mockRoutePage('IngressDetailPage'))
vi.mock('@/features/platform/network/topology/page', mockRoutePage('NetworkTopologyPage'))
vi.mock(
  '@/features/platform/storage/persistent-volume-claims/list-page',
  mockRoutePage('StoragePvcPage'),
)
vi.mock(
  '@/features/platform/workloads/deployments/list-page',
  mockRoutePage('WorkloadsDeploymentsPage'),
)
vi.mock(
  '@/features/platform/workloads/deployments/detail-page',
  mockRoutePage('DeploymentDetailPage'),
)
vi.mock('@/features/platform/workloads/pods/list-page', mockRoutePage('WorkloadsPodsPage'))
vi.mock('@/features/platform/workloads/pods/detail-page', mockRoutePage('PodDetailPage'))
vi.mock(
  '@/features/platform/workloads/replicasets/list-page',
  mockRoutePage('WorkloadsReplicaSetsPage'),
)
vi.mock(
  '@/features/platform/workloads/replicasets/detail-page',
  mockRoutePage('ReplicaSetDetailPage'),
)
vi.mock(
  '@/features/platform/workloads/replicationcontrollers/list-page',
  mockRoutePage('WorkloadsReplicationControllersPage'),
)
vi.mock(
  '@/features/platform/workloads/replicationcontrollers/detail-page',
  mockRoutePage('ReplicationControllerDetailPage'),
)
vi.mock(
  '@/features/platform/workloads/statefulsets/list-page',
  mockRoutePage('WorkloadsStatefulSetsPage'),
)
vi.mock(
  '@/features/platform/workloads/statefulsets/detail-page',
  mockRoutePage('StatefulSetDetailPage'),
)
vi.mock(
  '@/features/platform/workloads/daemonsets/list-page',
  mockRoutePage('WorkloadsDaemonSetsPage'),
)
vi.mock(
  '@/features/platform/workloads/daemonsets/detail-page',
  mockRoutePage('DaemonSetDetailPage'),
)
vi.mock('@/features/platform/workloads/jobs/list-page', mockRoutePage('WorkloadsJobsPage'))
vi.mock('@/features/platform/workloads/jobs/detail-page', mockRoutePage('JobDetailPage'))
vi.mock('@/features/platform/workloads/cronjobs/list-page', mockRoutePage('WorkloadsCronJobsPage'))
vi.mock('@/features/platform/workloads/cronjobs/detail-page', mockRoutePage('CronJobDetailPage'))
vi.mock('@/features/observability/alerts/detail-page', mockRoutePage('AlertEventDetailPage'))

const mountedRoots: Root[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

async function renderRoute(path: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>,
    )
  })
  return container
}

async function waitForRoutePage(container: HTMLElement, page: string) {
  const selector = `[data-route-page="${page}"]`
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const element = container.querySelector(selector)
    if (element) return element
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  return container.querySelector(selector)
}

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

describe('router deep-link baseline', () => {
  it.each([
    ['/', 'OverviewPage'],
    ['/login', 'LoginPage'],
    ['/auth/oidc/callback', 'OIDCCallbackPage'],
    ['/login/callback', 'OIDCCallbackPage'],
    ['/account/profile', 'UserProfilePage'],
    ['/portal', 'SohaProviderPortalPage'],
    ['/portal/applications/application-1', 'PortalApplicationDetailPage'],
    ['/portal/security', 'PortalSecurityPage'],
    ['/identity', 'IdentityOverviewPage'],
    ['/identity/overview', 'IdentityOverviewPage'],
    ['/identity/applications', 'IdentityApplicationsPage'],
    ['/identity/providers', 'IdentityProvidersPage'],
    ['/identity/outposts', 'IdentityOutpostsPage'],
    ['/identity/policies', 'IdentityPoliciesPage'],
    ['/identity/audit', 'AuditLogsPage'],
    ['/access', 'AccessCenterPage'],
    ['/access/users', 'AccessUsersPage'],
    ['/access/roles', 'AccessRolesPage'],
    ['/access/teams', 'AccessTeamsPage'],
    ['/access/policies', 'AccessPoliciesPage'],
    ['/access/scope-grants', 'AccessScopeGrantsPage'],
    ['/system', 'OnlineUsersPage'],
    ['/system/online-users', 'OnlineUsersPage'],
    ['/system/announcements', 'AnnouncementsPage'],
    ['/system/menus', 'MenusPage'],
    ['/system/audit', 'AuditLogsPage'],
    ['/system/operations', 'OperationLogsPage'],
    ['/settings', 'SettingsCenterPage'],
    ['/settings/login', 'LoginSettingsPage'],
    ['/settings/branding', 'BrandingSettingsPage'],
    ['/settings/about', 'AboutSettingsPage'],
    ['/clusters', 'ClustersPage'],
    ['/clusters/cluster-1', 'ClusterDetailPage'],
    ['/cluster-resources/nodes', 'ClusterNodesPage'],
    ['/cluster-resources', 'ClusterNodesPage'],
    ['/cluster-resources/nodes/worker-1', 'NodeDetailPage'],
    ['/cluster-resources/namespaces', 'ClusterNamespacesPage'],
    ['/configuration/configmaps', 'ConfigurationConfigMapsPage'],
    ['/configuration', 'ConfigurationConfigMapsPage'],
    ['/configuration/configmaps/app-config', 'ConfigMapDetailPage'],
    ['/configuration/secrets', 'ConfigurationSecretsPage'],
    ['/configuration/secrets/app-secret', 'SecretDetailPage'],
    ['/network/services', 'NetworkServicesPage'],
    ['/network', 'NetworkTopologyPage'],
    ['/network/services/api', 'ServiceDetailPage'],
    ['/network/ingresses', 'NetworkIngressesPage'],
    ['/network/ingresses/web', 'IngressDetailPage'],
    ['/workloads/overview', 'WorkloadsOverviewPage'],
    ['/workloads', 'WorkloadsOverviewPage'],
    ['/workloads/deployments', 'WorkloadsDeploymentsPage'],
    ['/workloads/deployments/api', 'DeploymentDetailPage'],
    ['/workloads/pods', 'WorkloadsPodsPage'],
    ['/workloads/pods/api-123', 'PodDetailPage'],
    ['/workloads/replicasets', 'WorkloadsReplicaSetsPage'],
    ['/workloads/replicasets/api-rs', 'ReplicaSetDetailPage'],
    ['/workloads/replicationcontrollers', 'WorkloadsReplicationControllersPage'],
    ['/workloads/replicationcontrollers/api-rc', 'ReplicationControllerDetailPage'],
    ['/workloads/statefulsets', 'WorkloadsStatefulSetsPage'],
    ['/workloads/statefulsets/database', 'StatefulSetDetailPage'],
    ['/workloads/daemonsets', 'WorkloadsDaemonSetsPage'],
    ['/workloads/daemonsets/agent', 'DaemonSetDetailPage'],
    ['/workloads/jobs', 'WorkloadsJobsPage'],
    ['/workloads/jobs/migration', 'JobDetailPage'],
    ['/workloads/cronjobs', 'WorkloadsCronJobsPage'],
    ['/workloads/cronjobs/backup', 'CronJobDetailPage'],
    ['/compute/virtualization/vms/vm-1', 'VirtualizationVmDetailPage'],
    ['/compute/runtimes/projects/project-1', 'DockerProjectDetailPage'],
    ['/monitoring-workbench/alerts/event-1', 'AlertEventDetailPage'],
    ['/observability/alerts/event-1', 'AlertEventDetailPage'],
    ['/ai-workbench/chat', 'AIWorkbenchChatPage'],
    ['/ai-workbench/inspection', 'AIOperationsPage'],
    ['/ai-workbench/tool-settings', 'AIToolsPage'],
    ['/ai-workbench/model-settings', 'AIModelSettingsPage'],
    ['/storage', 'StoragePvcPage'],
    ['/not-a-real-route', 'OverviewPage'],
  ])('resolves %s to %s', async (path, page) => {
    const container = await renderRoute(path)
    expect(await waitForRoutePage(container, page), container.innerHTML).not.toBeNull()
  })
})
