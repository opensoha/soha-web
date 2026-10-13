import type { WorkbenchAgentProvider, WorkbenchMode } from './types'

export function agentConnectionUnavailableReason(provider: WorkbenchAgentProvider | undefined) {
  if (!provider || !provider.enabled) return '助手未启用'
  if (provider.id === 'internal') return ''
  if (provider.runtimeStatus?.state !== 'ready')
    return provider.runtimeStatus?.reason || '运行器尚未就绪'
  return ''
}

export function agentUnavailableReason(
  provider: WorkbenchAgentProvider | undefined,
  mode: WorkbenchMode = 'general',
) {
  if (provider?.enabled && provider.id !== 'internal' && !provider.capabilities?.includes(mode))
    return '不支持当前任务'
  return agentConnectionUnavailableReason(provider)
}

export function preferredExternalAgent(
  providers: WorkbenchAgentProvider[],
  mode: WorkbenchMode = 'general',
) {
  const available = providers.filter(
    (provider) => provider.id !== 'internal' && !agentUnavailableReason(provider, mode),
  )
  return available.find((provider) => provider.default) ?? available[0]
}

export function taskAgentUnavailableReason(
  provider: WorkbenchAgentProvider | undefined,
  capabilities: WorkbenchMode[],
  hasQueryParameters = false,
) {
  const reason = capabilities.map((mode) => agentUnavailableReason(provider, mode)).find(Boolean)
  if (reason) return reason
  if (provider?.id !== 'internal' && (capabilities.length > 1 || hasQueryParameters))
    return '组合能力与查询参数需要内置助手'
  return agentUnavailableReason(provider, capabilities[0])
}
