import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card, Descriptions, Input, Tabs } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { dockerQueries } from '../queries'
import { PortsTable } from '../ports/table'
import { ServicesTable } from '../services/table'
import {
  architectureTag,
  configArrayCount,
  configTextValue,
  normalizePage,
  stringValue,
  useDockerPermissions,
} from '../shared/ui'

const { TextArea } = Input

const DockerProjectLogsPanel = lazy(() =>
  import('../runtime/logs-panel').then((module) => ({ default: module.DockerProjectLogsPanel })),
)
const DockerProjectTerminalPanel = lazy(() =>
  import('../runtime/terminal-panel').then((module) => ({
    default: module.DockerProjectTerminalPanel,
  })),
)
const DockerProjectVolumesPanel = lazy(() =>
  import('../runtime/volumes-panel').then((module) => ({
    default: module.DockerProjectVolumesPanel,
  })),
)

function RuntimeBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Card loading />}>{children}</Suspense>
}

function ProjectDetailWorkspace() {
  const { projectId } = useParams()
  const resolvedProjectId = projectId ?? ''
  const {
    dockerModuleEnabled,
    canViewServices,
    canViewServiceLogs,
    canAccessServiceTerminal,
    canViewPorts,
  } = useDockerPermissions()
  const [runtimeServiceName, setRuntimeServiceName] = useState('')
  const projectQuery = useQuery(dockerQueries.project(resolvedProjectId, dockerModuleEnabled))
  const detailServicesQuery = useQuery(
    dockerQueries.projectServices(resolvedProjectId, dockerModuleEnabled && canViewServices),
  )
  const project = projectQuery.data
  const isSingleContainerProject = project?.sourceKind === 'single_container'
  const projectConfig = project?.config
  const runtimeServices = normalizePage(detailServicesQuery.data, 1, 100).items
  const runtimeServiceOptions = useMemo(() => {
    const options = runtimeServices
      .map((service) => ({ label: service.name || service.id, value: service.name || service.id }))
      .filter((option) => option.value)
    const configServiceName = stringValue(projectConfig?.serviceName)
    if (configServiceName && !options.some((option) => option.value === configServiceName)) {
      options.push({ label: configServiceName, value: configServiceName })
    }
    return options
  }, [projectConfig, runtimeServices])
  const defaultRuntimeServiceName = runtimeServiceOptions[0]?.value || ''
  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: project?.name ? `Docker 项目 ${project.name}` : 'Docker 项目详情',
    entityKind: 'docker.project',
    entityName: project?.name ?? resolvedProjectId,
    dockerHostId: project?.hostId,
    dockerServiceId: runtimeServiceName || defaultRuntimeServiceName || undefined,
    visibleFilters: {
      runtimeServiceName: runtimeServiceName || defaultRuntimeServiceName,
      sourceKind: project?.sourceKind,
      status: project?.status,
    },
    pinnedData: {
      projectId: resolvedProjectId,
      serviceCount: runtimeServices.length,
      hostId: project?.hostId,
    },
  })
  useEffect(() => {
    if (!defaultRuntimeServiceName) {
      return
    }
    if (
      !runtimeServiceName ||
      !runtimeServiceOptions.some((option) => option.value === runtimeServiceName)
    ) {
      setRuntimeServiceName(defaultRuntimeServiceName)
    }
  }, [defaultRuntimeServiceName, runtimeServiceName, runtimeServiceOptions])
  if (!resolvedProjectId) {
    return <Navigate to="/compute/runtimes/projects" replace />
  }
  const runtimeConfigTab = isSingleContainerProject
    ? {
        key: 'config',
        label: '配置',
        children: (
          <Card className="soha-detail-card" loading={projectQuery.isLoading}>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2, lg: 3 }}
              items={[
                { key: 'image', label: '镜像', children: configTextValue(projectConfig, 'image') },
                {
                  key: 'architecture',
                  label: '架构',
                  children: architectureTag(configTextValue(projectConfig, 'architecture')),
                },
                {
                  key: 'platform',
                  label: '平台',
                  children: configTextValue(projectConfig, 'platform'),
                },
                {
                  key: 'serviceName',
                  label: '服务名',
                  children: configTextValue(projectConfig, 'serviceName'),
                },
                {
                  key: 'restartPolicy',
                  label: '重启策略',
                  children: configTextValue(projectConfig, 'restartPolicy'),
                },
                {
                  key: 'command',
                  label: '启动命令',
                  children: configTextValue(projectConfig, 'command'),
                },
                {
                  key: 'ports',
                  label: '端口',
                  children: `${configArrayCount(projectConfig, 'ports')} 个`,
                },
                {
                  key: 'volumes',
                  label: '卷',
                  children: `${configArrayCount(projectConfig, 'volumes')} 个`,
                },
              ]}
            />
            <div className="mt-4">
              <TextArea
                rows={12}
                spellCheck={false}
                value={JSON.stringify(projectConfig ?? {}, null, 2)}
                readOnly
              />
            </div>
          </Card>
        ),
      }
    : {
        key: 'compose',
        label: 'Compose',
        children: (
          <Card className="soha-detail-card">
            <Tabs
              items={[
                {
                  key: 'composeContent',
                  label: 'compose.yaml',
                  children: (
                    <TextArea
                      rows={18}
                      spellCheck={false}
                      value={project?.composeContent || ''}
                      readOnly
                    />
                  ),
                },
                {
                  key: 'envContent',
                  label: '.env',
                  children: (
                    <TextArea
                      rows={12}
                      spellCheck={false}
                      value={project?.envContent || ''}
                      readOnly
                    />
                  ),
                },
              ]}
            />
          </Card>
        ),
      }
  const detailTabItems = [
    {
      key: 'info',
      label: '信息',
      children: (
        <Card className="soha-detail-card" loading={projectQuery.isLoading}>
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, lg: 3 }}
            items={[
              { key: 'host', label: 'Docker 主机', children: project?.hostId || '-' },
              { key: 'environment', label: '环境', children: project?.environment || '-' },
              { key: 'owner', label: '负责人', children: project?.owner || project?.team || '-' },
              { key: 'desiredState', label: '目标态', children: project?.desiredState || '-' },
              {
                key: 'lastDeployedAt',
                label: '部署时间',
                children: formatDateTime(project?.lastDeployedAt),
              },
              { key: 'expiresAt', label: '到期', children: formatDateTime(project?.expiresAt) },
            ]}
          />
        </Card>
      ),
    },
    ...(canViewServices
      ? [
          {
            key: 'services',
            label: '服务',
            children: (
              <div className="soha-page-section">
                <ServicesTable fixedProjectId={resolvedProjectId} />
              </div>
            ),
          },
        ]
      : []),
    ...(canViewServiceLogs
      ? [
          {
            key: 'logs',
            label: '日志',
            children: (
              <RuntimeBoundary>
                <DockerProjectLogsPanel
                  enabled={canViewServiceLogs}
                  projectId={resolvedProjectId}
                  projectName={project?.name}
                  serviceName={runtimeServiceName}
                  serviceOptions={runtimeServiceOptions}
                  servicesLoading={detailServicesQuery.isFetching}
                  onServiceChange={setRuntimeServiceName}
                />
              </RuntimeBoundary>
            ),
          },
        ]
      : []),
    ...(canAccessServiceTerminal
      ? [
          {
            key: 'terminal',
            label: 'Shell',
            children: (
              <RuntimeBoundary>
                <DockerProjectTerminalPanel
                  enabled={canAccessServiceTerminal}
                  projectId={resolvedProjectId}
                  projectName={project?.name}
                  serviceName={runtimeServiceName}
                  serviceOptions={runtimeServiceOptions}
                  servicesLoading={detailServicesQuery.isFetching}
                  onServiceChange={setRuntimeServiceName}
                />
              </RuntimeBoundary>
            ),
          },
        ]
      : []),
    ...(canViewServices
      ? [
          {
            key: 'volumes',
            label: '卷文件',
            children: (
              <RuntimeBoundary>
                <DockerProjectVolumesPanel
                  enabled={canViewServices}
                  projectId={resolvedProjectId}
                  projectName={project?.name}
                  serviceName={runtimeServiceName}
                  serviceOptions={runtimeServiceOptions}
                  servicesLoading={detailServicesQuery.isFetching}
                  onServiceChange={setRuntimeServiceName}
                />
              </RuntimeBoundary>
            ),
          },
        ]
      : []),
    ...(canViewPorts
      ? [
          {
            key: 'ports',
            label: '端口映射',
            children: (
              <div className="soha-page-section">
                <PortsTable fixedProjectId={resolvedProjectId} fixedHostId={project?.hostId} />
              </div>
            ),
          },
        ]
      : []),
    runtimeConfigTab,
  ]
  return (
    <div className="soha-page soha-docker-page">
      <Tabs className="soha-resource-tabs soha-workload-detail-tabs" items={detailTabItems} />
    </div>
  )
}

export function DockerProjectDetailPage() {
  return <ProjectDetailWorkspace />
}
