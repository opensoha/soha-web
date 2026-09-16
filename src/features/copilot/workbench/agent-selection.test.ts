import { expect, it } from 'vitest'
import { agentUnavailableReason, preferredExternalAgent } from './agent-selection'
import type { WorkbenchAgentProvider } from './types'
const provider: WorkbenchAgentProvider = {
  id: 'hermes',
  kind: 'hermes-api',
  name: 'Hermes',
  enabled: true,
  capabilities: ['general'],
  runtimeStatus: { state: 'ready', queuedRuns: 0, runningRuns: 0, recentFailures: 0 },
}
it('selects only a ready external provider supporting the requested mode', () => {
  expect(preferredExternalAgent([{ ...provider, id: 'internal', default: true }, provider])).toBe(
    provider,
  )
  expect(preferredExternalAgent([{ ...provider, enabled: false }])).toBeUndefined()
  expect(preferredExternalAgent([{ ...provider, runtimeStatus: undefined }])).toBeUndefined()
  expect(preferredExternalAgent([provider], 'root_cause')).toBeUndefined()
  expect(agentUnavailableReason(provider)).toBe('')
})
