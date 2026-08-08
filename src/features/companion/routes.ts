import { defineRoutes } from '@/routes/definitions'

export const companionRoutes = defineRoutes([
  {
    meta: {
      id: 'companion-window',
      path: '/companion',
      title: '桌面宠物',
      description: '桌面宠物窗口',
      icon: 'IconRobot',
      group: 'ai',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      permissionKey: 'observe.ai.chat',
      scopeMode: 'hidden',
      workspace: 'system',
    },
    shell: 'portal',
    load: async () => {
      const module = await import('./window-page')
      return { default: module.CompanionWindowPage }
    },
  },
] as const)
