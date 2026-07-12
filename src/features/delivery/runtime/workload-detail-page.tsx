import { lazy, Suspense, useEffect, useState } from 'react'
import '../applications/styles.css'
import { App, Button, Card, Modal, Space, Tabs, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { DeploymentDetail, Pod } from '../types'

const { Text } = Typography

const PodLogViewer = lazy(async () => {
  const module = await import('@/components/pod-log-viewer')
  return { default: module.PodLogViewer }
})

const PodTerminal = lazy(async () => {
  const module = await import('@/components/pod-terminal')
  return { default: module.PodTerminal }
})

const ResourceMetricsPanel = lazy(async () => {
  const module = await import('@/components/resource-metrics-panel')
  return { default: module.ResourceMetricsPanel }
})
function firstPodName(pods?: Pod[]) {
  return pods?.[0]?.name || ''
}

function DeploymentOverview({ deployment }: { deployment: DeploymentDetail }) {
  return (
    <Card className="soha-management-panel-card">
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <div className="soha-application-runtime-overview">
          <div>
            <Text type="secondary">Workload</Text>
            <div className="soha-application-runtime-overview__title">{deployment.name}</div>
          </div>
          <Tag color="blue">{deployment.strategy}</Tag>
        </div>
        <div className="soha-application-runtime-statgrid">
          <Card className="soha-management-panel-card" size="small">
            <Text type="secondary">Desired</Text>
            <div>{deployment.desiredReplicas}</div>
          </Card>
          <Card className="soha-management-panel-card" size="small">
            <Text type="secondary">Ready</Text>
            <div>{deployment.readyReplicas}</div>
          </Card>
          <Card className="soha-management-panel-card" size="small">
            <Text type="secondary">Available</Text>
            <div>{deployment.availableReplicas}</div>
          </Card>
        </div>
        <Card className="soha-management-panel-card" size="small" title="Labels">
          <Space wrap>
            {Object.entries(deployment.labels ?? {}).map(([key, value]) => (
              <Tag key={key}>{`${key}=${value}`}</Tag>
            ))}
          </Space>
        </Card>
      </Space>
    </Card>
  )
}
export function ApplicationWorkloadDetailPage() {
  const { applicationId, applicationEnvironmentId, workloadName } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPodName, setSelectedPodName] = useState('')
  const [terminalVisible, setTerminalVisible] = useState(false)
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(permissionSnapshotQuery.data?.data, 'delivery.application.update')

  const workloadRef = {
    applicationId: applicationId ?? '',
    applicationEnvironmentId: applicationEnvironmentId ?? '',
    workloadName: workloadName ?? '',
  }
  const detailQuery = useQuery(
    deliveryQueries.workloads.runtime(
      workloadRef,
      Boolean(applicationId && applicationEnvironmentId && workloadName),
    ),
  )

  const detail = detailQuery.data
  const podList = detail?.pods ?? []
  const serviceList = detail?.services ?? []
  const ingressList = detail?.ingresses ?? []
  const deployment = detail?.deployment

  useEffect(() => {
    if (!selectedPodName) {
      setSelectedPodName(firstPodName(podList))
    }
  }, [podList, selectedPodName])

  const selectedPod = podList.find((item) => item.name === selectedPodName) ?? podList[0]

  useAIPageContext({
    sourceWorkbench: 'delivery',
    sourceTitle: detail?.workload?.workloadName
      ? `应用工作负载 ${detail.workload.workloadName}`
      : '应用工作负载详情',
    entityKind: 'delivery.application-workload',
    entityName: detail?.workload.workloadName ?? workloadName,
    applicationId,
    clusterId: detail?.workload?.clusterId,
    namespace: detail?.workload?.namespace,
    workload: detail?.workload?.workloadName ?? workloadName,
    pod: selectedPod?.name,
    visibleFilters: {
      tab: activeTab,
      applicationEnvironmentId,
      selectedPodName,
    },
    pinnedData: {
      podCount: podList.length,
      serviceCount: serviceList.length,
      ingressCount: ingressList.length,
      readyReplicas: deployment?.readyReplicas,
      desiredReplicas: deployment?.desiredReplicas,
    },
  })

  const metricsQuery = useQuery(
    deliveryQueries.workloads.metrics(
      {
        clusterId: detail?.workload.clusterId ?? '',
        namespace: detail?.workload.namespace ?? '',
        workloadName: detail?.workload.workloadName ?? '',
        rangeMinutes: 60,
      },
      Boolean(detail && activeTab === 'metrics'),
    ),
  )

  const restartOptions = deliveryMutations.workloads.restart(queryClient)
  const restartMutation = useMutation({
    ...restartOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void restartOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('已触发重启')
    },
    onError: (err: Error) => message.error(err.message),
  })

  if (detailQuery.isLoading) {
    return (
      <div className="soha-page">
        <ManagementState kind="loading" title="Loading..." />
      </div>
    )
  }
  if (!detail || !deployment) {
    return (
      <div className="soha-page">
        <ManagementState kind="not-found" description="未找到运行详情" />
      </div>
    )
  }

  const tabItems = [
    {
      key: 'overview',
      label: '概览',
      children: <DeploymentOverview deployment={deployment} />,
    },
    {
      key: 'pods',
      label: 'Pods',
      children: (
        <DeliveryTable
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '状态', dataIndex: 'phase' },
            { title: '节点', dataIndex: 'nodeName', render: (value?: string) => value || '-' },
            { title: '重启', dataIndex: 'restarts' },
          ]}
          dataSource={podList}
          rowKey="name"
          pageSize={10}
          onRow={(record: Pod) => ({
            onClick: () => setSelectedPodName(record.name),
          })}
        />
      ),
    },
    {
      key: 'network',
      label: '网络',
      children: (
        <div className="soha-application-runtime-network">
          <DeliveryTable
            title="Services"
            columns={[
              { title: '名称', dataIndex: 'name' },
              { title: '类型', dataIndex: 'type' },
              {
                title: 'Cluster IP',
                dataIndex: 'clusterIp',
                render: (value?: string) => value || '-',
              },
            ]}
            dataSource={serviceList}
            rowKey="name"
            pageSize={10}
          />
          <DeliveryTable
            title="Ingresses"
            columns={[
              { title: '名称', dataIndex: 'name' },
              {
                title: '主机',
                dataIndex: 'hosts',
                render: (value?: string[]) => (value ?? []).join(', ') || '-',
              },
              {
                title: '后端',
                dataIndex: 'backendServices',
                render: (value?: string[]) => (value ?? []).join(', ') || '-',
              },
            ]}
            dataSource={ingressList}
            rowKey="name"
            pageSize={10}
          />
        </div>
      ),
    },
    {
      key: 'logs',
      label: '日志',
      children: selectedPod ? (
        <Suspense fallback={<ManagementState bordered={false} compact kind="loading" />}>
          <PodLogViewer
            clusterId={detail.workload.clusterId}
            namespace={detail.workload.namespace}
            podName={selectedPod.name}
          />
        </Suspense>
      ) : (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          description="请选择一个 Pod"
        />
      ),
    },
    {
      key: 'terminal',
      label: '终端',
      children: selectedPod ? (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Button type="primary" onClick={() => setTerminalVisible(true)}>
            打开终端
          </Button>
          <Card title={selectedPod.name}>
            <Text type="secondary">
              终端会复用当前 Pod 的 cluster / namespace / workload 上下文。
            </Text>
          </Card>
          <Modal
            title={`Terminal: ${selectedPod.name}`}
            open={terminalVisible}
            onCancel={() => setTerminalVisible(false)}
            footer={null}
            width={1080}
          >
            <Suspense fallback={<ManagementState bordered={false} compact kind="loading" />}>
              <PodTerminal
                clusterId={detail.workload.clusterId}
                namespace={detail.workload.namespace}
                podName={selectedPod.name}
              />
            </Suspense>
          </Modal>
        </Space>
      ) : (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          description="请选择一个 Pod"
        />
      ),
    },
    {
      key: 'metrics',
      label: '监控',
      children: (
        <Suspense fallback={<ManagementState bordered={false} compact kind="loading" />}>
          <ResourceMetricsPanel
            title="Deployment Metrics"
            data={metricsQuery.data}
            loading={metricsQuery.isLoading}
            rangeMinutes={60}
            compact
          />
        </Suspense>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={detail.application.name}
        description={`${detail.environment?.name || detail.binding.environmentKey || detail.binding.environmentId} · ${detail.workload.workloadName}`}
        actions={
          <Space>
            <Button onClick={() => navigate(`/applications/${detail.application.id}`)}>
              返回应用
            </Button>
            {canManage ? (
              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  restartMutation.mutate({
                    clusterId: detail.workload.clusterId,
                    namespace: detail.workload.namespace,
                    workloadName: detail.workload.workloadName,
                  })
                }
              >
                重启
              </Button>
            ) : null}
          </Space>
        }
      />
      <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  )
}
