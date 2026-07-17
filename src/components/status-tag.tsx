import type { ReactNode } from 'react'
import { Tag } from 'antd'

type TagColor =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'processing'
  | 'grey'
  | 'green'
  | 'red'
  | 'orange'
  | 'blue'
  | 'gold'
  | 'lime'
  | 'cyan'
  | 'purple'
  | 'volcano'
  | 'geekblue'
  | 'magenta'

export type MetadataTagTone = 'default' | 'blue' | 'cyan' | 'purple' | 'gold' | 'orange'

function resolveAntdTagColor(
  color: TagColor,
): Exclude<TagColor, 'grey' | 'green' | 'red' | 'orange' | 'blue'> {
  switch (color) {
    case 'green':
      return 'success'
    case 'red':
      return 'error'
    case 'orange':
      return 'warning'
    case 'blue':
      return 'processing'
    case 'grey':
      return 'default'
    default:
      return color
  }
}

function pickStatusColor(value?: null | string): TagColor {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized) {
    return 'default'
  }

  if (['published', 'visible', 'resolved', 'deployed', 'available'].includes(normalized)) {
    return 'geekblue'
  }

  if (['connected', 'bound', 'normal'].includes(normalized)) {
    return 'cyan'
  }

  if (
    [
      'active',
      'healthy',
      'ready',
      'running',
      'succeeded',
      'complete',
      'success',
      'true',
      'allow',
    ].includes(normalized)
  ) {
    return 'success'
  }

  if (
    [
      'warning',
      'pending',
      'queued',
      'building',
      'waiting',
      'released',
      'pending-install',
      'pending-upgrade',
      'draft',
    ].includes(normalized)
  ) {
    if (normalized === 'draft') return 'magenta'
    return 'warning'
  }

  if (
    [
      'error',
      'failed',
      'disconnected',
      'critical',
      'crashloopbackoff',
      'terminating',
      'notready',
      'lost',
      'deny',
      'expired',
    ].includes(normalized)
  ) {
    return 'error'
  }

  if (['acknowledged', 'info'].includes(normalized)) {
    return 'processing'
  }

  return 'default'
}

export function StatusTag({ value }: { value?: null | string }) {
  const label = (value || '').trim() || '-'
  return (
    <Tag
      className="soha-status-tag"
      color={resolveAntdTagColor(pickStatusColor(value))}
      variant="filled"
    >
      {label}
    </Tag>
  )
}

export function MetadataTag({
  label,
  tone = 'default',
}: {
  label: ReactNode
  tone?: MetadataTagTone
}) {
  return (
    <Tag className="soha-metadata-tag" color={resolveAntdTagColor(tone)} variant="filled">
      {label}
    </Tag>
  )
}

export function BooleanTag({
  value,
  trueLabel = '是',
  falseLabel = '否',
  trueColor = 'success',
  falseColor = 'default',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
  trueColor?: TagColor
  falseColor?: TagColor
}) {
  return (
    <Tag
      className="soha-status-tag"
      color={resolveAntdTagColor(value ? trueColor : falseColor)}
      variant="filled"
    >
      {value ? trueLabel : falseLabel}
    </Tag>
  )
}
