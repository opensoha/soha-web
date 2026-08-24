import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Select, Space, Spin, Typography } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { ManagementState } from '@/components/management-list'
import { api } from '@/services/api-client'
import { toScopeKey, type ApiResponse } from '@/types'
import { useI18n } from '@/i18n'
import { buildServiceDiagnosticCommand } from './diagnostics-model'
import { serviceKeys } from './keys'
import type { ServicePortMapping } from './types'

interface PodSummary {
  name: string
  namespace: string
  phase: string
}

interface PodExecResult {
  success: boolean
  stdout: string
  stderr: string
  exitMessage?: string
}

export function ServiceDiagnosticsPanel({
  clusterId,
  namespace,
  portMappings,
  serviceName,
}: {
  clusterId: string
  namespace: string
  portMappings?: ServicePortMapping[]
  serviceName: string
}) {
  const { localeCode } = useI18n()
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canExec = hasPermission(permissionSnapshot, 'platform.pods.exec')
  const scope = toScopeKey(clusterId, namespace)
  const podsQuery = useQuery({
    queryKey: serviceKeys.diagnosticPods(scope),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PodSummary[]>>(
        `/clusters/${encodeURIComponent(clusterId)}/workloads/pods?namespace=${encodeURIComponent(namespace)}`,
      )
      return (response.data ?? []).filter((pod) => pod.phase === 'Running')
    },
    enabled: canExec,
  })
  const ports = useMemo(
    () => (portMappings ?? []).filter((item) => Number.isInteger(item.port) && item.port > 0),
    [portMappings],
  )
  const [podName, setPodName] = useState<string>()
  const [port, setPort] = useState<number>()
  useEffect(() => {
    if (!podName && podsQuery.data?.[0]) setPodName(podsQuery.data[0].name)
  }, [podName, podsQuery.data])
  useEffect(() => {
    if (!port && ports[0]) setPort(ports[0].port)
  }, [port, ports])

  const probe = useMutation({
    mutationFn: async () => {
      if (!podName || !port) throw new Error('Source Pod and Service port are required')
      const response = await api.post<ApiResponse<PodExecResult>>(
        `/clusters/${encodeURIComponent(clusterId)}/workloads/pods/${encodeURIComponent(podName)}/exec?namespace=${encodeURIComponent(namespace)}`,
        {
          command: buildServiceDiagnosticCommand({ serviceName, namespace, port }),
          timeoutSeconds: 15,
        },
      )
      return response.data
    },
  })

  if (!canExec) {
    return <ManagementState compact kind="unsupported" description="platform.pods.exec" />
  }
  if (podsQuery.isLoading) return <Spin />

  return (
    <div className="soha-detail-stack">
      <Space wrap>
        <Select
          aria-label={localeCode === 'zh_CN' ? '来源 Pod' : 'Source Pod'}
          placeholder={localeCode === 'zh_CN' ? '来源 Pod' : 'Source Pod'}
          style={{ minWidth: 240 }}
          value={podName}
          options={(podsQuery.data ?? []).map((pod) => ({ label: pod.name, value: pod.name }))}
          onChange={setPodName}
        />
        <Select
          aria-label={localeCode === 'zh_CN' ? 'Service 端口' : 'Service port'}
          placeholder={localeCode === 'zh_CN' ? 'Service 端口' : 'Service port'}
          style={{ minWidth: 180 }}
          value={port}
          options={ports.map((item) => ({
            label: `${item.name || 'port'} · ${item.port}/${item.protocol}`,
            value: item.port,
          }))}
          onChange={setPort}
        />
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={!podName || !port}
          loading={probe.isPending}
          onClick={() => probe.mutate()}
        >
          {localeCode === 'zh_CN' ? '运行诊断' : 'Run diagnostics'}
        </Button>
      </Space>
      {podsQuery.data?.length === 0 ? (
        <Alert
          showIcon
          type="warning"
          title={
            localeCode === 'zh_CN'
              ? '当前命名空间没有可用的 Running Pod'
              : 'No Running Pod is available in this namespace'
          }
        />
      ) : null}
      {probe.isError ? <Alert showIcon type="error" title={probe.error.message} /> : null}
      {probe.data ? (
        <Alert
          showIcon
          type={probe.data.success ? 'success' : 'error'}
          title={
            probe.data.success
              ? localeCode === 'zh_CN'
                ? '诊断通过'
                : 'Diagnostics passed'
              : localeCode === 'zh_CN'
                ? '诊断失败'
                : 'Diagnostics failed'
          }
          description={
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {[probe.data.stdout, probe.data.stderr, probe.data.exitMessage]
                .filter(Boolean)
                .join('\n') || '-'}
            </Typography.Paragraph>
          }
        />
      ) : null}
    </div>
  )
}
