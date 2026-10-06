import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Popconfirm, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { NetworkProxyConnection } from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import { formatBytes } from '@/components/resource-metrics-format'
import {
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryPanel,
  ManagementState,
} from '@/components/management-list'
import { hasPermission } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { closeConnection } from './api'
import { ProxyInstanceHeader, useProxyContext } from './context'
import { proxyKeys, proxyQueries } from './queries'
import './styles.css'

export default function ProxyConnectionsPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const context = useProxyContext('network_access.proxy_instances.view')
  const canView = hasPermission(
    context.permissions.data?.data,
    'network_access.proxy_connections.view',
  )
  const canClose = hasPermission(
    context.permissions.data?.data,
    'network_access.proxy_connections.close',
  )
  const selected = context.selected
  const snapshot = useQuery(proxyQueries.connections(selected?.id, canView))
  const traffic = useQuery(proxyQueries.traffic(selected?.id, canView))
  const samples = traffic.data?.samples ?? []
  const latest = samples[samples.length - 1]
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const close = useMutation({
    mutationFn: (connectionId: string) => closeConnection(selected!.id, connectionId),
    onSuccess: () => {
      message.success(
        t('networkAccess.proxyRuntime.closeQueued', '关闭请求已提交，等待运行时确认。'),
      )
      if (selected)
        void queryClient.invalidateQueries({ queryKey: proxyKeys.connections(selected.id) })
    },
    onError: () => message.error(t('networkAccess.proxyRuntime.closeFailed', '关闭请求提交失败。')),
  })
  const rows = (snapshot.data?.connections ?? []).filter(
    (item) =>
      !keyword ||
      [item.id, item.destination, item.network].some((value) =>
        value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
      ),
  )
  const columns: TableColumnsType<NetworkProxyConnection> = [
    {
      title: t('networkAccess.proxyRuntime.destination', '目的地'),
      dataIndex: 'destination',
      ellipsis: true,
    },
    { title: t('networkAccess.proxyRuntime.network', '网络'), dataIndex: 'network', width: 90 },
    {
      title: t('networkAccess.proxyRuntime.uploadBytes', '上传'),
      dataIndex: 'uploadBytes',
      width: 120,
      render: formatBytes,
    },
    {
      title: t('networkAccess.proxyRuntime.downloadBytes', '下载'),
      dataIndex: 'downloadBytes',
      width: 120,
      render: formatBytes,
    },
    {
      title: t('networkAccess.proxyRuntime.startedAt', '开始时间'),
      dataIndex: 'startedAt',
      width: 185,
      render: (value?: string) => (value ? formatDateTime(value) : '—'),
    },
    ...(canClose && selected?.capabilities.includes('close_connection')
      ? [
          {
            title: t('common.actions', '操作'),
            key: 'actions',
            className: 'soha-table-actions-column',
            width: 110,
            render: (_: unknown, record: NetworkProxyConnection) => (
              <Popconfirm
                title={t('networkAccess.proxyRuntime.confirmClose', '确认断开此连接？')}
                description={record.destination}
                okText={t('networkAccess.proxyRuntime.disconnect', '断开')}
                okButtonProps={{ danger: true }}
                onConfirm={() => close.mutate(record.id)}
              >
                <Button
                  danger
                  size="small"
                  loading={close.isPending && close.variables === record.id}
                >
                  {t('networkAccess.proxyRuntime.disconnect', '断开')}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ]
  if (!context.allowed || !canView) {
    return <ManagementState kind={context.permissions.isLoading ? 'loading' : 'no-permission'} />
  }
  if (context.instances.isLoading) return <ManagementState kind="loading" />
  if (context.instances.isError && !context.instances.data) {
    return (
      <ManagementState
        kind="error"
        actions={
          <Button onClick={() => void context.instances.refetch()}>
            {t('networkAccess.refresh', '刷新')}
          </Button>
        }
      />
    )
  }
  if (!selected)
    return (
      <ManagementState
        kind="empty"
        description={t(
          'networkAccess.proxyRuntime.noInstances',
          '尚无代理实例。请先在代理实例页面创建并登记运行时。',
        )}
      />
    )
  return (
    <main className="soha-server-proxy-page">
      <ProxyInstanceHeader
        instances={context.instances.data ?? []}
        selected={selected}
        onSelect={context.select}
      />
      <div className="soha-server-proxy-actions">
        <div>
          <h2>{t('networkAccess.proxyRuntime.connections', '活动连接')}</h2>
          <Typography.Text type="secondary">
            {snapshot.data?.observedAt
              ? `${t('networkAccess.proxyRuntime.sampledAt', '最近采样')}：${formatDateTime(snapshot.data.observedAt)} · ${t('networkAccess.proxyRuntime.maxConnections', '最多展示 200 条')}`
              : t('networkAccess.proxyRuntime.noSample', '未采集')}
          </Typography.Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={snapshot.isFetching}
          onClick={() => void snapshot.refetch()}
        >
          {t('networkAccess.refresh', '刷新')}
        </Button>
      </div>
      {snapshot.isError && snapshot.data ? (
        <ManagementState
          compact
          kind="error"
          description={t('networkAccess.proxyRuntime.stale', '刷新失败，当前显示上次采样。')}
        />
      ) : null}
      {snapshot.isError && !snapshot.data ? (
        <ManagementState
          kind="error"
          description={t(
            'networkAccess.proxyRuntime.connectionsError',
            '连接快照暂不可用，请检查运行时后重试。',
          )}
        />
      ) : snapshot.isLoading ? (
        <ManagementState kind="loading" />
      ) : snapshot.data?.state === 'unsupported' ? (
        <ManagementState
          kind="empty"
          description={t(
            'networkAccess.proxyRuntime.connectionsUnsupported',
            '此引擎不提供逐连接详情和断开操作。',
          )}
        />
      ) : snapshot.data?.state === 'unavailable' ? (
        <ManagementState
          kind="empty"
          description={t(
            'networkAccess.proxyRuntime.connectionsUnavailable',
            '暂无新鲜连接快照，请检查实例状态。',
          )}
        />
      ) : (
        <>
          <div className="soha-server-proxy-metrics soha-server-proxy-connection-metrics">
            <Card size="small">
              <span>{t('networkAccess.proxyRuntime.activeConnections', '活动连接')}</span>
              <strong>{latest?.activeConnections ?? '—'}</strong>
              <small>
                {latest
                  ? t('networkAccess.proxyRuntime.sampleCount', '最新快照')
                  : t('networkAccess.proxyRuntime.noSample', '未采集')}
              </small>
            </Card>
            <Card size="small">
              <span>{t('networkAccess.proxyRuntime.visibleConnections', '已展示连接')}</span>
              <strong>{snapshot.data?.connections.length ?? 0}</strong>
              <small>{t('networkAccess.proxyRuntime.maxConnections', '最多展示 200 条')}</small>
            </Card>
            <Card size="small">
              <span>{t('networkAccess.proxyRuntime.uploadRate', '上传速率')}</span>
              <strong>{latest ? `${formatBytes(latest.uploadBytesPerSecond)}/s` : '—'}</strong>
              <small>
                {latest
                  ? formatDateTime(latest.observedAt)
                  : t('networkAccess.proxyRuntime.noSample', '未采集')}
              </small>
            </Card>
            <Card size="small">
              <span>{t('networkAccess.proxyRuntime.downloadRate', '下载速率')}</span>
              <strong>{latest ? `${formatBytes(latest.downloadBytesPerSecond)}/s` : '—'}</strong>
              <small>
                {latest
                  ? formatDateTime(latest.observedAt)
                  : t('networkAccess.proxyRuntime.noSample', '未采集')}
              </small>
            </Card>
          </div>
          <ManagementQueryPanel
            onFinish={() => setKeyword(draft.trim())}
            actions={
              <ManagementQueryActions
                disabledReset={!draft && !keyword}
                onReset={() => {
                  setDraft('')
                  setKeyword('')
                }}
              />
            }
          >
            <ManagementKeywordField
              value={draft}
              onChange={setDraft}
              placeholder={t(
                'networkAccess.proxyRuntime.searchConnections',
                '搜索目的地、网络或连接 ID',
              )}
            />
          </ManagementQueryPanel>
          <AdminTable
            columns={columns}
            dataSource={rows}
            rowKey="id"
            localSorting
            loading={snapshot.isLoading}
            refreshing={snapshot.isFetching}
            onRefresh={() => void snapshot.refetch()}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            empty={
              keyword
                ? t('networkAccess.proxyRuntime.noMatch', '没有符合条件的连接。')
                : t('networkAccess.proxyRuntime.noConnections', '当前没有活动连接。')
            }
          />
        </>
      )}
    </main>
  )
}
