import { defineRoutes } from '@/routes/definitions'
import { copilotObserveRouteManifests } from './observe/routes'

export const copilotGatewayRoutes = defineRoutes([
  {
    meta: {
      id: 'ai-gateway',
      path: '/ai-gateway',
      title: 'AI Gateway',
      description: 'AI 工作台中的模型接入与治理能力',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      redirectTo: '/ai-workbench/overview',
      menuId: 'ai-gateway',
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    permissionExemptReason: 'Redirect-only route; child routes enforce Gateway permissions.',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayRedirectPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-overview',
      path: '/ai-gateway/overview',
      title: '概览',
      description: 'AI Gateway 能力、身份与治理摘要',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      redirectTo: '/ai-workbench/overview',
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-overview',
      permissionKey: 'ai.gateway.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayOverviewRedirectPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-relay',
      path: '/ai-gateway/relay',
      title: '模型中转',
      description: '管理 AI Gateway 模型中转、上游、模型路由与模型调用日志',
      icon: 'IconLink',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-relay',
      permissionKeysAny: ['ai.gateway.relay.view', 'ai.gateway.relay.manage'],
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/relay-page')
      return { default: module.AIGatewayRelayPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-upstreams',
      path: '/ai-gateway/upstreams',
      title: '上游管理',
      description: '模型中转上游管理入口',
      icon: 'IconLink',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      redirectTo: '/ai-gateway/relay?tab=upstreams',
      parentId: 'ai-gateway-relay',
      menuId: 'ai-gateway-relay',
      permissionKey: 'ai.gateway.relay.manage',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayUpstreamsRedirectPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-model-routes',
      path: '/ai-gateway/model-routes',
      title: '模型路由',
      description: '模型中转路由管理入口',
      icon: 'IconLink',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      redirectTo: '/ai-gateway/relay?tab=model-routes',
      parentId: 'ai-gateway-relay',
      menuId: 'ai-gateway-relay',
      permissionKey: 'ai.gateway.relay.manage',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayModelRoutesRedirectPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-manifest',
      path: '/ai-gateway/manifest',
      title: '能力清单',
      description: '查看当前身份可见的 MCP tools、resources、prompts 和 skills',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-manifest',
      permissionKey: 'ai.gateway.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/manifest-page')
      return { default: module.AIGatewayManifestPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-clients',
      path: '/ai-gateway/clients',
      title: 'AI Clients',
      description: '管理外部 AI 客户端注册入口',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-clients',
      permissionKey: 'ai.gateway.manage',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/clients-page')
      return { default: module.AIGatewayClientsPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-tokens',
      path: '/ai-gateway/tokens',
      title: 'Tokens',
      description: '管理 personal access tokens 与服务账号 token',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-tokens',
      permissionKeysAny: ['ai.gateway.view', 'ai.gateway.invoke', 'ai.gateway.manage'],
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/tokens-page')
      return { default: module.AIGatewayTokensPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-governance',
      path: '/ai-gateway/governance',
      title: 'Governance',
      description: '管理 Gateway 授权、策略与审批治理',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-governance',
      permissionKey: 'ai.gateway.manage',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/governance-page')
      return { default: module.AIGatewayGovernancePage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-call-logs',
      path: '/ai-gateway/call-logs',
      title: '调用日志',
      description: '查看 AI Gateway 调用者、调用内容与结果',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-gateway',
      menuId: 'ai-gateway-call-logs',
      permissionKey: 'ai.gateway.manage',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/pages/call-logs-page')
      return { default: module.AIGatewayCallLogsPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-gateway-compat',
      path: '/ai-workbench/gateway',
      title: 'AI Gateway',
      description: '兼容旧入口，跳转到 AI 工作台的模型与接入能力',
      icon: 'IconShield',
      group: 'ai-gateway',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      redirectTo: '/ai-workbench/overview',
      menuId: 'ai-gateway',
      permissionKeysAny: ['ai.gateway.view', 'ai.gateway.invoke', 'ai.gateway.manage'],
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayRedirectPage }
    },
  },
  {
    meta: {
      id: 'ai-gateway-wildcard',
      path: '/ai-gateway/*',
      title: 'AI Gateway',
      description: 'AI Gateway 未知入口回退',
      requiresAuth: true,
      navVisible: false,
    },
    shell: 'app',
    wildcard: true,
    inheritMetaFrom: 'ai-gateway',
    load: async () => {
      const module = await import('./gateway/redirects')
      return { default: module.AIGatewayWildcardRedirectPage }
    },
  },
] as const)

export const copilotRouteManifests = [
  ...copilotObserveRouteManifests,
  copilotGatewayRoutes,
] as const
