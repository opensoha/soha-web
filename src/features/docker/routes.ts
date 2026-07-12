import { defineRoutes } from '@/routes/definitions'

export const dockerRoutes = defineRoutes([
  {
    meta: {
      id: 'docker-workbench',
      path: '/docker',
      title: 'Docker 工作台',
      description: 'Docker 主机、容器管理、模板与操作记录',
      icon: 'IconServer',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'docker-workbench',
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/docker/overview',
  },
  {
    meta: {
      id: 'docker-workbench-overview',
      path: '/docker/overview',
      title: '总览',
      description: 'Docker 主机、Compose 与端口暴露概览',
      icon: 'IconServer',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-overview',
      permissionKey: 'docker.overview.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview/page')
      return { default: module.DockerOverviewPage }
    },
  },
  {
    meta: {
      id: 'docker-workbench-hosts',
      path: '/docker/hosts',
      title: 'Docker 主机',
      description: 'Docker 主机接入与 PVE 快速构建',
      icon: 'IconServer',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-hosts',
      permissionKey: 'docker.hosts.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./hosts/page')
      return { default: module.DockerHostsPage }
    },
  },
  {
    meta: {
      id: 'docker-workbench-projects',
      path: '/docker/projects',
      title: '容器管理',
      description: 'Compose 项目、单容器服务与详情运维',
      icon: 'IconGridView',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./projects/list-page')
      return { default: module.DockerProjectsPage }
    },
  },
  {
    meta: {
      id: 'docker-workbench-project-detail',
      path: '/docker/projects/:projectId',
      title: '容器详情',
      description: '容器项目、服务、端口、Compose 与操作上下文',
      icon: 'IconGridView',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./projects/detail-page')
      return { default: module.DockerProjectDetailPage }
    },
  },
  {
    meta: {
      id: 'docker-workbench-services',
      path: '/docker/services',
      title: '容器服务',
      description: '已合并到容器管理',
      icon: 'IconGridView',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    redirectTo: '/docker/projects',
  },
  {
    meta: {
      id: 'docker-workbench-ports',
      path: '/docker/ports',
      title: '端口映射',
      description: '已合并到容器管理',
      icon: 'IconShare',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'docker-workbench-projects',
      permissionKey: 'docker.projects.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    redirectTo: '/docker/projects',
  },
  {
    meta: {
      id: 'docker-workbench-templates',
      path: '/docker/templates',
      title: '模板',
      description: 'Compose 模板与环境变量模板',
      icon: 'IconCode',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-templates',
      permissionKey: 'docker.templates.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./templates/page')
      return { default: module.DockerTemplatesPage }
    },
  },
  {
    meta: {
      id: 'docker-workbench-operations',
      path: '/docker/operations',
      title: '操作记录',
      description: 'Docker 主机构建、Compose 与服务操作记录',
      icon: 'IconFileSearch',
      group: 'docker',
      workbenchId: 'docker',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'docker-workbench',
      menuId: 'docker-workbench-operations',
      permissionKey: 'docker.operations.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./operations/page')
      return { default: module.DockerOperationsPage }
    },
  },
] as const)
