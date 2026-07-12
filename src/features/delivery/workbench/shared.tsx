import type { ReactNode } from 'react'
import './styles.css'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { ExecutionTask, ReleaseBoardEntry, ReleaseBundle } from '../types'

const { Text } = Typography

const BLOCKED_STATUSES = new Set([
  'failed',
  'error',
  'canceled',
  'cancelled',
  'timeout',
  'rejected',
])
const ACTIVE_STATUSES = new Set([
  'running',
  'queued',
  'pending',
  'building',
  'dispatching',
  'waiting_approval',
  'pending_approval',
])
const READY_STATUSES = new Set([
  'completed',
  'success',
  'succeeded',
  'ready',
  'verified',
  'published',
])

export const VERIFY_TASK_KINDS = new Set([
  'verify',
  'validation',
  'smoke_test',
  'check',
  'check_http',
  'check_k8s_event',
])

interface StatCardItem {
  hint: string
  label: string
  value: string | number
}

interface ActionCardItem {
  description: string
  icon: ReactNode
  label: string
  path: string
  type?: 'primary' | 'default'
}

function normalizeStatus(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function isBlockedStatus(value?: string) {
  return BLOCKED_STATUSES.has(normalizeStatus(value))
}

export function isActiveStatus(value?: string) {
  return ACTIVE_STATUSES.has(normalizeStatus(value))
}

export function isReadyStatus(value?: string) {
  return READY_STATUSES.has(normalizeStatus(value))
}

export function workflowValidationCount(entry: ReleaseBoardEntry) {
  return (
    entry.latestWorkflow?.nodeRuns?.filter((node) => {
      const type = String(node.type || '').toLowerCase()
      return (
        VERIFY_TASK_KINDS.has(type) ||
        type.includes('verify') ||
        type.includes('check') ||
        type.includes('smoke')
      )
    }).length ?? 0
  )
}

export function executionTaskUpdatedAt(task: ExecutionTask) {
  return (
    task.updatedAt || task.lastHeartbeatAt || task.finishedAt || task.startedAt || task.createdAt
  )
}

export function releaseBundleUpdatedAt(bundle: ReleaseBundle) {
  return bundle.updatedAt || bundle.createdAt
}

export function sortByLatest<T>(items: T[], timeSelector: (item: T) => string | undefined) {
  return [...items].sort(
    (left, right) =>
      new Date(timeSelector(right) || 0).getTime() - new Date(timeSelector(left) || 0).getTime(),
  )
}

export function WorkbenchHeader({ description, title }: { description: string; title: string }) {
  return (
    <div className="soha-delivery-workbench-header">
      <div className="soha-delivery-workbench-header__main">
        <h2 className="soha-delivery-workbench-header__title">{title}</h2>
        <Text type="secondary">{description}</Text>
      </div>
    </div>
  )
}

export function StatCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="soha-delivery-workbench-stats">
      {items.map((item) => (
        <Card key={item.label} className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">{item.label}</span>
          <strong>{item.value}</strong>
          <Text type="secondary">{item.hint}</Text>
        </Card>
      ))}
    </div>
  )
}

export function ActionCards({ items }: { items: ActionCardItem[] }) {
  const navigate = useNavigate()

  return (
    <div className="soha-delivery-workbench-actions">
      {items.map((item) => (
        <Card key={item.label} className="soha-delivery-workbench-action-card" size="small">
          <div className="soha-delivery-workbench-action-card__icon">{item.icon}</div>
          <div className="soha-delivery-workbench-action-card__body">
            <Text strong>{item.label}</Text>
            <Text type="secondary">{item.description}</Text>
          </div>
          <Button
            icon={<ArrowRightOutlined />}
            type={item.type ?? 'default'}
            onClick={() => navigate(item.path)}
          >
            打开
          </Button>
        </Card>
      ))}
    </div>
  )
}

export function ManualModeAlert({ description }: { description: string }) {
  return <Alert showIcon type="info" title="常规模式保持完整可用" description={description} />
}
