import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Space, Tabs, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { CodeOutlined, ExportOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
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
import { manifestQueries, type ManifestPackage } from '@/features/delivery'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import './styles.css'

const { Text } = Typography

export function PlatformManifestsPage() {
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [selected, setSelected] = useState<ManifestPackage | null>(null)
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 })

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

  const scopedBindings = useMemo(
    () =>
      (manifestsQuery.data?.items ?? []).flatMap((item) =>
        item.bindings
          .filter((binding) => !clusterId || binding.clusterId === clusterId)
          .filter((binding) => !namespace || binding.namespace === namespace)
          .map((binding) => ({ ...binding, manifest: item })),
      ),
    [clusterId, manifestsQuery.data?.items, namespace],
  )

  const columns: TableColumnsType<(typeof scopedBindings)[number]> = [
    {
      title: '应用清单',
      dataIndex: ['manifest', 'name'],
      render: (_value, item) => (
        <Button
          type="link"
          className="soha-platform-manifest-link"
          onClick={() => setSelected(item.manifest)}
        >
          {item.manifest.name}
        </Button>
      ),
    },
    { title: '应用 ID', dataIndex: ['manifest', 'applicationId'] },
    {
      title: '环境',
      dataIndex: 'environmentKey',
      width: 110,
      render: (value) => <MetadataTag label={value} />,
    },
    { title: '集群', dataIndex: 'clusterId' },
    { title: 'Namespace', dataIndex: 'namespace' },
    {
      title: '版本',
      dataIndex: ['manifest', 'currentRevision'],
      width: 90,
      render: (value: number) => (value > 0 ? `v${value}` : '-'),
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => <StatusTag value={value || 'not_deployed'} />,
    },
    { title: '更新时间', dataIndex: ['manifest', 'updatedAt'], width: 180, render: formatDateTime },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      render: (_value, item) => (
        <Space size={4}>
          <ManagementIconButton
            aria-label="查看 YAML"
            icon={<CodeOutlined />}
            tooltip="查看 YAML"
            onClick={() => setSelected(item.manifest)}
          />
          <ManagementIconButton
            aria-label="前往应用清单库"
            icon={<ExportOutlined />}
            tooltip="前往清单库"
            onClick={() =>
              navigate(
                `/delivery/manifests?applicationId=${encodeURIComponent(item.manifest.applicationId)}`,
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
          title: <Text strong>应用清单</Text>,
          headerExtra: (
            <ManagementTableToolbar>
              <Button icon={<ExportOutlined />} onClick={() => navigate('/delivery/manifests')}>
                打开应用清单库
              </Button>
              <ManagementDensityButton
                aria-label="切换表格密度"
                tooltip={tableSize === 'small' ? '切换为舒展密度' : '切换为紧凑密度'}
                onClick={() =>
                  setTableSize((current) => (current === 'small' ? 'middle' : 'small'))
                }
              />
              <ManagementRefreshButton
                aria-label="刷新清单"
                disabled={!clusterId}
                loading={manifestsQuery.isFetching}
                tooltip="刷新"
                onClick={() => void manifestsQuery.refetch()}
              />
            </ManagementTableToolbar>
          ),
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: scopedBindings,
          loading: manifestsQuery.isLoading,
          rowKey: (item) => `${item.manifest.id}:${item.id || item.applicationEnvironmentId}`,
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
              {total > 0 ? `当前 ${range[0]}-${range[1]} / ${total} 条` : '当前 0 / 0 条'}
            </Text>
          ),
          scroll: { x: 'max-content' },
          empty: (
            <ManagementState
              bordered={false}
              compact
              description={clusterId ? '当前作用域没有绑定的应用清单' : '请先选择集群'}
              kind={!clusterId ? 'select-scope' : 'empty'}
            />
          ),
        }}
      />

      <Drawer
        open={Boolean(selected)}
        size={760}
        title={selected?.name}
        onClose={() => setSelected(null)}
      >
        <Tabs
          className="soha-resource-tabs"
          items={(selected?.files ?? []).map((file) => ({
            key: file.path,
            label: file.path,
            children: <pre className="soha-platform-manifest-yaml">{file.content}</pre>,
          }))}
        />
        {selected && selected.files.length === 0 ? (
          <Text type="secondary">该清单包没有文件</Text>
        ) : null}
      </Drawer>
    </>
  )
}
