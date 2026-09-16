import type { WorkbenchAgentProvider, WorkbenchMode } from './types'

export function agentUnavailableReason(
  provider: WorkbenchAgentProvider | undefined,
  mode: WorkbenchMode = 'general',
) {
  if (!provider || !provider.enabled) return '助手未启用'
  if (provider.id === 'internal') return ''
  if (!provider.capabilities?.includes(mode)) return '不支持当前任务'
  if (provider.runtimeStatus?.state !== 'ready')
    return provider.runtimeStatus?.reason || '运行器尚未就绪'
  return ''
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
