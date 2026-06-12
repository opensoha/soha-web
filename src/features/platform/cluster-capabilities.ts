import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api-client'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type {
  ApiResponse,
  Cluster,
  ClusterCapabilityMatrixEntry,
  ClusterCapabilityModeSupport,
  ClusterCapabilityRiskLevel,
  ClusterCapabilityStatus,
} from '@/types'

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
  return connectionMode === 'agent' ? 'agent' : 'direct'
}

function fallbackUnsupportedReason(localeCode: LocaleCode) {
  return localeCode === 'zh_CN'
    ? '当前集群连接模式暂不支持该操作。'
    : 'The current cluster connection mode does not support this operation.'
}

function notesFromSupport(support: ClusterCapabilityModeSupport | undefined) {
  return (support?.notes ?? []).map((item) => item.trim()).filter(Boolean)
}

export function evaluateClusterCapability({
  connectionMode,
  key,
  localeCode,
  matrix,
}: {
  connectionMode?: string
  key: string
  localeCode: LocaleCode
  matrix?: ClusterCapabilityMatrixEntry[]
}): ClusterCapabilityDecision {
  const mode = capabilityModeFor(connectionMode)
  const entry = (matrix ?? []).find((item) => item.key === key)
  if (!mode || !entry) {
    return {
      disabled: false,
      entry,
      isLoading: false,
      mode,
      notes: [],
      requiredScopes: [],
      requiresApproval: false,
      reason: '',
      status: 'unknown',
    }
  }

  const support = entry[mode]
  const notes = notesFromSupport(support)
  const disabled = support.status === 'unsupported'
  const reason = support.reason?.trim() || notes.join(' / ') || (disabled ? fallbackUnsupportedReason(localeCode) : '')

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
  const clustersQuery = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get<ApiResponse<Cluster[]>>('/clusters'),
    enabled: !!clusterId,
  })
  const capabilitiesQuery = useQuery({
    queryKey: ['clusters', 'capabilities'],
    queryFn: () => api.get<ApiResponse<ClusterCapabilityMatrixEntry[]>>('/clusters/capabilities'),
    enabled: !!clusterId,
  })

  const connectionMode = useMemo(
    () => (clustersQuery.data?.data ?? []).find((item) => item.id === clusterId)?.connectionMode,
    [clusterId, clustersQuery.data?.data],
  )

  return useMemo(
    () => ({
      ...evaluateClusterCapability({
        connectionMode,
        key,
        localeCode,
        matrix: capabilitiesQuery.data?.data,
      }),
      isLoading: clustersQuery.isLoading || capabilitiesQuery.isLoading,
    }),
    [
      capabilitiesQuery.data?.data,
      capabilitiesQuery.isLoading,
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
