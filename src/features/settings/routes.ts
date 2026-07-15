import { defineRoutes } from '@/routes/definitions'

export const settingsRoutes = defineRoutes([
  {
    meta: {
      id: 'settings',
      path: '/settings',
      title: '设置中心',
      description: '登陆与品牌配置',
      icon: 'IconSetting',
      group: 'settings',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      menuId: 'settings',
      workbenchId: 'settings',
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'system',
    },
    shell: 'app',
    permissionExemptReason: 'Settings center visibility is resolved from accessible child menus.',
    load: async () => {
      const module = await import('./center/page')
      return { default: module.SettingsCenterPage }
    },
  },
  {
    meta: {
      id: 'settings-login',
      path: '/settings/login',
      title: '登陆设置',
      description: 'OIDC、OAuth2 与 SAML 登录配置',
      icon: 'IconSetting',
      group: 'settings',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'settings',
      menuId: 'settings-login',
      permissionKey: 'settings.identity.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./identity/page')
      return { default: module.LoginSettingsPage }
    },
  },
  {
    meta: {
      id: 'settings-branding',
      path: '/settings/branding',
      title: '品牌设置',
      description: '品牌 Logo 与标题配置',
      icon: 'IconSetting',
      group: 'settings',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'settings',
      menuId: 'settings-branding',
      permissionKey: 'settings.branding.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./branding/page')
      return { default: module.BrandingSettingsPage }
    },
  },
  {
    meta: {
      id: 'settings-about',
      path: '/settings/about',
      title: '关于',
      description: 'OpenSoha 版本与项目信息',
      icon: 'IconInfoCircle',
      group: 'settings',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      parentId: 'settings',
      menuId: 'settings-about',
      scopeMode: 'passive',
    },
    shell: 'app',
    permissionExemptReason: 'About is intentionally available through its visible settings menu.',
    load: async () => {
      const module = await import('./about/page')
      return { default: module.AboutSettingsPage }
    },
  },
] as const)
