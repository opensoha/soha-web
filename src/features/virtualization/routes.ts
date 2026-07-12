import { defineRoutes } from '@/routes/definitions'

export const virtualizationRoutes = defineRoutes([
  {
    meta: {
      id: 'virtualization-workbench',
      path: '/virtualization',
      title: '虚拟化管理工作台',
      description: '虚拟化资源总览、虚拟机、集群、镜像、规格与操作记录',
      icon: 'IconServer',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'virtualization-workbench',
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/virtualization/overview',
  },
  {
    meta: {
      id: 'virtualization-workbench-overview',
      path: '/virtualization/overview',
      title: '总览',
      description: '虚拟化资源接入状态与后续目标',
      icon: 'IconServer',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-overview',
      permissionKey: 'virtualization.overview.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview/page')
      return { default: module.VirtualizationOverviewPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-vms',
      path: '/virtualization/vms',
      title: '虚拟机',
      description: '虚拟机实例入口',
      icon: 'IconServer',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-vms',
      permissionKey: 'virtualization.vms.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./virtual-machines/list-page')
      return { default: module.VirtualizationVmsPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-vm-detail',
      path: '/virtualization/vms/:id',
      title: '虚拟机详情',
      description: '虚拟机规格、镜像、网络和任务详情',
      icon: 'IconServer',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'virtualization-workbench-vms',
      permissionKey: 'virtualization.vms.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./virtual-machines/detail-page')
      return { default: module.VirtualizationVmDetailPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-clusters',
      path: '/virtualization/clusters',
      title: '集群',
      description: '虚拟化连接与集群入口',
      icon: 'IconServer',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-clusters',
      permissionKey: 'virtualization.clusters.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./clusters/list-page')
      return { default: module.VirtualizationClustersPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-images',
      path: '/virtualization/images',
      title: '镜像',
      description: '虚拟机镜像入口',
      icon: 'IconInbox',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-images',
      permissionKey: 'virtualization.images.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./images/list-page')
      return { default: module.VirtualizationImagesPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-flavors',
      path: '/virtualization/flavors',
      title: '规格',
      description: '虚拟机规格入口',
      icon: 'IconGridView',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-flavors',
      permissionKey: 'virtualization.flavors.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./flavors/list-page')
      return { default: module.VirtualizationFlavorsPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-operations',
      path: '/virtualization/operations',
      title: '操作记录',
      description: '虚拟化操作记录入口',
      icon: 'IconFileSearch',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-operations',
      permissionKey: 'virtualization.operations.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./operations/page')
      return { default: module.VirtualizationOperationsPage }
    },
  },
  {
    meta: {
      id: 'virtualization-workbench-sync',
      path: '/virtualization/sync',
      title: '同步任务',
      description: '虚拟化资产同步任务',
      icon: 'IconFileSearch',
      group: 'virtualization',
      workbenchId: 'virtualization',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'virtualization-workbench',
      menuId: 'virtualization-workbench-sync',
      permissionKey: 'virtualization.sync.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./sync/page')
      return { default: module.VirtualizationSyncPage }
    },
  },
] as const)
