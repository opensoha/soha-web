import { defineRoutes } from '@/routes/definitions'

export const deliveryRoutes = defineRoutes([
  {
    meta: {
      id: 'applications',
      path: '/applications',
      title: '应用中心',
      description: '应用入口视角',
      icon: 'IconAppCenter',
      group: 'delivery',
      workbenchId: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'builds',
      permissionKey: 'delivery.applications.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./applications/list-page')
      return { default: module.ApplicationsPage }
    },
  },
  {
    meta: {
      id: 'application-detail',
      path: '/applications/:applicationId',
      title: '应用详情',
      description: '应用运行详情',
      icon: 'IconAppCenter',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'applications',
      scopeMode: 'passive',
    },
    shell: 'app',
    permissionExemptReason:
      'Application detail authorization is enforced by the parent resource and backend.',
    load: async () => {
      const module = await import('./applications/detail-page')
      return { default: module.ApplicationDetailPage }
    },
  },
  {
    meta: {
      id: 'application-workload-detail',
      path: '/applications/:applicationId/application-environments/:applicationEnvironmentId/workloads/:workloadName',
      title: '服务详情',
      description: '应用服务运行详情',
      icon: 'IconAppCenter',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'application-detail',
      scopeMode: 'passive',
    },
    shell: 'app',
    permissionExemptReason:
      'Workload detail authorization is enforced by the parent application resource and backend.',
    load: async () => {
      const module = await import('./runtime/workload-detail-page')
      return { default: module.ApplicationWorkloadDetailPage }
    },
  },
  {
    meta: {
      id: 'application-environments',
      path: '/application-environments',
      title: '应用环境绑定',
      description: '应用与环境绑定',
      icon: 'IconAppCenter',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'application-environments',
      permissionKey: 'delivery.application-environments.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./environments/list-page')
      return { default: module.ApplicationEnvironmentsPage }
    },
  },
  {
    meta: {
      id: 'application-environment-detail',
      path: '/application-environments/:applicationEnvironmentId',
      title: '环境详情',
      description: '应用环境详情',
      icon: 'IconAppCenter',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'application-environments',
      scopeMode: 'passive',
    },
    shell: 'app',
    permissionExemptReason:
      'Environment detail authorization is enforced by the parent resource and backend.',
    load: async () => {
      const module = await import('./environments/detail-page')
      return { default: module.ApplicationEnvironmentDetailPage }
    },
  },
  {
    meta: {
      id: 'build-templates',
      path: '/build-templates',
      title: '构建模板',
      description: '平台构建模板',
      icon: 'IconCode',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'build-templates',
      permissionKey: 'delivery.build-templates.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./build-templates/page')
      return { default: module.BuildTemplatesPage }
    },
  },
  {
    meta: {
      id: 'delivery-blueprints',
      path: '/delivery/blueprints',
      title: '应用接入模板',
      description: '应用接入模板、规范渲染与平台编排入口',
      icon: 'IconCode',
      group: 'delivery',
      workbenchId: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'delivery-blueprints',
      permissionKey: 'delivery.applications.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./blueprints/page')
      return { default: module.DeliveryBlueprintsPage }
    },
  },
  {
    meta: {
      id: 'delivery-onboarding',
      path: '/delivery/onboarding',
      title: '应用接入',
      description: '新应用接入、模板消费、规范草稿与环境绑定入口',
      icon: 'IconCode',
      group: 'delivery',
      workbenchId: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'delivery-onboarding',
      permissionKey: 'delivery.applications.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workbench/onboarding-page')
      return { default: module.DeliveryOnboardingPage }
    },
  },
  {
    meta: {
      id: 'delivery-testing',
      path: '/delivery/testing',
      title: '测试验证',
      description: '候选版本、验证结果、测试证据和晋级判断入口',
      icon: 'IconShield',
      group: 'delivery',
      workbenchId: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'delivery-testing',
      permissionKeysAny: [
        'delivery.release-bundles.view',
        'delivery.execution-tasks.view',
        'delivery.release-board.view',
      ],
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workbench/testing-page')
      return { default: module.DeliveryTestingPage }
    },
  },
  {
    meta: {
      id: 'delivery-analysis',
      path: '/delivery/analysis',
      title: '问题分析',
      description: '失败任务、日志证据、影响范围和修复建议入口',
      icon: 'IconFlow',
      group: 'delivery',
      workbenchId: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'delivery-analysis',
      permissionKeysAny: [
        'delivery.execution-tasks.view',
        'delivery.release-board.view',
        'delivery.release-bundles.view',
      ],
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workbench/analysis-page')
      return { default: module.DeliveryAnalysisPage }
    },
  },
  {
    meta: {
      id: 'release-bundles',
      path: '/delivery/release-bundles',
      title: '版本包',
      description: '不可变交付版本包',
      icon: 'IconInbox',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'release-bundles',
      permissionKey: 'delivery.release-bundles.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./release-bundles/list-page')
      return { default: module.ReleaseBundlesPage }
    },
  },
  {
    meta: {
      id: 'release-bundles-detail',
      path: '/delivery/release-bundles/:releaseBundleId',
      title: '版本包详情',
      description: '版本包运行态详情',
      icon: 'IconInbox',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'release-bundles',
      permissionKey: 'delivery.release-bundles.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./release-bundles/detail-page')
      return { default: module.ReleaseBundleDetailPage }
    },
  },
  {
    meta: {
      id: 'execution-tasks',
      path: '/delivery/execution-tasks',
      title: '执行任务',
      description: '执行平面任务与日志',
      icon: 'IconFlow',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'execution-tasks',
      permissionKey: 'delivery.execution-tasks.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./execution-tasks/list-page')
      return { default: module.ExecutionTasksPage }
    },
  },
  {
    meta: {
      id: 'execution-tasks-detail',
      path: '/delivery/execution-tasks/:executionTaskId',
      title: '执行任务详情',
      description: '执行任务运行态详情',
      icon: 'IconFlow',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'execution-tasks',
      permissionKey: 'delivery.execution-tasks.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./execution-tasks/detail-page')
      return { default: module.ExecutionTaskDetailPage }
    },
  },
  {
    meta: {
      id: 'workflow-templates',
      path: '/workflow-templates',
      title: '发布流程模板',
      description: '交付发布流程模板',
      icon: 'IconFlow',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'workflow-templates',
      permissionKey: 'delivery.workflow-templates.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workflow-templates/page')
      return { default: module.WorkflowTemplatesPage }
    },
  },
  {
    meta: {
      id: 'release-board',
      path: '/release-board',
      title: '构建发布',
      description: '应用环境构建、发布与候选版本态势',
      icon: 'IconSend',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'release-board',
      permissionKey: 'delivery.release-board.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./release-board/page')
      return { default: module.ReleaseBoardPage }
    },
  },
  {
    meta: {
      id: 'workflows',
      path: '/workflows',
      title: '工作流',
      description: '工作流管理',
      icon: 'IconFlow',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'workflows',
      permissionKey: 'delivery.workflows.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workflows/list-page')
      return { default: module.WorkflowsPage }
    },
  },
  {
    meta: {
      id: 'workflows-detail',
      path: '/workflows/:workflowId',
      title: '工作流详情',
      description: '工作流运行态详情',
      icon: 'IconFlow',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'workflows',
      permissionKey: 'delivery.workflows.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./workflows/detail-page')
      return { default: module.WorkflowDetailPage }
    },
  },
  {
    meta: {
      id: 'releases',
      path: '/releases',
      title: '发布记录',
      description: '发布结果、环境变更和回滚记录',
      icon: 'IconSend',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'releases',
      permissionKey: 'delivery.releases.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./releases/list-page')
      return { default: module.ReleasesPage }
    },
  },
  {
    meta: {
      id: 'releases-detail',
      path: '/releases/:releaseId',
      title: '发布详情',
      description: '发布运行态详情',
      icon: 'IconSend',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'releases',
      permissionKey: 'delivery.releases.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./releases/detail-page')
      return { default: module.ReleaseDetailPage }
    },
  },
  {
    meta: {
      id: 'builds-detail',
      path: '/builds/:buildId',
      title: '构建详情',
      description: '构建运行态详情',
      icon: 'IconCode',
      group: 'delivery',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'applications',
      permissionKey: 'delivery.applications.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./builds/detail-page')
      return { default: module.BuildDetailPage }
    },
  },
  {
    meta: {
      id: 'registries',
      path: '/registries',
      title: '镜像仓库',
      description: '镜像仓库连接',
      icon: 'IconInbox',
      group: 'delivery',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      menuId: 'registries',
      permissionKey: 'delivery.registries.view',
      scopeMode: 'passive',
      workspace: 'application',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./registries/page')
      return { default: module.RegistriesPage }
    },
  },
] as const)
