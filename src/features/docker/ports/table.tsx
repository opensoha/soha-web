import { useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { StepFormModal } from '@/components/step-form-modal'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerPortMapping, DockerPortMappingInput } from '../docker-types'
import {
  DockerAdminTable,
  compactRecord,
  formatAccessURL,
  formatPort,
  normalizePage,
  pageTablePagination,
  refreshDocker,
  statusTag,
  type DockerFilterState,
  useDockerOptions,
  useDockerPermissions,
} from '../shared/ui'
import { formatDateTime } from '@/utils/time'

const { Text } = Typography

interface DockerPortFormValues extends Omit<DockerPortMappingInput, 'expiresAt'> {
  expiresAt?: string
}

function buildPortPayload(values: DockerPortFormValues): DockerPortMappingInput {
  return compactRecord({
    ...values,
    protocol: values.protocol || 'tcp',
    exposureScope: values.exposureScope || 'internal',
    status: values.status || 'active',
  })
}

export function PortsTable({
  embedded = false,
  fixedHostId,
  fixedProjectId,
}: {
  embedded?: boolean
  fixedHostId?: string
  fixedProjectId?: string
}) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
    hostId: fixedHostId,
    projectId: fixedProjectId,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<DockerPortFormValues>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [editing, setEditing] = useState<DockerPortMapping | null>(null)
  const { dockerModuleEnabled, canManagePorts, canViewServices } = useDockerPermissions()
  const { hostOptions, projectOptions, serviceOptions } = useDockerOptions({
    includeServices: canViewServices,
  })
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const portsQuery = useQuery(dockerQueries.ports(filters, dockerModuleEnabled))
  const saveMutation = useMutation({
    mutationFn: (values: DockerPortFormValues) =>
      editing
        ? dockerApi.updatePort(editing.id, buildPortPayload(values))
        : dockerApi.createPort(buildPortPayload(values)),
    onSuccess: () => {
      message.success(editing ? '端口映射已更新' : '端口映射已创建')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      refreshDocker(queryClient)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deletePort,
    onSuccess: () => {
      message.success('端口映射已删除')
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(portsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const columns: ColumnsType<DockerPortMapping> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 180,
      render: (value) => <Text strong>{value}</Text>,
    },
    { title: '状态', dataIndex: 'status', width: 105, render: statusTag },
    { title: '映射', width: 220, render: (_value, record) => formatPort(record) },
    {
      title: '域名',
      dataIndex: 'domainName',
      width: 220,
      render: (value, record) =>
        value ? (
          <Space>
            <Text>{value}</Text>
            {record.domainTlsEnabled ? <Tag color="green">TLS</Tag> : null}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '暴露范围',
      dataIndex: 'exposureScope',
      width: 110,
      render: (value) => value || 'internal',
    },
    {
      title: '访问地址',
      width: 250,
      render: (_value, record) => {
        const url = formatAccessURL(record)
        return url ? (
          <Typography.Link href={url} target="_blank">
            {url}
          </Typography.Link>
        ) : (
          '-'
        )
      },
    },
    {
      title: '主机',
      dataIndex: 'hostId',
      width: 170,
      render: (value) => hostOptions.find((item) => item.value === value)?.label || value,
    },
    {
      title: '项目/服务',
      width: 190,
      render: (_value, record) =>
        [
          projectOptions.find((item) => item.value === record.projectId)?.label || record.projectId,
          serviceOptions.find((item) => item.value === record.serviceId)?.label || record.serviceId,
        ]
          .filter(Boolean)
          .join(' / ') || '-',
    },
    { title: '负责人', dataIndex: 'owner', width: 120, render: (value) => value || '-' },
    { title: '到期', dataIndex: 'expiresAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      className: 'soha-table-actions-column',
      fixed: 'right',
      width: 96,
      render: (_value, record) =>
        canManagePorts ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="编辑端口映射"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue(record)
                setCurrentStep(0)
                setDrawerOpen(true)
              }}
            />
            <Popconfirm
              title="确认删除端口映射？"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <ManagementIconButton
                aria-label="删除端口映射"
                size="small"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]
  return (
    <>
      {!embedded ? (
        <div className="soha-vrt-query">
          <ManagementQueryPanel
            form={filterForm}
            actions={
              <ManagementQueryActions
                loading={portsQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters({
                    page: 1,
                    pageSize: filters.pageSize ?? 10,
                    hostId: fixedHostId,
                    projectId: fixedProjectId,
                  })
                }}
              />
            }
            onFinish={(values) =>
              setFilters((current) => ({
                ...current,
                ...values,
                hostId: fixedHostId,
                projectId: fixedProjectId,
                page: 1,
              }))
            }
          >
            <ManagementKeywordField placeholder="名称、访问地址或负责人" />
            {!fixedHostId ? (
              <ManagementQueryField minWidth={180} width={220} name="hostId" label="主机">
                <Select
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="全部主机"
                  options={hostOptions}
                />
              </ManagementQueryField>
            ) : null}
            {!fixedProjectId ? (
              <ManagementQueryField minWidth={180} width={220} name="projectId" label="项目">
                <Select
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="全部项目"
                  options={projectOptions}
                />
              </ManagementQueryField>
            ) : null}
            <ManagementQueryField minWidth={132} width={150} name="status" label="状态">
              <Select
                allowClear
                placeholder="全部"
                options={['active', 'reserved', 'released', 'expired'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={portsQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: 1470 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        actions={
          canManagePorts && !embedded ? (
            <>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null)
                  form.setFieldsValue({
                    hostId: fixedHostId,
                    projectId: fixedProjectId,
                    protocol: 'tcp',
                    exposureScope: 'internal',
                    status: 'active',
                    domainScheme: 'http',
                    domainTlsEnabled: false,
                  })
                  setCurrentStep(0)
                  setDrawerOpen(true)
                }}
              >
                新增映射
              </Button>
            </>
          ) : null
        }
        enableDensity={!embedded}
        refreshing={portsQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => portsQuery.refetch()}
      />
      <StepFormModal
        title={editing ? '编辑端口映射' : '新增端口映射'}
        current={currentStep}
        form={form}
        loading={saveMutation.isPending}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCurrentChange={setCurrentStep}
        onFinish={(values) => saveMutation.mutate(values)}
        steps={[
          {
            title: '端口配置',
            fieldNames: ['name', 'hostId', 'hostPort', 'containerPort'],
            children: (
              <>
                <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <div className="grid gap-3 md:grid-cols-2">
                  <Form.Item
                    name="hostId"
                    label="Docker 主机"
                    rules={[{ required: true }]}
                    hidden={Boolean(fixedHostId)}
                  >
                    <Select showSearch={{ optionFilterProp: 'label' }} options={hostOptions} />
                  </Form.Item>
                  <Form.Item name="hostIp" label="监听 IP">
                    <Input placeholder="0.0.0.0" />
                  </Form.Item>
                  <Form.Item name="hostPort" label="主机端口" rules={[{ required: true }]}>
                    <InputNumber min={1} max={65535} className="w-full" />
                  </Form.Item>
                  <Form.Item name="containerPort" label="容器端口" rules={[{ required: true }]}>
                    <InputNumber min={1} max={65535} className="w-full" />
                  </Form.Item>
                  <Form.Item name="protocol" label="协议">
                    <Select
                      options={[
                        { value: 'tcp', label: 'tcp' },
                        { value: 'udp', label: 'udp' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="exposureScope" label="暴露范围">
                    <Select
                      options={['internal', 'vpn', 'public'].map((item) => ({
                        value: item,
                        label: item,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="status" label="状态">
                    <Select
                      options={['active', 'reserved', 'released', 'expired'].map((item) => ({
                        value: item,
                        label: item,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="owner" label="负责人">
                    <Input />
                  </Form.Item>
                  <Form.Item name="projectId" label="项目" hidden={Boolean(fixedProjectId)}>
                    <Select
                      allowClear
                      showSearch={{ optionFilterProp: 'label' }}
                      options={projectOptions}
                    />
                  </Form.Item>
                  <Form.Item name="serviceId" label="服务">
                    <Select
                      allowClear
                      showSearch={{ optionFilterProp: 'label' }}
                      options={serviceOptions}
                    />
                  </Form.Item>
                </div>
              </>
            ),
          },
          {
            title: '访问配置',
            children: (
              <>
                <div className="grid gap-3 md:grid-cols-[1fr_160px_120px]">
                  <Form.Item name="domainName" label="访问域名">
                    <Input placeholder="preview.internal.example.com" />
                  </Form.Item>
                  <Form.Item name="domainScheme" label="域名协议">
                    <Select
                      options={[
                        { value: 'http', label: 'http' },
                        { value: 'https', label: 'https' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="domainTlsEnabled" label="TLS" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
                <Form.Item name="accessUrl" label="访问地址">
                  <Input placeholder="http://10.0.0.10:8080" />
                </Form.Item>
                <Form.Item name="expiresAt" label="到期时间">
                  <Input placeholder="2026-06-01T10:00:00Z" />
                </Form.Item>
              </>
            ),
          },
        ]}
        submitText="保存"
      />
    </>
  )
}
