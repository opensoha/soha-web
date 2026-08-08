import { describe, expect, it } from 'vitest'
import { evaluateClusterCapability } from './cluster-capabilities'
import type { ClusterCapabilityMatrixEntry } from '@/types'

const matrix: ClusterCapabilityMatrixEntry[] = [
  {
    key: 'resource.yaml.apply',
    label: 'YAML apply and delete',
    category: 'configuration',
    requiredScopes: ['cluster', 'namespace'],
    riskLevel: 'mutate',
    requiresApproval: true,
    docsUrl: '/operations/agent-runtime',
    direct: { status: 'available' },
    agent: {
      status: 'unsupported',
      reason: 'Agent mode cannot apply YAML yet',
      notes: ['YAML apply and delete are not supported for agent-connected clusters yet'],
    },
  },
  {
    key: 'workload.mutations',
    label: 'Workload mutations',
    category: 'workloads',
    requiredScopes: ['cluster', 'namespace'],
    riskLevel: 'mutate',
    requiresApproval: true,
    docsUrl: '/architecture/authorization',
    direct: { status: 'available' },
    agent: {
      status: 'partial',
      notes: ['deployment restart, rollback, and scale are available through the agent'],
    },
  },
]

describe('evaluateClusterCapability', () => {
  it('disables unsupported agent capabilities and exposes backend notes', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'agent',
      key: 'resource.yaml.apply',
      localeCode: 'en_US',
      matrix,
    })

    expect(decision.status).toBe('unsupported')
    expect(decision.disabled).toBe(true)
    expect(decision.reason).toBe('Agent mode cannot apply YAML yet')
    expect(decision.requiredScopes).toEqual(['cluster', 'namespace'])
    expect(decision.riskLevel).toBe('mutate')
    expect(decision.requiresApproval).toBe(true)
    expect(decision.docsUrl).toBe('/operations/agent-runtime')
  })

  it('keeps partial capabilities enabled while preserving notes for UI hints', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'agent',
      key: 'workload.mutations',
      localeCode: 'en_US',
      matrix,
    })

    expect(decision.status).toBe('partial')
    expect(decision.disabled).toBe(false)
    expect(decision.reason).toContain('deployment restart')
    expect(decision.requiresApproval).toBe(true)
  })

  it('disables unknown capabilities until the matrix is available', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'agent',
      key: 'missing.capability',
      localeCode: 'zh_CN',
      matrix,
    })

    expect(decision.status).toBe('unknown')
    expect(decision.disabled).toBe(true)
    expect(decision.reason).toContain('暂时无法确认')
    expect(decision.requiredScopes).toEqual([])
    expect(decision.requiresApproval).toBe(false)
  })

  it('disables cached capabilities when the capability query fails', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'direct_kubeconfig',
      key: 'workload.mutations',
      localeCode: 'en_US',
      matrix,
      isError: true,
    })

    expect(decision.status).toBe('unknown')
    expect(decision.disabled).toBe(true)
    expect(decision.reason).toContain('Unable to confirm')
  })

  it('disables actions while capability data is loading', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'agent',
      key: 'workload.mutations',
      localeCode: 'en_US',
      matrix,
      isLoading: true,
    })

    expect(decision.disabled).toBe(true)
    expect(decision.isLoading).toBe(true)
    expect(decision.reason).toContain('Checking')
  })

  it('does not treat an unrecognized connection mode as direct access', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'future-mode',
      key: 'workload.mutations',
      localeCode: 'en_US',
      matrix,
    })

    expect(decision.status).toBe('unknown')
    expect(decision.disabled).toBe(true)
  })
})
