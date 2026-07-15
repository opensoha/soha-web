import { useEffect, useMemo, useState } from 'react'
import {
  AppstoreAddOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Pagination,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { usePermissionSnapshot } from '@/features/auth'
import type { InstalledPlugin, MarketplacePlugin, PluginMarketplaceFilters } from '../plugin-model'
import {
  manifestAssetCount,
  manifestCapabilityCount,
  manifestExtensionCount,
  pluginTypeLabel,
  pluginTypeOptions,
} from '../plugin-model'
import { pluginQueries } from '../queries'
import { pluginRiskTag, pluginStatusBadge } from '../shared/formatters'
import { canInstallPlugin } from '../shared/permissions'
import { marketplaceDetailPath, useInstallPluginAction } from './install-action'
import '../shared/styles.css'

const { Text, Title } = Typography
const PAGE_SIZE = 12

const initialFilters: Required<PluginMarketplaceFilters> = {
  query: '',
  type: '',
  publisher: '',
  sourceId: '',
  marketplaceUrl: '',
  version: '',
}

type InstallationFilter = 'all' | 'installed' | 'available'

const installationOptions = [
  { label: '全部', value: 'all' },
  { label: '已安装', value: 'installed' },
  { label: '未安装', value: 'available' },
] as const

function PluginMarketplaceCard({
  installedPlugin,
  installLoading,
  plugin,
  onInstall,
}: {
  installedPlugin?: InstalledPlugin
  installLoading: boolean
  plugin: MarketplacePlugin
  onInstall: (plugin: MarketplacePlugin) => void
}) {
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const detailPath = marketplaceDetailPath(plugin)

  return (
    <Card
      hoverable
      size="small"
      classNames={{
        root: 'soha-plugin-market-card',
        body: 'soha-plugin-market-card-body',
        actions: 'soha-plugin-market-card-actions',
      }}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
        },
      }}
      actions={[
        <Tooltip key="details" title="查看插件详情与完整扩展能力">
          <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(detailPath)}>
            详情
          </Button>
        </Tooltip>,
        plugin.installed ? (
          <Button
            key="manage"
            type="text"
            icon={<SettingOutlined />}
            onClick={() => navigate(`/plugins/installed/${encodeURIComponent(plugin.id)}`)}
          >
            管理
          </Button>
        ) : (
          <Button
            key="install"
            type="text"
            disabled={!canInstallPlugin(snapshot)}
            icon={<CloudDownloadOutlined />}
            loading={installLoading}
            onClick={() => onInstall(plugin)}
          >
            安装
          </Button>
        ),
      ]}
    >
      <Link
        aria-label={`查看 ${plugin.name} 详情`}
        className="soha-plugin-market-card-link"
        to={detailPath}
      >
        <Card.Meta
          avatar={<Avatar shape="square" size={36} icon={<AppstoreAddOutlined />} />}
          title={
            <div className="soha-plugin-market-card-title-row">
              <span className="soha-plugin-market-card-title">{plugin.name}</span>
              <Tag>{pluginTypeLabel(plugin.type)}</Tag>
            </div>
          }
          description={
            <div className="soha-plugin-market-card-meta">
              <Text type="secondary">
                {plugin.publisher} / {plugin.id}
              </Text>
              <Text className="soha-plugin-market-card-summary">
                {plugin.summary || plugin.manifest.description || '暂无简介'}
              </Text>
            </div>
          }
        />

        <Space size={[4, 4]} wrap>
          <Tag>{plugin.sourceId || 'static'}</Tag>
          {plugin.verified ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag>}
          <Tag>{plugin.latestVersion || plugin.version}</Tag>
          {installedPlugin ? pluginStatusBadge(installedPlugin.status) : null}
          {!installedPlugin && plugin.installed ? <Tag color="green">已安装</Tag> : null}
          {!plugin.installed ? <Tag>未安装</Tag> : null}
          {pluginRiskTag(plugin.riskLevel)}
        </Space>

        <div className="soha-plugin-market-card-metrics">
          <div>
            <strong>{manifestAssetCount(plugin.manifest)}</strong>
            <Text type="secondary">资产</Text>
          </div>
          <div>
            <strong>{manifestCapabilityCount(plugin.manifest)}</strong>
            <Text type="secondary">能力</Text>
          </div>
          <div>
            <strong>{manifestExtensionCount(plugin.manifest)}</strong>
            <Text type="secondary">扩展点</Text>
          </div>
        </div>
      </Link>
    </Card>
  )
}

export function PluginMarketplacePage() {
  const [filterForm] = Form.useForm<Required<PluginMarketplaceFilters>>()
  const [filters, setFilters] = useState(initialFilters)
  const [searchParams] = useSearchParams()
  const [installationFilter, setInstallationFilter] = useState<InstallationFilter>(() =>
    searchParams.get('installation') === 'installed' ? 'installed' : 'all',
  )
  const [page, setPage] = useState(1)
  const installAction = useInstallPluginAction()
  const marketplaceQuery = useQuery(pluginQueries.marketplace(filters))
  const installedQuery = useQuery(pluginQueries.installed())
  const installedById = useMemo(
    () => new Map((installedQuery.data ?? []).map((plugin) => [plugin.id, plugin])),
    [installedQuery.data],
  )
  const marketplacePlugins = useMemo(
    () =>
      (marketplaceQuery.data ?? []).filter((plugin) => {
        if (installationFilter === 'installed') return plugin.installed
        if (installationFilter === 'available') return !plugin.installed
        return true
      }),
    [installationFilter, marketplaceQuery.data],
  )
  const isLoading =
    marketplaceQuery.isLoading ||
    marketplaceQuery.isFetching ||
    installedQuery.isLoading ||
    installedQuery.isFetching
  const maxPage = Math.max(1, Math.ceil(marketplacePlugins.length / PAGE_SIZE))
  const currentPage = Math.min(page, maxPage)
  const visiblePlugins = marketplacePlugins.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  useEffect(() => setPage(1), [filters, installationFilter])

  return (
    <div className="soha-page soha-plugin-page">
      <div className="soha-plugin-market-heading">
        <div>
          <Title level={4}>插件市场</Title>
          <Text type="secondary">{marketplacePlugins.length} 个插件</Text>
        </div>
      </div>

      <div className="soha-plugin-market-query">
        <ManagementQueryPanel
          actions={
            <>
              <Tooltip title="刷新插件列表">
                <Button
                  aria-label="刷新插件列表"
                  icon={<ReloadOutlined />}
                  loading={isLoading}
                  onClick={() =>
                    Promise.all([marketplaceQuery.refetch(), installedQuery.refetch()])
                  }
                />
              </Tooltip>
              <ManagementQueryActions
                disabledReset={Object.values(filters).every((value) => !value)}
                loading={isLoading}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters(initialFilters)
                }}
              />
            </>
          }
          form={filterForm}
          initialValues={initialFilters}
          onFinish={(values) => setFilters({ ...initialFilters, ...values })}
        >
          <ManagementKeywordField
            label="关键词"
            minWidth={300}
            name="query"
            placeholder="搜索 ID、名称、发布者"
            width={300}
          />
          <ManagementQueryField label="类型" minWidth={180} name="type" width={180}>
            <Select allowClear placeholder="全部" options={[...pluginTypeOptions]} />
          </ManagementQueryField>
          <ManagementQueryField label="Publisher" minWidth={220} name="publisher" width={220}>
            <Input allowClear placeholder="Publisher" />
          </ManagementQueryField>
          <ManagementQueryField label="Source ID" minWidth={220} name="sourceId" width={220}>
            <Input allowClear placeholder="Source ID" />
          </ManagementQueryField>
          <ManagementQueryField
            label="Marketplace URL"
            minWidth={300}
            name="marketplaceUrl"
            width={300}
          >
            <Input allowClear placeholder="Marketplace URL" />
          </ManagementQueryField>
          <ManagementQueryField label="Version" minWidth={160} name="version" width={160}>
            <Input allowClear placeholder="Version" />
          </ManagementQueryField>
        </ManagementQueryPanel>
      </div>

      <div className="soha-plugin-market-filters">
        <ManagementTableToolbar>
          <Segmented<InstallationFilter>
            options={[...installationOptions]}
            value={installationFilter}
            onChange={setInstallationFilter}
          />
        </ManagementTableToolbar>
      </div>

      {marketplaceQuery.isError ? (
        <ManagementState
          kind="error"
          title="无法连接插件市场"
          description="请确认本地插件市场已启动，或检查后端插件市场地址配置后重试。"
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => void marketplaceQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="soha-plugin-market-grid" aria-label="正在加载插件">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} loading className="soha-plugin-market-card" />
          ))}
        </div>
      ) : visiblePlugins.length ? (
        <>
          <div className="soha-plugin-market-grid">
            {visiblePlugins.map((plugin) => (
              <PluginMarketplaceCard
                key={`${plugin.sourceId || 'static'}:${plugin.id}:${plugin.version}`}
                installedPlugin={installedById.get(plugin.id)}
                installLoading={installAction.loading}
                plugin={plugin}
                onInstall={installAction.confirmInstall}
              />
            ))}
          </div>
          <Pagination
            align="end"
            current={currentPage}
            hideOnSinglePage
            pageSize={PAGE_SIZE}
            showSizeChanger={false}
            total={marketplacePlugins.length}
            onChange={setPage}
          />
        </>
      ) : (
        <ManagementState
          kind="empty"
          title={installationFilter === 'installed' ? '尚未安装插件' : '没有匹配插件'}
          description={
            installationFilter === 'installed'
              ? '从插件市场完成安装后，可直接在此筛选和管理。'
              : '调整筛选条件后重试。'
          }
        />
      )}
    </div>
  )
}
