import { describe, expect, it } from 'vitest'
import { deliveryKeys, deliveryMutationKeys } from './keys'

describe('deliveryKeys', () => {
  it('keeps all capability keys under the stable delivery root', () => {
    expect(deliveryKeys.applications.list()).toEqual(['delivery', 'applications', 'list'])
    expect(deliveryKeys.environments.list()).toEqual(['delivery', 'environments', 'list'])
    expect(deliveryKeys.releaseBoard.list()).toEqual(['delivery', 'release-board', 'list'])
    expect(deliveryKeys.executionTasks.list()).toEqual(['delivery', 'execution-tasks', 'list'])
  })

  it('normalizes identifiers and application list filters', () => {
    expect(deliveryKeys.applications.runtime(' app-1 ')).toEqual([
      'delivery',
      'applications',
      'detail',
      'app-1',
      'runtime',
    ])
    expect(deliveryKeys.workflows.list({ applicationId: ' app-1 ' })).toEqual([
      'delivery',
      'workflows',
      'list',
      { applicationId: 'app-1' },
    ])
    expect(deliveryKeys.releases.list({ applicationId: ' ' })).toEqual([
      'delivery',
      'releases',
      'list',
      {},
    ])
  })

  it('uses stable structured workload, rollout, gateway, and runtime keys', () => {
    expect(
      deliveryKeys.workloads.metrics({
        clusterId: ' cluster-1 ',
        namespace: ' default ',
        workloadName: ' api ',
      }),
    ).toEqual([
      'delivery',
      'workloads',
      'metrics',
      { clusterId: 'cluster-1', namespace: 'default', workloadName: 'api', rangeMinutes: 60 },
    ])
    expect(deliveryKeys.runtime.detail('release_bundle', ' bundle-1 ')).toEqual([
      'delivery',
      'runtime',
      'detail',
      'release_bundle',
      'bundle-1',
    ])
    expect(deliveryKeys.gateway.readiness({ skillId: ' delivery ' })).toEqual([
      'delivery',
      'gateway',
      'readiness',
      { skillId: 'delivery', source: 'delivery-workbench' },
    ])
  })

  it('provides canonical mutation keys', () => {
    expect(deliveryMutationKeys.plans('confirm')).toEqual([
      'delivery',
      'mutation',
      'plans',
      'confirm',
    ])
  })
})
