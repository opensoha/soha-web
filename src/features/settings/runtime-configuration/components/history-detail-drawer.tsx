import { Button, Descriptions, Drawer, Space, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { RollbackOutlined } from '@ant-design/icons'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { SettingsAdminTable } from '../../shared/components'
import type { RuntimeConfigItem, RuntimeConfigRevision } from '../types'

const { Text } = Typography

function displayValue(value: unknown, sensitive: boolean) {
  if (sensitive) return '********'
  if (value === undefined) return '-'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function RuntimeConfigurationHistoryDrawer({
  canRollback,
  items,
  onClose,
  onRollback,
  open,
  revision,
  rollingBack,
}: {
  canRollback: boolean
  items: RuntimeConfigItem[]
  onClose: () => void
  onRollback: (revision: RuntimeConfigRevision) => void
  open: boolean
  revision: RuntimeConfigRevision | null
  rollingBack: boolean
}) {
  const itemByKey = new Map(items.map((item) => [item.key, item]))
  const columns: TableColumnsType<RuntimeConfigRevision['changes'][number]> = [
    { title: '配置键', dataIndex: 'key', width: 280 },
    {
      title: '操作',
      key: 'operation',
      width: 100,
      render: (_, change) => (
        <MetadataTag
          label={change.reset ? '移除覆盖' : '设置值'}
          tone={change.reset ? 'orange' : 'blue'}
        />
      ),
    },
    {
      title: '目标值',
      key: 'value',
      render: (_, change) => (
        <Text code>
          {displayValue(change.value, itemByKey.get(change.key)?.sensitive === true)}
        </Text>
      ),
    },
  ]

  return (
    <Drawer
      destroyOnHidden
      open={open}
      size={680}
      title={revision ? `配置版本 v${revision.version}` : '配置版本'}
      extra={
        revision && canRollback ? (
          <Button
            danger
            icon={<RollbackOutlined />}
            loading={rollingBack}
            onClick={() => onRollback(revision)}
          >
            回滚到此版本
          </Button>
        ) : null
      }
      onClose={onClose}
    >
      {revision ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            items={[
              { key: 'status', label: '状态', children: <StatusTag value={revision.status} /> },
              { key: 'actor', label: '操作者', children: revision.actor || '-' },
              { key: 'createdAt', label: '创建时间', children: formatDateTime(revision.createdAt) },
              { key: 'reason', label: '变更原因', children: revision.reason || '-' },
              {
                key: 'rollback',
                label: '回滚来源',
                children: revision.rollbackOfRevisionId || '-',
              },
            ]}
          />
          <SettingsAdminTable
            columns={columns}
            dataSource={revision.changes}
            enableColumnSelection={false}
            pagination={false}
            rowKey="key"
            title="结构化变更"
          />
        </Space>
      ) : null}
    </Drawer>
  )
}
