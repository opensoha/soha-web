import { Card } from 'antd'
import { ManagementState } from '@/components/management-list'
import { LogExplorer } from '@/features/observability'
import { runtimeServiceSelector, type DockerRuntimePanelProps } from './shared'
import './styles.css'

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
      <Card className="soha-detail-card" size="small">
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
      <Card className="soha-detail-card" size="small">
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
    <LogExplorer
      key={`${projectId}:${serviceName ?? ''}`}
      autoStart
      embedded
      preset={{ source: 'docker', dockerProjectId: projectId, dockerService: serviceName }}
      scopeControl={runtimeServiceSelector({
        disabled: !enabled,
        loading: servicesLoading,
        options: serviceOptions,
        serviceName,
        onChange: onServiceChange,
      })}
      target={{ kind: 'docker', projectId, serviceName: serviceName ?? '' }}
    />
  )
}
