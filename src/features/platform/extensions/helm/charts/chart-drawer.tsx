import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { CloudDownloadOutlined, LinkOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { helmKeys } from '../keys'
import { helmMutations } from '../mutations'
import { helmQueries } from '../queries'
import type {
  HelmChart,
  HelmChartDetailInput,
  HelmChartInstallFormValues,
  HelmChartInstallResource,
  HelmChartInstallResult,
  HelmChartInstallTarget,
  HelmChartValuesInput,
  HelmReleaseTarget,
} from '../types'
import {
  defaultHelmChartInstallForm,
  formatHelmInstallError,
  getHelmChartBadges,
  getHelmChartVersionOptions,
  hasHelmChartSecuritySummary,
  helmReleaseMatchesInstallTarget,
  isHelmReleaseDeployed,
  isHelmReleaseNameConflictError,
  mapObservedHelmReleaseToInstallResult,
  retryHelmReleaseName,
} from './utils'

const { Text } = Typography

interface HelmChartDrawerProps {
  chart: HelmChart
  initialTab: 'overview' | 'install'
  onClose: () => void
}

type HelmChartDrawerTab = 'overview' | 'readme' | 'values' | 'install'

function Readme({ value }: { value?: string }) {
  if (!value?.trim()) return <Text type="secondary">-</Text>
  return (
    <pre
      style={{
        background: 'var(--soha-bg-surface-muted)',
        border: '1px solid var(--soha-border-color)',
        borderRadius: 6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.55,
        maxHeight: 420,
        overflow: 'auto',
        padding: 12,
        whiteSpace: 'pre-wrap',
      }}
    >
      {value}
    </pre>
  )
}

export function HelmChartDrawer({ chart, initialTab, onClose }: HelmChartDrawerProps) {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const capability = useClusterCapability('helm.releases', localeCode)
  const [form] = Form.useForm<HelmChartInstallFormValues>()
  const [activeTab, setActiveTab] = useState<HelmChartDrawerTab>(initialTab)
  const [selectedVersion, setSelectedVersion] = useState(chart.latestVersion || '')
  const [valuesDraft, setValuesDraft] = useState('')
  const [installTarget, setInstallTarget] = useState<HelmChartInstallTarget | null>(null)
  const [installResult, setInstallResult] = useState<HelmChartInstallResult | null>(null)
  const [installError, setInstallError] = useState('')
  const [installStartedAt, setInstallStartedAt] = useState<number | null>(null)
  const [installElapsedSeconds, setInstallElapsedSeconds] = useState(0)
  const detailInput: HelmChartDetailInput | null =
    clusterId && chart.repositoryName
      ? {
          chartName: chart.name,
          clusterId,
          repositoryName: chart.repositoryName,
          version: selectedVersion,
        }
      : null
  const detailQuery = useQuery(helmQueries.chartDetail(detailInput))
  const detail = detailQuery.data
  const activeChart = detail ?? chart
  const activeVersion = selectedVersion || activeChart.latestVersion || ''
  const valuesInput: HelmChartValuesInput | null =
    clusterId && activeChart.packageId && activeVersion
      ? {
          clusterId,
          packageId: activeChart.packageId,
          name: activeChart.name,
          version: activeVersion,
        }
      : null
  const valuesQuery = useQuery(
    helmQueries.chartValues(valuesInput, activeTab === 'values' || activeTab === 'install'),
  )
  const mutationsDisabled = capability.status !== 'unknown' && capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''
  const canInstall = hasAllowedAction(activeChart.allowedActions, 'create') && !mutationsDisabled
  const installConflict = isHelmReleaseNameConflictError(installError)
  const progressTarget: HelmReleaseTarget | null =
    clusterId && installTarget
      ? {
          clusterId,
          name: installTarget.releaseName,
          namespace: installTarget.namespace,
        }
      : null
  const progressQuery = useQuery(
    helmQueries.installProgress(
      progressTarget,
      Boolean(
        installStartedAt && !installResult && (!installError || installConflict) && progressTarget,
      ),
    ),
  )
  const installMutation = useMutation(helmMutations.installChart(queryClient))

  useEffect(() => {
    form.setFieldsValue(defaultHelmChartInstallForm(chart, namespace))
  }, [chart, form, namespace])

  useEffect(() => {
    const nextVersion = selectedVersion || detail?.latestVersion || chart.latestVersion || ''
    form.setFieldsValue({
      repositoryName: activeChart.repositoryName || chart.repositoryName,
      repositoryUrl: activeChart.repositoryUrl || chart.repositoryUrl || chart.urls?.[0] || '',
      chartName: activeChart.name || chart.name,
      version: nextVersion,
    })
  }, [activeChart, chart, detail?.latestVersion, form, selectedVersion])

  useEffect(() => {
    if (typeof valuesQuery.data?.content === 'string') setValuesDraft(valuesQuery.data.content)
  }, [valuesQuery.data?.content])

  useEffect(() => {
    if (!installStartedAt || installResult || installError) return undefined
    const updateElapsed = () =>
      setInstallElapsedSeconds(Math.max(0, Math.floor((Date.now() - installStartedAt) / 1000)))
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [installError, installResult, installStartedAt])

  useEffect(() => {
    const release = progressQuery.data
    if (!release || installResult || !installError || !installConflict) return
    if (!helmReleaseMatchesInstallTarget(release, installTarget)) return
    if (!isHelmReleaseDeployed(release.status)) return
    setInstallResult(mapObservedHelmReleaseToInstallResult(release, localeCode))
    setInstallError('')
    if (clusterId) {
      void queryClient.invalidateQueries({ queryKey: helmKeys.releases(clusterId) })
    }
  }, [
    clusterId,
    installConflict,
    installError,
    installResult,
    installTarget,
    localeCode,
    progressQuery.data,
    queryClient,
  ])

  const versionOptions = getHelmChartVersionOptions(detail, chart)
  const drawerTitle = `Chart: ${activeChart.repositoryName ? `${activeChart.repositoryName}/` : ''}${activeChart.name}`

  const submitInstall = async () => {
    if (!canInstall || !clusterId) {
      setActiveTab('install')
      return
    }
    const values = await form.validateFields()
    setActiveTab('install')
    setInstallTarget({
      chartName: values.chartName,
      namespace: values.namespace,
      releaseName: values.releaseName,
      timeoutSeconds: values.timeoutSeconds,
      version: values.version,
      wait: values.wait,
    })
    setInstallResult(null)
    setInstallError('')
    setInstallStartedAt(Date.now())
    setInstallElapsedSeconds(0)
    installMutation.mutate(
      { ...values, clusterId, valuesYaml: valuesDraft },
      {
        onSuccess: (result) => {
          setInstallResult(result)
          setInstallError('')
          void message.success(
            localeCode === 'zh_CN' ? `已安装 ${result.name}` : `Installed ${result.name}`,
          )
        },
        onError: (error) => setInstallError(error.message),
      },
    )
  }

  const resourceColumns: TableColumnsType<HelmChartInstallResource> = useMemo(
    () => [
      { title: 'Kind', dataIndex: 'kind', width: 150 },
      { title: 'Name', dataIndex: 'name' },
      {
        title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
        dataIndex: 'namespace',
        width: 160,
      },
      { title: 'API Version', dataIndex: 'apiVersion', width: 160 },
    ],
    [localeCode],
  )
  const observedRelease = progressQuery.data
  const installInFlight = Boolean(installStartedAt && !installResult && !installError)
  const statusColor = installMutation.isPending
    ? 'processing'
    : installResult
      ? 'success'
      : installError
        ? installConflict
          ? 'warning'
          : 'error'
        : 'default'
  const statusLabel = installMutation.isPending
    ? localeCode === 'zh_CN'
      ? '安装中'
      : 'Installing'
    : installResult
      ? localeCode === 'zh_CN'
        ? '已完成'
        : 'Completed'
      : installError
        ? localeCode === 'zh_CN'
          ? '失败'
          : 'Failed'
        : localeCode === 'zh_CN'
          ? '未开始'
          : 'Not started'

  return (
    <Drawer
      destroyOnHidden
      open
      title={drawerTitle}
      size="large"
      onClose={onClose}
      extra={
        <Space>
          <Button autoInsertSpace={false} onClick={onClose}>
            {localeCode === 'zh_CN' ? '取消' : 'Cancel'}
          </Button>
          <Button
            autoInsertSpace={false}
            icon={<CloudDownloadOutlined />}
            disabled={!canInstall}
            loading={installMutation.isPending}
            type="primary"
            onClick={() => void submitInstall()}
          >
            {localeCode === 'zh_CN' ? '安装' : 'Install'}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Space align="start" size={14}>
          {activeChart.logoImageUrl ? (
            <img
              src={activeChart.logoImageUrl}
              alt=""
              style={{ width: 72, height: 72, borderRadius: 6, objectFit: 'contain' }}
            />
          ) : null}
          <Space orientation="vertical" size={6}>
            <Space size={6} wrap>
              <Text strong style={{ fontSize: 16 }}>
                {activeChart.name}
              </Text>
              {getHelmChartBadges(activeChart).map((badge) => (
                <Tag key={badge.label} color={badge.color}>
                  {badge.label}
                </Tag>
              ))}
            </Space>
            <Text type="secondary">{activeChart.description || '-'}</Text>
            {activeChart.artifactHubUrl ? (
              <Button
                href={activeChart.artifactHubUrl}
                icon={<LinkOutlined />}
                size="small"
                target="_blank"
                type="link"
              >
                Artifact Hub
              </Button>
            ) : null}
          </Space>
        </Space>
        <Tabs
          size="small"
          activeKey={activeTab}
          onChange={(value) => setActiveTab(value as HelmChartDrawerTab)}
          items={[
            {
              key: 'overview',
              label: localeCode === 'zh_CN' ? '包信息' : 'Package',
              children: (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <Descriptions
                    bordered
                    column={1}
                    size="small"
                    items={[
                      { key: 'chart', label: 'Chart', children: activeChart.name },
                      {
                        key: 'repository',
                        label: localeCode === 'zh_CN' ? '仓库' : 'Repository',
                        children: activeChart.repositoryName || '-',
                      },
                      {
                        key: 'version',
                        label: 'Version',
                        children: activeChart.latestVersion || '-',
                      },
                      {
                        key: 'appVersion',
                        label: 'App Version',
                        children: activeChart.appVersion || '-',
                      },
                      {
                        key: 'security',
                        label: 'Security',
                        children: hasHelmChartSecuritySummary(activeChart)
                          ? `critical ${activeChart.securityCritical ?? 0} / high ${activeChart.securityHigh ?? 0}`
                          : '-',
                      },
                    ]}
                  />
                  {detailQuery.isLoading ? <Spin size="small" /> : null}
                  {detail?.links?.map((link) =>
                    link.url ? (
                      <Button
                        key={`${link.name}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        size="small"
                      >
                        {link.name || link.url}
                      </Button>
                    ) : null,
                  )}
                </Space>
              ),
            },
            {
              key: 'readme',
              label: 'README',
              children: activeTab === 'readme' ? <Readme value={detail?.readme} /> : null,
            },
            {
              key: 'values',
              label: 'Values',
              children:
                activeTab === 'values' ? (
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {valuesQuery.isLoading ? <Spin size="small" /> : null}
                    {valuesQuery.isError ? (
                      <Text type="secondary">Artifact Hub did not return default values.</Text>
                    ) : null}
                    <Input.TextArea
                      value={valuesDraft}
                      onChange={(event) => setValuesDraft(event.target.value)}
                      rows={18}
                      style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                    />
                  </Space>
                ) : null,
            },
            {
              key: 'install',
              label: localeCode === 'zh_CN' ? '安装' : 'Install',
              forceRender: true,
              children: (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  {!canInstall ? (
                    <Alert
                      showIcon
                      type="warning"
                      title={
                        mutationsDisabled ? 'Helm installs limited' : 'Install permission required'
                      }
                      description={capabilityReason}
                    />
                  ) : null}
                  <Form form={form} layout="vertical" size="small">
                    <Form.Item name="releaseName" label="Release" rules={[{ required: true }]}>
                      <Input disabled={!canInstall || installMutation.isPending} />
                    </Form.Item>
                    <Form.Item name="namespace" label="Namespace" rules={[{ required: true }]}>
                      <Input disabled={!canInstall || installMutation.isPending} />
                    </Form.Item>
                    <Form.Item name="version" label="Version" rules={[{ required: true }]}>
                      <Select
                        showSearch
                        disabled={!canInstall || installMutation.isPending}
                        options={versionOptions}
                        onChange={(value) => {
                          setSelectedVersion(value)
                          setValuesDraft('')
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="repositoryUrl"
                      label="Chart Repository URL"
                      rules={[{ required: true }]}
                    >
                      <Input disabled={!canInstall || installMutation.isPending} />
                    </Form.Item>
                    <Form.Item name="chartName" label="Chart" rules={[{ required: true }]}>
                      <Input disabled={!canInstall || installMutation.isPending} />
                    </Form.Item>
                    <Form.Item
                      name="timeoutSeconds"
                      label="Timeout seconds"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={30} max={3600} step={30} style={{ width: '100%' }} />
                    </Form.Item>
                    <Space size={16} wrap>
                      <Form.Item name="createNamespace" valuePropName="checked">
                        <Checkbox>Create namespace</Checkbox>
                      </Form.Item>
                      <Form.Item name="wait" valuePropName="checked">
                        <Checkbox>Wait for resources</Checkbox>
                      </Form.Item>
                    </Space>
                  </Form>
                  {installTarget ? (
                    <Card size="small" title="Install progress">
                      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                        <Space wrap>
                          <Tag color={statusColor}>{statusLabel}</Tag>
                          <Text strong>{installTarget.releaseName}</Text>
                          <Text type="secondary">{installTarget.namespace}</Text>
                          <Text type="secondary">
                            {installElapsedSeconds}s / {installTarget.timeoutSeconds ?? 300}s
                          </Text>
                        </Space>
                        <Descriptions
                          bordered
                          column={1}
                          size="small"
                          items={[
                            {
                              key: 'submitted',
                              label: 'Submit Helm install',
                              children: (
                                <Tag color={installStartedAt ? 'success' : 'default'}>
                                  {installStartedAt ? 'OK' : '-'}
                                </Tag>
                              ),
                            },
                            {
                              key: 'release',
                              label: 'Cluster release',
                              children: observedRelease ? (
                                <StatusTag value={observedRelease.status || 'detected'} />
                              ) : installInFlight ? (
                                <Spin size="small" />
                              ) : (
                                '-'
                              ),
                            },
                          ]}
                        />
                        {installError ? (
                          <Alert
                            type={installConflict ? 'warning' : 'error'}
                            showIcon
                            title={
                              installConflict ? 'Release name already in use' : 'Install failed'
                            }
                            description={formatHelmInstallError(
                              installError,
                              localeCode,
                              installTarget,
                            )}
                            action={
                              installConflict ? (
                                <Space>
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      form.setFieldsValue({
                                        releaseName: retryHelmReleaseName(
                                          installTarget.releaseName,
                                          installTarget.chartName,
                                        ),
                                      })
                                      setInstallTarget(null)
                                      setInstallResult(null)
                                      setInstallError('')
                                      setInstallStartedAt(null)
                                    }}
                                  >
                                    Use new name
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      onClose()
                                      navigate('/helm/releases')
                                    }}
                                  >
                                    View releases
                                  </Button>
                                </Space>
                              ) : undefined
                            }
                          />
                        ) : null}
                        {installResult ? (
                          <Space orientation="vertical" style={{ width: '100%' }}>
                            <Descriptions
                              bordered
                              column={1}
                              size="small"
                              items={[
                                {
                                  key: 'status',
                                  label: 'Status',
                                  children: <StatusTag value={installResult.status || 'unknown'} />,
                                },
                                {
                                  key: 'revision',
                                  label: 'Revision',
                                  children: installResult.revision || '-',
                                },
                                {
                                  key: 'chart',
                                  label: 'Chart',
                                  children: installResult.chart || installResult.chartName || '-',
                                },
                              ]}
                            />
                            <Table
                              columns={resourceColumns}
                              dataSource={installResult.resources ?? []}
                              rowKey={(record) =>
                                `${record.apiVersion}:${record.kind}:${record.namespace}:${record.name}`
                              }
                              size="small"
                              pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                              scroll={{ x: 720 }}
                            />
                            {installResult.notes ? (
                              <pre className="soha-helm-install-output">{installResult.notes}</pre>
                            ) : null}
                          </Space>
                        ) : null}
                      </Space>
                    </Card>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Drawer>
  )
}
