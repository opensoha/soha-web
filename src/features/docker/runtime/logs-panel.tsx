import { Card, Space, Typography } from 'antd'
import { ManagementState } from '@/components/management-list'
import { LogExplorer } from '@/features/observability'
import { runtimeServiceSelector, type DockerRuntimePanelProps } from './shared'
import './styles.css'

const { Text } = Typography

export function DockerProjectLogsPanel({
  enabled,
  projectId,
  serviceName,
  serviceOptions,
  servicesLoading,
  onServiceChange,
}: DockerRuntimePanelProps) {
  if (!enabled) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title="运行时日志不可用"
          description="Docker 模块或当前权限不允许读取运行时日志。"
        />
      </Card>
    )
  }

  if (serviceOptions.length === 0 && !servicesLoading) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="empty"
          title="没有可用服务"
          description="该项目还没有同步到可用于运行时访问的服务记录。"
        />
      </Card>
    )
  }

  return (
    <div className="soha-docker-log-explorer">
      <Space className="soha-terminal-toolbar" size={8} wrap>
        <Text type="secondary">服务</Text>
        {runtimeServiceSelector({
          disabled: !enabled,
          loading: servicesLoading,
          options: serviceOptions,
          serviceName,
          onChange: onServiceChange,
        })}
      </Space>
      <LogExplorer
        key={`${projectId}:${serviceName ?? ''}`}
        autoStart
        embedded
        preset={{ source: 'docker', dockerProjectId: projectId, dockerService: serviceName }}
        target={{ kind: 'docker', projectId, serviceName: serviceName ?? '' }}
      />
    </div>
  )
}
