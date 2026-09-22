import { SafetyCertificateOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Steps, Typography, type TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import { DeliveryTable } from '../delivery-table'
import { deliveryQueries } from '../queries'
import type { ExecutionTask } from '../types'
import { executionTaskUpdatedAt, isActiveStatus, isBlockedStatus, sortByLatest } from './shared'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

export function DeliveryAnalysisPage() {
  const navigate = useNavigate()
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canViewTasks = hasPermission(permissionSnapshot, 'delivery.execution-tasks.view')
  const canViewReleaseBoard = hasPermission(permissionSnapshot, 'delivery.release-board.view')
  const canViewBundles = hasPermission(permissionSnapshot, 'delivery.release-bundles.view')
  const tasksQuery = useQuery(
    deliveryQueries.executionTasks.list({ enabled: canViewTasks, refetchInterval: 5000 }),
  )
  const releaseBoardQuery = useQuery(
    deliveryQueries.releaseBoard.list({ enabled: canViewReleaseBoard, refetchInterval: 5000 }),
  )
  const bundlesQuery = useQuery(deliveryQueries.releaseBundles.list({ enabled: canViewBundles }))

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
  const analysisStats: OverviewMetricItem[] = [
    {
      key: 'failed',
      label: '失败任务',
      value: canViewTasks && !tasksQuery.isError ? failedTasks.length : '-',
      helper: canViewTasks
        ? `${tasks.filter((item) => isActiveStatus(item.status)).length} 个仍在执行`
        : '无执行任务查看权限',
      tone: failedTasks.length > 0 ? 'danger' : 'success',
    },
    {
      key: 'environments',
      label: '阻塞环境',
      value: canViewReleaseBoard && !releaseBoardQuery.isError ? blockedBoard.length : '-',
      helper: canViewReleaseBoard ? '来自发布看板状态聚合' : '无发布看板查看权限',
      tone: blockedBoard.length > 0 ? 'danger' : 'success',
    },
    {
      key: 'bundles',
      label: '阻塞版本',
      value:
        canViewBundles && !bundlesQuery.isError
          ? bundles.filter((item) => isBlockedStatus(item.status)).length
          : '-',
      helper: canViewBundles ? '来自版本包状态' : '无版本包查看权限',
      tone: 'warning',
    },
    {
      key: 'retryable',
      label: '可重试任务',
      value:
        canViewTasks && !tasksQuery.isError
          ? failedTasks.filter((item) => item.attemptCount < item.maxRetries).length
          : '-',
      helper: canViewTasks ? '常规任务操作入口保留' : '无执行任务查看权限',
    },
  ]
  const columns: ColumnProps<ExecutionTask>[] = [
    {
      title: '任务',
      dataIndex: 'taskKind',
      render: (value: string, record: ExecutionTask) => (
        <Space orientation="vertical" size={0}>
          <Space size={6} wrap>
            <Text strong>{value}</Text>
            {isBlockedStatus(record.status) ? <StatusTag value="failed" label="需处理" /> : null}
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
      <div className="soha-overview-metric-grid">
        {analysisStats.map(({ key, ...item }) => (
          <OverviewMetricCard key={key} {...item} />
        ))}
      </div>
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
        aria-label="最近任务与故障线索"
        rowKey="id"
        dataSource={recentTasks}
        empty={
          canViewTasks ? undefined : (
            <ManagementState
              bordered={false}
              compact
              kind="no-permission"
              title="无执行任务查看权限"
            />
          )
        }
        isError={canViewTasks && tasksQuery.isError}
        errorDescription="暂时无法读取最近任务。"
        onRetry={() => void tasksQuery.refetch()}
        loading={canViewTasks && tasksQuery.isLoading}
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
          canViewReleaseBoard ? (
            <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/release-board')}>
              查看影响面
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
