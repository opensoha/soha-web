import type { ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { Button, Space, Tabs, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'

const { Text } = Typography

export interface ProductionRecord {
  id: string
  name?: string
  kind?: string
  status?: string
  version?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface ProductionTab<T extends ProductionRecord = ProductionRecord> {
  key: string
  label: string
  records: T[]
  loading?: boolean
  error?: boolean
  columns?: TableColumnsType<T>
  actions?: (record: T) => ReactNode
  emptyDescription: string
}

interface ProductionOperationsPageProps {
  title: string
  description: string
  tabs: ProductionTab[]
  actions?: ReactNode
  onRefresh: () => void
  refreshing?: boolean
  notice?: ReactNode
  children?: ReactNode
}

const defaultColumns: TableColumnsType<ProductionRecord> = [
  { title: '名称 / ID', key: 'identity', render: (_, row) => row.name || row.id },
  {
    title: '类型',
    dataIndex: 'kind',
    key: 'kind',
    width: 150,
    render: (value) => String(value || '-'),
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: 140,
    render: (value) => String(value || '-'),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    render: (value) => <StatusTag value={String(value || 'unknown')} />,
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 190,
    render: (value) => String(value || '-'),
  },
]

export function ProductionOperationsPage({
  title,
  description,
  tabs,
  actions,
  onRefresh,
  refreshing,
  notice,
  children,
}: ProductionOperationsPageProps) {
  return (
    <ManagementDataPage
      className="soha-ai-production-capability"
      header={{
        title,
        description,
        actions: (
          <ManagementTableToolbar>
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh}>
              刷新
            </Button>
            {actions}
          </ManagementTableToolbar>
        ),
      }}
      beforeQuery={notice}
      tableNode={
        <Tabs
          destroyOnHidden
          items={tabs.map((tab) => ({
            key: tab.key,
            label: `${tab.label} (${tab.records.length})`,
            children: (
              <AdminTable
                columns={[
                  ...((tab.columns as TableColumnsType<ProductionRecord> | undefined) ??
                    defaultColumns),
                  ...(tab.actions
                    ? [
                        {
                          title: '操作',
                          key: 'actions',
                          render: (_: unknown, record: ProductionRecord) => tab.actions?.(record),
                        },
                      ]
                    : []),
                ]}
                dataSource={tab.records}
                loading={tab.loading}
                rowKey="id"
                empty={
                  tab.error ? (
                    <ManagementState kind="error" title={`${tab.label}加载失败`} />
                  ) : (
                    <ManagementState
                      title={`暂无${tab.label}`}
                      description={tab.emptyDescription}
                    />
                  )
                }
              />
            ),
          }))}
        />
      }
    >
      {children ? (
        <Space orientation="vertical" size={12}>
          {children}
        </Space>
      ) : null}
      <Text type="secondary">所有长任务均返回 operation 或 run ID，并由服务端状态机推进。</Text>
    </ManagementDataPage>
  )
}
