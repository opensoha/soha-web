import { describe, expect, it } from 'vitest'
import { buildRelatedResourcePath, localizeRelatedResourceKind } from './workloads-model'

describe('workload relation paths', () => {
  it('links network and controller relations to their detail pages', () => {
    expect(
      buildRelatedResourcePath(
        { kind: 'Ingress', name: 'api', namespace: 'team-a' },
        'selected-ns',
      ),
    ).toBe('/network/ingresses/api?namespace=team-a')
    expect(
      buildRelatedResourcePath(
        { kind: 'ReplicaSet', name: 'api-7d9', namespace: 'team-a' },
        'selected-ns',
      ),
    ).toBe('/workloads/replicasets/api-7d9?namespace=selected-ns')
    expect(
      buildRelatedResourcePath(
        { kind: 'ReplicationController', name: 'legacy', namespace: 'team-a' },
        null,
      ),
    ).toBe('/workloads/replicationcontrollers/legacy?namespace=team-a')
    expect(localizeRelatedResourceKind('ReplicationController', 'zh_CN')).toBe(
      'ReplicationController',
    )
    expect(
      buildRelatedResourcePath({ kind: 'HTTPRoute', name: 'api', namespace: 'team-a' }, null),
    ).toBe('/network/gateway-api/httproutes/api?namespace=team-a')
    expect(
      buildRelatedResourcePath({ kind: 'GRPCRoute', name: 'rpc', namespace: 'team-a' }, null),
    ).toBe('/network/gateway-api/grpcroutes/rpc?namespace=team-a')
  })
})
