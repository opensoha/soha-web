import { Card, Descriptions, Space, Tag, Typography } from 'antd'
import type { PluginManifest, PluginPermissionRequest } from '../plugin-model'
import { manifestExtensionCount, pluginTypeLabel, requiredSecretValues } from '../plugin-model'
import { compactPluginTags, pluginJsonBlock } from './formatters'
import { ExtensionPointList } from './extension-list'
import { pluginSchemaProperties } from './schema'

const { Text } = Typography

export function PermissionReview({
  permissions,
}: {
  permissions?: PluginPermissionRequest | null
}) {
  const required = permissions?.required ?? []
  const domain = permissions?.domain ?? []
  if (!required.length && !domain.length) {
    return <Text type="secondary">未声明权限需求</Text>
  }
  return (
    <Space orientation="vertical" size={4}>
      {required.length ? (
        <div>
          <Text type="secondary">Gateway</Text>
          <div>{compactPluginTags(required, 6)}</div>
        </div>
      ) : null}
      {domain.length ? (
        <div>
          <Text type="secondary">Domain</Text>
          <div>{compactPluginTags(domain, 6)}</div>
        </div>
      ) : null}
    </Space>
  )
}

export function PluginManifestSections({ manifest }: { manifest?: PluginManifest | null }) {
  if (!manifest) return null
  const secrets = requiredSecretValues(manifest.secrets)
  return (
    <div className="soha-plugin-detail-grid">
      <Card title="Manifest" size="small">
        <Descriptions
          column={2}
          size="small"
          items={[
            { key: 'id', label: 'ID', children: manifest.id },
            { key: 'type', label: 'Type', children: pluginTypeLabel(manifest.type) },
            { key: 'publisher', label: 'Publisher', children: manifest.publisher },
            { key: 'version', label: 'Version', children: manifest.version },
            { key: 'homepage', label: 'Homepage', children: manifest.homepage || '-' },
            {
              key: 'compatibility',
              label: 'Compatibility',
              children: pluginJsonBlock(manifest.compatibility),
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
      </Card>
      <Card title="Assets 与 Capabilities" size="small">
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'assets', label: 'Assets', children: pluginJsonBlock(manifest.assets) },
            {
              key: 'capabilities',
              label: 'Capabilities',
              children: pluginJsonBlock(manifest.capabilities),
            },
          ]}
        />
      </Card>
      <Card title="Requested permissions" size="small">
        <PermissionReview permissions={manifest.permissions} />
      </Card>
      <Card title="Required secrets" size="small">
        {secrets.length ? (
          <Space size={[4, 4]} wrap>
            {secrets.map((item) => (
              <Tag key={item.name} color={item.required === false ? 'default' : 'gold'}>
                {item.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">无</Text>
        )}
      </Card>
      <Card title="Extension points" size="small">
        <ExtensionPointList points={manifest.extensionPoints} />
      </Card>
      <Card title="Config schema" size="small">
        {pluginSchemaProperties(manifest.configSchema).length ? (
          pluginJsonBlock(manifest.configSchema)
        ) : (
          <Text type="secondary">未声明配置 schema</Text>
        )}
      </Card>
    </div>
  )
}
