import { describe, expect, it } from 'vitest'
import { prettifyAction } from './system-model'

describe('prettifyAction', () => {
  it('makes common audit actions readable without hiding unknown actions', () => {
    expect(prettifyAction('list')).toBe('查看列表')
    expect(prettifyAction('portal.launch')).toBe('打开工作台')
    expect(prettifyAction('custom_action')).toBe('custom action')
  })
})
