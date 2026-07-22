import { describe, expect, it } from 'vitest'
import { createGitLabIntegration, gitLabFormValues, updateGitLabIntegration } from './model'
import type { SystemIntegration } from './types'

const integration = {
  id: 'gitlab-main',
  category: 'source_control',
  providerType: 'gitlab',
  name: 'Company GitLab',
  description: 'Primary source',
  enabled: true,
  configuration: [
    { key: 'base_url', value: 'https://gitlab.example.com/api/v4' },
    { key: 'group_id', value: '42' },
    { key: 'per_page', value: '50' },
    { key: 'timeout', value: '20s' },
  ],
  credentialKeys: ['token'],
  healthStatus: 'healthy',
  version: 3,
  createdAt: '2026-07-21T00:00:00Z',
  updatedAt: '2026-07-21T00:00:00Z',
} satisfies SystemIntegration

describe('system integration model', () => {
  it('maps redacted integration configuration to the GitLab form', () => {
    expect(gitLabFormValues(integration)).toMatchObject({
      name: 'Company GitLab',
      baseUrl: 'https://gitlab.example.com/api/v4',
      groupId: '42',
      perPage: 50,
      timeout: '20s',
      token: '',
    })
  })

  it('creates GitLab payloads with a write-only token', () => {
    expect(
      createGitLabIntegration({
        name: ' GitLab ',
        enabled: true,
        baseUrl: ' https://gitlab.example.com/api/v4 ',
        groupId: ' 42 ',
        perPage: 100,
        timeout: '15s',
        token: ' secret ',
      }),
    ).toMatchObject({
      category: 'source_control',
      providerType: 'gitlab',
      name: 'GitLab',
      credentials: [{ key: 'token', value: 'secret' }],
    })
  })

  it('preserves an existing token when the edit form leaves it blank', () => {
    const values = gitLabFormValues(integration)
    expect(updateGitLabIntegration(integration, values)).toEqual({
      expectedVersion: 3,
      name: 'Company GitLab',
      description: 'Primary source',
      enabled: true,
      configuration: integration.configuration,
      credentials: undefined,
    })
  })
})
