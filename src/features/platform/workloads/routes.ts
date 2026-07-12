import { defineRoutes } from '@/routes/definitions'

export const workloadRoutes = defineRoutes([
  {
    meta: {
      id: 'workloads-overview',
      path: '/workloads/overview',
      title: 'Overview',
      description: '资源概览与事件',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview/page')
      return { default: module.WorkloadsOverviewPage }
    },
  },
  {
    meta: {
      id: 'workloads-deployments',
      path: '/workloads/deployments',
      title: 'Deployments',
      description: '部署管理',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./deployments/list-page')
      return { default: module.WorkloadsDeploymentsPage }
    },
  },
  {
    meta: {
      id: 'workloads-deployment-detail',
      path: '/workloads/deployments/:deploymentName',
      title: 'Deployment Detail',
      description: 'Deployment 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-deployments',
    load: async () => {
      const module = await import('./deployments/detail-page')
      return { default: module.DeploymentDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-pods',
      path: '/workloads/pods',
      title: 'Pods',
      description: 'Pod 管理',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./pods/list-page')
      return { default: module.WorkloadsPodsPage }
    },
  },
  {
    meta: {
      id: 'workloads-pod-detail',
      path: '/workloads/pods/:podName',
      title: 'Pod Detail',
      description: 'Pod 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-pods',
    load: async () => {
      const module = await import('./pods/detail-page')
      return { default: module.PodDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-replicasets',
      path: '/workloads/replicasets',
      title: 'ReplicaSets',
      description: '副本集',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./replicasets/list-page')
      return { default: module.WorkloadsReplicaSetsPage }
    },
  },
  {
    meta: {
      id: 'workloads-replicaset-detail',
      path: '/workloads/replicasets/:replicaSetName',
      title: 'ReplicaSet Detail',
      description: 'ReplicaSet 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-replicasets',
    load: async () => {
      const module = await import('./replicasets/detail-page')
      return { default: module.ReplicaSetDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-replicationcontrollers',
      path: '/workloads/replicationcontrollers',
      title: 'ReplicationControllers',
      description: '复制控制器',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./replicationcontrollers/list-page')
      return { default: module.WorkloadsReplicationControllersPage }
    },
  },
  {
    meta: {
      id: 'workloads-replicationcontroller-detail',
      path: '/workloads/replicationcontrollers/:replicationControllerName',
      title: 'ReplicationController Detail',
      description: 'ReplicationController 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-replicationcontrollers',
    load: async () => {
      const module = await import('./replicationcontrollers/detail-page')
      return { default: module.ReplicationControllerDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-statefulsets',
      path: '/workloads/statefulsets',
      title: 'StatefulSets',
      description: '有状态副本集',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./statefulsets/list-page')
      return { default: module.WorkloadsStatefulSetsPage }
    },
  },
  {
    meta: {
      id: 'workloads-statefulset-detail',
      path: '/workloads/statefulsets/:statefulSetName',
      title: 'StatefulSet Detail',
      description: 'StatefulSet 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-statefulsets',
    load: async () => {
      const module = await import('./statefulsets/detail-page')
      return { default: module.StatefulSetDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-daemonsets',
      path: '/workloads/daemonsets',
      title: 'DaemonSets',
      description: '守护进程集',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./daemonsets/list-page')
      return { default: module.WorkloadsDaemonSetsPage }
    },
  },
  {
    meta: {
      id: 'workloads-daemonset-detail',
      path: '/workloads/daemonsets/:daemonSetName',
      title: 'DaemonSet Detail',
      description: 'DaemonSet 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-daemonsets',
    load: async () => {
      const module = await import('./daemonsets/detail-page')
      return { default: module.DaemonSetDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-jobs',
      path: '/workloads/jobs',
      title: 'Jobs',
      description: '批量作业',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./jobs/list-page')
      return { default: module.WorkloadsJobsPage }
    },
  },
  {
    meta: {
      id: 'workloads-job-detail',
      path: '/workloads/jobs/:jobName',
      title: 'Job Detail',
      description: 'Job 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-jobs',
    load: async () => {
      const module = await import('./jobs/detail-page')
      return { default: module.JobDetailPage }
    },
  },
  {
    meta: {
      id: 'workloads-cronjobs',
      path: '/workloads/cronjobs',
      title: 'CronJobs',
      description: '定时任务',
      icon: 'IconGridView',
      group: 'platform',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'workloads',
      menuId: 'workloads',
      permissionKey: 'platform.workloads.view',
      scopeMode: 'namespace',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./cronjobs/list-page')
      return { default: module.WorkloadsCronJobsPage }
    },
  },
  {
    meta: {
      id: 'workloads-cronjob-detail',
      path: '/workloads/cronjobs/:cronJobName',
      title: 'CronJob Detail',
      description: 'CronJob 详情',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      scopeMode: 'namespace',
    },
    shell: 'app',
    inheritMetaFrom: 'workloads-cronjobs',
    load: async () => {
      const module = await import('./cronjobs/detail-page')
      return { default: module.CronJobDetailPage }
    },
  },
] as const)
