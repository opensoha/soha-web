import { useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerContainerStartInput, DockerProject, DockerProjectInput } from '../docker-types'
import {
  ARCHITECTURE_OPTIONS,
  DEFAULT_COMPOSE,
  DEFAULT_CONTAINER_PORTS,
  DockerAdminTable,
  DrawerFooter,
  bytesFromMiB,
  compactRecord,
  normalizePage,
  operationActionLabel,
  pageTablePagination,
  refreshDocker,
  renderProjectPortSummary,
  statusTag,
  type DockerFilterState,
  type DockerProjectSourceKind,
  useDockerOptions,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography
const { TextArea } = Input

type ContainerStartResourceFormValues = NonNullable<DockerContainerStartInput['resources']> & {
  memoryMiB?: number
  memoryReservationMiB?: number
}

interface ContainerStartFormValues extends Omit<DockerContainerStartInput, 'resources'> {
  resources?: ContainerStartResourceFormValues
}

export function buildProjectPayload(values: DockerProjectInput): DockerProjectInput {
  return compactRecord({
    ...values,
    composeContent: values.composeContent || DEFAULT_COMPOSE,
    status: values.status || 'draft',
    sourceKind: values.sourceKind || 'inline_compose',
  })
}

export function buildContainerStartPayload(
  values: ContainerStartFormValues,
): DockerContainerStartInput {
  const {
    ports: formPorts,
    volumes: formVolumes,
    environmentVariables: formEnvVars,
    resources: formResources,
    ...rest
  } = values
  const ports = (formPorts ?? [])
    .map((port) =>
      compactRecord({
        ...port,
        protocol: port.protocol || rest.protocol || 'tcp',
        exposureScope: port.exposureScope || rest.exposureScope || 'internal',
        domainScheme: port.domainName
          ? port.domainScheme || (port.domainTlsEnabled ? 'https' : 'http')
          : undefined,
        domainTlsEnabled: port.domainName ? Boolean(port.domainTlsEnabled) : undefined,
      }),
    )
    .filter((port) => port.hostPort || port.containerPort)
  const volumes = (formVolumes ?? [])
    .map((volume) =>
      compactRecord({
        ...volume,
        type: volume.type || undefined,
        readOnly: Boolean(volume.readOnly),
      }),
    )
    .filter((volume) => volume.source || volume.target)
  const environmentVariables = (formEnvVars ?? [])
    .map((item) => compactRecord(item))
    .filter((item) => item.name || item.value)
  const resources = compactRecord({
    cpus: formResources?.cpus && formResources.cpus > 0 ? formResources.cpus : undefined,
    memoryBytes: bytesFromMiB(formResources?.memoryMiB) ?? formResources?.memoryBytes,
    memoryReservationBytes:
      bytesFromMiB(formResources?.memoryReservationMiB) ?? formResources?.memoryReservationBytes,
  })
  const primaryPort = ports[0]
  return compactRecord({
    ...rest,
    architecture: rest.architecture || undefined,
    containerPort: primaryPort?.containerPort ?? rest.containerPort,
    hostIp: primaryPort?.hostIp ?? rest.hostIp,
    hostPort: primaryPort?.hostPort ?? rest.hostPort,
    protocol: primaryPort?.protocol || rest.protocol || 'tcp',
    exposureScope: primaryPort?.exposureScope || rest.exposureScope || 'internal',
    domainName: primaryPort?.domainName ?? rest.domainName,
    domainScheme: primaryPort?.domainName
      ? primaryPort.domainScheme || (primaryPort.domainTlsEnabled ? 'https' : 'http')
      : undefined,
    domainTlsEnabled: primaryPort?.domainName ? Boolean(primaryPort.domainTlsEnabled) : undefined,
    restartPolicy: rest.restartPolicy || 'unless-stopped',
    ports: ports.length ? ports : undefined,
    volumes: volumes.length ? volumes : undefined,
    environmentVariables: environmentVariables.length ? environmentVariables : undefined,
    resources: Object.keys(resources).length ? resources : undefined,
  })
}

function ProjectsTable({
  embedded = false,
  sourceKind = 'compose' as DockerProjectSourceKind,
}: {
  embedded?: boolean
  sourceKind?: DockerProjectSourceKind
}) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
    sourceKind,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<DockerProjectInput>()
  const [containerForm] = Form.useForm<ContainerStartFormValues>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [containerDrawerOpen, setContainerDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<DockerProject | null>(null)
  const { dockerModuleEnabled, canManageProjects, canDeployProjects, canManagePorts } =
    useDockerPermissions()
  const { hosts, hostOptions } = useDockerOptions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const projectsQuery = useQuery(dockerQueries.projects(filters, dockerModuleEnabled))
  const saveMutation = useMutation({
    mutationFn: (values: DockerProjectInput) =>
      editing
        ? dockerApi.updateProject(editing.id, buildProjectPayload(values))
        : dockerApi.createProject(buildProjectPayload(values)),
    onSuccess: () => {
      message.success(editing ? '项目已更新' : '项目已创建')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      refreshDocker(queryClient)
    },
  })
  const containerStartMutation = useMutation({
    mutationFn: (values: ContainerStartFormValues) =>
      dockerApi.startContainer(buildContainerStartPayload(values)),
    onSuccess: () => {
      message.success('单容器启动任务已提交')
      setContainerDrawerOpen(false)
      containerForm.resetFields()
      refreshDocker(queryClient)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deleteProject,
    onSuccess: () => {
      message.success('项目已删除')
      refreshDocker(queryClient)
    },
  })
  const deployMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dockerApi.deployProject(id, action),
    onSuccess: (_response, variables) => {
      message.success(`${operationActionLabel(variables.action)}任务已提交`)
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(projectsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const canStartContainer = canManageProjects && canDeployProjects && canManagePorts
  const isSingleContainer = sourceKind === 'single_container'
  const applyContainerHostDefaults = (hostID?: string) => {
    const host = hosts.find((item) => item.id === hostID)
    if (host?.architecture) {
      containerForm.setFieldsValue({ architecture: host.architecture })
    }
  }
  const columns: ColumnsType<DockerProject> = [
    {
      title: isSingleContainer ? '单容器服务' : 'Compose',
      dataIndex: 'name',
      fixed: 'left',
      width: 210,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Link to={`/docker/projects/${record.id}`}>
            <Text strong>{value}</Text>
          </Link>
          <Text type="secondary">{record.slug}</Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
    {
      title: '主机',
      dataIndex: 'hostId',
      width: 190,
      render: (value) => hostOptions.find((item) => item.value === value)?.label || value,
    },
    {
      title: '来源',
      width: 160,
      render: (_value, record) => record.sourceKind || record.templateId || 'inline_compose',
    },
    ...(isSingleContainer
      ? ([
          {
            title: '端口映射',
            width: 260,
            render: (_value, record) => renderProjectPortSummary(record),
          },
        ] satisfies ColumnsType<DockerProject>)
      : []),
    {
      title: '环境/归属',
      width: 180,
      render: (_value, record) =>
        [record.environment, record.owner || record.team].filter(Boolean).join(' / ') || '-',
    },
    { title: '目标态', dataIndex: 'desiredState', width: 120, render: (value) => value || '-' },
    { title: '到期', dataIndex: 'expiresAt', width: 155, render: formatDateTime },
    { title: '部署时间', dataIndex: 'lastDeployedAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 160,
      render: (_value, record) => (
        <Space className="soha-row-action-icons">
          {canDeployProjects ? (
            <ManagementIconButton
              aria-label="部署项目"
              size="small"
              tooltip="部署"
              icon={<PlayCircleOutlined />}
              loading={deployMutation.isPending}
              onClick={() => deployMutation.mutate({ id: record.id, action: 'deploy' })}
            />
          ) : null}
          {canDeployProjects ? (
            <ManagementIconButton
              aria-label="重启项目"
              size="small"
              tooltip="重启"
              icon={<ReloadOutlined />}
              loading={deployMutation.isPending}
              onClick={() => deployMutation.mutate({ id: record.id, action: 'restart' })}
            />
          ) : null}
          {canDeployProjects ? (
            <ManagementIconButton
              aria-label="停止项目"
              size="small"
              tooltip="停止"
              icon={<PoweroffOutlined />}
              loading={deployMutation.isPending}
              onClick={() => deployMutation.mutate({ id: record.id, action: 'down' })}
            />
          ) : null}
          <Link to={`/docker/projects/${record.id}`}>
            <ManagementIconButton
              aria-label="查看容器详情"
              size="small"
              tooltip="详情"
              icon={<FileTextOutlined />}
            />
          </Link>
          {canManageProjects ? (
            <ManagementIconButton
              aria-label="编辑项目"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue(record)
                setDrawerOpen(true)
              }}
            />
          ) : null}
          {canManageProjects ? (
            <Popconfirm
              title={isSingleContainer ? '确认删除单容器服务？' : '确认删除 Compose 项目？'}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <ManagementIconButton
                aria-label="删除项目"
                size="small"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          ) : null}
        </Space>
      ),
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
                loading={projectsQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters({ page: 1, pageSize: filters.pageSize ?? 10, sourceKind })
                }}
              />
            }
            onFinish={(values) =>
              setFilters((current) => ({ ...current, ...values, sourceKind, page: 1 }))
            }
          >
            <ManagementKeywordField placeholder="项目、Slug 或来源" />
            <ManagementQueryField minWidth={180} width={220} name="hostId" label="主机">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                placeholder="全部主机"
                options={hostOptions}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={132} width={150} name="status" label="状态">
              <Select
                allowClear
                placeholder="全部"
                options={['draft', 'defined', 'running', 'stopped', 'failed'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={150} width={180} name="environment" label="环境">
              <Input allowClear placeholder="dev / test" />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={projectsQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: isSingleContainer ? 1690 : 1430 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        actions={
          !embedded ? (
            <>
              {isSingleContainer && canStartContainer ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    containerForm.setFieldsValue({
                      architecture: 'amd64',
                      protocol: 'tcp',
                      exposureScope: 'internal',
                      restartPolicy: 'unless-stopped',
                      domainScheme: 'http',
                      domainTlsEnabled: false,
                      ports: DEFAULT_CONTAINER_PORTS,
                    })
                    setContainerDrawerOpen(true)
                  }}
                >
                  快速启动
                </Button>
              ) : null}
              {!isSingleContainer && canManageProjects ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditing(null)
                    form.setFieldsValue({
                      composeContent: DEFAULT_COMPOSE,
                      status: 'draft',
                      sourceKind: 'inline_compose',
                    })
                    setDrawerOpen(true)
                  }}
                >
                  创建 Compose
                </Button>
              ) : null}
            </>
          ) : null
        }
        enableDensity={!embedded}
        refreshing={projectsQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => projectsQuery.refetch()}
      />
      <Drawer
        title={editing ? '编辑 Compose 项目' : '创建 Compose 项目'}
        size="large"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <DrawerFooter
            form={form}
            loading={saveMutation.isPending}
            onCancel={() => setDrawerOpen(false)}
          />
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="hostId" label="Docker 主机" rules={[{ required: true }]}>
              <Select showSearch={{ optionFilterProp: 'label' }} options={hostOptions} />
            </Form.Item>
            <Form.Item name="slug" label="Slug">
              <Input />
            </Form.Item>
            <Form.Item name="environment" label="环境">
              <Input />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input />
            </Form.Item>
            <Form.Item name="team" label="团队">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                options={['draft', 'defined', 'running', 'stopped', 'failed'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </Form.Item>
            <Form.Item name="desiredState" label="目标态">
              <Select
                allowClear
                options={['running', 'stopped'].map((item) => ({ value: item, label: item }))}
              />
            </Form.Item>
            <Form.Item name="ttlSeconds" label="TTL 秒数">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="sourceKind" label="来源类型">
              <Select
                options={['inline_compose', 'git', 'template'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </Form.Item>
            <Form.Item name="sourceRef" label="来源引用">
              <Input />
            </Form.Item>
            <Form.Item name="templateId" label="模板 ID">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Tabs
            items={[
              {
                key: 'compose',
                label: 'Compose',
                children: (
                  <Form.Item name="composeContent" rules={[{ required: true }]}>
                    <TextArea rows={16} spellCheck={false} />
                  </Form.Item>
                ),
              },
              {
                key: 'env',
                label: '.env',
                children: (
                  <Form.Item name="envContent">
                    <TextArea rows={12} spellCheck={false} />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
      <Drawer
        title="快速启动 Docker 应用"
        size="large"
        open={containerDrawerOpen}
        onClose={() => setContainerDrawerOpen(false)}
        extra={
          <DrawerFooter
            form={containerForm}
            loading={containerStartMutation.isPending}
            onCancel={() => setContainerDrawerOpen(false)}
            submitLabel="启动"
          />
        }
      >
        <Form
          form={containerForm}
          layout="vertical"
          onFinish={(values) => containerStartMutation.mutate(values)}
        >
          <Form.Item name="name" label="容器名称" rules={[{ required: true }]}>
            <Input placeholder="preview-api" />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="hostId" label="Docker 主机" rules={[{ required: true }]}>
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                options={hostOptions}
                onChange={applyContainerHostDefaults}
              />
            </Form.Item>
            <Form.Item name="image" label="镜像" rules={[{ required: true }]}>
              <Input placeholder="nginx:alpine" />
            </Form.Item>
            <Form.Item name="architecture" label="架构">
              <Select options={ARCHITECTURE_OPTIONS} />
            </Form.Item>
            <Form.Item name="restartPolicy" label="重启策略">
              <Select
                options={['unless-stopped', 'always', 'on-failure', 'no'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </Form.Item>
            <Form.Item name="environment" label="环境">
              <Input />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input />
            </Form.Item>
            <Form.Item name="team" label="团队">
              <Input />
            </Form.Item>
            <Form.Item name="ttlSeconds" label="TTL 秒数">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="command" label="启动命令">
              <Input />
            </Form.Item>
            <Form.Item name="entrypoint" label="Entrypoint">
              <Input />
            </Form.Item>
          </div>
          <Form.List name="ports">
            {(fields, { add, remove }) => (
              <div className="mb-3 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="rounded border border-[var(--soha-border-color)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Text strong>端口 {index + 1}</Text>
                      {fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Form.Item name={[field.name, 'name']} label="名称">
                        <Input placeholder="http" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'containerPort']}
                        label="容器端口"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={65535} className="w-full" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'hostPort']}
                        label="主机端口"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={65535} className="w-full" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'hostIp']} label="监听 IP">
                        <Input placeholder="0.0.0.0" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'protocol']} label="协议">
                        <Select
                          options={[
                            { value: 'tcp', label: 'tcp' },
                            { value: 'udp', label: 'udp' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, 'exposureScope']} label="暴露范围">
                        <Select
                          options={['internal', 'vpn', 'public'].map((item) => ({
                            value: item,
                            label: item,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, 'domainName']} label="访问域名">
                        <Input placeholder="preview.internal.example.com" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'domainScheme']} label="域名协议">
                        <Select
                          options={[
                            { value: 'http', label: 'http' },
                            { value: 'https', label: 'https' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'domainTlsEnabled']}
                        label="TLS"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </div>
                  </div>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      hostIp: '0.0.0.0',
                      protocol: 'tcp',
                      exposureScope: 'internal',
                      domainScheme: 'http',
                      domainTlsEnabled: false,
                    })
                  }
                >
                  添加端口
                </Button>
              </div>
            )}
          </Form.List>
          <Form.List name="volumes">
            {(fields, { add, remove }) => (
              <div className="mb-3 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="rounded border border-[var(--soha-border-color)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Text strong>卷 {index + 1}</Text>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Form.Item name={[field.name, 'name']} label="名称">
                        <Input placeholder="data" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'type']} label="类型">
                        <Select
                          options={[
                            { value: 'bind', label: 'bind' },
                            { value: 'volume', label: 'volume' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, 'source']} label="来源">
                        <Input placeholder="/data/app 或 app-data" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'target']} label="挂载路径">
                        <Input placeholder="/var/lib/app" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'readOnly']}
                        label="只读"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </div>
                  </div>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ type: 'bind', readOnly: false })}
                >
                  添加卷
                </Button>
              </div>
            )}
          </Form.List>
          <Form.List name="environmentVariables">
            {(fields, { add, remove }) => (
              <div className="mb-3 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="grid items-start gap-3 md:grid-cols-[1fr_1fr_40px]"
                  >
                    <Form.Item
                      name={[field.name, 'name']}
                      label={index === 0 ? '变量名' : undefined}
                    >
                      <Input placeholder="APP_ENV" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'value']}
                      label={index === 0 ? '变量值' : undefined}
                    >
                      <Input />
                    </Form.Item>
                    <Button
                      className={index === 0 ? 'mt-8' : undefined}
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                  添加环境变量
                </Button>
              </div>
            )}
          </Form.List>
          <div className="grid gap-3 md:grid-cols-3">
            <Form.Item name={['resources', 'cpus']} label="CPU 限制">
              <InputNumber min={0} step={0.1} className="w-full" />
            </Form.Item>
            <Form.Item name={['resources', 'memoryMiB']} label="内存限制 MiB">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name={['resources', 'memoryReservationMiB']} label="内存预留 MiB">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="network" label="外部网络">
            <Input placeholder="traefik 或已有 Docker network" />
          </Form.Item>
          <Form.Item name="imagePullPolicy" label="拉取策略">
            <Select
              allowClear
              options={['always', 'missing', 'never', 'build'].map((item) => ({
                value: item,
                label: item,
              }))}
            />
          </Form.Item>
          <Form.Item name="envContent" label=".env">
            <TextArea rows={8} spellCheck={false} placeholder="KEY=value" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

function ContainerManagementPage() {
  return (
    <div className="soha-page soha-docker-page">
      <ManagementDetailHeader
        title="容器管理"
        meta={
          <>
            <span>Compose</span>
            <span>单容器服务</span>
          </>
        }
      />
      <Tabs
        className="soha-docker-management-tabs"
        items={[
          { key: 'compose', label: 'Compose', children: <ProjectsTable sourceKind="compose" /> },
          {
            key: 'single',
            label: '单容器服务',
            children: <ProjectsTable sourceKind="single_container" />,
          },
        ]}
      />
    </div>
  )
}

export function DockerProjectsPage() {
  return <ContainerManagementPage />
}
