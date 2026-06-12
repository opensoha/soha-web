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

  it('keeps unknown capabilities enabled until the matrix is available', () => {
    const decision = evaluateClusterCapability({
      connectionMode: 'agent',
      key: 'missing.capability',
      localeCode: 'zh_CN',
      matrix,
    })

    expect(decision.status).toBe('unknown')
    expect(decision.disabled).toBe(false)
    expect(decision.reason).toBe('')
    expect(decision.requiredScopes).toEqual([])
    expect(decision.requiresApproval).toBe(false)
  })
})
