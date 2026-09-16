import { Alert, Card, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import type { ApplicationRuntimeEnvironment } from '../types'
import { manifestDeploymentRuntimeStatus } from './runtime-status'
import { ManifestResourceInventoryTable } from '../manifests/resource-inventory'

export function ManifestDeploymentState({
  deployment,
}: {
  deployment: NonNullable<ApplicationRuntimeEnvironment['manifestDeployments']>[number]
}) {
  const status = manifestDeploymentRuntimeStatus(deployment)
  return (
    <Card
      size="small"
      title="配置与资源状态"
      extra={<StatusTag value={status.tone} label={status.label} />}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Typography.Text>期望版本 {deployment.spec.desiredRevision}</Typography.Text>
          <Typography.Text>
            已应用版本 {deployment.status.appliedRevision || '暂无'}
          </Typography.Text>
          {deployment.status.lastExecutionTaskId ? (
            <Link to={`/delivery/execution-tasks/${deployment.status.lastExecutionTaskId}`}>
              查看执行任务
            </Link>
          ) : null}
        </Space>
        <Typography.Text type="secondary" copyable>
          {deployment.spec.desiredDigest}
        </Typography.Text>
        {deployment.status.lastErrorMessage ? (
          <Alert showIcon type="error" title={deployment.status.lastErrorMessage} />
        ) : null}
        <ManifestResourceInventoryTable items={deployment.status.inventory ?? []} />
      </Space>
    </Card>
  )
}
