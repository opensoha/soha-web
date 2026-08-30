import { describe, expect, it } from 'vitest'
import { MENU_WORKBENCH_LABELS, MENU_WORKBENCH_ORDER, prettifyAction } from './system-model'

describe('prettifyAction', () => {
  it('makes common audit actions readable without hiding unknown actions', () => {
    expect(prettifyAction('list')).toBe('查看列表')
    expect(prettifyAction('portal.launch')).toBe('打开工作台')
    expect(prettifyAction('custom_action')).toBe('custom action')
  })
})

describe('menu workbench presentation', () => {
  it('uses the product order and portal label', () => {
    expect(MENU_WORKBENCH_ORDER.slice(0, 8)).toEqual([
      'home',
      'platform',
      'delivery',
      'monitoring',
      'compute',
      'ai',
      'security',
      'settings',
    ])
    expect(MENU_WORKBENCH_LABELS.home).toBe('门户')
  })
})
