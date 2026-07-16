import { defineRoutes } from '@/routes/definitions'

const computeRootMeta = {
  group: 'compute',
  workbenchId: 'compute',
  requiresAuth: true,
  scopeMode: 'passive',
  workspace: 'resource',
} as const

export const computeRoutes = defineRoutes([
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench',
      path: '/compute',
      title: '计算资源工作台',
      description: '虚拟化、运行时主机、容器项目与任务的统一入口',
      icon: 'IconServer',
      tabbar: false,
      navVisible: true,
      menuId: 'compute-workbench',
      permissionStrategy: 'any-child',
    },
    shell: 'app',
    redirectTo: '/compute/overview',
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench-overview',
      path: '/compute/overview',
      title: '总览',
      description: '计算资源接入、健康状态与风险总览',
      icon: 'IconGauge',
      tabbar: true,
      navVisible: true,
      parentId: 'compute-workbench',
      menuId: 'compute-workbench-overview',
      permissionKeysAny: [
        'virtualization.overview.view',
        'virtualization.vms.view',
        'virtualization.clusters.view',
        'virtualization.images.view',
        'virtualization.flavors.view',
        'virtualization.operations.view',
        'virtualization.sync.view',
        'virtualization.sync.manage',
        'docker.overview.view',
        'docker.hosts.view',
        'docker.projects.view',
        'docker.services.view',
        'docker.ports.view',
        'docker.templates.view',
        'docker.operations.view',
      ],
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview/page')
      return { default: module.ComputeOverviewPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench-access',
      path: '/compute/access',
      title: '资源接入',
      description: '虚拟化连接、Agent 与运行时主机接入状态',
      icon: 'IconCluster',
      tabbar: true,
      navVisible: true,
      parentId: 'compute-workbench',
      menuId: 'compute-workbench-access',
      permissionKeysAny: [
        'compute.access.view',
        'virtualization.clusters.view',
        'docker.hosts.view',
      ],
    },
    shell: 'app',
    load: async () => {
      const module = await import('./access/page')
      return { default: module.ComputeAccessPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench',
      path: '/compute/virtualization',
      title: '虚拟化',
      description: '虚拟机、连接、镜像与规格',
      icon: 'IconServer',
      tabbar: false,
      navVisible: true,
      parentId: 'compute-workbench',
      menuId: 'virtualization-workbench',
      permissionStrategy: 'any-child',
    },
    shell: 'app',
    redirectTo: '/compute/virtualization/vms',
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench-vms',
      path: '/compute/virtualization/vms',
      title: '虚拟机',
      description: '虚拟机实例入口',
      icon: 'IconServer',
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-vms',
      permissionKey: 'virtualization.vms.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/virtualization/virtual-machines/list-page')
      return { default: module.VirtualizationVmsPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench-vm-detail',
      path: '/compute/virtualization/vms/:id',
      title: '虚拟机详情',
      description: '虚拟机规格、镜像、网络和任务详情',
      icon: 'IconServer',
      tabbar: false,
      navVisible: false,
      parentId: 'virtualization-workbench-vms',
      permissionKey: 'virtualization.vms.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/virtualization/virtual-machines/detail-page')
      return { default: module.VirtualizationVmDetailPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench-clusters',
      path: '/compute/virtualization/clusters',
      title: '集群',
      description: '虚拟化连接与集群入口',
      icon: 'IconCluster',
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-clusters',
      permissionKey: 'virtualization.clusters.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/virtualization/clusters/list-page')
      return { default: module.VirtualizationClustersPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench-images',
      path: '/compute/virtualization/images',
      title: '镜像',
      description: '虚拟机镜像入口',
      icon: 'IconInbox',
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-images',
      permissionKey: 'virtualization.images.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/virtualization/images/list-page')
      return { default: module.VirtualizationImagesPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'virtualization-workbench-flavors',
      path: '/compute/virtualization/flavors',
      title: '规格',
      description: '虚拟机规格入口',
      icon: 'IconGridView',
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-flavors',
      permissionKey: 'virtualization.flavors.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/virtualization/flavors/list-page')
      return { default: module.VirtualizationFlavorsPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'docker-workbench',
      path: '/compute/runtimes',
      title: '容器运行时',
      description: '运行时主机、容器管理与部署模板',
      icon: 'IconDocker',
      tabbar: false,
      navVisible: true,
      parentId: 'compute-workbench',
      menuId: 'docker-workbench',
      permissionStrategy: 'any-child',
    },
    shell: 'app',
    redirectTo: '/compute/runtimes/hosts',
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'docker-workbench-hosts',
      path: '/compute/runtimes/hosts',
      title: '运行时主机',
      description: '运行时主机接入与虚拟化快速构建',
      icon: 'IconServer',
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-hosts',
      permissionKey: 'docker.hosts.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/docker/hosts/page')
      return { default: module.DockerHostsPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'docker-workbench-projects',
      path: '/compute/runtimes/projects',
      title: '容器管理',
      description: '项目、容器、服务与端口',
      icon: 'IconGridView',
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/docker/projects/list-page')
      return { default: module.DockerProjectsPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'docker-workbench-project-detail',
      path: '/compute/runtimes/projects/:projectId',
      title: '容器详情',
      description: '容器项目、服务、端口与操作上下文',
      icon: 'IconGridView',
      tabbar: false,
      navVisible: false,
      parentId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/docker/projects/detail-page')
      return { default: module.DockerProjectDetailPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'docker-workbench-templates',
      path: '/compute/runtimes/templates',
      title: '部署模板',
      description: 'Compose 与其他运行时部署模板',
      icon: 'IconCode',
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-templates',
      permissionKey: 'docker.templates.view',
    },
    shell: 'app',
    load: async () => {
      const module = await import('@/features/docker/templates/page')
      return { default: module.DockerTemplatesPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench-tasks-sync',
      path: '/compute/tasks/sync',
      title: '同步任务',
      description: '虚拟化与运行时资源同步任务',
      icon: 'IconSync',
      tabbar: false,
      navVisible: false,
      parentId: 'compute-workbench',
      menuId: 'compute-workbench-tasks-sync',
      permissionKeysAny: [
        'compute.tasks.view',
        'virtualization.sync.view',
        'virtualization.sync.manage',
        'docker.operations.view',
      ],
    },
    shell: 'app',
    load: async () => {
      const module = await import('./tasks/sync-page')
      return { default: module.ComputeSyncTasksPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench-tasks-build',
      path: '/compute/tasks/build',
      title: '构建任务',
      description: '运行时主机构建与部署任务',
      icon: 'IconFileSearch',
      tabbar: false,
      navVisible: false,
      parentId: 'compute-workbench',
      menuId: 'compute-workbench-tasks-build',
      permissionKeysAny: [
        'compute.tasks.view',
        'virtualization.operations.view',
        'docker.operations.view',
      ],
    },
    shell: 'app',
    load: async () => {
      const module = await import('./tasks/build-page')
      return { default: module.ComputeBuildTasksPage }
    },
  },
  {
    meta: {
      ...computeRootMeta,
      id: 'compute-workbench-tasks-operations',
      path: '/compute/tasks/operations',
      title: '任务中心',
      description: '计算资源任务的统一查询、日志与控制入口',
      icon: 'IconFileSearch',
      tabbar: true,
      navVisible: true,
      parentId: 'compute-workbench',
      menuId: 'compute-workbench-tasks-operations',
      permissionKeysAny: [
        'compute.tasks.view',
        'virtualization.operations.view',
        'virtualization.sync.view',
        'virtualization.sync.manage',
        'docker.operations.view',
      ],
    },
    shell: 'app',
    load: async () => {
      const module = await import('./tasks/operations-page')
      return { default: module.ComputeOperationRecordsPage }
    },
  },
] as const)
