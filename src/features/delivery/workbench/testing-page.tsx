import { CheckCircleOutlined, ExperimentOutlined, RocketOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Steps, Typography, type TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import { DeliveryTable } from '../delivery-table'
import { deliveryQueries } from '../queries'
import type { ReleaseBundle } from '../types'
import {
  ActionCards,
  isActiveStatus,
  isBlockedStatus,
  isReadyStatus,
  ManualModeAlert,
  releaseBundleUpdatedAt,
  sortByLatest,
  StatCards,
  VERIFY_TASK_KINDS,
  WorkbenchHeader,
  workflowValidationCount,
} from './shared'
import { summarizeDeliveryGovernance } from './governance'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

export function DeliveryTestingPage() {
  const navigate = useNavigate()
  const bundlesQuery = useQuery(deliveryQueries.releaseBundles.list())
  const tasksQuery = useQuery(deliveryQueries.executionTasks.list())
  const releaseBoardQuery = useQuery(deliveryQueries.releaseBoard.list())

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
  const testingStats = [
    {
      label: '候选版本',
      value: candidateBundles.length,
      hint: `${bundles.filter((item) => isReadyStatus(item.status)).length} 个已就绪`,
    },
    {
      label: '验证任务',
      value: verifyTasks.length,
      hint: `${verifyTasks.filter((item) => isActiveStatus(item.status)).length} 个执行中`,
    },
    {
      label: '阻塞证据',
      value:
        bundles.filter((item) => isBlockedStatus(item.status)).length +
        verifyTasks.filter((item) => isBlockedStatus(item.status)).length,
      hint: '来自版本包和验证任务',
    },
    {
      label: 'DAG 验证节点',
      value: board.reduce((sum, item) => sum + workflowValidationCount(item), 0),
      hint: '来自工作流节点执行记录',
    },
    {
      label: '晋级门禁',
      value: governance.filter((item) => item.decision === 'passed').length,
      hint: `${governance.filter((item) => item.decision === 'blocked').length} 个禁止晋级`,
    },
  ]
  const loading = bundlesQuery.isLoading || tasksQuery.isLoading || releaseBoardQuery.isLoading

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
      <WorkbenchHeader
        title="测试验证"
        description="面向测试人员聚合候选版本、验证任务、测试证据和晋级判断，AI 只在证据之上生成摘要和建议。"
      />
      <ManualModeAlert description="常规模式可以直接查看版本包、执行任务和发布看板；AI 摘要必须回链到版本包、任务日志或分析 run ID。" />
      <StatCards items={testingStats} />
      <ActionCards
        items={[
          {
            label: '查看版本包',
            description: '检查不可变候选版本和交付物元数据。',
            icon: <RocketOutlined />,
            path: '/delivery/release-bundles',
            type: 'primary',
          },
          {
            label: '查看执行任务',
            description: '查看验证任务、日志、回调和重试状态。',
            icon: <ExperimentOutlined />,
            path: '/delivery/execution-tasks',
          },
          {
            label: '查看构建发布',
            description: '按应用环境查看候选版本和门禁态势。',
            icon: <CheckCircleOutlined />,
            path: '/release-board',
          },
        ]}
      />
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
        loading={loading}
        refreshing={
          bundlesQuery.isFetching || tasksQuery.isFetching || releaseBoardQuery.isFetching
        }
        onRefresh={() => {
          void bundlesQuery.refetch()
          void tasksQuery.refetch()
          void releaseBoardQuery.refetch()
        }}
        columns={columns}
        actions={
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => navigate('/delivery/execution-tasks')}
          >
            查看验证任务
          </Button>
        }
      />
    </div>
  )
}
