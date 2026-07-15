import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderCompactMappedTags } from './compact-mapped-tags'

describe('renderCompactMappedTags', () => {
  it('keeps long tag collections to a single compact summary', () => {
    const html = renderToStaticMarkup(
      renderCompactMappedTags(
        ['view', 'list', 'watch', 'create', 'update'],
        {},
        '未配置',
        2,
        '动作',
      ),
    )

    expect(html).toContain('view')
    expect(html).toContain('list')
    expect(html).toContain('+3')
    expect(html).toContain('aria-label="查看 5 个动作"')
    expect(html).not.toContain('watch')
  })
})
