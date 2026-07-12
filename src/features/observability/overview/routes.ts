import { defineRoutes } from '@/routes/definitions'

export const observabilityOverviewRoutes = defineRoutes([
  {
    meta: {
      id: 'monitoring-workbench-overview',
      path: '/monitoring-workbench/overview',
      title: '总览',
      description: '监控总览',
      icon: 'IconPulse',
      group: 'observe',
      workbenchId: 'monitoring',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'monitoring-workbench',
      menuId: 'monitoring-workbench-overview',
      permissionKey: 'observe.monitoring.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./page')
      return { default: module.MonitoringPage }
    },
  },
] as const)
