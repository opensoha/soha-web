import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Alert, Space, Spin, Tag, Typography } from 'antd'
import { CloudDownloadOutlined, LinkOutlined, RocketOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { hasAllowedAction } from '@/features/auth'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { ResourceQueryPanel } from '../../shared/resource-query-panel'
import { normalizeSearchKeyword } from '../../shared/search'
import { helmQueries } from '../queries'
import type { HelmChart, HelmChartCatalogInput } from '../types'
import { formatHelmChartCount, getHelmChartBadges, hasHelmChartSecuritySummary } from './utils'
import '@/features/platform/extensions/styles.css'

const { Text } = Typography
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 60
const PAGE_SIZE_OPTIONS = [20, 40, 60]

const HelmChartDrawer = lazy(async () => {
  const module = await import('./chart-drawer')
  return { default: module.HelmChartDrawer }
})

export function HelmChartsPage() {
  const { t, localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const capability = useClusterCapability('helm.releases', localeCode)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [selectedChart, setSelectedChart] = useState<HelmChart | null>(null)
  const [initialDrawerTab, setInitialDrawerTab] = useState<'overview' | 'install'>('overview')
  const normalizedKeyword = normalizeSearchKeyword(useDeferredValue(searchKeyword))
  const offset = (page - 1) * pageSize
  const catalogInput: HelmChartCatalogInput | null = clusterId
    ? { clusterId, keyword: normalizedKeyword, limit: pageSize, offset }
    : null
  const chartsQuery = useQuery(helmQueries.chartCatalog(catalogInput))
  const catalog = chartsQuery.data
  const rawItems = catalog?.charts ?? []
  const total = catalog?.totalCount ?? catalog?.chartCount ?? rawItems.length
  const loaded = catalog?.loadedCount ?? catalog?.chartCount ?? rawItems.length
  const currentOffset = catalog?.offset ?? offset
  const rangeStart = loaded > 0 ? currentOffset + 1 : 0
  const rangeEnd = loaded > 0 ? currentOffset + loaded : 0
  const formattedTotal = formatHelmChartCount(total, localeCode)
  const mutationsDisabled = capability.status !== 'unknown' && capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  useEffect(() => setPage(1), [clusterId, normalizedKeyword])

  const openDrawer = (chart: HelmChart, tab: 'overview' | 'install' = 'overview') => {
    setInitialDrawerTab(tab)
    setSelectedChart(chart)
  }

  const columns: TableColumnsType<HelmChart> = useMemo(
    () => [
      {
        title: 'Chart',
        dataIndex: 'name',
        width: 300,
        render: (value: string, record: HelmChart) => (
          <Space size={10} align="start">
            {record.logoImageUrl ? (
              <img
                src={record.logoImageUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'contain' }}
              />
            ) : null}
            <Space orientation="vertical" size={2}>
              <Space size={6} wrap>
                <Text strong>{value}</Text>
                {getHelmChartBadges(record)
                  .slice(0, 3)
                  .map((badge) => (
                    <Tag key={badge.label} color={badge.color}>
                      {badge.label}
                    </Tag>
                  ))}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.repositoryDisplay || record.repositoryName || '-'}
              </Text>
            </Space>
          </Space>
        ),
      },
      {
        title: localeCode === 'zh_CN' ? '仓库' : 'Repository',
        dataIndex: 'repositoryName',
        width: 180,
      },
      {
        title: localeCode === 'zh_CN' ? '最新版本' : 'Latest Version',
        dataIndex: 'latestVersion',
        width: 140,
      },
      { title: 'App Version', dataIndex: 'appVersion', width: 140 },
      {
        title: localeCode === 'zh_CN' ? '描述' : 'Description',
        dataIndex: 'description',
        width: 420,
        render: (value?: string) => (value ? <Text type="secondary">{value}</Text> : '-'),
      },
      {
        title: localeCode === 'zh_CN' ? '关键词' : 'Keywords',
        dataIndex: 'keywords',
        width: 240,
        render: (values?: string[]) =>
          values?.length ? (
            <Space size={[4, 4]} wrap>
              {values.slice(0, 4).map((value) => (
                <Tag key={value}>{value}</Tag>
              ))}
            </Space>
          ) : (
            '-'
          ),
      },
      {
        title: localeCode === 'zh_CN' ? '状态' : 'Signals',
        key: 'signals',
        width: 180,
        render: (_value, record) => (
          <Space size={[4, 4]} wrap>
            {typeof record.stars === 'number' ? <Tag>Stars {record.stars}</Tag> : null}
            {record.hasValuesSchema ? <Tag color="processing">values.schema</Tag> : null}
            {hasHelmChartSecuritySummary(record) ? (
              <Tag
                color={
                  (record.securityCritical ?? 0) > 0 || (record.securityHigh ?? 0) > 0
                    ? 'error'
                    : 'default'
                }
              >
                CVEs {(record.securityCritical ?? 0) + (record.securityHigh ?? 0)}
              </Tag>
            ) : null}
          </Space>
        ),
      },
      { title: localeCode === 'zh_CN' ? '版本数' : 'Versions', dataIndex: 'versionCount' },
      {
        title: localeCode === 'zh_CN' ? '操作' : 'Actions',
        key: 'actions',
        width: 112,
        fixed: 'right',
        align: 'center',
        render: (_value, record) => {
          const viewLabel =
            localeCode === 'zh_CN'
              ? '查看 Chart 详情、README 和默认 values'
              : 'View chart details, README, and default values'
          const installLabel =
            localeCode === 'zh_CN'
              ? '安装 Chart 到当前集群'
              : 'Install chart to the current cluster'
          return (
            <Space size={2} className="soha-row-action-icons">
              {record.artifactHubUrl ? (
                <ManagementIconButton
                  href={record.artifactHubUrl}
                  icon={<LinkOutlined />}
                  target="_blank"
                  tooltip="Open Artifact Hub package page"
                  aria-label="Open Artifact Hub package page"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : null}
              <ManagementIconButton
                icon={<RocketOutlined />}
                tooltip={viewLabel}
                aria-label={viewLabel}
                onClick={(event) => {
                  event.stopPropagation()
                  openDrawer(record)
                }}
              />
              {hasAllowedAction(record.allowedActions, 'create') ? (
                <ManagementIconButton
                  icon={<CloudDownloadOutlined />}
                  disabled={mutationsDisabled}
                  tooltip={capabilityActionTooltip(installLabel, capability)}
                  aria-label={installLabel}
                  onClick={(event) => {
                    event.stopPropagation()
                    openDrawer(record, 'install')
                  }}
                />
              ) : null}
            </Space>
          )
        },
      },
    ],
    [capability, localeCode, mutationsDisabled],
  )

  const emptyTitle = !clusterId
    ? t('platformScope.clusterPlaceholder', 'Select cluster')
    : chartsQuery.isError
      ? t('page.extensions.helmCharts.errorTitle', 'Chart catalog unavailable')
      : normalizedKeyword
        ? localeCode === 'zh_CN'
          ? '没有匹配的 Helm Chart'
          : 'No matching Helm charts'
        : t('page.extensions.helmCharts.emptyTitle', 'No Helm charts')

  return (
    <div className="soha-page">
      <ResourceQueryPanel
        placeholder={
          localeCode === 'zh_CN'
            ? '搜索 Chart / 版本 / 描述 / 关键词 / 维护者'
            : 'Search chart / version / description / keyword / maintainer'
        }
        searchKeyword={searchKeyword}
        setSearchKeyword={(value) => {
          setSearchKeyword(value)
          setPage(1)
        }}
      />
      {capabilityReason ? (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 12 }}
          title={localeCode === 'zh_CN' ? '当前连接模式限制 Helm 安装' : 'Helm installs limited'}
          description={capabilityReason}
        />
      ) : null}
      <AdminTable
        className="soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="toolbar"
        shellClassName="soha-management-table-shell soha-helm-chart-table-shell"
        columns={columns}
        dataSource={clusterId && !chartsQuery.isError ? rawItems : []}
        rowKey={(record) =>
          record.packageId || `${record.repositoryName}:${record.name}:${record.latestVersion}`
        }
        loading={chartsQuery.isLoading}
        pagination={{
          current: page,
          currentPage: page,
          pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showQuickJumper: total > pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (nextPageSize: number) => {
            setPage(1)
            setPageSize(Math.min(nextPageSize, MAX_PAGE_SIZE))
          },
        }}
        paginationSummary={
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${rangeStart}-${rangeEnd} / 总计 ${formattedTotal} 条`
              : `${rangeStart}-${rangeEnd} / ${formattedTotal} total`}
          </Text>
        }
        toolbar={
          catalog?.repository ? (
            <Space className="soha-helm-chart-catalog-toolbar" size={8}>
              <Tag color="processing">Artifact Hub</Tag>
              <Tag>{localeCode === 'zh_CN' ? '仅 Helm packages' : 'Helm packages only'}</Tag>
              <Text className="soha-helm-chart-catalog-url" type="secondary">
                {catalog.repository.url}
              </Text>
              <Text className="soha-helm-chart-catalog-total" type="secondary">
                {localeCode === 'zh_CN' ? `总计 ${formattedTotal} 个` : `${formattedTotal} total`}
              </Text>
            </Space>
          ) : null
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        onRow={(record: HelmChart) => ({
          onClick: () => openDrawer(record),
          style: { cursor: 'pointer' },
        })}
        toolbarExtra={
          <ManagementTableToolbar>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={t('common.refresh', 'Refresh')}
              disabled={!clusterId}
              loading={chartsQuery.isFetching}
              tooltip={t('common.refresh', 'Refresh')}
              onClick={() => clusterId && void chartsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        empty={
          <ManagementState
            bordered={false}
            compact
            kind={!clusterId ? 'select-scope' : chartsQuery.isError ? 'error' : 'empty'}
            title={emptyTitle}
            description={chartsQuery.error?.message}
          />
        }
      />
      {selectedChart ? (
        <Suspense fallback={<Spin />}>
          <HelmChartDrawer
            chart={selectedChart}
            initialTab={initialDrawerTab}
            onClose={() => setSelectedChart(null)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
