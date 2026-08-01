import type { LogEntry } from '@opensoha/contracts/gen/ts/sohaapi'
import { describe, expect, it } from 'vitest'
import {
  buildLogExplorerPath,
  buildDurableLogQuery,
  buildRuntimeLogQuery,
  buildSohaQLExpression,
  mergeLogEntries,
  parseSohaQLExpression,
  readLogExplorerPreset,
} from './model'

function entry(timestamp: string, message: string): LogEntry {
  return {
    timestamp,
    message,
    source: { domain: 'kubernetes', podName: 'api-0', containerName: 'api' },
    sourceMode: 'runtime',
  }
}

describe('log explorer model', () => {
  it('builds a bounded runtime query and validates workload pairs', () => {
    expect(
      buildRuntimeLogQuery(' apps ', {
        workloadKind: ' Deployment ',
        workloadName: ' api ',
        podNames: ['api-0', ' api-0 ', 'api-1'],
        allContainers: true,
        tail: 500,
        sinceSeconds: 900,
      }),
    ).toEqual({
      sourceMode: 'runtime',
      selector: {
        namespace: 'apps',
        workloadKind: 'Deployment',
        workloadName: 'api',
        podNames: ['api-0', 'api-1'],
        containers: undefined,
        labelSelector: undefined,
        allContainers: true,
      },
      tail: 500,
      limit: 5000,
      direction: 'forward',
      text: undefined,
      runtimeOptions: { previous: false, sinceSeconds: 900 },
    })
    expect(() => buildRuntimeLogQuery('apps', { workloadName: 'api' })).toThrow(
      '工作负载类型和名称必须同时填写',
    )
  })

  it('builds a bounded durable query with an explicit time range', () => {
    expect(
      buildDurableLogQuery(
        'apps',
        {
          podNames: ['api-0'],
          containers: ['api'],
          sinceSeconds: 3600,
          tail: 5000,
          text: 'timeout',
        },
        Date.parse('2026-07-31T03:00:00Z'),
      ),
    ).toEqual({
      sourceMode: 'durable',
      selector: {
        namespace: 'apps',
        workloadKind: undefined,
        workloadName: undefined,
        podNames: ['api-0'],
        containers: ['api'],
        allContainers: false,
      },
      from: '2026-07-31T02:00:00.000Z',
      to: '2026-07-31T03:00:00.000Z',
      limit: 1000,
      direction: 'backward',
      text: 'timeout',
    })
    expect(() => buildDurableLogQuery('apps', { podNames: ['api-0', 'api-1'] })).toThrow(
      '历史日志每次只能筛选一个 Pod 和一个容器',
    )
  })

  it('round-trips shareable scope and filter parameters', () => {
    const path = buildLogExplorerPath({
      clusterId: 'cluster-a',
      namespace: 'apps',
      workloadKind: 'Deployment',
      workloadName: 'api',
      podNames: ['api-0', 'api-1'],
      containers: ['api', 'sidecar'],
      text: 'timeout',
      sinceSeconds: 3600,
      tail: 500,
      previous: true,
    })
    const preset = readLogExplorerPreset(new URL(path, 'http://soha.local').searchParams)
    expect(preset).toMatchObject({
      clusterId: 'cluster-a',
      namespace: 'apps',
      workloadKind: 'Deployment',
      workloadName: 'api',
      podNames: ['api-0', 'api-1'],
      containers: ['api', 'sidecar'],
      text: 'timeout',
      sinceSeconds: 3600,
      tail: 500,
      previous: true,
    })
  })

  it('round-trips the safe SohaQL selector subset', () => {
    const expression = buildSohaQLExpression({
      workloadKind: 'Deployment',
      workloadName: 'frontend',
      podNames: ['frontend-0'],
      containers: ['frontend'],
      text: 'request "failed"',
    })

    expect(expression).toBe(
      '{workload_kind="Deployment", workload="frontend", pod="frontend-0", container="frontend"} |= "request \\"failed\\""',
    )
    expect(parseSohaQLExpression(expression)).toEqual({
      workloadKind: 'Deployment',
      workloadName: 'frontend',
      podNames: ['frontend-0'],
      containers: ['frontend'],
      text: 'request "failed"',
      allContainers: false,
    })
    expect(() => parseSohaQLExpression('{namespace="other"}')).toThrow(
      '不支持的选择器：namespace',
    )
    expect(parseSohaQLExpression('{ }')).toEqual({
      workloadKind: undefined,
      workloadName: undefined,
      podNames: undefined,
      containers: undefined,
      text: undefined,
      allContainers: true,
    })
  })

  it('deduplicates and stably orders snapshot and stream entries', () => {
    const later = entry('2026-07-31T02:00:01Z', 'later')
    const earlier = entry('2026-07-31T02:00:00Z', 'earlier')
    expect(mergeLogEntries([later], [earlier, later])).toEqual([earlier, later])
  })
})
