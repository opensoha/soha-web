import {
  BugOutlined,
  FileTextOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Steps, Tag, Typography, type TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import { DeliveryTable } from '../delivery-table'
import { deliveryQueries } from '../queries'
import type { ExecutionTask } from '../types'
import {
  ActionCards,
  executionTaskUpdatedAt,
  isActiveStatus,
  isBlockedStatus,
  ManualModeAlert,
  sortByLatest,
  StatCards,
  WorkbenchHeader,
} from './shared'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

export function DeliveryAnalysisPage() {
  const navigate = useNavigate()
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list({ refetchInterval: 5000 }))
  const releaseBoardQuery = useQuery(deliveryQueries.releaseBoard.list({ refetchInterval: 5000 }))
  const bundlesQuery = useQuery(deliveryQueries.releaseBundles.list())

  const tasks = tasksQuery.data ?? []
  const board = releaseBoardQuery.data ?? []
  const bundles = bundlesQuery.data ?? []
  const blockedBoard = board.filter(
    (entry) =>
      isBlockedStatus(entry.latestBuild?.status) ||
      isBlockedStatus(entry.latestWorkflow?.status) ||
      isBlockedStatus(entry.latestExecutionTask?.status) ||
      isBlockedStatus(entry.latestRelease?.status) ||
      isBlockedStatus(entry.latestBundle?.status),
  )
  const failedTasks = tasks.filter((task) => isBlockedStatus(task.status))
  const recentTasks = sortByLatest(tasks, executionTaskUpdatedAt).slice(0, 10)
  const analysisStats = [
    {
      label: '失败任务',
      value: failedTasks.length,
      hint: `${tasks.filter((item) => isActiveStatus(item.status)).length} 个仍在执行`,
    },
    { label: '阻塞环境', value: blockedBoard.length, hint: '来自发布看板状态聚合' },
    {
      label: '阻塞版本',
      value: bundles.filter((item) => isBlockedStatus(item.status)).length,
      hint: '来自版本包状态',
    },
    {
      label: '可重试任务',
      value: failedTasks.filter((item) => item.attemptCount < item.maxRetries).length,
      hint: '常规任务操作入口保留',
    },
  ]
  const loading = tasksQuery.isLoading || releaseBoardQuery.isLoading || bundlesQuery.isLoading

  const columns: ColumnProps<ExecutionTask>[] = [
    {
      title: '任务',
      dataIndex: 'taskKind',
      render: (value: string, record: ExecutionTask) => (
        <Space orientation="vertical" size={0}>
          <Space size={6} wrap>
            <Text strong>{value}</Text>
            {isBlockedStatus(record.status) ? <Tag color="error">需处理</Tag> : null}
          </Space>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: '应用', dataIndex: 'applicationId' },
    {
      title: '环境绑定',
      dataIndex: 'applicationEnvironmentId',
      render: (value: string) => value || '-',
    },
    {
      title: '类型',
      dataIndex: 'providerKind',
      render: (value: string, record: ExecutionTask) => `${value} / ${record.targetKind}`,
    },
    { title: '版本包', dataIndex: 'releaseBundleId', render: (value: string) => value || '-' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
    {
      title: '重试',
      dataIndex: 'attemptCount',
      render: (value: number, record: ExecutionTask) => `${value}/${record.maxRetries}`,
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近更新',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
  ]

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <WorkbenchHeader
        title="问题分析"
        description="聚合失败任务、阻塞环境、日志入口和影响面，面向开发与测试先给出可操作的常规排查入口。"
      />
      <ManualModeAlert description="常规模式保留任务日志、发布看板、版本包和重试入口；AI 分析只是对这些证据做摘要、归因和修复建议。" />
      <StatCards items={analysisStats} />
      <ActionCards
        items={[
          {
            label: '任务日志',
            description: '进入执行任务查看日志、结果、制品和重试操作。',
            icon: <BugOutlined />,
            path: '/delivery/execution-tasks',
            type: 'primary',
          },
          {
            label: '发布态势',
            description: '按应用环境查看构建、工作流、发布和审批状态。',
            icon: <RocketOutlined />,
            path: '/release-board',
          },
          {
            label: '版本证据',
            description: '核对版本包、artifact、digest 与生成来源。',
            icon: <FileTextOutlined />,
            path: '/delivery/release-bundles',
          },
        ]}
      />
      <div className="soha-delivery-workbench-grid">
        <DeliveryGatewayReadinessPanel
          title="AI Gateway 故障分析"
          description="可在常规证据基础上汇总失败原因、影响范围和修复建议，适合发布失败、验证失败和 K8s 运行态问题。"
          skillId="delivery-tester"
          manualPath="/delivery/execution-tasks"
          manualTitle="手工排查"
          capabilities={[
            'diagnosis.release_failure.analyze',
            'delivery.rollback.context',
            'delivery.release_context.diff',
            'k8s.pods.logs',
            'k8s.deployments.events',
          ]}
        />
        <Card className="soha-management-panel-card" title="分析闭环" size="small">
          <Steps
            current={1}
            orientation="vertical"
            items={[
              {
                title: '定位失败对象',
                content: '从失败任务或阻塞环境进入具体应用、环境和版本。',
              },
              {
                title: '收集证据',
                content: '查看任务日志、发布记录、K8s 事件、diff 和制品信息。',
              },
              {
                title: '修复并验证',
                content: '常规重试或重新触发验证，AI 建议必须回链证据。',
              },
            ]}
          />
        </Card>
      </div>
      <DeliveryTable
        title="最近任务与故障线索"
        rowKey="id"
        dataSource={recentTasks}
        loading={loading}
        refreshing={
          tasksQuery.isFetching || releaseBoardQuery.isFetching || bundlesQuery.isFetching
        }
        onRefresh={() => {
          void tasksQuery.refetch()
          void releaseBoardQuery.refetch()
          void bundlesQuery.refetch()
        }}
        columns={columns}
        actions={
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/release-board')}>
            查看影响面
          </Button>
        }
      />
    </div>
  )
}
