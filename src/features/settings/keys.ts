export const settingsKeys = {
  all: ['settings'] as const,
  branding: {
    all: ['settings', 'branding'] as const,
    detail: () => ['settings', 'branding', 'detail'] as const,
  },
  identity: {
    all: ['settings', 'identity'] as const,
    detail: () => ['settings', 'identity', 'detail'] as const,
  },
  monitoring: {
    all: ['settings', 'monitoring'] as const,
    detail: () => ['settings', 'monitoring', 'detail'] as const,
  },
  ai: {
    all: ['settings', 'ai'] as const,
    detail: () => ['settings', 'ai', 'detail'] as const,
    modelRoutes: () => ['settings', 'ai', 'model-routes'] as const,
    dataSources: () => ['settings', 'ai', 'data-sources'] as const,
    analysisProfiles: () => ['settings', 'ai', 'analysis-profiles'] as const,
    automationPolicies: () => ['settings', 'ai', 'automation-policies'] as const,
    dataSourceCapabilities: () => ['settings', 'ai', 'data-source-capabilities'] as const,
    workbenchCatalog: () => ['settings', 'ai', 'workbench-catalog'] as const,
    agentRuns: () => ['settings', 'ai', 'agent-runs'] as const,
  },
}

export const settingsMutationKeys = {
  branding: (action: 'save' | 'upload') => ['settings', 'branding', 'mutation', action] as const,
  identity: (action: 'save') => ['settings', 'identity', 'mutation', action] as const,
  monitoring: (action: 'save') => ['settings', 'monitoring', 'mutation', action] as const,
  ai: (action: string) => ['settings', 'ai', 'mutation', action] as const,
}
