import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type {
  ClusterCapabilityMatrixEntry,
  ClusterCapabilityModeSupport,
  ClusterCapabilityRiskLevel,
  ClusterCapabilityStatus,
} from '@/types'
import { clusterQueries } from './clusters/queries'

type CapabilityMode = 'direct' | 'agent'
type LocaleCode = 'zh_CN' | 'en_US'

export interface ClusterCapabilityDecision {
  disabled: boolean
  entry?: ClusterCapabilityMatrixEntry
  isLoading: boolean
  mode?: CapabilityMode
  notes: string[]
  requiredScopes: string[]
  requiresApproval: boolean
  reason: string
  riskLevel?: ClusterCapabilityRiskLevel
  docsUrl?: string
  status: ClusterCapabilityStatus | 'unknown'
}

function capabilityModeFor(connectionMode?: string): CapabilityMode | undefined {
  if (!connectionMode) return undefined
  if (connectionMode === 'agent') return 'agent'
  if (connectionMode === 'direct' || connectionMode === 'direct_kubeconfig') return 'direct'
  return undefined
}

function fallbackUnsupportedReason(localeCode: LocaleCode) {
  return localeCode === 'zh_CN'
    ? '当前集群连接模式暂不支持该操作。'
    : 'The current cluster connection mode does not support this operation.'
}

function fallbackUnknownReason(localeCode: LocaleCode, isLoading: boolean) {
  if (isLoading) {
    return localeCode === 'zh_CN'
      ? '正在确认当前集群的运行能力。'
      : 'Checking the current cluster capabilities.'
  }
  return localeCode === 'zh_CN'
    ? '暂时无法确认当前集群是否支持该操作。'
    : 'Unable to confirm whether the current cluster supports this operation.'
}

function notesFromSupport(support: ClusterCapabilityModeSupport | undefined) {
  return (support?.notes ?? []).map((item) => item.trim()).filter(Boolean)
}

export function evaluateClusterCapability({
  connectionMode,
  key,
  localeCode,
  matrix,
  isError = false,
  isLoading = false,
}: {
  connectionMode?: string
  key: string
  localeCode: LocaleCode
  matrix?: ClusterCapabilityMatrixEntry[]
  isError?: boolean
  isLoading?: boolean
}): ClusterCapabilityDecision {
  const mode = capabilityModeFor(connectionMode)
  const entry = (matrix ?? []).find((item) => item.key === key)
  if (isLoading || isError || !mode || !entry) {
    return {
      disabled: true,
      entry,
      isLoading,
      mode,
      notes: [],
      requiredScopes: [],
      requiresApproval: false,
      reason: fallbackUnknownReason(localeCode, isLoading),
      status: 'unknown',
    }
  }

  const support = entry[mode]
  const notes = notesFromSupport(support)
  const disabled = support.status === 'unsupported'
  const reason =
    support.reason?.trim() ||
    notes.join(' / ') ||
    (disabled ? fallbackUnsupportedReason(localeCode) : '')

  return {
    disabled,
    entry,
    isLoading: false,
    mode,
    notes,
    requiredScopes: entry.requiredScopes ?? [],
    requiresApproval: entry.requiresApproval,
    reason,
    riskLevel: entry.riskLevel,
    docsUrl: entry.docsUrl,
    status: support.status,
  }
}

export function useClusterCapability(
  key: string,
  localeCode: LocaleCode,
): ClusterCapabilityDecision {
  const { clusterId } = usePlatformScopeStore()
  return useClusterCapabilityForCluster(key, localeCode, clusterId)
}

export function useClusterCapabilityForCluster(
  key: string,
  localeCode: LocaleCode,
  clusterId?: string | null,
): ClusterCapabilityDecision {
  const clustersQuery = useQuery({ ...clusterQueries.list(), enabled: !!clusterId })
  const capabilitiesQuery = useQuery({ ...clusterQueries.capabilities(), enabled: !!clusterId })

  const connectionMode = useMemo(
    () => (clustersQuery.data ?? []).find((item) => item.id === clusterId)?.connectionMode,
    [clusterId, clustersQuery.data],
  )

  return useMemo(
    () => ({
      ...evaluateClusterCapability({
        connectionMode,
        key,
        localeCode,
        matrix: capabilitiesQuery.data,
        isError: clustersQuery.isError || capabilitiesQuery.isError,
        isLoading: clustersQuery.isLoading || capabilitiesQuery.isLoading,
      }),
    }),
    [
      capabilitiesQuery.data,
      capabilitiesQuery.isError,
      capabilitiesQuery.isLoading,
      clustersQuery.isError,
      clustersQuery.isLoading,
      connectionMode,
      key,
      localeCode,
    ],
  )
}

export function capabilityActionTooltip(label: string, capability: ClusterCapabilityDecision) {
  return capability.reason ? `${label}: ${capability.reason}` : label
}
