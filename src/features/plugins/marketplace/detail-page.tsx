import { useMemo } from 'react'
import { CloudDownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Descriptions, Space, Tag, Typography } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { usePermissionSnapshot } from '@/features/auth'
import { manifestAssetCount, manifestExtensionCount } from '../plugin-model'
import { pluginQueries } from '../queries'
import { compactPluginTags, pluginRiskTag } from '../shared/formatters'
import { PluginManifestSections } from '../shared/manifest-sections'
import { PluginNameCell } from '../shared/plugin-name-cell'
import { PluginPageShell } from '../shared/page-shell'
import { canInstallPlugin } from '../shared/permissions'
import { useInstallPluginAction } from './install-action'

const { Text } = Typography

export function PluginMarketplaceDetailPage() {
  const { pluginId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const installAction = useInstallPluginAction()
  const filters = useMemo(
    () => ({
      sourceId: searchParams.get('sourceId') ?? '',
      marketplaceUrl: searchParams.get('marketplaceUrl') ?? '',
      version: searchParams.get('version') ?? '',
    }),
    [searchParams],
  )
  const detailQuery = useQuery(pluginQueries.marketplaceDetail(pluginId, filters))
  const plugin = detailQuery.data

  if (detailQuery.isLoading) {
    return (
      <PluginPageShell activeKey="marketplace">
        <ManagementState kind="loading" />
      </PluginPageShell>
    )
  }
  if (!plugin) {
    return (
      <PluginPageShell activeKey="marketplace">
        <ManagementState kind="not-found" />
      </PluginPageShell>
    )
  }

  return (
    <PluginPageShell
      activeKey="marketplace"
      extra={
        <Space>
          <Button onClick={() => navigate('/plugins/marketplace')}>返回市场</Button>
          <Button
            disabled={plugin.installed || !canInstallPlugin(snapshot)}
            icon={<CloudDownloadOutlined />}
            loading={installAction.loading}
            type="primary"
            onClick={() => installAction.confirmInstall(plugin)}
          >
            安装
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
          description={plugin.summary || plugin.manifest.description}
        />
      </Card>
      <div className="soha-plugin-kpi-grid">
        <Card size="small">
          <Text type="secondary">Risk</Text>
          <div>{pluginRiskTag(plugin.riskLevel)}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Assets</Text>
          <div className="soha-plugin-kpi-value">{manifestAssetCount(plugin.manifest)}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Extensions</Text>
          <div className="soha-plugin-kpi-value">{manifestExtensionCount(plugin.manifest)}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Installed</Text>
          <div>{plugin.installed ? <Tag color="green">是</Tag> : <Tag>否</Tag>}</div>
        </Card>
      </div>
      <Card title="市场来源" size="small">
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'source', label: 'Source', children: plugin.source },
            { key: 'sourceId', label: 'Source ID', children: plugin.sourceId || '-' },
            { key: 'sourceUrl', label: 'Catalog URL', children: plugin.sourceUrl || '-' },
            { key: 'latest', label: 'Latest', children: plugin.latestVersion || '-' },
            {
              key: 'verified',
              label: 'Verified',
              children: plugin.verified ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
            },
            {
              key: 'categories',
              label: 'Categories',
              children: compactPluginTags(plugin.categories, 4),
            },
          ]}
        />
      </Card>
      <PluginManifestSections manifest={plugin.manifest} />
    </PluginPageShell>
  )
}
