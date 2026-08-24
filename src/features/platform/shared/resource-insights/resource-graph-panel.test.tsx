import { describe, expect, it } from 'vitest'
import type { KubernetesResourceGraph } from '@opensoha/contracts/gen/ts/sohaapi'
import { buildResourceGraphFlow } from './resource-graph-panel'

describe('buildResourceGraphFlow', () => {
  it('keeps backend direction and highlights the requested root', () => {
    const graph: KubernetesResourceGraph = {
      clusterId: 'cluster-a',
      generatedAt: '2026-08-23T10:00:00Z',
      rootId: 'deployment/default/api',
      nodes: [
        {
          id: 'deployment/default/api',
          resource: {
            clusterId: 'cluster-a',
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            namespace: 'default',
            name: 'api',
            scopeMode: 'namespace',
          },
          status: 'healthy',
        },
        {
          id: 'pod/default/api-1',
          resource: {
            clusterId: 'cluster-a',
            apiVersion: 'v1',
            kind: 'Pod',
            namespace: 'default',
            name: 'api-1',
            scopeMode: 'namespace',
          },
        },
      ],
      edges: [
        {
          id: 'owns',
          sourceId: 'deployment/default/api',
          targetId: 'pod/default/api-1',
          relation: 'owns',
        },
      ],
      evidence: [],
      warnings: [],
    }

    const flow = buildResourceGraphFlow(graph)

    expect(flow.nodes).toHaveLength(2)
    expect(flow.nodes[0]?.className).toContain('is-root')
    expect(flow.edges[0]).toMatchObject({
      source: 'deployment/default/api',
      target: 'pod/default/api-1',
      label: 'owns',
    })
  })
})
