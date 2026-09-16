import { Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { StatusTag } from '@/components/status-tag'
import type { ManifestResourceInventory } from './types'

export function ManifestResourceInventoryTable({ items }: { items: ManifestResourceInventory[] }) {
  const columns: TableColumnsType<ManifestResourceInventory> = [
    { title: '资源', key: 'resource', render: (_, item) => `${item.kind} / ${item.name}` },
    { title: '命名空间', dataIndex: 'namespace' },
    {
      title: '健康状态',
      key: 'health',
      render: (_, item) => (
        <StatusTag
          value={item.deletingAt ? 'deleting' : item.health || 'unknown'}
          label={
            item.deletingAt
              ? '删除中'
              : item.kind === 'WorkloadCronJob' && item.health === 'healthy'
                ? '配置已同步'
                : undefined
          }
        />
      ),
    },
    {
      title: '控制器已观察 / 资源代次',
      key: 'generation',
      render: (_, item) =>
        item.resourceGeneration
          ? `${item.observedResourceGeneration ?? '未报告'} / ${item.resourceGeneration}`
          : '—',
    },
    {
      title: 'UID',
      dataIndex: 'uid',
      render: (value?: string) =>
        value ? <Typography.Text copyable>{value}</Typography.Text> : '—',
    },
    {
      title: '清理等待项',
      dataIndex: 'finalizers',
      render: (value?: string[]) => value?.join(', ') || '—',
    },
  ]
  return (
    <AdminTable
      tableSize="small"
      pagination={false}
      enableColumnSelection={false}
      rowKey={(item: ManifestResourceInventory) =>
        `${item.apiVersion}/${item.kind}/${item.namespace}/${item.name}`
      }
      dataSource={items}
      empty="等待执行器返回资源清单"
      scroll={{ x: 900 }}
      columns={columns}
    />
  )
}
