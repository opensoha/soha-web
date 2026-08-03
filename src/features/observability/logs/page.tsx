import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlatformScopeToolbar } from '@/components/platform-scope-toolbar'
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
      <LogExplorer
        clusterId={clusterId}
        namespace={namespace}
        preset={preset}
        scopeControl={
          <PlatformScopeToolbar
            clusterWidth={180}
            embedded
            namespaceWidth={180}
            showLabel={false}
          />
        }
        syncURL
        target={target}
      />
    </div>
  )
}
