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
            {t(
              'identity.proxySetup.description',
              '选择运行环境并复制配置。所有方式都使用同一个 Soha forward-auth 端点。',
            )}
          </Paragraph>
        </div>
        <Tag color="blue">forward-auth</Tag>
      </div>
      <div className="soha-proxy-endpoint-row">
        <Input readOnly value={context.authURL} />
        <Button
          aria-label={t('identity.proxySetup.copyEndpoint', '复制认证地址')}
          icon={<CopyOutlined />}
          onClick={() => copy(context.authURL)}
        />
      </div>
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
    </div>
  )
}
