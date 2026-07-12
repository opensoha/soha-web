import { describe, expect, it } from 'vitest'
import { applyProviderPreset } from './model'

describe('login provider presets', () => {
  it.each([
    ['feishu', 'mobile', 'avatar_url'],
    ['dingtalk', 'mobile', 'avatarUrl'],
    ['wecom', 'mobile', 'avatar'],
    ['oauth2', 'phone_number', 'picture'],
  ])('provides profile field mappings for %s', (type, phoneField, avatarField) => {
    expect(applyProviderPreset(type)).toMatchObject({ phoneField, avatarField })
  })

  it('configures the enterprise WeChat detail endpoint', () => {
    expect(applyProviderPreset('wecom').profileUrl).toBe(
      'https://qyapi.weixin.qq.com/cgi-bin/user/get',
    )
  })
})
