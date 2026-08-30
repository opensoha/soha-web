import { describe, expect, it } from 'vitest'
import {
  parseReleaseTargets,
  releaseTargetKey,
  releaseTargetsFromCandidates,
  summarizeReleaseTargets,
} from './release-targets'

describe('release target matrix', () => {
  it('accepts typed YAML, Helm and Kustomize targets', () => {
    const targets = parseReleaseTargets(
      JSON.stringify([
        { clusterId: 'c1', namespace: 'app', targetKind: 'k8s_workload', workloadKind: 'Deployment', workloadName: 'api', configRef: 'deploy/api.yaml' },
        { clusterId: 'c1', namespace: 'app', targetKind: 'helm_release', workloadKind: 'Release', workloadName: 'web', metadata: { chartRef: 'charts/web', valuesRef: 'values/prod.yaml' } },
        { clusterId: 'c2', namespace: 'app', targetKind: 'kustomize_overlay', workloadKind: 'Kustomization', workloadName: 'worker', metadata: { basePath: 'deploy/base', overlayPath: 'deploy/overlays/prod' } },
      ]),
    )
    expect(targets).toHaveLength(3)
    expect(targets.every((target) => target.enabled)).toBe(true)
    expect(summarizeReleaseTargets(targets as never)).toBe(
      'k8s_workload 1 · helm_release 1 · kustomize_overlay 1',
    )
  })

  it('rejects targets missing deployment-specific configuration', () => {
    expect(() =>
      parseReleaseTargets(
        JSON.stringify([{ clusterId: 'c1', namespace: 'app', targetKind: 'helm_release', workloadKind: 'Release', workloadName: 'web' }]),
      ),
    ).toThrow('metadata.chartRef')
  })

  it('turns selected workload candidates into executable release targets', () => {
    const existing = {
      id: 'target-1',
      clusterId: 'c1',
      namespace: 'app',
      workloadKind: 'Deployment',
      workloadName: 'api',
      enabled: true,
    }
    const worker = {
      clusterId: 'c1',
      namespace: 'app',
      workloadKind: 'StatefulSet',
      workloadName: 'worker',
      desiredReplicas: 1,
      readyReplicas: 1,
      relatedResources: [],
    }

    expect(
      releaseTargetsFromCandidates(
        [worker],
        [releaseTargetKey(existing), releaseTargetKey(worker)],
        [existing],
      ),
    ).toEqual([
      existing,
      {
        clusterId: 'c1',
        namespace: 'app',
        targetKind: 'k8s_workload',
        executorKind: 'k8s_job_runner',
        workloadKind: 'StatefulSet',
        workloadName: 'worker',
        metadata: {},
        enabled: true,
      },
    ])
  })
})
