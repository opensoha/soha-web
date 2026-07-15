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
      permissionStrategy: 'any-child',
      scopeMode: 'passive',
      workspace: 'resource',
    },
    shell: 'app',
    redirectTo: '/ai-workbench/overview',
    permissionExemptReason:
      'Redirect-only workbench root; accessible child routes enforce permissions.',
  },
  {
    meta: {
      id: 'ai-workbench-overview',
      path: '/ai-workbench/overview',
      title: '总览',
      description: 'AI 能力、运行状态与治理摘要',
      icon: 'IconGauge',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-overview',
      permissionKeysAny: [
        'observe.ai.view',
        'observe.ai.chat',
        'ai.knowledge.view',
        'ai.context.inspect',
        'ai.evaluations.view',
        'ai.evaluations.manage',
        'ai.gateway.view',
        'ai.gateway.invoke',
        'ai.gateway.manage',
        'ai.gateway.relay.view',
      ],
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('./overview/page')
      return { default: module.AIObserveOverviewPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-knowledge',
      path: '/ai-workbench/knowledge',
      title: 'Knowledge Center',
      description: '知识库、来源、索引与检索验证',
      icon: 'IconBook',
      group: 'knowledge',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-knowledge',
      permissionKey: 'ai.knowledge.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../knowledge/page')
      return { default: module.KnowledgeCenterPage }
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
      navVisible: false,
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
      navVisible: false,
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
      id: 'ai-workbench-agent-runs',
      path: '/ai-workbench/agent-runs',
      title: 'Agent Runs',
      description: 'Agent 运行记录、状态与能力绑定',
      icon: 'IconHistory',
      group: 'observe',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-agent-runs',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../agent-runs/page')
      return { default: module.AgentRunsPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-context',
      path: '/ai-workbench/context',
      title: 'Context Inspector',
      description: '检查 Prompt、RAG、工具、环境与预算组成',
      icon: 'IconInspect',
      group: 'context',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-context',
      permissionKey: 'ai.context.inspect',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../context/page')
      return { default: module.ContextInspectorPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-evaluations',
      path: '/ai-workbench/evaluations',
      title: 'Evaluation',
      description: '固定数据集、候选版本与确定性评测指标',
      icon: 'IconInspect',
      group: 'evaluation',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-evaluations',
      permissionKeysAny: ['ai.evaluations.view', 'ai.evaluations.manage'],
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../evaluation/page')
      return { default: module.EvaluationStudioPage }
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
  {
    meta: {
      id: 'ai-workbench-agent-providers',
      path: '/ai-workbench/agent-providers',
      title: 'Agent Providers',
      description: 'Provider Adapter、运行状态与插件市场接入',
      icon: 'IconPlugin',
      group: 'agent',
      workbenchId: 'ai',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'ai-workbench',
      menuId: 'ai-workbench-agent-providers',
      permissionKey: 'observe.ai.view',
      scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => {
      const module = await import('../agent-providers/page')
      return { default: module.AgentProvidersPage }
    },
  },
  {
    meta: {
      id: 'ai-workbench-knowledge-pipelines', path: '/ai-workbench/knowledge-pipelines',
      title: 'Knowledge Pipelines', description: 'Connector、异步 Ingestion、Revision 与 Retrieval Playground',
      icon: 'IconBook', group: 'knowledge', workbenchId: 'ai', requiresAuth: true, tabbar: true,
      navVisible: true, parentId: 'ai-workbench', menuId: 'ai-workbench-knowledge-pipelines',
      permissionKeysAny: ['ai.knowledge.connectors.view', 'ai.knowledge.ingestion.operate'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../knowledge-production/page'); return { default: module.KnowledgeProductionPage } },
  },
  {
    meta: {
      id: 'ai-workbench-environments', path: '/ai-workbench/environments', title: 'Agent Environments',
      description: 'Environment Template、Lease、Quota、Snapshot 与 GC', icon: 'IconPlugin', group: 'agent',
      workbenchId: 'ai', requiresAuth: true, tabbar: true, navVisible: true, parentId: 'ai-workbench',
      menuId: 'ai-workbench-environments', permissionKeysAny: ['ai.environments.view', 'ai.environments.manage'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../environments/page'); return { default: module.EnvironmentsPage } },
  },
  {
    meta: {
      id: 'ai-workbench-provider-fleet', path: '/ai-workbench/provider-fleet', title: 'Provider Fleet',
      description: 'Fleet rollout、canary、LKG 与 conformance', icon: 'IconPlugin', group: 'agent', workbenchId: 'ai',
      requiresAuth: true, tabbar: true, navVisible: true, parentId: 'ai-workbench', menuId: 'ai-workbench-provider-fleet',
      permissionKeysAny: ['ai.agent-fleet.view', 'ai.agent-fleet.manage'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../provider-fleet/page'); return { default: module.ProviderFleetPage } },
  },
  {
    meta: {
      id: 'ai-workbench-evaluation-lifecycle', path: '/ai-workbench/evaluation-lifecycle', title: 'Evaluation Lifecycle',
      description: 'Candidate Executor、Replay、Feedback 与 Release Gate', icon: 'IconInspect', group: 'evaluation',
      workbenchId: 'ai', requiresAuth: true, tabbar: true, navVisible: true, parentId: 'ai-workbench',
      menuId: 'ai-workbench-evaluation-lifecycle', permissionKeysAny: ['ai.evaluations.execute', 'ai.evaluations.gates.manage', 'ai.evaluations.feedback.curate'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../evaluation-lifecycle/page'); return { default: module.EvaluationLifecyclePage } },
  },
  {
    meta: {
      id: 'ai-workbench-memory', path: '/ai-workbench/memory', title: 'Memory Policies',
      description: '长期 Memory 的同意、TTL、来源与删除传播', icon: 'IconInspect', group: 'context', workbenchId: 'ai',
      requiresAuth: true, tabbar: true, navVisible: true, parentId: 'ai-workbench', menuId: 'ai-workbench-memory',
      permissionKeysAny: ['ai.memory.view', 'ai.memory.manage'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../memory/page'); return { default: module.MemoryPoliciesPage } },
  },
  {
    meta: {
      id: 'ai-workbench-production-operations', path: '/ai-workbench/production-operations', title: 'AI Operations',
      description: '容量、SLO、备份恢复、重建与 runbook evidence', icon: 'IconGauge', group: 'observe', workbenchId: 'ai',
      requiresAuth: true, tabbar: true, navVisible: true, parentId: 'ai-workbench', menuId: 'ai-workbench-production-operations',
      permissionKeysAny: ['ai.operations.view', 'ai.operations.manage'], scopeMode: 'passive',
    },
    shell: 'app',
    load: async () => { const module = await import('../production-operations/page'); return { default: module.AIProductionOperationsPage } },
  },
] as const)

export const copilotObserveRouteManifests = [
  copilotObserveRoutes,
] as const
