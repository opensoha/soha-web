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
      'enabled',
      'healthy',
      'online',
      'ready',
      'running',
      'supported',
      'succeeded',
      'completed',
      'complete',
      'synced',
      'success',
      'docker_ready',
      'true',
      'allow',
    ].includes(normalized)
  ) {
    return 'success'
  }

  if (
    [
      'warning',
      'approval',
      'pending',
      'queued',
      'building',
      'waiting',
      'released',
      'pending-install',
      'pending-upgrade',
      'draft',
      'degraded',
      'maintenance',
      'target',
      'agent_registered',
    ].includes(normalized)
  ) {
    if (normalized === 'draft') return 'magenta'
    return 'warning'
  }

  if (
    [
      'error',
      'blocked',
      'denied',
      'failure',
      'failed',
      'disconnected',
      'critical',
      'crashloopbackoff',
      'terminating',
      'notready',
      'lost',
      'deny',
      'expired',
      'unavailable',
      'agent_failed',
      'timeout',
      'callback_timeout',
    ].includes(normalized)
  ) {
    return 'error'
  }

  if (['acknowledged', 'info'].includes(normalized)) {
    return 'processing'
  }

  if (
    [
      'attention',
      'checking',
      'defined',
      'initializing',
      'provisioning',
      'provisioned_waiting_agent',
      'agent_bootstrapping',
      'running_task',
      'syncing',
      'vm_ready',
    ].includes(normalized)
  ) {
    return 'processing'
  }

  return 'default'
}

export function StatusTag({
  label,
  value,
}: {
  label?: ReactNode
  value?: null | string
}) {
  const displayLabel = label ?? ((value || '').trim() || '-')
  return (
    <Tag
      className="soha-status-tag"
      color={resolveAntdTagColor(pickStatusColor(value))}
      variant="filled"
    >
      {displayLabel}
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
