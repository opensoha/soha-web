import { expect, it } from 'vitest'
import { organizationTags, PINNED_SESSION_TAG, sessionProject } from './session-organization'
it('updates personal organization while preserving unrelated tags and allows removal', () => {
  const tags = organizationTags(['user-tag', 'soha:project:Old'], ' New ', true)
  expect(tags).toEqual(['user-tag', PINNED_SESSION_TAG, 'soha:project:New'])
  expect(sessionProject({ id: '1', title: '', updatedAt: '', metadata: { tags } })).toBe('New')
  expect(organizationTags(tags, '', false)).toEqual(['user-tag'])
})
