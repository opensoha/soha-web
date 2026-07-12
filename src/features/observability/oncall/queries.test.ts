import { describe, expect, it } from 'vitest'
import { observabilityKeys } from '../keys'
import { observabilityOncallQueries } from './queries'

describe('on-call queries', () => {
  it('uses canonical board and settings keys with active task polling', () => {
    expect(observabilityOncallQueries.schedules().queryKey).toEqual(
      observabilityKeys.oncall.schedules(),
    )
    expect(observabilityOncallQueries.routes().queryKey).toEqual(observabilityKeys.oncall.routes())
    expect(observabilityOncallQueries.tasks().refetchInterval).toBe(30_000)
  })
})
