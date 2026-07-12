import { CloudDownloadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Card, Descriptions, Space, Tag, Typography } from 'antd'
import { pluginMutations } from '../mutations'
import type { MarketplacePlugin } from '../plugin-model'
import {
  latestMarketplaceVersion,
  manifestAssetCount,
  manifestCapabilityCount,
  manifestExtensionCount,
  requiredSecretValues,
} from '../plugin-model'
import { compactPluginTags, pluginRiskTag } from '../shared/formatters'
import { ExtensionPointList } from '../shared/extension-list'
import { PermissionReview } from '../shared/manifest-sections'
import './styles.css'

const { Text } = Typography

function InstallReview({ plugin }: { plugin: MarketplacePlugin }) {
  const manifest = plugin.manifest
  const secrets = requiredSecretValues(manifest.secrets)
  const latestVersion = latestMarketplaceVersion(plugin)
  return (
    <Space orientation="vertical" size={12} className="soha-plugin-install-review">
      <Alert
        showIcon
        type={plugin.riskLevel === 'read' ? 'info' : 'warning'}
        title="插件安装只保存 manifest 快照和 requested permissions，不会直接授予能力。"
      />
      <Descriptions
        bordered
        column={2}
        size="small"
        items={[
          { key: 'id', label: 'ID', children: plugin.id },
          { key: 'publisher', label: 'Publisher', children: plugin.publisher },
          { key: 'version', label: 'Version', children: plugin.version },
          { key: 'source', label: 'Source', children: plugin.sourceId || plugin.source },
          {
            key: 'latest',
            label: 'Latest',
            children: latestVersion?.version || plugin.latestVersion || '-',
          },
          {
            key: 'verified',
            label: 'Verified',
            children: plugin.verified ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag>,
          },
          { key: 'risk', label: 'Risk', children: pluginRiskTag(plugin.riskLevel) },
          { key: 'assets', label: 'Assets', children: manifestAssetCount(manifest) },
          {
            key: 'capabilities',
            label: 'Capabilities',
            children: manifestCapabilityCount(manifest),
          },
          {
            key: 'runtime',
            label: 'Runtime',
            children: manifest.runtime?.mode || 'manifest-only',
          },
          {
            key: 'extensions',
            label: 'Extensions',
            children: manifestExtensionCount(manifest),
          },
        ]}
      />
      <Card size="small" title="Requested permissions">
        <PermissionReview permissions={manifest.permissions} />
      </Card>
      <Card size="small" title="Required secrets">
        {secrets.length ? (
          compactPluginTags(
            secrets.map((item) => item.name),
            6,
          )
        ) : (
          <Text type="secondary">无</Text>
        )}
      </Card>
      <Card size="small" title="Extension points">
        <ExtensionPointList points={manifest.extensionPoints} />
      </Card>
    </Space>
  )
}

export function useInstallPluginAction() {
  const { modal, message } = App.useApp()
  const queryClient = useQueryClient()
  const mutation = useMutation(pluginMutations.install(queryClient))

  return {
    loading: mutation.isPending,
    confirmInstall(plugin: MarketplacePlugin, enable = false) {
      modal.confirm({
        title: `安装 ${plugin.name}`,
        width: 720,
        icon: <CloudDownloadOutlined />,
        content: <InstallReview plugin={plugin} />,
        okText: enable ? '安装并启用' : '安装',
        cancelText: '取消',
        onOk: async () => {
          const item = await mutation.mutateAsync({
            pluginId: plugin.id,
            enable,
            sourceId: plugin.sourceId,
            marketplaceUrl: plugin.sourceUrl,
            version: plugin.latestVersion || plugin.version,
          })
          message.success(`已安装 ${item.name}`)
        },
      })
    },
  }
}

export function marketplaceDetailPath(plugin: MarketplacePlugin) {
  const params = new URLSearchParams()
  if (plugin.sourceId) params.set('sourceId', plugin.sourceId)
  if (plugin.sourceUrl) params.set('marketplaceUrl', plugin.sourceUrl)
  if (plugin.latestVersion || plugin.version) {
    params.set('version', plugin.latestVersion || plugin.version)
  }
  const suffix = params.toString()
  return `/plugins/marketplace/${encodeURIComponent(plugin.id)}${suffix ? `?${suffix}` : ''}`
}
