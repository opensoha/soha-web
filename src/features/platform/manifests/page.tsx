import { useEffect, useState } from 'react'
import { Button, Descriptions, Drawer, Space, Table, Tabs, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { CodeOutlined, ExportOutlined } from '@ant-design/icons'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import {
  manifestQueries,
  type ManifestDeployment,
  type ManifestPackage,
  type ManifestResourceInventory,
} from '@/features/delivery'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import './styles.css'

const { Text } = Typography

type ManifestRuntimeRow = ManifestPackage['bindings'][number] & {
  manifest: ManifestPackage
  deployment?: ManifestDeployment
}

interface ManifestDiffRow {
  key: string
  resource: string
  path: string
  desiredValue: unknown
  observedValue: unknown
}

function runtimeRowKey(item: ManifestRuntimeRow) {
  return `${item.manifest.id}:${item.id || item.applicationEnvironmentId}`
}

function manifestDiffRows(deployment?: ManifestDeployment): ManifestDiffRow[] {
  return (deployment?.status.drift?.resources ?? []).flatMap((resource) =>
    resource.fields.map((field) => ({
      key: `${resource.apiVersion}:${resource.kind}:${resource.namespace}:${resource.name}:${field.path}`,
      resource: `${resource.kind}/${resource.name}`,
      path: field.path,
      desiredValue: field.desiredValue,
      observedValue: field.observedValue,
    })),
  )
}

function formatManifestValue(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? '-'
}

export function PlatformManifestsPage() {
  const { localeCode, t } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [selectedKey, setSelectedKey] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [pagination, setPagination] = useState({ page: 1, pageSize: K8S_TABLE_PAGE_SIZE })

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [clusterId, namespace])
  const manifestsQuery = useQuery(
    manifestQueries.list(
      {
        clusterId: clusterId || undefined,
        namespace: namespace || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
      Boolean(clusterId),
    ),
  )

  const manifestItems = manifestsQuery.data?.items ?? []
  const deploymentQueries = useQueries({
    queries: manifestItems.map((item) => manifestQueries.deployments(item.id, Boolean(clusterId))),
  })
  const deploymentsByBinding = new Map(
    deploymentQueries.flatMap((query) => query.data ?? []).map((item) => [item.bindingId, item]),
  )
  const scopedBindings: ManifestRuntimeRow[] = manifestItems.flatMap((item) =>
    item.bindings
      .filter((binding) => !clusterId || binding.clusterId === clusterId)
      .filter((binding) => !namespace || binding.namespace === namespace)
      .map((binding) => ({
        ...binding,
        manifest: item,
        deployment: binding.id ? deploymentsByBinding.get(binding.id) : undefined,
      })),
  )
  const selected = scopedBindings.find((item) => runtimeRowKey(item) === selectedKey)
  const selectedDiff = manifestDiffRows(selected?.deployment)

  const columns: TableColumnsType<ManifestRuntimeRow> = [
    {
      title: t('common.manifest', '应用清单'),
      dataIndex: ['manifest', 'name'],
      render: (_value, item) => (
        <Button
          type="link"
          className="soha-platform-manifest-link"
          onClick={() => setSelectedKey(runtimeRowKey(item))}
        >
          {item.manifest.name}
        </Button>
      ),
    },
    {
      title: t('common.source', '来源'),
      key: 'source',
      render: (_value, item) => (
        <Space size={4} wrap>
          <Text>{item.manifest.applicationId}</Text>
          <MetadataTag
            label={item.manifest.serviceId ? `服务 ${item.manifest.serviceId}` : '应用级'}
          />
        </Space>
      ),
    },
    {
      title: t('common.environment', '环境'),
      dataIndex: 'environmentKey',
      width: 110,
      render: (value) => <MetadataTag label={value} />,
    },
    { title: t('common.cluster', '集群'), dataIndex: 'clusterId' },
    { title: t('common.namespace', '命名空间'), dataIndex: 'namespace' },
    {
      title: t('common.version', '版本'),
      key: 'revision',
      width: 150,
      render: (_value, item) => (
        <Space size={8}>
          <Text>{`期望 v${item.deployment?.spec.desiredRevision ?? item.manifest.currentRevision}`}</Text>
          <Text type="secondary">{`实际 ${item.deployment?.status.appliedRevision ? `v${item.deployment.status.appliedRevision}` : '-'}`}</Text>
        </Space>
      ),
    },
    {
      title: t('common.runtimeStatus', '运行状态'),
      key: 'status',
      width: 120,
      render: (_value, item) => (
        <StatusTag value={item.deployment?.status.phase || item.status || 'not_deployed'} />
      ),
    },
    {
      title: t('common.diff', '差异'),
      key: 'diff',
      width: 100,
      render: (_value, item) => {
        const resources = item.deployment?.status.drift?.resources.length ?? 0
        return <Text type={resources > 0 ? 'warning' : 'secondary'}>{`${resources} 个资源`}</Text>
      },
    },
    {
      title: t('common.updatedAt', '更新时间'),
      dataIndex: ['manifest', 'updatedAt'],
      width: 180,
      render: formatDateTime,
    },
    {
      title: t('common.actions', '操作'),
      key: 'actions',
      fixed: 'right',
      render: (_value, item) => (
        <Space size={4}>
          <ManagementIconButton
            aria-label={t('common.viewYaml', '查看 YAML')}
            icon={<CodeOutlined />}
            tooltip={t('common.viewYaml', '查看 YAML')}
            onClick={() => setSelectedKey(runtimeRowKey(item))}
          />
          <ManagementIconButton
            aria-label={t('common.openManifestLibrary', '查看扩展资源')}
            icon={<ExportOutlined />}
            tooltip={t('common.openManifestLibrary', '查看扩展资源')}
            onClick={() =>
              navigate(
                `/applications/${encodeURIComponent(item.manifest.applicationId)}?tab=resources`,
              )
            }
          />
        </Space>
      ),
    },
  ]

  return (
    <>
      <ManagementDataPage
        className="soha-platform-manifests"
        table={{
          title: <Text strong>{t('common.manifest', '应用清单')}</Text>,
          headerExtra: (
            <ManagementTableToolbar>
              <ManagementDensityButton
                aria-label={localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'}
                tooltip={
                  tableSize === 'small'
                    ? localeCode === 'zh_CN'
                      ? '切换为舒展密度'
                      : 'Use comfortable density'
                    : localeCode === 'zh_CN'
                      ? '切换为紧凑密度'
                      : 'Use compact density'
                }
                onClick={() =>
                  setTableSize((current) => (current === 'small' ? 'middle' : 'small'))
                }
              />
              <ManagementRefreshButton
                aria-label={localeCode === 'zh_CN' ? '刷新清单' : 'Refresh manifests'}
                disabled={!clusterId}
                loading={
                  manifestsQuery.isFetching || deploymentQueries.some((query) => query.isFetching)
                }
                tooltip={t('common.refresh', '刷新')}
                onClick={() => {
                  void manifestsQuery.refetch()
                  deploymentQueries.forEach((query) => void query.refetch())
                }}
              />
            </ManagementTableToolbar>
          ),
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: scopedBindings,
          loading: manifestsQuery.isLoading || deploymentQueries.some((query) => query.isLoading),
          rowKey: runtimeRowKey,
          tableSize,
          pageSize: pagination.pageSize,
          pagination: {
            current: manifestsQuery.data?.page ?? pagination.page,
            pageSize: manifestsQuery.data?.pageSize ?? pagination.pageSize,
            total: manifestsQuery.data?.total ?? 0,
            onPageChange: (page: number) => setPagination((current) => ({ ...current, page })),
            onPageSizeChange: (pageSize: number) => setPagination({ page: 1, pageSize }),
          },
          paginationSummary: (total, range) => (
            <Text type="secondary">
              {localeCode === 'zh_CN'
                ? total > 0
                  ? `当前 ${range[0]}-${range[1]} / ${total} 条`
                  : '当前 0 / 0 条'
                : total > 0
                  ? `${range[0]}-${range[1]} / ${total} items`
                  : '0 / 0 items'}
            </Text>
          ),
          scroll: { x: 'max-content' },
          viewportScroll: true,
          empty: (
            <ManagementState
              bordered={false}
              compact
              description={
                clusterId
                  ? localeCode === 'zh_CN'
                    ? '当前作用域没有绑定的应用清单'
                    : 'No manifests are bound in the current scope'
                  : localeCode === 'zh_CN'
                    ? '请先选择集群'
                    : 'Please select a cluster'
              }
              kind={!clusterId ? 'select-scope' : 'empty'}
            />
          ),
        }}
      />

      <Drawer
        open={Boolean(selected)}
        size={760}
        title={selected?.manifest.name}
        onClose={() => setSelectedKey('')}
      >
        {selected ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={2}
              items={[
                { key: 'application', label: '应用', children: selected.manifest.applicationId },
                {
                  key: 'service',
                  label: '服务',
                  children: selected.manifest.serviceId || '应用级扩展资源',
                },
                { key: 'environment', label: '环境', children: selected.environmentKey },
                {
                  key: 'target',
                  label: '目标',
                  children: `${selected.clusterId} / ${selected.namespace}`,
                },
                {
                  key: 'desired',
                  label: '期望版本',
                  children: `v${selected.deployment?.spec.desiredRevision ?? selected.manifest.currentRevision}`,
                },
                {
                  key: 'applied',
                  label: '实际版本',
                  children: selected.deployment?.status.appliedRevision
                    ? `v${selected.deployment.status.appliedRevision}`
                    : '-',
                },
              ]}
            />
            <Tabs
              className="soha-resource-tabs"
              items={[
                {
                  key: 'desired',
                  label: '期望清单',
                  children:
                    selected.manifest.files.length > 0 ? (
                      <Tabs
                        items={selected.manifest.files.map((file) => ({
                          key: file.path,
                          label: file.path,
                          children: (
                            <pre className="soha-platform-manifest-yaml">{file.content}</pre>
                          ),
                        }))}
                      />
                    ) : (
                      <Text type="secondary">该清单包没有文件</Text>
                    ),
                },
                {
                  key: 'actual',
                  label: `实际资源 (${selected.deployment?.status.inventory?.length ?? 0})`,
                  children: (
                    <Table<ManifestResourceInventory>
                      size="small"
                      pagination={false}
                      rowKey={(item) =>
                        `${item.apiVersion}:${item.kind}:${item.namespace}:${item.name}`
                      }
                      dataSource={selected.deployment?.status.inventory ?? []}
                      columns={[
                        { title: '资源', render: (_value, item) => `${item.kind}/${item.name}` },
                        { title: '命名空间', dataIndex: 'namespace' },
                        {
                          title: '健康状态',
                          dataIndex: 'health',
                          render: (value: string) => <StatusTag value={value || 'unknown'} />,
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'diff',
                  label: `差异 (${selectedDiff.length})`,
                  children: (
                    <Table<ManifestDiffRow>
                      size="small"
                      pagination={false}
                      rowKey="key"
                      dataSource={selectedDiff}
                      columns={[
                        { title: '资源', dataIndex: 'resource' },
                        { title: '字段', dataIndex: 'path' },
                        {
                          title: '期望值',
                          dataIndex: 'desiredValue',
                          render: formatManifestValue,
                        },
                        {
                          title: '实际值',
                          dataIndex: 'observedValue',
                          render: formatManifestValue,
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </>
  )
}
