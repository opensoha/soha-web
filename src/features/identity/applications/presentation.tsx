import { Avatar, Space, Typography } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import type { IdentityApplication, IdentityApplicationStatus } from '../shared/types'

const { Paragraph, Text } = Typography

const statusLabels: Record<IdentityApplicationStatus, string> = {
  draft: 'Draft',
  enabled: 'Enabled',
  disabled: 'Disabled',
  maintenance: 'Maintenance',
}

export function formatIdentityApplicationDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function IdentityApplicationNameCell({ application }: { application: IdentityApplication }) {
  return (
    <div className="soha-identity-app-name-cell">
      <Avatar
        alt={application.name}
        icon={application.iconUrl ? undefined : <AppstoreOutlined />}
        shape="square"
        size={40}
        src={application.iconUrl || undefined}
      >
        {application.name.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className="soha-identity-app-name-copy">
        <Text strong ellipsis title={application.name}>
          {application.name}
        </Text>
        <Text type="secondary" ellipsis title={application.slug}>
          {application.slug}
        </Text>
        {application.description ? (
          <Paragraph
            className="soha-identity-app-description"
            ellipsis={{ rows: 2, tooltip: application.description }}
          >
            {application.description}
          </Paragraph>
        ) : null}
      </div>
    </div>
  )
}

export function identityApplicationStatusTag(status: IdentityApplicationStatus, label?: string) {
  const normalizedStatus = statusLabels[status] ? status : 'draft'
  return <StatusTag label={label ?? statusLabels[normalizedStatus]} value={normalizedStatus} />
}

export function identityApplicationAssignmentsSummary(
  application: IdentityApplication,
  emptyLabel = 'All authenticated users',
) {
  const assignments = application.assignments ?? []
  if (!assignments.length) return <Text type="secondary">{emptyLabel}</Text>
  return (
    <Space size={[4, 4]} wrap>
      {assignments.slice(0, 4).map((assignment) => (
        <MetadataTag
          key={`${assignment.subjectType}:${assignment.subjectId}`}
          label={`${assignment.subjectType}:${assignment.subjectId}`}
        />
      ))}
      {assignments.length > 4 ? <MetadataTag label={`+${assignments.length - 4}`} /> : null}
    </Space>
  )
}
