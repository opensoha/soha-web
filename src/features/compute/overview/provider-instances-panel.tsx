import { App, Card, Space, Typography } from 'antd'
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { computeMutations } from '../mutations'
import { computeQueries } from '../queries'

const { Text } = Typography

export function ProviderInstancesPanel({
  enabled,
  localeCode,
}: {
  enabled: boolean
  localeCode: 'zh_CN' | 'en_US'
}) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instancesQuery = useQuery(computeQueries.providerInstances({ limit: 50 }, enabled))
  const healthMutation = useMutation(computeMutations.checkProviderHealth(queryClient))
  const discoveryMutation = useMutation(computeMutations.discoverProvider(queryClient))
  const items = instancesQuery.data?.items ?? []

  const openTask = (domain: string, taskId: string) => {
    navigate(
      `/compute/tasks/operations?domain=${encodeURIComponent(domain)}&taskId=${encodeURIComponent(taskId)}&view=logs`,
    )
  }

  return (
    <Card
      className="soha-overview-panel-card soha-compute-provider-instances"
      title={localeCode === 'zh_CN' ? '提供方实例' : 'Provider instances'}
      extra={
        <ManagementRefreshButton
          aria-label={localeCode === 'zh_CN' ? '刷新提供方实例' : 'Refresh provider instances'}
          loading={instancesQuery.isFetching}
          tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
          onClick={() => void instancesQuery.refetch()}
        />
      }
    >
      {instancesQuery.isLoading ? (
        <ManagementState bordered={false} compact kind="loading" />
      ) : instancesQuery.isError ? (
        <ManagementState
          bordered={false}
          compact
          kind="error"
          title={localeCode === 'zh_CN' ? '提供方实例加载失败' : 'Provider instances unavailable'}
        />
      ) : items.length === 0 ? (
        <ManagementState
          bordered={false}
          compact
          kind="empty"
          title={localeCode === 'zh_CN' ? '暂无提供方实例' : 'No provider instances'}
        />
      ) : (
        <div className="soha-compute-provider-instance-list">
          {items.map((instance) => {
            const canInspect = instance.snapshot.domain === 'virtualization'
            const busy =
              (healthMutation.isPending &&
                healthMutation.variables?.instanceRef === instance.instanceRef) ||
              (discoveryMutation.isPending &&
                discoveryMutation.variables?.instanceRef === instance.instanceRef)
            return (
              <div
                className="soha-compute-provider-instance-row"
                key={`${instance.snapshot.domain}:${instance.snapshot.providerKey}:${instance.instanceRef}`}
              >
                <div className="soha-compute-provider-instance-main">
                  <Space size={6} wrap>
                    <Text strong>{instance.displayName}</Text>
                    <StatusTag value={instance.health.status} />
                    <MetadataTag
                      label={
                        instance.accessMode === 'agent_proxy'
                          ? localeCode === 'zh_CN'
                            ? 'Agent 代理'
                            : 'Agent proxy'
                          : localeCode === 'zh_CN'
                            ? '直连'
                            : 'Direct'
                      }
                      tone={instance.accessMode === 'agent_proxy' ? 'cyan' : 'blue'}
                    />
                  </Space>
                  <Text type="secondary">
                    {instance.snapshot.providerKey} ·{' '}
                    {localeCode === 'zh_CN' ? '最近观测' : 'Last observed'}{' '}
                    {formatDateTime(instance.lastObservedAt)}
                  </Text>
                </div>
                {canInspect ? (
                  <Space size={4}>
                    <ManagementIconButton
                      aria-label={
                        localeCode === 'zh_CN' ? '检查连接健康' : 'Check connection health'
                      }
                      icon={<ReloadOutlined />}
                      loading={busy}
                      size="small"
                      tooltip={localeCode === 'zh_CN' ? '检查连接健康' : 'Check connection health'}
                      onClick={() =>
                        healthMutation.mutate(
                          {
                            domain: instance.snapshot.domain,
                            providerKey: instance.snapshot.providerKey,
                            instanceRef: instance.instanceRef,
                            input: { expectedGeneration: instance.snapshot.generation },
                          },
                          {
                            onSuccess: (result) => openTask(result.data.domain, result.data.id),
                            onError: (error) => void message.error(error.message),
                          },
                        )
                      }
                    />
                    <ManagementIconButton
                      aria-label={localeCode === 'zh_CN' ? '发现并同步资源' : 'Discover resources'}
                      icon={<SyncOutlined />}
                      loading={busy}
                      size="small"
                      tooltip={localeCode === 'zh_CN' ? '发现并同步资源' : 'Discover resources'}
                      onClick={() =>
                        discoveryMutation.mutate(
                          {
                            domain: instance.snapshot.domain,
                            providerKey: instance.snapshot.providerKey,
                            instanceRef: instance.instanceRef,
                            input: {
                              expectedGeneration: instance.snapshot.generation,
                              maxItems: 1000,
                            },
                          },
                          {
                            onSuccess: (result) => openTask(result.data.domain, result.data.id),
                            onError: (error) => void message.error(error.message),
                          },
                        )
                      }
                    />
                  </Space>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
