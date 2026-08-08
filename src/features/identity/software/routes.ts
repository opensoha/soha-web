import { defineRoutes } from '@/routes/definitions'

export const internalWorkbenchSoftwareRoutes = defineRoutes([
  {
    meta: {
      id: 'internal-workbench-software',
      path: '/internal-workbench/software',
      title: 'Software Library',
      description: '软件库',
      icon: 'IconGridView',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'internal-workbench',
      menuId: 'identity-software',
      permissionKey: 'software.package.view',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./page')
      return { default: module.SoftwareLibraryPage }
    },
  },
  {
    meta: {
      id: 'internal-workbench-software-storage',
      path: '/internal-workbench/software-storage',
      title: 'Software Storage',
      description: '存储文件',
      icon: 'IconServer',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'internal-workbench',
      menuId: 'identity-software-storage',
      permissionKey: 'software.package.view',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./storage-page')
      return { default: module.SoftwareStoragePage }
    },
  },
] as const)
