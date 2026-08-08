import { useMemo, useState, type Key } from 'react'
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Result,
  Segmented,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clusterQueries, namespaceQueries } from '@/features/platform'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type {
  ApplicationEnvironment,
  DeliveryApplication,
  DeliveryTargetCandidate,
  HelmReleaseCandidate,
  HelmReleaseImportResult,
  KubernetesServiceImportResult,
} from '../types'

type ImportSource = 'kubernetes' | 'helm'
type OwnershipMode = 'observe_only' | 'managed'

interface ImportKubernetesServicesModalProps {
  applications: DeliveryApplication[]
  bindings: ApplicationEnvironment[]
  open: boolean
  onClose: () => void
}

interface ImportFormValues {
  clusterId?: string
  namespace?: string
  applicationKey?: string[]
  environmentKey?: string[]
}

function workloadKey(item: Pick<DeliveryTargetCandidate, 'workloadKind' | 'workloadName'>) {
  return `${item.workloadKind}/${item.workloadName}`
}

function singleTag(value?: string[]) {
  return String(value?.[0] ?? '').trim()
}

export function ImportKubernetesServicesModal({
  applications,
  bindings,
  open,
  onClose,
}: ImportKubernetesServicesModalProps) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ImportFormValues>()
  const [step, setStep] = useState(0)
  const [source, setSource] = useState<ImportSource>('kubernetes')
  const [ownershipMode, setOwnershipMode] = useState<OwnershipMode>('observe_only')
  const [search, setSearch] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])
  const [result, setResult] = useState<
    KubernetesServiceImportResult | HelmReleaseImportResult | null
  >(null)
  const clusterId = Form.useWatch('clusterId', form)
  const namespace = Form.useWatch('namespace', form)

  const clustersQuery = useQuery({ ...clusterQueries.list(), enabled: open })
  const namespacesQuery = useQuery({
    ...namespaceQueries.list({ clusterId: clusterId || null, namespace: null }),
    enabled: open && Boolean(clusterId),
  })
  const candidatesQuery = useQuery(
    deliveryQueries.environments.targetCandidates(
      { clusterId: clusterId ?? '', namespace: namespace ?? '', search, limit: 200 },
      open && step >= 1 && source === 'kubernetes',
    ),
  )
  const helmReleasesQuery = useQuery(
    deliveryQueries.environments.helmReleases(
      clusterId ?? '',
      namespace ?? '',
      open && step >= 1 && source === 'helm',
    ),
  )
  const candidates = candidatesQuery.data?.items ?? []
  const selectedWorkloads = useMemo(() => {
    const keys = new Set(selectedKeys.map(String))
    return candidates.filter((item) => keys.has(workloadKey(item)))
  }, [candidates, selectedKeys])
  const helmReleases = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (helmReleasesQuery.data ?? []).filter(
      (item) =>
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.chart?.toLowerCase().includes(keyword),
    )
  }, [helmReleasesQuery.data, search])
  const selectedHelmReleases = useMemo(() => {
    const keys = new Set(selectedKeys.map(String))
    return helmReleases.filter((item) => keys.has(item.name))
  }, [helmReleases, selectedKeys])
  const selectedCount = source === 'helm' ? selectedHelmReleases.length : selectedWorkloads.length
  const managedKubernetesAllowed = selectedWorkloads.every(
    (item) => item.workloadKind === 'Deployment',
  )

  const environmentOptions = useMemo(
    () =>
      Array.from(
        new Set(bindings.map((item) => item.environmentKey || item.environmentId).filter(Boolean)),
      ).map((key) => ({ value: key, label: key })),
    [bindings],
  )
  const importMutation = useMutation(
    deliveryMutations.environments.importKubernetesServices(queryClient),
  )
  const helmImportMutation = useMutation(
    deliveryMutations.environments.importHelmReleases(queryClient),
  )

  const close = () => {
    form.resetFields()
    setStep(0)
    setSource('kubernetes')
    setOwnershipMode('observe_only')
    setSearch('')
    setSelectedKeys([])
    setResult(null)
    onClose()
  }

  const columns: TableColumnsType<DeliveryTargetCandidate> = [
    {
      title: '工作负载',
      key: 'workload',
      render: (_, item) => (
        <Space size={8}>
          <Tag>{item.workloadKind}</Tag>
          <Typography.Text strong>{item.workloadName}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '就绪',
      key: 'ready',
      width: 90,
      render: (_, item) => (
        <Tag color={item.readyReplicas === item.desiredReplicas ? 'success' : 'warning'}>
          {item.readyReplicas}/{item.desiredReplicas}
        </Tag>
      ),
    },
    {
      title: '关联资源',
      dataIndex: 'relatedResources',
      render: (items: DeliveryTargetCandidate['relatedResources']) =>
        items.length ? (
          <Space size={[4, 4]} wrap>
            {items.map((item) => (
              <Tag key={`${item.kind}/${item.name}`}>{`${item.kind}/${item.name}`}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
  ]

  const helmColumns: TableColumnsType<HelmReleaseCandidate> = [
    {
      title: 'Release',
      dataIndex: 'name',
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: 'Chart', dataIndex: 'chart', render: (value: string) => value || '-' },
    {
      title: 'Revision',
      dataIndex: 'revision',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => (
        <Tag color={value === 'deployed' ? 'success' : 'warning'}>{value || 'unknown'}</Tag>
      ),
    },
  ]

  const next = async () => {
    if (step === 0) {
      await form.validateFields(['clusterId', 'namespace'])
      setStep(1)
      return
    }
    if (step === 1) {
      if (source === 'kubernetes' && ownershipMode === 'managed' && !managedKubernetesAllowed) {
        setOwnershipMode('observe_only')
      }
      setStep(2)
    }
  }

  const submit = async () => {
    const values = await form.validateFields(['applicationKey', 'environmentKey'])
    const applicationKey = singleTag(values.applicationKey)
    const environmentKey = singleTag(values.environmentKey)
    const applicationName =
      applications.find((item) => item.key === applicationKey)?.name || applicationKey
    const scope = {
      clusterId: clusterId ?? '',
      namespace: namespace ?? '',
      applicationKey,
      applicationName,
      environmentKey,
      environmentName: environmentKey,
      ownershipMode,
    }
    if (source === 'helm') {
      helmImportMutation.mutate(
        {
          ...scope,
          releases: selectedHelmReleases.map((item) => ({ releaseName: item.name })),
        },
        {
          onSuccess: setResult,
          onError: (error) => message.error(error.message),
        },
      )
      return
    }
    importMutation.mutate(
      {
        ...scope,
        workloads: selectedWorkloads.map((item) => ({
          workloadKind: item.workloadKind as 'Deployment' | 'StatefulSet' | 'DaemonSet',
          workloadName: item.workloadName,
        })),
      },
      {
        onSuccess: setResult,
        onError: (error) => message.error(error.message),
      },
    )
  }

  return (
    <Modal
      title="导入集群服务"
      open={open}
      onCancel={close}
      width={920}
      destroyOnHidden
      footer={
        result ? (
          <Button type="primary" onClick={close}>
            完成
          </Button>
        ) : (
          <Space>
            <Button onClick={step === 0 ? close : () => setStep((value) => value - 1)}>
              {step === 0 ? '取消' : '上一步'}
            </Button>
            {step < 2 ? (
              <Button
                type="primary"
                onClick={() => void next()}
                disabled={step === 1 && !selectedCount}
              >
                下一步
              </Button>
            ) : (
              <Button
                type="primary"
                loading={importMutation.isPending || helmImportMutation.isPending}
                onClick={() => void submit()}
              >
                导入 {selectedCount} 个服务
              </Button>
            )}
          </Space>
        )
      }
    >
      {result ? (
        <Result
          status="success"
          title={`${source === 'helm' ? 'Helm Release' : 'Kubernetes 服务'}已接入`}
          subTitle={`应用${result.application.created ? '已创建' : '已复用'}，环境${result.environment.created ? '已创建' : '已复用'}，已关联 ${result.services.length} 个服务和 ${result.targets.length} 个${result.ownershipMode === 'managed' ? '托管' : '观察'}目标。`}
        />
      ) : (
        <>
          <Steps
            current={step}
            size="small"
            items={[
              { title: '选择来源' },
              { title: source === 'helm' ? '选择 Release' : '选择工作负载' },
              { title: '确认归属' },
            ]}
            style={{ marginBottom: 24 }}
          />
          <Form form={form} layout="vertical">
            {step === 0 ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Segmented
                  block
                  value={source}
                  options={[
                    { value: 'kubernetes', label: 'Kubernetes 工作负载' },
                    { value: 'helm', label: 'Helm Release' },
                  ]}
                  onChange={(value) => {
                    setSource(value as ImportSource)
                    setSearch('')
                    setSelectedKeys([])
                    setOwnershipMode('observe_only')
                  }}
                />
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  }}
                >
                  <Form.Item
                    name="clusterId"
                    label="集群"
                    rules={[{ required: true, message: '请选择集群' }]}
                  >
                    <Select
                      showSearch={{ optionFilterProp: 'label' }}
                      loading={clustersQuery.isLoading}
                      options={(clustersQuery.data ?? []).map((item) => ({
                        value: item.id,
                        label: `${item.name} (${item.id})`,
                      }))}
                      onChange={() => {
                        form.setFieldValue('namespace', undefined)
                        setSelectedKeys([])
                      }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="namespace"
                    label="命名空间"
                    rules={[{ required: true, message: '请选择命名空间' }]}
                  >
                    <Select
                      showSearch={{ optionFilterProp: 'label' }}
                      disabled={!clusterId}
                      loading={namespacesQuery.isLoading}
                      options={(namespacesQuery.data ?? []).map((item) => ({
                        value: item.name,
                        label: item.name,
                      }))}
                      onChange={() => setSelectedKeys([])}
                    />
                  </Form.Item>
                </div>
              </Space>
            ) : null}
            {step === 1 ? (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Input.Search
                  allowClear
                  placeholder={source === 'helm' ? '搜索 Release 或 Chart' : '搜索 Kind 或名称'}
                  onSearch={(value) => {
                    setSearch(value.trim())
                    setSelectedKeys([])
                  }}
                />
                {(source === 'helm' ? helmReleasesQuery.isError : candidatesQuery.isError) ? (
                  <Alert
                    type="error"
                    showIcon
                    title={
                      source === 'helm'
                        ? helmReleasesQuery.error?.message
                        : candidatesQuery.error?.message
                    }
                  />
                ) : null}
                {candidatesQuery.data?.truncated ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="结果已限制为前 200 个工作负载，请缩小搜索范围。"
                  />
                ) : null}
                {source === 'helm' ? (
                  <Table
                    size="small"
                    columns={helmColumns}
                    dataSource={helmReleases}
                    rowKey="name"
                    loading={helmReleasesQuery.isLoading || helmReleasesQuery.isFetching}
                    pagination={false}
                    scroll={{ x: 680, y: 360 }}
                    rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
                    locale={{ emptyText: '当前命名空间没有可导入的 Helm Release' }}
                  />
                ) : (
                  <Table
                    size="small"
                    columns={columns}
                    dataSource={candidates}
                    rowKey={workloadKey}
                    loading={candidatesQuery.isLoading || candidatesQuery.isFetching}
                    pagination={false}
                    scroll={{ x: 680, y: 360 }}
                    rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
                    locale={{ emptyText: '当前命名空间没有可导入的工作负载' }}
                  />
                )}
              </Space>
            ) : null}
            {step === 2 ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  title={ownershipMode === 'managed' ? '托管发布' : '仅观察模式'}
                  description={
                    ownershipMode === 'managed'
                      ? source === 'helm'
                        ? '导入后可通过完整 Values YAML 发布 Helm Release。'
                        : '导入后可更新 Deployment 镜像并执行回滚。'
                      : '导入后目标禁用，不会修改集群资源。'
                  }
                />
                <Form.Item label="管理方式">
                  <Segmented
                    block
                    value={ownershipMode}
                    options={[
                      { value: 'observe_only', label: '只读观察' },
                      {
                        value: 'managed',
                        label: '托管发布',
                        disabled: source === 'kubernetes' && !managedKubernetesAllowed,
                      },
                    ]}
                    onChange={(value) => setOwnershipMode(value as OwnershipMode)}
                  />
                </Form.Item>
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  }}
                >
                  <Form.Item
                    name="applicationKey"
                    label="应用"
                    rules={[{ required: true, message: '请选择或输入应用' }]}
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="选择现有应用或输入新 Key"
                      options={applications.map((item) => ({
                        value: item.key,
                        label: `${item.name} (${item.key})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="environmentKey"
                    label="环境"
                    rules={[{ required: true, message: '请选择或输入环境' }]}
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="dev / test / prod"
                      options={environmentOptions}
                    />
                  </Form.Item>
                </div>
                <Typography.Text type="secondary">
                  {clusterId} / {namespace} · {selectedCount} 个
                  {source === 'helm' ? ' Helm Release' : '工作负载'}
                </Typography.Text>
              </Space>
            ) : null}
          </Form>
        </>
      )}
    </Modal>
  )
}
