import { describe, expect, it } from 'vitest'
import {
  createDefaultReleaseDagDefinition,
  createNodeConfig,
} from './release-flow-dag-definition'

describe('release flow DAG definition', () => {
  it('stores approval policy fields inside manual approval nodes', () => {
    expect(createNodeConfig('manual_approval')).toEqual({
      approvalMode: 'any',
      approverRoles: ['release-manager'],
      approverUsers: [],
      approverTeams: [],
      required: true,
      requiredApprovals: 1,
      slaMinutes: 60,
      onTimeout: 'block',
      rejectAction: 'stop',
      changeWindow: {
        enabled: false,
        timezone: 'Asia/Shanghai',
        startsAt: '',
        endsAt: '',
      },
    })
  })

  it('creates default release templates with approval node gate configuration', () => {
    const definition = createDefaultReleaseDagDefinition()
    const approvalNode = definition.nodes.find((node) => node.type === 'manual_approval')

    expect(approvalNode?.config).toMatchObject({
      approvalMode: 'any',
      requiredApprovals: 1,
      slaMinutes: 60,
      onTimeout: 'block',
      rejectAction: 'stop',
    })
  })
})
