import { defineRoutes } from '@/routes/definitions'

export const identityOverviewRoutes = defineRoutes([
  {
    meta: {
      id: 'identity-overview',
      path: '/identity/overview',
      title: 'Overview',
      description: '身份工作台总览',
      icon: 'IconDesktop',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'identity',
      menuId: 'identity-overview',
      permissionKeysAny: [
        'identity.applications.view',
        'identity.providers.view',
        'identity.outposts.view',
        'identity.policies.view',
        'identity.audit.view',
      ],
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./page')
      return { default: module.IdentityOverviewPage }
    },
  },
] as const)
