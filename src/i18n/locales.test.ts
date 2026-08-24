import { describe, expect, it } from 'vitest'
import { enUS } from './locales/en_US'
import { zhCN } from './locales/zh_CN'

describe('locale dictionaries', () => {
  it('keeps English and Chinese keys in parity', () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(zhCN).sort())
  })

  it('localizes the global resource creation action', () => {
    expect(enUS['platform.resourceCreation.createResource']).toBe('Create resource')
    expect(zhCN['platform.resourceCreation.createResource']).toBe('创建资源')
  })
})
