import { Space, Tag, Typography } from 'antd'
import { pluginTypeLabel } from '../plugin-model'

const { Paragraph, Text } = Typography

export function PluginNameCell({
  description,
  id,
  name,
  publisher,
  type,
  version,
}: {
  description?: string
  id: string
  name: string
  publisher: string
  type: string
  version: string
}) {
  return (
    <Space orientation="vertical" size={2} className="soha-plugin-name-cell">
      <Space size={6} wrap>
        <Text strong>{name}</Text>
        <Tag>{pluginTypeLabel(type)}</Tag>
        <Tag color="blue">{version}</Tag>
      </Space>
      <Text type="secondary">
        {publisher} / {id}
      </Text>
      {description ? (
        <Paragraph ellipsis={{ rows: 2, tooltip: description }} className="soha-plugin-summary">
          {description}
        </Paragraph>
      ) : null}
    </Space>
  )
}
