import { Avatar, Space, Tag, Typography } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import type { IdentityApplication, IdentityApplicationStatus } from '../shared/types'

const { Paragraph, Text } = Typography

const statusTagMeta: Record<IdentityApplicationStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Draft' },
  enabled: { color: 'green', label: 'Enabled' },
  disabled: { color: 'default', label: 'Disabled' },
  maintenance: { color: 'gold', label: 'Maintenance' },
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

export function identityApplicationStatusTag(status: IdentityApplicationStatus) {
  const meta = statusTagMeta[status] ?? statusTagMeta.draft
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function identityApplicationAssignmentsSummary(application: IdentityApplication) {
  const assignments = application.assignments ?? []
  if (!assignments.length) return <Text type="secondary">All authenticated users</Text>
  return (
    <Space size={[4, 4]} wrap>
      {assignments.slice(0, 4).map((assignment) => (
        <Tag key={`${assignment.subjectType}:${assignment.subjectId}`}>
          {assignment.subjectType}:{assignment.subjectId}
        </Tag>
      ))}
      {assignments.length > 4 ? <Tag>+{assignments.length - 4}</Tag> : null}
    </Space>
  )
}
