import { describe, expect, it } from 'vitest'
import { computeRelatedResourcePath } from './related-resource-path'

describe('computeRelatedResourcePath', () => {
  it.each([
    ['vm', 'vm/one', '/compute/virtualization/vms/vm%2Fone'],
    ['project', 'project one', '/compute/runtimes/projects/project%20one'],
    ['runtime_host', 'host-1', '/compute/runtimes/hosts'],
    ['connection', 'connection-1', '/compute/virtualization/clusters'],
    ['agent_host', 'agent-1', '/compute/access?sourceType=agent_host'],
    ['container', 'container-1', null],
  ] as const)('maps %s resources to the canonical compute route', (kind, id, expected) => {
    expect(computeRelatedResourcePath({ kind, id })).toBe(expected)
  })
})
