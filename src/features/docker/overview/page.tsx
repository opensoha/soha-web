import { Alert, Badge, Button, Card, Typography } from 'antd'
import { DockerOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { dockerQueries } from '../queries'
import { OperationsTable } from '../operations/table'
import {
  DockerAdminTable,
  DockerTableHeader,
  MetricCard,
  SummaryChips,
  badgeStatusForTone,
  statusTag,
  type OverviewTone,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography

export function DockerOverviewPage() {
  const { dockerModuleEnabled, canManageProjects } = useDockerPermissions()
  const overviewQuery = useQuery(dockerQueries.overview(dockerModuleEnabled))
  const overview = overviewQuery.data
  const stats = overview?.stats ?? {}
  const hostSummary = overview?.hostSummary ?? {}
  const projectSummary = overview?.projectSummary ?? {}
  const serviceSummary = overview?.serviceSummary ?? {}
  const portSummary = overview?.portSummary ?? {}
  const recentOperations = overview?.recentOperations ?? []
  const expiringProjects = overview?.expiringProjects ?? []
  const overviewTone: OverviewTone =
    (stats.failedTaskCount ?? 0) > 0
      ? 'danger'
      : (stats.pendingTaskCount ?? 0) > 0 || (hostSummary.provisioning ?? 0) > 0
        ? 'warning'
        : (stats.hostCount ?? 0) > 0
          ? 'success'
          : 'default'
  useAIPageContext({
    sourceWorkbench: 'docker',
    sourceTitle: 'Docker 工作台',
    entityKind: 'docker.overview',
    entityName: 'Docker 工作台',
    visibleFilters: {
      tone: overviewTone,
    },
    pinnedData: {
      hostCount: stats.hostCount,
      projectCount: stats.projectCount,
      serviceCount: stats.serviceCount,
      portMappingCount: stats.portMappingCount,
      failedTaskCount: stats.failedTaskCount,
      pendingTaskCount: stats.pendingTaskCount,
    },
  })
  return (
    <div className="soha-page soha-docker-page">
      <div className={`soha-vrt-commandbar is-${overviewTone}`}>
        <div className="soha-vrt-commandbar-main">
          <div className="soha-vrt-title-row">
            <DockerOutlined />
            <h1>Docker 工作台</h1>
            <Badge
              status={badgeStatusForTone(overviewTone)}
              text={
                overviewTone === 'danger'
                  ? '存在异常任务'
                  : overviewTone === 'warning'
                    ? '任务处理中'
                    : overviewTone === 'success'
                      ? '运行中'
                      : '未接入'
              }
            />
          </div>
          <div className="soha-vrt-commandbar-meta">
            <span>主机 {stats.hostCount ?? 0}</span>
            <span>项目 {stats.projectCount ?? 0}</span>
            <span>服务 {stats.serviceCount ?? 0}</span>
            <span>端口 {stats.portMappingCount ?? 0}</span>
          </div>
        </div>
        {canManageProjects ? (
          <div className="soha-vrt-commandbar-actions">
            <Link to="/docker/projects">
              <Button type="primary" icon={<PlusOutlined />}>
                创建 Compose 项目
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
      {overviewQuery.isError ? <Alert type="error" showIcon title="Docker 总览加载失败" /> : null}
      <div className="soha-vrt-metric-grid">
        <MetricCard
          label="在线主机"
          value={stats.onlineHostCount ?? 0}
          helper={`总计 ${stats.hostCount ?? 0}`}
          tone={(stats.onlineHostCount ?? 0) > 0 ? 'success' : 'default'}
        />
        <MetricCard
          label="运行项目"
          value={stats.runningProjectCount ?? 0}
          helper={`总计 ${stats.projectCount ?? 0}`}
          tone="success"
        />
        <MetricCard
          label="运行服务"
          value={stats.runningServiceCount ?? 0}
          helper={`总计 ${stats.serviceCount ?? 0}`}
          tone="success"
        />
        <MetricCard
          label="端口映射"
          value={stats.portMappingCount ?? 0}
          helper={`Public ${portSummary.public ?? 0} / VPN ${portSummary.vpn ?? 0}`}
          tone={(portSummary.public ?? 0) > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          label="异常任务"
          value={stats.failedTaskCount ?? 0}
          helper={`处理中 ${stats.pendingTaskCount ?? 0}`}
          tone={
            (stats.failedTaskCount ?? 0) > 0
              ? 'danger'
              : (stats.pendingTaskCount ?? 0) > 0
                ? 'warning'
                : 'default'
          }
        />
      </div>
      <div className="soha-vrt-workbench-grid">
        <div className="soha-vrt-workbench-main">
          <Card size="small" variant="outlined" className="soha-docker-panel-card">
            <DockerTableHeader title="运行分布" />
            <SummaryChips
              counts={[
                {
                  key: 'hosts-online',
                  label: '主机在线',
                  value: hostSummary.online,
                  tone: 'success',
                },
                {
                  key: 'hosts-provisioning',
                  label: '主机构建中',
                  value: hostSummary.provisioning,
                  tone: 'warning',
                },
                {
                  key: 'projects-running',
                  label: '项目运行',
                  value: projectSummary.running,
                  tone: 'success',
                },
                {
                  key: 'projects-pending',
                  label: '项目待处理',
                  value: projectSummary.pending,
                  tone: 'warning',
                },
                {
                  key: 'services-running',
                  label: '服务运行',
                  value: serviceSummary.running,
                  tone: 'success',
                },
                {
                  key: 'services-failed',
                  label: '服务异常',
                  value: serviceSummary.failed,
                  tone: 'danger',
                },
              ]}
            />
          </Card>
          <OperationsTable embedded initialPreset="pending" />
        </div>
        <div className="soha-vrt-side-stack">
          <Card size="small" variant="outlined" className="soha-docker-panel-card">
            <DockerTableHeader title="端口暴露" />
            <SummaryChips
              compact
              counts={[
                { key: 'internal', label: 'Internal', value: portSummary.internal },
                { key: 'vpn', label: 'VPN', value: portSummary.vpn, tone: 'warning' },
                { key: 'public', label: 'Public', value: portSummary.public, tone: 'danger' },
                { key: 'expired', label: 'Expired', value: portSummary.expired, tone: 'danger' },
              ]}
            />
          </Card>
          <DockerAdminTable
            rowKey="id"
            title={<Text strong>即将到期项目</Text>}
            pagination={false}
            enableColumnSelection={false}
            enableDensity={false}
            showColumnSettings={false}
            showRefresh={false}
            dataSource={expiringProjects}
            empty="暂无到期项目"
            columns={[
              { title: '项目', dataIndex: 'name' },
              { title: '状态', dataIndex: 'status', render: statusTag },
              { title: '到期', dataIndex: 'expiresAt', render: formatDateTime },
            ]}
          />
          <DockerAdminTable
            rowKey="id"
            title={<Text strong>最近任务</Text>}
            pagination={false}
            enableColumnSelection={false}
            enableDensity={false}
            showColumnSettings={false}
            showRefresh={false}
            dataSource={recentOperations}
            empty="暂无任务"
            columns={[
              { title: '类型', dataIndex: 'operationKind' },
              { title: '状态', dataIndex: 'status', render: statusTag },
              { title: '创建', dataIndex: 'createdAt', render: formatDateTime },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
