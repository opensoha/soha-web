import { describe, expect, it } from 'vitest'

import { workbenchKeys } from './keys'

describe('workbenchKeys', () => {
  it('preserves the existing session query tuples', () => {
    expect(workbenchKeys.sessions.all()).toEqual(['copilot-workbench-sessions'])
    expect(workbenchKeys.sessions.detail('session-1')).toEqual([
      'copilot-workbench-session-detail',
      'session-1',
    ])
    expect(workbenchKeys.sessions.messages('session-1')).toEqual([
      'copilot-workbench-messages',
      'session-1',
    ])
  })

  it('preserves catalog and agent run query tuples', () => {
    expect(workbenchKeys.catalog()).toEqual(['copilot-workbench-catalog'])
    expect(workbenchKeys.agentRuns.all()).toEqual(['copilot-agent-runs'])
    expect(workbenchKeys.agentRuns.session('session-1')).toEqual([
      'copilot-agent-runs',
      'session-1',
    ])
  })
})
