import { defineRoutes } from '@/routes/definitions'

export const authRoutes = defineRoutes([
  {
    meta: {
      id: 'login',
      path: '/login',
      title: '登录',
      description: '用户登录',
      icon: 'IconLock',
      group: 'auth',
      requiresAuth: false,
      tabbar: false,
      navVisible: false,
      scopeMode: 'hidden',
    },
    shell: 'public',
    load: async () => {
      const module = await import('./login-page')
      return { default: module.LoginPage }
    },
  },
] as const)

export const authUtilityRoutes = defineRoutes([
  {
    meta: {
      id: 'account-profile',
      path: '/account/profile',
      title: '个人中心',
      description: '当前账号资料、登录安全与 AI Gateway key',
      icon: 'IconUser',
      group: 'settings',
      workbenchId: 'settings',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      parentId: 'settings',
      menuId: 'account-profile',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    permissionExemptReason: 'Every authenticated user can manage their own account profile.',
    load: async () => {
      const module = await import('./user-profile-page')
      return { default: module.UserProfilePage }
    },
  },
  {
    meta: {
      id: 'oidc-callback',
      path: '/auth/oidc/callback',
      title: 'OIDC Callback',
      description: 'OIDC 回调',
      icon: 'IconLock',
      group: 'auth',
      requiresAuth: false,
      tabbar: false,
      navVisible: false,
      scopeMode: 'hidden',
    },
    shell: 'public',
    load: async () => {
      const module = await import('./oidc-callback-page')
      return { default: module.OIDCCallbackPage }
    },
  },
  {
    meta: {
      id: 'login-callback',
      path: '/login/callback',
      title: 'Login Callback',
      description: '登录回调',
      icon: 'IconLock',
      group: 'auth',
      requiresAuth: false,
      tabbar: false,
      navVisible: false,
      scopeMode: 'hidden',
    },
    shell: 'public',
    load: async () => {
      const module = await import('./oidc-callback-page')
      return { default: module.OIDCCallbackPage }
    },
  },
] as const)
