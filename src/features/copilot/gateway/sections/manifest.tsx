import { ReloadOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { Button, Descriptions, Input, Select, Space, Tag, Typography } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import type { AIClient, GatewayManifest, GatewayTool } from '../types'

const { Text } = Typography

function compactList(values?: string[], max = 3) {
  const items = values?.filter(Boolean) ?? []
  if (!items.length) return <Text type="secondary">-</Text>
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, max).map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
      {items.length > max ? <Tag>+{items.length - max}</Tag> : null}
    </Space>
  )
}

export interface GatewayManifestSectionProps {
  manifest?: GatewayManifest
  loading: boolean
  clients: AIClient[]
  filters: { aiClientId: string; skillId: string; source: string }
  toolColumns: TableColumnsType<GatewayTool>
  onFiltersChange: (filters: { aiClientId: string; skillId: string; source: string }) => void
  onRefresh: () => void
}

export function GatewayManifestSection({
  manifest,
  loading,
  clients,
  filters,
  toolColumns,
  onFiltersChange,
  onRefresh,
}: GatewayManifestSectionProps) {
  const clientOptions = clients.map((item) => ({
    label: `${item.name} (${item.id})`,
    value: item.id,
  }))
  const skillOptions =
    manifest?.skills?.map((item) => ({ label: `${item.name} (${item.id})`, value: item.id })) ?? []

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder="AI client"
          options={clientOptions}
          value={filters.aiClientId || undefined}
          onChange={(value) => onFiltersChange({ ...filters, aiClientId: value ?? '' })}
        />
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder="Skill"
          options={skillOptions}
          value={filters.skillId || undefined}
          onChange={(value) => onFiltersChange({ ...filters, skillId: value ?? '' })}
        />
        <Input
          style={{ width: 180 }}
          placeholder="source"
          value={filters.source}
          onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
      {manifest ? (
        <>
          <Descriptions
            size="small"
            column={4}
            bordered
            items={[
              {
                key: 'principal',
                label: 'Subject',
                children: manifest.principal?.userName || manifest.principal?.userId || '-',
              },
              {
                key: 'roles',
                label: 'Roles',
                children: compactList(manifest.principal?.roles, 2),
              },
              {
                key: 'permissions',
                label: 'Permissions',
                children: manifest.permissionKeys.length,
              },
              { key: 'denied', label: 'Denied', children: manifest.summary.deniedCount },
            ]}
          />
          <AdminTable
            shellClassName="soha-management-table-shell"
            columnSettingIconOnly
            columnSettingPlacement="header"
            rowKey="name"
            tableSize="small"
            columns={toolColumns}
            dataSource={manifest.tools}
            loading={loading}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
          />
        </>
      ) : (
        <ManagementState
          bordered={false}
          compact
          title="暂无 Manifest"
          description="选择 AI client、skill 或 source 后查看可调用工具清单。"
        />
      )}
    </Space>
  )
}
