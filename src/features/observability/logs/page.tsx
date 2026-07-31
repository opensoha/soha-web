import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ManagementDetailHeader } from '@/components/management-list'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { LogExplorer } from './log-explorer'
import type { LogTarget } from './api'
import { readLogExplorerPreset } from './model'

export function LogsPage() {
  const [searchParams] = useSearchParams()
  const preset = useMemo(() => readLogExplorerPreset(searchParams), [searchParams])
  const { clusterId, namespace, setClusterId, setNamespace } = usePlatformScopeStore()
  const target = useMemo<LogTarget | undefined>(() => {
    if (preset.source === 'docker') {
      return {
        kind: 'docker',
        projectId: preset.dockerProjectId ?? '',
        serviceName: preset.dockerService ?? '',
      }
    }
    if (preset.source === 'delivery') {
      return {
        kind: 'delivery',
        applicationId: preset.applicationId ?? '',
        environmentId: preset.environmentId ?? '',
        namespace: preset.namespace ?? undefined,
      }
    }
    return undefined
  }, [preset])

  useEffect(() => {
    if (preset.clusterId && preset.clusterId !== clusterId) setClusterId(preset.clusterId)
    if (preset.namespace && preset.namespace !== namespace) setNamespace(preset.namespace)
  }, [clusterId, namespace, preset.clusterId, preset.namespace, setClusterId, setNamespace])

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="日志"
        description={
          preset.source === 'docker'
            ? '查看 Docker 项目服务的标准化运行时日志'
            : preset.source === 'delivery'
              ? '按应用环境聚合查看交付工作负载日志'
              : '按命名空间、工作负载、Pod 和容器聚合查看运行时日志'
        }
      />
      <LogExplorer
        clusterId={clusterId}
        namespace={namespace}
        preset={preset}
        syncURL
        target={target}
      />
    </div>
  )
}
