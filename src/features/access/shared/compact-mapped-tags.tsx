import { useState } from 'react'
import { Button, Popover, Space, Tag } from 'antd'

interface CompactMappedTagsProps {
  emptyText: string
  itemLabel: string
  labelMap: Record<string, string>
  values: string[]
  visibleCount: number
}

function CompactMappedTags({
  emptyText,
  itemLabel,
  labelMap,
  values,
  visibleCount,
}: CompactMappedTagsProps) {
  const [open, setOpen] = useState(false)
  if (!values?.length) return emptyText

  const visibleValues = values.slice(0, visibleCount)
  const hiddenCount = Math.max(values.length - visibleValues.length, 0)
  const renderTag = (value: string, className = 'soha-access-compact-tag') => {
    const label = labelMap[value] || value
    return (
      <Tag key={value} className={className} title={label}>
        <span className="soha-access-compact-tag-text">{label}</span>
      </Tag>
    )
  }
  if (hiddenCount === 0) {
    return (
      <Space wrap={false} size={4} className="soha-access-compact-tags">
        {visibleValues.map((value) => renderTag(value))}
      </Space>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={[]}
      placement="topLeft"
      title={`${values.length} 个${itemLabel}`}
      content={
        <div className="soha-access-permission-popover">
          {values.map((value) => renderTag(value, 'soha-access-permission-popover-tag'))}
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        className="soha-access-compact-tags-trigger"
        aria-label={`查看 ${values.length} 个${itemLabel}`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Space wrap={false} size={4} className="soha-access-compact-tags">
          {visibleValues.map((value) => renderTag(value))}
          <Tag className="soha-access-compact-tag-more">{`+${hiddenCount}`}</Tag>
        </Space>
      </Button>
    </Popover>
  )
}

export function renderCompactMappedTags(
  values: string[],
  labelMap: Record<string, string>,
  emptyText = '-',
  visibleCount = 2,
  itemLabel = '权限项',
) {
  return (
    <CompactMappedTags
      emptyText={emptyText}
      itemLabel={itemLabel}
      labelMap={labelMap}
      values={values}
      visibleCount={visibleCount}
    />
  )
}
