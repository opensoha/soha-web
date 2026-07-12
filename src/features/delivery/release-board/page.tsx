import { useMemo } from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementIconButton } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import {
  releaseBoardArtifactCount,
  releaseBoardQualitySignal,
  summarizeReleaseBoard,
} from '../delivery-status'
import { DeliveryTable } from '../delivery-table'
import { deliveryQueries } from '../queries'
import type { BuildRecord, ReleaseBoardEntry, ReleaseRecord, WorkflowRun } from '../types'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

function summarizeLatestActivity(
  localeCode: 'zh_CN' | 'en_US',
  build?: BuildRecord,
  workflow?: WorkflowRun,
  release?: ReleaseRecord,
) {
  if (release?.createdAt) {
    return localeCode === 'zh_CN'
      ? `最近发布 ${formatDateTime(release.createdAt)}`
      : `Latest release ${formatDateTime(release.createdAt)}`
  }
  if (workflow?.updatedAt) {
    return localeCode === 'zh_CN'
      ? `最近工作流 ${formatDateTime(workflow.updatedAt)}`
      : `Latest workflow ${formatDateTime(workflow.updatedAt)}`
  }
  if (build?.createdAt) {
    return localeCode === 'zh_CN'
      ? `最近构建 ${formatDateTime(build.createdAt)}`
      : `Latest build ${formatDateTime(build.createdAt)}`
  }
  return localeCode === 'zh_CN' ? '暂无执行记录' : 'No execution history'
}

export function ReleaseBoardPage() {
  const { t, localeCode } = useI18n()
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewApplications = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.applications.view',
  )
  const releaseBoardQuery = useQuery(deliveryQueries.releaseBoard.list())

  const rows = releaseBoardQuery.data ?? []
  const summary = useMemo(() => summarizeReleaseBoard(rows), [rows])
  const columns: ColumnProps<ReleaseBoardEntry>[] = [
    {
      title: t('common.application', 'Application'),
      dataIndex: 'applicationName',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.applicationId}</Text>
        </Space>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '环境' : 'Environment',
      dataIndex: 'environmentName',
      render: (value: string, record) => value || record.environmentKey || record.environmentId,
    },
    {
      title: localeCode === 'zh_CN' ? '构建来源' : 'Build Source',
      dataIndex: 'buildSource',
      render: (_: unknown, record) => record.buildSource?.name || record.buildSourceId || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '目标' : 'Targets',
      dataIndex: 'targets',
      render: (targets: ReleaseBoardEntry['targets']) => targets?.length ?? 0,
    },
    {
      title: localeCode === 'zh_CN' ? '候选版本' : 'Candidate',
      dataIndex: 'latestBundle',
      render: (value: ReleaseBoardEntry['latestBundle']) => value?.version || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '交付态势' : 'Delivery Signal',
      key: 'quality',
      render: (_: unknown, record) => {
        const signal = releaseBoardQualitySignal(record)
        return <Tag color={signal.color}>{signal.label}</Tag>
      },
    },
    {
      title: localeCode === 'zh_CN' ? '交付物' : 'Artifacts',
      key: 'artifacts',
      render: (_: unknown, record) => releaseBoardArtifactCount(record),
    },
    {
      title: localeCode === 'zh_CN' ? '审批' : 'Approval',
      dataIndex: 'requiresApproval',
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    {
      title: 'Build',
      dataIndex: 'latestBuild',
      render: (value: ReleaseBoardEntry['latestBuild']) => (
        <StatusTag value={value?.status || 'unknown'} />
      ),
    },
    {
      title: 'Workflow',
      dataIndex: 'latestWorkflow',
      render: (value: ReleaseBoardEntry['latestWorkflow']) => (
        <StatusTag value={value?.status || 'unknown'} />
      ),
    },
    {
      title: 'Task',
      dataIndex: 'latestExecutionTask',
      render: (value: ReleaseBoardEntry['latestExecutionTask']) => (
        <StatusTag value={value?.status || 'unknown'} />
      ),
    },
    {
      title: 'Release',
      dataIndex: 'latestRelease',
      render: (value: ReleaseBoardEntry['latestRelease']) => (
        <StatusTag value={value?.status || 'unknown'} />
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '最近活动' : 'Latest Activity',
      key: 'latestActivity',
      render: (_: unknown, record) =>
        summarizeLatestActivity(
          localeCode,
          record.latestBuild,
          record.latestWorkflow,
          record.latestRelease,
        ),
    },
    {
      ...tableColumnPresets.action,
      title: t('common.actions', 'Actions'),
      dataIndex: 'applicationEnvironmentId',
      render: (_: unknown, record: ReleaseBoardEntry) =>
        canViewApplications ? (
          <ManagementIconButton
            aria-label={localeCode === 'zh_CN' ? '进入应用' : 'Open application'}
            icon={<ArrowRightOutlined />}
            size="small"
            tooltip={localeCode === 'zh_CN' ? '进入应用' : 'Open application'}
            onClick={() => navigate(`/applications/${record.applicationId}`)}
          />
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div className="soha-page">
      <div className="soha-release-board-summary">
        <Card className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">环境绑定</span>
          <strong>{summary.total}</strong>
          <Text type="secondary">{summary.targets} 个发布目标</Text>
        </Card>
        <Card className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">执行中</span>
          <strong>{summary.running}</strong>
          <Text type="secondary">构建 / 工作流 / 发布</Text>
        </Card>
        <Card className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">待审批</span>
          <strong>{summary.approval}</strong>
          <Text type="secondary">人工审批门禁</Text>
        </Card>
        <Card className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">可推广</span>
          <strong>{summary.ready}</strong>
          <Text type="secondary">{summary.blocked} 个阻塞</Text>
        </Card>
      </div>
      <DeliveryGatewayReadinessPanel
        title="AI Gateway 构建发布辅助"
        description="用于读取应用环境、版本包、执行任务和 diff，并在授权允许时通过统一 delivery action 触发构建、发布或验证；常规发布看板和手工触发入口保持可用。"
        skillId="delivery-developer"
        manualPath="/application-environments"
        manualTitle="手工配置"
        capabilities={[
          'delivery.application_environments.list',
          'delivery.release_targets.list',
          'delivery.release_bundles.list',
          'delivery.execution_tasks.list',
          'delivery.release.plan',
          'delivery.release_context.diff',
          'delivery.actions.trigger',
        ]}
      />
      <DeliveryTable
        refreshing={releaseBoardQuery.isFetching}
        onRefresh={() => void releaseBoardQuery.refetch()}
        columns={columns}
        dataSource={rows}
        rowKey="applicationEnvironmentId"
        loading={releaseBoardQuery.isLoading}
      />
    </div>
  )
}
