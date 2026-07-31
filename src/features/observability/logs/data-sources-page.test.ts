import { describe, expect, it } from 'vitest'
import { buildDataSourceInput } from './data-sources-page'

describe('log data source form model', () => {
  it('builds a Loki payload without returning blank credentials', () => {
    expect(
      buildDataSourceInput({
        name: ' shared logs ',
        backendType: 'loki',
        enabled: true,
        endpoint: ' https://logs.example ',
        clusterIds: ['cluster-a'],
        namespaces: ['team-a'],
        maxEntries: 500,
        maxRangeSeconds: 3600,
        timeoutSeconds: 8,
        bearerToken: ' token-1 ',
        username: ' ',
        clearCredentialKeys: ['password'],
        labelCluster: 'cluster',
        labelNamespace: 'namespace',
        labelService: 'service',
        labelWorkload: 'workload',
        labelSeverity: 'level',
        labelPod: 'pod',
        labelContainer: 'container',
      }),
    ).toEqual({
      name: 'shared logs',
      backendType: 'loki',
      enabled: true,
      scope: { clusterIds: ['cluster-a'], namespaces: ['team-a'] },
      queryBudget: { maxEntries: 500, maxRangeSeconds: 3600, timeoutSeconds: 8 },
      redactionPolicy: { dropAttributeKeys: undefined },
      config: {
        endpoint: 'https://logs.example',
        labelKeys: {
          cluster: 'cluster',
          namespace: 'namespace',
          service: 'service',
          workload: 'workload',
          severity: 'level',
          pod: 'pod',
          container: 'container',
        },
      },
      credentials: [{ key: 'bearer_token', value: 'token-1' }],
      clearCredentialKeys: ['password'],
    })
  })
})
