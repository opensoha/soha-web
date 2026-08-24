import { Card } from 'antd'
import { ManagementState } from '@/components/management-list'
import { LogExplorer } from '@/features/observability'
import { localeText, useI18n } from '@/i18n'
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
  const { localeCode } = useI18n()
  if (!enabled) {
    return (
      <Card className="soha-detail-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title={localeText(localeCode, '运行时日志不可用', 'Runtime logs unavailable')}
          description={localeText(
            localeCode,
            'Docker 模块或当前权限不允许读取运行时日志。',
            'The Docker module or your permissions do not allow access to runtime logs.',
          )}
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
          title={localeText(localeCode, '没有可用服务', 'No available services')}
          description={localeText(
            localeCode,
            '该项目还没有同步到可用于运行时访问的服务记录。',
            'No service records are available for runtime access yet.',
          )}
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
        localeCode,
        onChange: onServiceChange,
      })}
      target={{ kind: 'docker', projectId, serviceName: serviceName ?? '' }}
    />
  )
}
