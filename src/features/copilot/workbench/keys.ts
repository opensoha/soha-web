export const workbenchKeys = {
  sessions: {
    all: () => ['copilot-workbench-sessions'] as const,
    detail: (sessionId?: string) => ['copilot-workbench-session-detail', sessionId] as const,
    messages: (sessionId?: string) => ['copilot-workbench-messages', sessionId] as const,
  },
  catalog: () => ['copilot-workbench-catalog'] as const,
  agentRuns: {
    all: () => ['copilot-agent-runs'] as const,
    session: (sessionId?: string) => ['copilot-agent-runs', sessionId] as const,
  },
}

export const workbenchMutationKeys = {
  sessions: (action: string) => ['copilot', 'workbench', 'sessions', action] as const,
}
