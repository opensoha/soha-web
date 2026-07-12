import { defineRoutes } from '@/routes/definitions'
import { accessControlRoutes } from './access-control/routes'
import { clusterResourceRoutes } from './cluster-resources/routes'
import { clusterRoutes } from './clusters/routes'
import { configurationRoutes } from './configuration/routes'
import { extensionRoutes } from './extensions/routes'
import { networkRoutes } from './network/routes'
import { storageRoutes } from './storage/routes'
import { workloadRoutes } from './workloads/routes'

export const platformShellRoutes = defineRoutes([
  {
    meta: {
      id: 'overview',
      path: '/',
      title: 'k8s工作台',
      description: '平台总览',
      icon: 'IconDesktop',
      group: 'overview',
      workbenchId: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'dashboard',
      permissionKey: 'overview.view',
      scopeMode: 'cluster',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview-page')
      return { default: module.OverviewPage }
    },
  },
  {
    meta: {
      id: 'workloads',
      path: '/workloads',
      title: '工作负载',
      description: '工作负载管理',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/workloads/overview',
  },
  {
    meta: {
      id: 'configuration',
      path: '/configuration',
      title: 'Configuration',
      description: '平台配置资源',
      icon: 'IconSetting',
      group: 'platform',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'configuration',
      permissionKey: 'platform.configuration.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/configuration/configmaps',
  },
  {
    meta: {
      id: 'network',
      path: '/network',
      title: '网络',
      description: '网络资源',
      icon: 'IconConnection',
      group: 'platform',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'network',
      permissionKey: 'platform.network.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/network/topology',
  },
  {
    meta: {
      id: 'storage',
      path: '/storage',
      title: '存储',
      description: '存储资源',
      icon: 'IconServer',
      group: 'platform',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'storage',
      permissionKey: 'platform.storage.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/storage/persistentvolumeclaims',
  },
] as const)

export const platformRouteManifests = [
  accessControlRoutes,
  clusterRoutes,
  clusterResourceRoutes,
  workloadRoutes,
  configurationRoutes,
  extensionRoutes,
  networkRoutes,
  storageRoutes,
] as const
