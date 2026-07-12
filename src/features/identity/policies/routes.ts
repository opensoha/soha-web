import { defineRoutes } from '@/routes/definitions'

export const identityPolicyRoutes = defineRoutes([
  {
    meta: {
      id: 'identity-policies',
      path: '/identity/policies',
      title: 'Policies',
      description: 'Provider Portal 访问策略',
      icon: 'IconShield',
      group: 'identity',
      workbenchId: 'settings',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'identity',
      menuId: 'identity-policies',
      permissionKey: 'identity.policies.view',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./list-page')
      return { default: module.IdentityPoliciesPage }
    },
  },
] as const)
