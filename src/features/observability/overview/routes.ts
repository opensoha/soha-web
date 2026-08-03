import { defineRoutes } from '@/routes/definitions'

export const observabilityOverviewRoutes = defineRoutes([
  {
    meta: {
      id: 'monitoring-workbench-overview',
      path: '/monitoring-workbench/overview',
      title: '总览',
      description: '可观测信号、Provider 与响应状态',
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
      const module = await import('./workbench-page')
      return { default: module.ObservabilityWorkbenchPage }
    },
  },
  {
    meta: {
      id: 'monitoring-workbench-alerting',
      path: '/monitoring-workbench/alerting',
      title: '告警总览',
      description: '活动告警、规则与响应链路',
      icon: 'IconAlertTriangle',
      group: 'observe',
      workbenchId: 'monitoring',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'monitoring-workbench',
      menuId: 'monitoring-workbench-alerting',
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
