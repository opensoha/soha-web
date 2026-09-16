import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Statistic,
  Tabs,
  Timeline,
  Typography,
} from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LineChart } from '@visactor/react-vchart'
import type {
  NetworkVPNDecision,
  NetworkVPNPreviewInput,
  NetworkVPNSeriesPoint,
  NetworkVPNGatewayMetrics,
  NetworkVPNConnectionView,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import { StatusTag } from '@/components/status-tag'
import { buildCompactChartSpec, compactMetricColors } from '@/components/resource-metrics-panel'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { previewVPN, vpnDashboard, vpnDecision, vpnDocuments, vpnKeys } from './vpn-api'

export default function VPNDashboardPage() {
  const { localeCode } = useI18n()
  const text = (zh: string, en: string) => (localeCode === 'zh_CN' ? zh : en)
  const permissions = usePermissionSnapshot()
  const can = (key: string) => hasPermission(permissions.data?.data, key)
  const [filter, setFilter] = useState<Record<string, string>>(() => ({
    from: new Date(Date.now() - 3600000).toISOString(),
    to: new Date().toISOString(),
  }))
  const [decisionID, setDecisionID] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [form] = Form.useForm<Record<string, string>>()
  const query = useQuery({
    queryKey: vpnKeys.dashboard(filter),
    queryFn: () => vpnDashboard(filter),
    enabled: can('network_access.vpn_dashboard.view'),
    retry: false,
  })
  const profiles = useQuery({
    queryKey: vpnKeys.documents('profiles'),
    queryFn: () => vpnDocuments('profiles'),
    enabled: can('network_access.vpn_profiles.view'),
  })
  const decision = useQuery({
    queryKey: vpnKeys.decision(decisionID),
    queryFn: () => vpnDecision(decisionID),
    enabled: !!decisionID,
  })
  const simulation = useMutation({ mutationFn: previewVPN })
  const data = query.data
  const n = (value: number | undefined, unit = '') =>
    value == null
      ? text('未采集', 'Not collected')
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`
  const reload = () =>
    setFilter({
      ...filter,
      to: new Date().toISOString(),
      from: new Date(Date.now() - (Date.parse(filter.to) - Date.parse(filter.from))).toISOString(),
    })
  const chart = (
    title: string,
    field:
      | 'latencyP50Ms'
      | 'latencyP95Ms'
      | 'uploadBytes'
      | 'downloadBytes'
      | 'attempts'
      | 'fallbacks',
    unit: string,
  ) => {
    const points = (data?.series || [])
      .filter((p) => p[field] != null)
      .map((p) => ({ timestamp: p.at, value: p[field]! }))
    return (
      <Card key={field} title={title} size="small">
        <div style={{ height: 220 }}>
          {points.length ? (
            <LineChart
              spec={buildCompactChartSpec(
                [{ key: field, label: title, color: compactMetricColors.default, points, unit }],
                unit,
                localeCode,
              )}
            />
          ) : (
            <Typography.Text type="secondary">
              {text('该时间段无样本', 'No samples in this window')}
            </Typography.Text>
          )}
        </div>
      </Card>
    )
  }
  const summary = (
    <>
      {query.isError ? <Alert type="error" showIcon description={query.error.message} /> : null}
      {data?.partial ? (
        <Alert
          type="warning"
          showIcon
          description={text(
            '当前结果达到有界查询上限；请缩短时间或收窄范围。',
            'This bounded result is partial. Shorten the window or narrow the scope.',
          )}
        />
      ) : null}
      {data && !data.telemetryAvailable ? (
        <Alert
          type="info"
          showIcon
          description={text(
            '遥测暂不可用；未知指标不会按零计算。',
            'Telemetry is unavailable; unknown measurements are not treated as zero.',
          )}
        />
      ) : null}
      <Space wrap size="large">
        <Statistic
          title={text('在线 VPN 会话', 'Online VPN sessions')}
          value={data?.activeSessions ?? '—'}
        />
        <Statistic
          title={text('可用 / 总入口', 'Available / total entrances')}
          value={data ? `${data.availableGateways} / ${data.totalGateways}` : '—'}
        />
        <Statistic
          title={text('逻辑连接成功率', 'Logical connection success rate')}
          value={data?.attempts ? `${((100 * data.successes) / data.attempts).toFixed(1)}%` : '—'}
        />
        <Statistic
          title="P50 / P95 RTT"
          value={`${n(data?.latencyP50Ms, ' ms')} / ${n(data?.latencyP95Ms, ' ms')}`}
        />
        <Statistic
          title={text('上传 / 下载速率', 'Upload / download rate')}
          value={`${n(data?.uploadBytesPerSecond, ' B/s')} / ${n(data?.downloadBytesPerSecond, ' B/s')}`}
        />
      </Space>
      <Typography.Paragraph type="secondary">
        {text('当前权限范围', 'Current permission scope')} · {data?.from} — {data?.to} · asOf{' '}
        {data?.asOf || '—'}
      </Typography.Paragraph>
    </>
  )
  const gatewayTable = (
    <AdminTable
      rowKey="gatewayId"
      loading={query.isPending}
      dataSource={data?.gateways || []}
      columns={[
        {
          title: text('接入点', 'Entrance'),
          dataIndex: 'name',
          render: (name: string, row: NetworkVPNGatewayMetrics) => (
            <Button type="link" onClick={() => setFilter({ ...filter, gatewayId: row.gatewayId })}>
              {name || row.gatewayId}
            </Button>
          ),
        },
        {
          title: text('地区 / 供应商', 'Region / provider'),
          key: 'provider',
          render: (_: unknown, row: NetworkVPNGatewayMetrics) =>
            `${row.region} · ${row.providerName || row.providerCode}`,
        },
        {
          title: text('健康', 'Health'),
          key: 'health',
          render: (_: unknown, row: NetworkVPNGatewayMetrics) => (
            <StatusTag
              value={row.healthy == null ? 'unknown' : row.healthy ? 'healthy' : 'unavailable'}
            />
          ),
        },
        {
          title: text('范围内会话 / 入口上限', 'Scoped sessions / entrance limit'),
          key: 'capacity',
          render: (_: unknown, row: NetworkVPNGatewayMetrics) =>
            `${row.activeSessions} / ${row.maxSessions == null ? '—' : row.maxSessions || text('不限', 'Unlimited')}`,
        },
        {
          title: text('成功 / 请求 / 回退', 'Success / attempts / fallbacks'),
          key: 'attempts',
          render: (_: unknown, row: NetworkVPNGatewayMetrics) =>
            `${row.successes} / ${row.attempts} / ${row.fallbacks}`,
        },
        {
          title: 'P50 / P95 RTT',
          key: 'latency',
          render: (_: unknown, row: NetworkVPNGatewayMetrics) =>
            `${n(row.latencyP50Ms, ' ms')} / ${n(row.latencyP95Ms, ' ms')}`,
        },
        {
          title: text('丢包', 'Packet loss'),
          key: 'loss',
          render: () => text('未采集', 'Not collected'),
        },
        { title: text('测量时间', 'Measured at'), dataIndex: 'measuredAt' },
      ]}
    />
  )
  const sessions = (
    <AdminTable
      rowKey="sessionId"
      dataSource={data?.sessions || []}
      columns={[
        {
          title: text('用户 / 设备', 'User / device'),
          key: 'owner',
          render: (_: unknown, s: NetworkVPNConnectionView) => `${s.subjectId} / ${s.deviceId}`,
        },
        { title: text('目标方案', 'Target profile'), dataIndex: 'profileName' },
        {
          title: text('偏好 / 实际入口', 'Preference / actual entrance'),
          key: 'entrance',
          render: (_: unknown, s: NetworkVPNConnectionView) => `${s.selection} / ${s.gatewayName}`,
        },
        { title: text('模式', 'Mode'), dataIndex: 'mode' },
        { title: 'IP', dataIndex: 'tunnelIP' },
        {
          title: text('状态', 'State'),
          dataIndex: 'state',
          render: (value: string) => <StatusTag value={value} />,
        },
        { title: text('最后握手', 'Last handshake'), dataIndex: 'lastHandshakeAt' },
        {
          title: text('操作', 'Action'),
          key: 'detail',
          render: (_: unknown, s: NetworkVPNConnectionView) => (
            <Button onClick={() => setDecisionID(s.decisionId)}>
              {text('连接详情', 'Connection details')}
            </Button>
          ),
        },
      ]}
    />
  )
  const decisions = (
    <AdminTable
      rowKey="id"
      dataSource={data?.decisions || []}
      columns={[
        { title: text('时间', 'Time'), dataIndex: 'createdAt' },
        { title: text('策略', 'Strategy'), dataIndex: 'strategy' },
        { title: text('原因', 'Reason'), dataIndex: 'reasonCode' },
        {
          title: text('状态', 'State'),
          dataIndex: 'state',
          render: (value: string) => <StatusTag value={value} />,
        },
        {
          title: text('操作', 'Action'),
          key: 'detail',
          render: (_: unknown, d: NetworkVPNDecision) => (
            <Button onClick={() => setDecisionID(d.id)}>
              {text('候选与决策', 'Candidates and decision')}
            </Button>
          ),
        },
      ]}
    />
  )
  return (
    <ManagementDataPage
      header={{
        title: 'VPN Dashboard',
        description: text(
          '连接质量、入口与 Auto 决策',
          'Connection quality, entrances and Auto decisions',
        ),
        actions: (
          <Space>
            <Button onClick={reload} loading={query.isFetching}>
              {text('刷新', 'Refresh')}
            </Button>
            {can('network_access.vpn_selection_policies.preview') ? (
              <Button onClick={() => setPreviewOpen(true)}>
                {text('模拟选择', 'Simulate selection')}
              </Button>
            ) : null}
          </Space>
        ),
      }}
      query={{
        form,
        onFinish: (values) => {
          const hours = Number(values.hours || 1)
          const next: Record<string, string> = {
            from: new Date(Date.now() - hours * 3600000).toISOString(),
            to: new Date().toISOString(),
          }
          for (const [key, value] of Object.entries(values)) {
            if (key !== 'hours' && typeof value === 'string' && value) next[key] = value
          }
          setFilter(next)
        },
        actions: (
          <Button htmlType="submit" type="primary">
            {text('查询', 'Query')}
          </Button>
        ),
        children: (
          <>
            <Form.Item name="hours" label={text('时间范围', 'Window')} initialValue="1">
              <Select
                options={[
                  { value: '1', label: text('最近 1 小时', 'Last hour') },
                  { value: '24', label: text('最近 24 小时', 'Last 24 hours') },
                  { value: '168', label: text('最近 7 天', 'Last 7 days') },
                ]}
              />
            </Form.Item>
            <Form.Item name="profileId" label={text('方案', 'Profile')}>
              <Select
                allowClear
                options={profiles.data?.map((p) => ({ value: p.id, label: p.configuration.name }))}
              />
            </Form.Item>
            {(['siteId', 'gatewayId', 'providerCode', 'subjectId', 'teamId'] as const).map(
              (key, index) => (
                <Form.Item
                  key={key}
                  name={key}
                  label={text(
                    ['站点 ID', '入口 ID', '供应商', '用户 ID', '团队 ID'][index],
                    ['Site ID', 'Gateway ID', 'Provider', 'User ID', 'Team ID'][index],
                  )}
                >
                  <Input allowClear />
                </Form.Item>
              ),
            )}
          </>
        ),
      }}
      beforeQuery={summary}
      tableNode={
        <Tabs
          items={[
            { key: 'gateways', label: text('接入点', 'Entrances'), children: gatewayTable },
            {
              key: 'trends',
              label: text('趋势', 'Trends'),
              children: (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
                      gap: 16,
                    }}
                  >
                    {chart('P50 RTT', 'latencyP50Ms', 'ms')}
                    {chart('P95 RTT', 'latencyP95Ms', 'ms')}
                    {chart(text('上传量 / 小时', 'Uploaded per hour'), 'uploadBytes', 'bytes')}
                    {chart(text('下载量 / 小时', 'Downloaded per hour'), 'downloadBytes', 'bytes')}
                    {chart(text('连接请求', 'Connection attempts'), 'attempts', 'count')}
                    {chart(text('自动回退', 'Automatic fallbacks'), 'fallbacks', 'count')}
                  </div>
                  <AdminTable
                    rowKey="at"
                    dataSource={data?.series || []}
                    columns={(
                      [
                        'at',
                        'attempts',
                        'successes',
                        'fallbacks',
                        'uploadBytes',
                        'downloadBytes',
                        'latencyP50Ms',
                        'latencyP95Ms',
                      ] as (keyof NetworkVPNSeriesPoint)[]
                    ).map((key) => ({ title: key, dataIndex: key }))}
                  />
                </>
              ),
            },
            { key: 'sessions', label: text('当前与历史会话', 'Sessions'), children: sessions },
            { key: 'decisions', label: text('Auto 分析', 'Auto analysis'), children: decisions },
          ]}
        />
      }
    >
      <Drawer
        open={!!decisionID}
        onClose={() => setDecisionID('')}
        title={text('连接详情', 'Connection details')}
        size={760}
      >
        {decision.data ? (
          <VPNDecisionDetail decision={decision.data} />
        ) : decision.isError ? (
          <Alert type="error" description={decision.error.message} />
        ) : null}
      </Drawer>
      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={text('模拟选择（不创建连接）', 'Simulate selection (no connection created)')}
        size={760}
      >
        <Form<NetworkVPNPreviewInput>
          layout="vertical"
          initialValues={{ selection: 'auto' }}
          onFinish={(input) => simulation.mutate(input)}
        >
          <Form.Item name="profileId" label={text('方案', 'Profile')} rules={[{ required: true }]}>
            <Select
              options={profiles.data?.map((p) => ({ value: p.id, label: p.configuration.name }))}
            />
          </Form.Item>
          <Form.Item
            name="deviceId"
            label={text('设备 ID', 'Device ID')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="selection" label={text('选择', 'Selection')}>
            <Select
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'manual', label: text('手动', 'Manual') },
              ]}
            />
          </Form.Item>
          <Form.Item name="gatewayId" label={text('手动入口 ID', 'Manual gateway ID')}>
            <Input />
          </Form.Item>
          <Form.Item
            name="probeBatchId"
            label={text('已有测量批次（可选）', 'Existing probe batch (optional)')}
          >
            <Input />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={simulation.isPending}>
            {text('模拟', 'Simulate')}
          </Button>
        </Form>
        {simulation.isError ? <Alert type="error" description={simulation.error.message} /> : null}
        {simulation.data ? <VPNDecisionDetail decision={simulation.data} /> : null}
      </Drawer>
    </ManagementDataPage>
  )
}

function VPNDecisionDetail({ decision: d }: { decision: NetworkVPNDecision }) {
  const { localeCode } = useI18n()
  const text = (zh: string, en: string) => (localeCode === 'zh_CN' ? zh : en)
  return (
    <>
      <Typography.Paragraph>
        {text('方案修订', 'Profile revision')} r{d.profileRevision} ·{' '}
        {text('策略修订', 'Policy revision')} r{d.selectionPolicyRevision} · {d.strategy}
      </Typography.Paragraph>
      <Timeline
        items={[
          {
            content: `${d.createdAt} · ${text('请求与候选选择', 'Request and candidate selection')}`,
          },
          { content: `${d.updatedAt} · ${d.state} · ${d.reasonCode}` },
        ]}
      />
      <AdminTable
        rowKey="gatewayId"
        dataSource={d.candidates}
        columns={[
          { title: text('接入点', 'Entrance'), dataIndex: 'name' },
          { title: text('供应商', 'Provider'), dataIndex: 'providerCode' },
          { title: text('排名', 'Rank'), dataIndex: 'rank' },
          {
            title: text('资格', 'Eligibility'),
            dataIndex: 'eligible',
            render: (value: boolean) => <StatusTag value={value ? 'allow' : 'denied'} />,
          },
          { title: text('原因', 'Reason'), dataIndex: 'reasonCode' },
          {
            title: 'RTT (ms)',
            dataIndex: 'latencyMs',
            render: (value: number | undefined) => value ?? text('未采集', 'Not collected'),
          },
          { title: text('测量时间', 'Measured at'), dataIndex: 'measuredAt' },
        ]}
      />
    </>
  )
}
