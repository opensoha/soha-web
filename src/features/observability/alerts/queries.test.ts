import { describe, expect, it } from 'vitest'
import { observabilityKeys } from '../keys'
import { observabilityAlertQueries } from './queries'

describe('alert queries', () => {
  it('uses canonical list and detail fan-out keys', () => {
    expect(observabilityAlertQueries.list().queryKey).toEqual(observabilityKeys.alerts.list())
    expect(observabilityAlertQueries.recent(8).queryKey).toEqual(observabilityKeys.alerts.recent(8))
    expect(observabilityAlertQueries.detail('event-1').queryKey).toEqual(
      observabilityKeys.alerts.detail('event-1'),
    )
    expect(observabilityAlertQueries.preview('event-1', 'policy-1').queryKey).toEqual(
      observabilityKeys.alerts.preview('event-1', 'policy-1'),
    )
  })
})
