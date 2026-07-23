import { defineRoutes } from '@/routes/definitions'

export const identityPolicyRoutes = defineRoutes([
  {
    meta: {
      id: 'identity-policies',
      path: '/identity/policies',
      title: 'Policies',
      description: 'Provider Portal 访问策略兼容入口',
      icon: 'IconShield',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'identity',
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
