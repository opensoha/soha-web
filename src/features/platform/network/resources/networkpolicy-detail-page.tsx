import { useState } from 'react'
import { Button, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import type { TableColumnsType } from 'antd'
import { NetworkDetailShell } from '../shared/detail-shell'
import { renderNetworkTextList } from '../shared/renderers'
import { resolveNetworkNamespace } from '../shared/scope'
import { networkCoreQueries } from './queries'
import type {
  NetworkPolicyDetail,
  NetworkPolicyPeer,
  NetworkPolicyPod,
  NetworkPolicyPort,
  NetworkPolicyRule,
} from './types'

function renderPeers(peers?: NetworkPolicyPeer[]) {
  if (!peers?.length) return 'All'
  return peers
    .map((peer) =>
      [
        peer.namespaceSelector && `namespace: ${peer.namespaceSelector}`,
        peer.podSelector && `pod: ${peer.podSelector}`,
        peer.ipBlock && `ip: ${peer.ipBlock}`,
      ]
        .filter(Boolean)
        .join('; '),
    )
    .join(' | ')
}

function renderPorts(ports?: NetworkPolicyPort[]) {
  if (!ports?.length) return 'All'
  return ports
    .map(
      (port) =>
        `${port.protocol || 'TCP'}/${port.port || '*'}${port.endPort ? `-${port.endPort}` : ''}`,
    )
    .join(', ')
}

export function NetworkPolicyDetailPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const [searchParams] = useSearchParams()
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(
    networkCoreQueries.detail<NetworkPolicyDetail>('networkpolicies', scope, name),
  )
  const detail = query.data
  if (!clusterId || !detailNamespace)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  if (query.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'NetworkPolicy 未找到' : 'NetworkPolicy not found'}
        />
      </div>
    )
  const ruleColumns: TableColumnsType<NetworkPolicyRule> = [
    { title: localeCode === 'zh_CN' ? '方向' : 'Direction', dataIndex: 'direction' },
    {
      title: localeCode === 'zh_CN' ? '来源 / 目标' : 'Peers',
      dataIndex: 'peers',
      render: renderPeers,
    },
    { title: localeCode === 'zh_CN' ? '端口' : 'Ports', dataIndex: 'ports', render: renderPorts },
  ]
  const podColumns: TableColumnsType<NetworkPolicyPod> = [
    {
      title: 'Pod',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() =>
            navigate(
              `/workloads/pods/${encodeURIComponent(value)}?${new URLSearchParams({ namespace: record.namespace })}`,
            )
          }
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'phase',
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: 'Ready', dataIndex: 'readyContainers' },
    { title: localeCode === 'zh_CN' ? '重启次数' : 'Restarts', dataIndex: 'restarts' },
  ]
  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      detail={detail}
      kind="networkpolicies"
      label="NetworkPolicy"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Policy Types', value: renderNetworkTextList(detail.policyTypes) },
        { key: 'Pod Selector', value: detail.podSelector || '{}' },
        { key: 'Rules', value: detail.rules?.length ?? 0 },
        { key: 'Matching Pods', value: detail.matchingPods?.length ?? 0 },
      ]}
      overviewContent={
        <>
          <Card className="soha-detail-card" title={localeCode === 'zh_CN' ? '规则' : 'Rules'}>
            <AdminTable
              columns={ruleColumns}
              dataSource={detail.rules ?? []}
              rowKey={(record) =>
                `${record.direction}/${renderPeers(record.peers)}/${renderPorts(record.ports)}`
              }
              pageSize={10}
              tableSize="small"
              scroll={{ x: 'max-content' }}
              enableColumnSelection={false}
            />
          </Card>
          <Card
            className="soha-detail-card"
            title={localeCode === 'zh_CN' ? '匹配 Pods' : 'Matching pods'}
          >
            <AdminTable
              columns={podColumns}
              dataSource={detail.matchingPods ?? []}
              rowKey={(record) => `${record.namespace}/${record.name}`}
              pageSize={10}
              tableSize="small"
              scroll={{ x: 'max-content' }}
              enableColumnSelection={false}
            />
          </Card>
        </>
      }
      target={{ scope, name }}
    />
  )
}
