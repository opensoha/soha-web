import { defineRoutes } from '@/routes/definitions'
import { identityApplicationRoutes } from './applications/routes'
import { identityOutpostRoutes } from './outposts/routes'
import { identityOverviewRoutes } from './overview/routes'
import { identityPolicyRoutes } from './policies/routes'
import { identityProviderRoutes } from './providers/routes'

export const identityParentRoutes = defineRoutes([
  {
    meta: {
      id: 'identity',
      path: '/identity',
      title: 'Identity',
      description: '身份工作台',
      icon: 'IconShield',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'identity',
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    redirectTo: '/identity/overview',
  },
] as const)

export const identityRouteManifests = [
  identityParentRoutes,
  identityOverviewRoutes,
  identityApplicationRoutes,
  identityProviderRoutes,
  identityOutpostRoutes,
  identityPolicyRoutes,
] as const
