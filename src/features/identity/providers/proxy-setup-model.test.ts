import { describe, expect, it } from 'vitest'
import { proxySetupContext, proxySetupSnippet, proxySetupTargets } from './proxy-setup-model'

const provider = {
  id: 'proxy-grafana',
  applicationId: 'grafana',
  name: 'Grafana Proxy',
  type: 'proxy' as const,
  enabled: true,
  status: 'enabled' as const,
  config: {
    externalHosts: ['grafana.example.com'],
    upstreamUrl: 'http://grafana:3000',
  },
  createdAt: '2026-07-13T00:00:00Z',
  updatedAt: '2026-07-13T00:00:00Z',
}

describe('proxy setup model', () => {
  it('generates all supported integration targets from one provider', () => {
    const context = proxySetupContext(provider, 'https://soha.example.com/')
    expect(proxySetupTargets).toHaveLength(7)
    expect(context.authURL).toContain('provider_id=proxy-grafana')
    expect(context.reverseProxyURL).toBe(
      'https://soha.example.com/api/v1/provider/proxy/reverse/proxy-grafana',
    )
    for (const target of proxySetupTargets) {
      const snippet = proxySetupSnippet(target, context)
      expect(snippet).toContain('soha')
      expect(snippet).toContain('proxy-grafana')
    }
    expect(proxySetupSnippet('traefik-compose', context)).toContain('grafana.example.com')
    expect(proxySetupSnippet('traefik-ingress', context)).toContain('redirect=true')
    const nginxIngress = proxySetupSnippet('nginx-ingress', context)
    expect(nginxIngress).not.toContain('redirect=true')
    expect(nginxIngress).toContain('return_to=$scheme://$host$escaped_request_uri')
  })
})
