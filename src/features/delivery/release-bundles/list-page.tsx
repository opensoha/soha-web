import { useMemo } from 'react'
import { Alert, Card, Space, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import { DeliveryTable } from '@/features/delivery/delivery-table'
import {
  summarizeReleaseBundleArtifact,
  summarizeReleaseBundleStatus,
} from '@/features/delivery/delivery-status'
import { deliveryQueries } from '@/features/delivery/queries'
import type { ReleaseBundle } from '@/features/delivery/types'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'

const { Text } = Typography

export function ReleaseBundlesPage() {
  const [searchParams] = useSearchParams()
  const focusedReleaseBundleId = searchParams.get('releaseBundleId')?.trim() ?? ''
  const bundlesQuery = useQuery(deliveryQueries.releaseBundles.list())
  const bundles = bundlesQuery.data ?? []
  const focusedBundle = focusedReleaseBundleId
    ? bundles.find((item) => item.id === focusedReleaseBundleId)
    : undefined
  const bundleSummary = useMemo(() => summarizeReleaseBundleStatus(bundles), [bundles])

  return (
    <div className="soha-page">
      {focusedReleaseBundleId ? (
        <Alert
          showIcon
          title={focusedBundle ? `已定位版本包 ${focusedBundle.id}` : '版本包定位'}
          description={`releaseBundleId=${focusedReleaseBundleId}`}
          type={focusedBundle || bundlesQuery.isLoading ? 'info' : 'warning'}
        />
      ) : null}
      <div className="soha-release-bundle-summary">
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">候选版本</Text>
          <strong>{bundleSummary.total}</strong>
          <Text type="secondary">{bundleSummary.ready} 个可验证 / 可推广</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">阻塞版本</Text>
          <strong>{bundleSummary.blocked}</strong>
          <Text type="secondary">构建或发布失败</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">交付物</Text>
          <strong>{bundleSummary.artifacts}</strong>
          <Text type="secondary">镜像 / 包 / digest</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">缺少交付物</Text>
          <strong>{bundleSummary.missingArtifacts}</strong>
          <Text type="secondary">需要回填 artifact</Text>
        </Card>
      </div>
      <DeliveryTable
        rowKey="id"
        refreshing={bundlesQuery.isFetching}
        onRefresh={() => void bundlesQuery.refetch()}
        loading={bundlesQuery.isLoading}
        dataSource={bundles}
        columns={[
          {
            title: 'Version',
            dataIndex: 'version',
            render: (value: string, record: ReleaseBundle) => (
              <Space orientation="vertical" size={0}>
                <Space size={6} wrap>
                  <Text strong>{value}</Text>
                  {record.id === focusedReleaseBundleId ? <Tag color="blue">已定位</Tag> : null}
                </Space>
                <Text type="secondary">{record.id}</Text>
              </Space>
            ),
          },
          { title: 'Application', dataIndex: 'applicationId' },
          {
            title: 'Environment Binding',
            dataIndex: 'applicationEnvironmentId',
            render: (value: string) => value || '-',
          },
          { title: 'Source', dataIndex: 'sourceType' },
          {
            title: 'Artifact',
            dataIndex: 'artifactRef',
            render: (_: unknown, record: ReleaseBundle) => summarizeReleaseBundleArtifact(record),
          },
          { title: 'Digest', dataIndex: 'artifactDigest', render: (value: string) => value || '-' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: string) => <StatusTag value={value} />,
          },
          {
            ...tableColumnPresets.datetime,
            title: 'Updated',
            dataIndex: 'updatedAt',
            render: (value: string) => formatDateTime(value),
          },
        ]}
      />
    </div>
  )
}
