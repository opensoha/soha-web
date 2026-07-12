import { defineRoutes } from '@/routes/definitions'

export const copilotObserveRoutes = defineRoutes([
  {
    meta: {
      id: 'ai-workbench',
      path: '/ai-workbench',
      title: 'AI工作台',
      description: 'AI 对话、分析与巡检入口',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: true,
      menuId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
  {
    meta: {
      id: 'ai-workbench-chat',
      path: '/ai-workbench/chat',
      title: '通用聊天',
      description: '通用会话与问答排障',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-chat',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../workbench/pages/chat-page')
      return { default: module.AIWorkbenchChatPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-root-cause',
      path: '/ai-workbench/root-cause',
      title: '根因分析',
      description: '围绕告警、事件和异常做根因分析',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-chat',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../workbench/pages/root-cause-page')
      return { default: module.AIWorkbenchRootCausePage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-performance',
      path: '/ai-workbench/performance',
      title: '性能分析',
      description: '聚焦容量、时延和吞吐分析',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-chat',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../workbench/pages/performance-page')
      return { default: module.AIWorkbenchPerformancePage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-inspection',
      path: '/ai-workbench/inspection',
      title: '巡检',
      description: '巡检任务、运行记录与自动化策略',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-inspection',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./operations/page')
      return { default: module.AIOperationsPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-tool-settings',
      path: '/ai-workbench/tool-settings',
      title: '工具与技能',
      description: '查看并配置工具、技能与数据源',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-tool-settings',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./tools/page')
      return { default: module.AIToolsPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-model-settings',
      path: '/ai-workbench/model-settings',
      title: 'AI 设置',
      description: '选择 Workbench 默认模型、数据源、技能与自动化策略',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-model-settings',
      permissionKey: 'settings.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./model-settings/page')
      return { default: module.AIModelSettingsPage }
    },
  },
] as const)

export const copilotObserveCompatibilityRoutes = defineRoutes([
  {
    meta: {
      id: 'ai-workbench-automation-compat',
      path: '/ai-workbench/automation',
      title: '巡检与自动化',
      description: '兼容旧自动化入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchOperationsRedirect }
    },
  },
  {
    meta: {
      id: 'ai-workbench-tools',
      path: '/ai-workbench/tools',
      title: '工具与技能',
      description: '兼容旧入口，跳转到工具与技能设置',
      icon: 'IconComment',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-tool-settings',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchToolsRedirect }
    },
  },
  {
    meta: {
      id: 'ai-workbench-investigation',
      path: '/ai-workbench/investigation',
      title: 'AI 会话入口',
      description: '兼容旧入口，跳转到通用聊天',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
  {
    meta: {
      id: 'ai-observe-compat',
      path: '/ai-observe',
      title: 'Ai可观测性',
      description: '兼容旧入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
  {
    meta: {
      id: 'ai-observe-workbench-compat',
      path: '/ai-observe/workbench',
      title: '旧调查入口',
      description: '兼容旧入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
  {
    meta: {
      id: 'ai-observe-operations-compat',
      path: '/ai-observe/operations',
      title: '旧巡检入口',
      description: '兼容旧入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchOperationsRedirect }
    },
  },
  {
    meta: {
      id: 'ai-observe-tools-compat',
      path: '/ai-observe/tools',
      title: '旧工具入口',
      description: '兼容旧入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchToolsRedirect }
    },
  },
  {
    meta: {
      id: 'ai-root-cause',
      path: '/ai-observe/root-cause',
      title: '链路根因分析',
      description: '兼容旧入口，跳转到工作台根因模式',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchRootCauseRedirect }
    },
  },
  {
    meta: {
      id: 'ai-performance',
      path: '/ai-observe/performance',
      title: '性能分析',
      description: '兼容旧入口，跳转到工作台性能模式',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchPerformanceRedirect }
    },
  },
  {
    meta: {
      id: 'ai-chat',
      path: '/ai-observe/chat',
      title: 'AI Chat',
      description: '兼容旧入口，跳转到通用聊天',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
  {
    meta: {
      id: 'ai-inspection',
      path: '/ai-observe/inspection',
      title: '智能巡检',
      description: '兼容旧入口，跳转到巡检与自动化',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchOperationsRedirect }
    },
  },
  {
    meta: {
      id: 'chat',
      path: '/chat',
      title: 'AI Chat',
      description: '兼容旧入口',
      icon: 'IconComment',
      group: 'observe',
      requiresAuth: true,
      tabbar: false,
      navVisible: false,
      parentId: 'ai-workbench',
      permissionKey: 'observe.ai.chat',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./redirects')
      return { default: module.AIWorkbenchModeRedirect }
    },
  },
] as const)

export const copilotObserveRouteManifests = [
  copilotObserveRoutes,
  copilotObserveCompatibilityRoutes,
] as const
