import { Space, Tag, Typography } from 'antd'

const { Text } = Typography

export function formatDateTime(value?: string) {
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

export function compactList(values?: string[], max = 3) {
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
