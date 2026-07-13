import { App, Button, Input, Tabs, Tag, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useI18n } from '@/i18n'
import type { IdentityProvider } from '../types'
import {
  proxySetupContext,
  proxySetupSnippet,
  proxySetupTargets,
  type ProxySetupTarget,
} from '../proxy-setup-model'

const { Paragraph, Text } = Typography

const targetLabels: Record<ProxySetupTarget, string> = {
  'nginx-ingress': 'Nginx (Ingress)',
  'nginx-proxy-manager': 'Nginx (Proxy Manager)',
  'nginx-standalone': 'Nginx (Standalone)',
  'traefik-ingress': 'Traefik (Ingress)',
  'traefik-compose': 'Traefik (Compose)',
  'traefik-standalone': 'Traefik (Standalone)',
  'caddy-standalone': 'Caddy (Standalone)',
}

export function ProxySetupPanel({ provider }: { provider: IdentityProvider }) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const context = proxySetupContext(provider, window.location.origin)
  const reverseProxy = provider.config?.mode === 'reverse_proxy'
  const endpoint = reverseProxy ? context.reverseProxyURL : context.authURL

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    void message.success(t('identity.proxySetup.copied', '已复制配置'))
  }

  return (
    <div className="soha-proxy-setup-panel">
      <div className="soha-proxy-setup-heading">
        <div>
          <Text strong>{t('identity.proxySetup.title', '接入配置')}</Text>
          <Paragraph type="secondary">
            {reverseProxy
              ? t(
                  'identity.proxySetup.reverseDescription',
                  '通过此地址访问应用，Soha 会在完成身份验证和授权后将请求转发到已配置的上游。',
                )
              : t(
                  'identity.proxySetup.description',
                  '选择运行环境并复制配置。所有方式都使用同一个 Soha forward-auth 端点。',
                )}
          </Paragraph>
        </div>
        <Tag color="blue">{reverseProxy ? 'reverse-proxy' : 'forward-auth'}</Tag>
      </div>
      <div className="soha-proxy-endpoint-row">
        <Input readOnly value={endpoint} />
        <Button
          aria-label={
            reverseProxy
              ? t('identity.proxySetup.copyReverseEndpoint', '复制代理地址')
              : t('identity.proxySetup.copyEndpoint', '复制认证地址')
          }
          icon={<CopyOutlined />}
          onClick={() => copy(endpoint)}
        />
      </div>
      {reverseProxy ? null : (
        <Tabs
          items={proxySetupTargets.map((target) => {
            const snippet = proxySetupSnippet(target, context)
            return {
              key: target,
              label: targetLabels[target],
              children: (
                <div className="soha-proxy-snippet">
                  <div className="soha-proxy-snippet-toolbar">
                    <Text type="secondary">
                      {t('identity.proxySetup.generated', '已按当前 Provider 参数生成')}
                    </Text>
                    <Button icon={<CopyOutlined />} size="small" onClick={() => copy(snippet)}>
                      {t('common.copy', '复制')}
                    </Button>
                  </div>
                  <pre>{snippet}</pre>
                </div>
              ),
            }
          })}
          size="small"
        />
      )}
    </div>
  )
}
