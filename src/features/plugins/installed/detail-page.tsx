import { useMemo, useState } from 'react'
import {
  CodeOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Descriptions, Space, Tag, Typography } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { usePermissionSnapshot } from '@/features/auth'
import { pluginMutations } from '../mutations'
import { pluginQueries } from '../queries'
import { RegisteredExtensionList } from '../shared/extension-list'
import {
  compactPluginTags,
  formatPluginDateTime,
  pluginJsonBlock,
  pluginStatusBadge,
} from '../shared/formatters'
import { PluginManifestSections } from '../shared/manifest-sections'
import { PluginNameCell } from '../shared/plugin-name-cell'
import { PluginPageShell } from '../shared/page-shell'
import { canConfigurePluginSecrets, canManagePlugins } from '../shared/permissions'
import { useInstalledPluginActions } from './actions'
import { PluginConfigModal } from './config-modal'

const { Text } = Typography

export function InstalledPluginDetailPage() {
  const { pluginId = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const snapshot = usePermissionSnapshot().data?.data
  const [configOpen, setConfigOpen] = useState(false)
  const actions = useInstalledPluginActions()
  const detailQuery = useQuery(pluginQueries.installedDetail(pluginId))
  const manifestQuery = useQuery(pluginQueries.manifest(pluginId))
  const extensionsQuery = useQuery(pluginQueries.extensions('runtime'))
  const configMutation = useMutation(pluginMutations.configure(queryClient))
  const plugin = detailQuery.data
  const manifest = manifestQuery.data ?? plugin?.manifest
  const registeredExtensions = useMemo(
    () => (extensionsQuery.data ?? []).filter((record) => record.pluginId === plugin?.id),
    [extensionsQuery.data, plugin?.id],
  )

  if (detailQuery.isLoading) {
    return (
      <PluginPageShell activeKey="installed">
        <ManagementState kind="loading" />
      </PluginPageShell>
    )
  }
  if (!plugin) {
    return (
      <PluginPageShell activeKey="installed">
        <ManagementState kind="not-found" />
      </PluginPageShell>
    )
  }

  return (
    <PluginPageShell
      activeKey="installed"
      extra={
        <Space>
          <Button onClick={() => navigate('/plugins/installed')}>返回已安装</Button>
          {plugin.status === 'enabled' ? (
            <Button
              disabled={!canManagePlugins(snapshot)}
              icon={<PauseCircleOutlined />}
              onClick={() => actions.disable(plugin.id)}
            >
              停用
            </Button>
          ) : (
            <Button
              disabled={!canManagePlugins(snapshot)}
              icon={<PlayCircleOutlined />}
              onClick={() => actions.enable(plugin.id)}
            >
              启用
            </Button>
          )}
          <Button
            disabled={!canManagePlugins(snapshot)}
            icon={<SettingOutlined />}
            onClick={() => setConfigOpen(true)}
          >
            配置
          </Button>
          <Button
            disabled={!canManagePlugins(snapshot)}
            icon={<ReloadOutlined />}
            onClick={() => actions.upgrade(plugin.id)}
          >
            升级
          </Button>
          <Button
            danger
            disabled={!canManagePlugins(snapshot)}
            icon={<DeleteOutlined />}
            onClick={() => actions.confirmRemove(plugin)}
          >
            移除
          </Button>
        </Space>
      }
    >
      <Card size="small">
        <PluginNameCell
          id={plugin.id}
          name={plugin.name}
          publisher={plugin.publisher}
          type={plugin.type}
          version={plugin.version}
          description={plugin.manifest.description}
        />
      </Card>
      <div className="soha-plugin-kpi-grid">
        <Card size="small">
          <Text type="secondary">Status</Text>
          <div>{pluginStatusBadge(plugin.status)}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Checksum</Text>
          <div>
            <Tag>{plugin.checksumStatus}</Tag>
          </div>
        </Card>
        <Card size="small">
          <Text type="secondary">Installed</Text>
          <div className="soha-plugin-kpi-value">{formatPluginDateTime(plugin.installedAt)}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Updated</Text>
          <div className="soha-plugin-kpi-value">{formatPluginDateTime(plugin.updatedAt)}</div>
        </Card>
      </div>
      <Card title="安装记录" size="small">
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'source', label: 'Source', children: plugin.source },
            { key: 'installedBy', label: 'Installed by', children: plugin.installedBy },
            {
              key: 'signature',
              label: 'Signature',
              children: plugin.signatureStatus || '-',
            },
            {
              key: 'enabledAt',
              label: 'Enabled at',
              children: formatPluginDateTime(plugin.enabledAt),
            },
            {
              key: 'disabledAt',
              label: 'Disabled at',
              children: formatPluginDateTime(plugin.disabledAt),
            },
            {
              key: 'secrets',
              label: 'Secret refs',
              children: compactPluginTags(Object.keys(plugin.configuredSecretRefs ?? {}), 4),
            },
          ]}
        />
      </Card>
      <Card
        title="已注册扩展"
        size="small"
        loading={extensionsQuery.isLoading || extensionsQuery.isFetching}
      >
        <RegisteredExtensionList records={registeredExtensions} />
      </Card>
      <PluginManifestSections manifest={manifest} />
      <Card title="Raw manifest" size="small" extra={<CodeOutlined />}>
        {pluginJsonBlock(manifest)}
      </Card>
      <PluginConfigModal
        canEditSecrets={canConfigurePluginSecrets(snapshot)}
        open={configOpen}
        plugin={plugin}
        onCancel={() => setConfigOpen(false)}
        onSubmit={async (input) => {
          const item = await configMutation.mutateAsync({ pluginId, input })
          message.success(`已配置 ${item.name}`)
          return item
        }}
      />
    </PluginPageShell>
  )
}
