import type { MouseEventHandler } from 'react'
import { Button, Tooltip, Typography } from 'antd'
import type { TooltipProps } from 'antd'

const { Text } = Typography
const tooltipStyles = {
  root: { maxWidth: 'min(640px, 78vw)' },
  container: { overflowWrap: 'anywhere', whiteSpace: 'normal' },
} satisfies TooltipProps['styles']

function displayValue(value?: null | number | string) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

export function TableCellText({ value }: { value?: null | number | string }) {
  const display = displayValue(value)
  return (
    <Tooltip placement="topLeft" styles={tooltipStyles} title={display}>
      <Text>{display}</Text>
    </Tooltip>
  )
}

export function TableCellLink({
  label,
  onClick,
}: {
  label: string
  onClick: MouseEventHandler<HTMLElement>
}) {
  return (
    <Tooltip placement="topLeft" styles={tooltipStyles} title={label}>
      <Button type="text" onClick={onClick}>
        {label}
      </Button>
    </Tooltip>
  )
}
