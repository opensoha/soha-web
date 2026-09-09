import { ExperimentOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Steps, Typography, type TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import { DeliveryTable } from '../delivery-table'
import { deliveryQueries } from '../queries'
import type { ReleaseBundle } from '../types'
import {
  isActiveStatus,
  isBlockedStatus,
  isReadyStatus,
  releaseBundleUpdatedAt,
  sortByLatest,
  VERIFY_TASK_KINDS,
  workflowValidationCount,
} from './shared'
import { summarizeDeliveryGovernance } from './governance'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

export function DeliveryTestingPage() {
  const navigate = useNavigate()
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canViewBundles = hasPermission(permissionSnapshot, 'delivery.release-bundles.view')
  const canViewTasks = hasPermission(permissionSnapshot, 'delivery.execution-tasks.view')
  const canViewReleaseBoard = hasPermission(permissionSnapshot, 'delivery.release-board.view')
  const bundlesQuery = useQuery(
    deliveryQueries.releaseBundles.list({ enabled: canViewBundles }),
  )
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list({ enabled: canViewTasks }))
  const releaseBoardQuery = useQuery(
    deliveryQueries.releaseBoard.list({ enabled: canViewReleaseBoard }),
  )

  const bundles = bundlesQuery.data ?? []
  const tasks = tasksQuery.data ?? []
  const board = releaseBoardQuery.data ?? []
  const verifyTasks = tasks.filter((task) => {
    const taskKind = String(task.taskKind || '').toLowerCase()
    return (
      VERIFY_TASK_KINDS.has(taskKind) ||
      taskKind.includes('verify') ||
      taskKind.includes('test') ||
      taskKind.includes('check')
    )
  })
  const latestBundles = sortByLatest(bundles, releaseBundleUpdatedAt).slice(0, 8)
  const governanceByBundle = new Map(
    bundles.map((bundle) => [bundle.id, summarizeDeliveryGovernance(bundle, tasks)]),
  )
  const governance = bundles.map((bundle) => governanceByBundle.get(bundle.id)!)
  const candidateBundles = bundles.filter(
    (bundle) => governanceByBundle.get(bundle.id)?.decision !== 'blocked',
  )
  const testingStats: OverviewMetricItem[] = [
    {
      key: 'candidates',
      label: '候选版本',
      value: canViewBundles && !bundlesQuery.isError ? candidateBundles.length : '-',
      helper: canViewBundles
        ? `${bundles.filter((item) => isReadyStatus(item.status)).length} 个已就绪 · ${governance.filter((item) => item.decision === 'passed').length} 个通过门禁`
        : '无版本包查看权限',
    },
    {
      key: 'verification',
      label: '验证任务',
      value: canViewTasks && !tasksQuery.isError ? verifyTasks.length : '-',
      helper: canViewTasks
        ? `${verifyTasks.filter((item) => isActiveStatus(item.status)).length} 个执行中`
        : '无执行任务查看权限',
    },
    {
      key: 'blocked',
      label: '阻塞证据',
      value:
        (canViewBundles || canViewTasks) && !bundlesQuery.isError && !tasksQuery.isError
          ? bundles.filter((item) => isBlockedStatus(item.status)).length +
            verifyTasks.filter((item) => isBlockedStatus(item.status)).length
          : '-',
      helper: canViewBundles || canViewTasks ? '基于当前可见记录' : '无相关记录查看权限',
      tone: 'danger',
    },
    {
      key: 'dag',
      label: 'DAG 验证节点',
      value:
        canViewReleaseBoard && !releaseBoardQuery.isError
          ? board.reduce((sum, item) => sum + workflowValidationCount(item), 0)
          : '-',
      helper: canViewReleaseBoard ? '来自工作流节点执行记录' : '无发布看板查看权限',
    },
  ]

  const columns: ColumnProps<ReleaseBundle>[] = [
    {
      title: '候选版本',
      dataIndex: 'version',
      render: (value: string, record: ReleaseBundle) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
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
    { title: '来源', dataIndex: 'sourceType' },
    {
      title: '交付物',
      dataIndex: 'artifactRef',
      render: (value: string, record: ReleaseBundle) => value || record.artifactDigest || '-',
    },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
    {
      title: '验证判断',
      dataIndex: 'id',
      render: (_: string, record: ReleaseBundle) => {
        const result = governanceByBundle.get(record.id)
        return result ? <StatusTag value={result.label} /> : <StatusTag value="未验证" />
      },
    },
    {
      title: '治理证据',
      dataIndex: 'id',
      render: (_: string, record: ReleaseBundle) => {
        const result = governanceByBundle.get(record.id)
        if (!result) return '-'
        return (
          <Space size={4} wrap>
            {result.approvalStatus ? (
              <MetadataTag label={`审批:${result.approvalStatus}`} tone="gold" />
            ) : null}
            {result.approvalRequestId ? (
              <MetadataTag label={`审批单:${result.approvalRequestId}`} tone="orange" />
            ) : null}
            {result.rollbackTaskCount ? (
              <MetadataTag label={`回滚:${result.rollbackTaskCount}`} tone="blue" />
            ) : null}
            {result.evidenceRefs.length ? (
              <MetadataTag label={`报告:${result.evidenceRefs.length}`} tone="cyan" />
            ) : null}
            {result.aiAuditRefs.length ? (
              <MetadataTag label={`AI审计:${result.aiAuditRefs.length}`} tone="purple" />
            ) : null}
            {result.reason ? <Text type="danger">{result.reason}</Text> : null}
          </Space>
        )
      },
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
  ]

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <div className="soha-overview-metric-grid">
        {testingStats.map(({ key, ...item }) => (
          <OverviewMetricCard key={key} {...item} />
        ))}
      </div>
      <div className="soha-delivery-workbench-grid">
        <DeliveryGatewayReadinessPanel
          title="AI Gateway 验证辅助"
          description="可以汇总版本、任务日志、diff 和验证证据，输出是否可晋级的建议；最终晋级仍由常规流程和审批决定。"
          skillId="delivery-tester"
          manualPath="/delivery/execution-tasks"
          manualTitle="手工验证"
          capabilities={[
            'delivery.release.plan',
            'delivery.release_context.diff',
            'delivery.release_bundles.list',
            'delivery.execution_tasks.list',
            'delivery.execution_logs.list',
          ]}
        />
        <Card className="soha-management-panel-card" title="验证证据来源" size="small">
          <Steps
            current={2}
            orientation="vertical"
            items={[
              { title: '版本包', content: '固定版本号、镜像、digest 和来源。' },
              { title: '执行任务', content: '构建、发布、验证和回滚任务状态与日志。' },
              { title: '发布看板', content: '应用环境维度的候选版本、审批和目标状态。' },
            ]}
          />
        </Card>
      </div>
      <DeliveryTable
        title="候选版本与验证判断"
        rowKey="id"
        dataSource={latestBundles}
        empty={
          canViewBundles ? undefined : (
            <ManagementState bordered={false} compact kind="no-permission" title="无版本包查看权限" />
          )
        }
        isError={canViewBundles && bundlesQuery.isError}
        errorDescription="暂时无法读取候选版本。"
        onRetry={() => void bundlesQuery.refetch()}
        loading={canViewBundles && bundlesQuery.isLoading}
        refreshing={
          bundlesQuery.isFetching || tasksQuery.isFetching || releaseBoardQuery.isFetching
        }
        onRefresh={() => {
          void bundlesQuery.refetch()
          void tasksQuery.refetch()
          void releaseBoardQuery.refetch()
        }}
        columns={columns}
        actions={canViewTasks ? (
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => navigate('/delivery/execution-tasks')}
          >
            查看验证任务
          </Button>
        ) : undefined}
      />
    </div>
  )
}
