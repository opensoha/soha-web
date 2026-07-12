import { App, Space } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { ReleaseRecord, ReleaseTriggerInput } from '../types'

type ColumnProps<T> = TableColumnsType<T>[number]

function releaseTriggerInput(record: ReleaseRecord): ReleaseTriggerInput {
  return {
    applicationId: record.applicationId,
    clusterId: record.clusterId,
    namespace: record.namespace,
    deploymentName: record.deploymentName,
    containerName: String(record.metadata?.containerName ?? '') || undefined,
    image: String(record.metadata?.image ?? '') || undefined,
    imageTag: String(record.metadata?.imageTag ?? '') || undefined,
    releaseName: String(record.metadata?.releaseName ?? '') || undefined,
  }
}

export function ReleasesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canTriggerRelease = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.releases.trigger',
  )

  const releasesQuery = useQuery(deliveryQueries.releases.list())
  const triggerMutation = useMutation(deliveryMutations.releases.trigger(queryClient))

  const columns: ColumnProps<ReleaseRecord>[] = [
    { title: '应用', dataIndex: 'applicationId' },
    { title: '集群', dataIndex: 'clusterId' },
    { title: '命名空间', dataIndex: 'namespace' },
    { title: 'Deployment', dataIndex: 'deploymentName' },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <StatusTag value={status} />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '部署时间',
      dataIndex: 'deployedAt',
      render: (value: string, record: ReleaseRecord) => formatDateTime(value || record.createdAt),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: ReleaseRecord) =>
        canTriggerRelease ? (
          <Space className="soha-row-action-icons" size={2}>
            <ManagementIconButton
              aria-label="部署"
              icon={<PlayCircleOutlined />}
              loading={triggerMutation.isPending}
              size="small"
              tooltip="部署"
              onClick={() =>
                triggerMutation.mutate(releaseTriggerInput(record), {
                  onSuccess: () => message.success('发布已触发'),
                  onError: (error) =>
                    message.error(error instanceof Error ? error.message : '触发发布失败'),
                })
              }
            />
          </Space>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div className="soha-page">
      <DeliveryTable
        refreshing={releasesQuery.isFetching}
        onRefresh={() => void releasesQuery.refetch()}
        columns={columns}
        dataSource={releasesQuery.data ?? []}
        rowKey="id"
        loading={releasesQuery.isLoading}
      />
    </div>
  )
}
