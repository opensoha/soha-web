import { ManagementState } from '@/components/management-list'
import { ReadFeedback, useInlineApiError } from '@/components/request-feedback'
import { usePermissionSnapshot } from '@/features/auth'
import { isApiError } from '@/services/api-error'
import { queryAccessDenied, readableQueryData } from '@/utils/query-feedback'
import { CloudDownloadOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Descriptions, Space, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { manifestAssetCount, manifestExtensionCount } from '../plugin-model'
import { pluginQueries } from '../queries'
import { compactPluginTags, pluginRiskTag } from '../shared/formatters'
import { PluginManifestSections } from '../shared/manifest-sections'
import { PluginPageShell } from '../shared/page-shell'
import { canInstallPlugin } from '../shared/permissions'
import { PluginNameCell } from '../shared/plugin-name-cell'
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
  const plugin = readableQueryData(detailQuery)
  const notFound = isApiError(detailQuery.error) && detailQuery.error.status === 404
  useInlineApiError(notFound ? detailQuery.error : null)

  if (detailQuery.isLoading) {
    return (
      <PluginPageShell>
        <ManagementState kind="loading" />
      </PluginPageShell>
    )
  }
  if (!plugin) {
    return (
      <PluginPageShell>
        {!queryAccessDenied(detailQuery) ? installAction.feedback : null}
        {notFound || !detailQuery.isError ? (
          <ManagementState kind="not-found" />
        ) : (
          <ReadFeedback query={detailQuery} label="插件详情" />
        )}
      </PluginPageShell>
    )
  }

  return (
    <PluginPageShell
      extra={
        <Space>
          <Button onClick={() => navigate('/plugins/marketplace')}>返回市场</Button>
          <Button
            aria-label="刷新插件详情"
            icon={<ReloadOutlined />}
            loading={detailQuery.isFetching}
            onClick={() => void detailQuery.refetch()}
          />
          {plugin.installed ? (
            <Button
              icon={<SettingOutlined />}
              type="primary"
              onClick={() => navigate(`/plugins/installed/${encodeURIComponent(plugin.id)}`)}
            >
              管理插件
            </Button>
          ) : (
            <Button
              disabled={installAction.blocked || !canInstallPlugin(snapshot)}
              icon={<CloudDownloadOutlined />}
              loading={installAction.loading}
              type="primary"
              onClick={() => installAction.confirmInstall(plugin)}
            >
              安装
            </Button>
          )}
        </Space>
      }
    >
      <ReadFeedback query={detailQuery} label="插件详情" />
      {installAction.feedback}
      {installAction.dialog}
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
