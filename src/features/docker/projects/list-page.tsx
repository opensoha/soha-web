import { useEffect, useMemo, useRef, useState } from 'react'
import type { Key, ReactNode } from 'react'
import {
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BranchesOutlined,
  CloudOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { StepFormModal } from '@/components/step-form-modal'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { MetadataTag } from '@/components/status-tag'
import type { OperationalPlan } from '@opensoha/contracts/gen/ts/sohaapi'
import { createUUID } from '@/utils/uuid'
import { tableColumnPresets } from '@/utils/table-columns'
import { computeQueries, latestTaskForResource, ResourceTaskActions } from '@/features/compute'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type {
  DockerContainerStartInput,
  DockerProject,
  DockerProjectInput,
  DockerService,
} from '../docker-types'
import {
  ARCHITECTURE_OPTIONS,
  DEFAULT_COMPOSE,
  DEFAULT_CONTAINER_PORTS,
  DockerAdminTable,
  bytesFromMiB,
  compactRecord,
  normalizePage,
  operationActionLabel,
  pageTablePagination,
  refreshDocker,
  renderProjectPortSummary,
  stringValue,
  statusTag,
  type DockerFilterState,
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

interface DockerProjectTreeRow {
  key: string
  kind: 'project' | 'service'
  project: DockerProject
  service?: DockerService
  children?: DockerProjectTreeRow[]
}

function isSingleContainerProject(project: DockerProject) {
  return ['single_container', 'git_dockerfile'].includes(project.sourceKind ?? '')
}

function projectTypeLabel(project: DockerProject) {
  return isSingleContainerProject(project) ? '单容器' : 'Compose'
}

function QuickStartFormSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="soha-docker-quick-form-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
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
    gitBuild: formGitBuild,
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
    sourceKind: rest.sourceKind || 'image',
    gitBuild:
      rest.sourceKind === 'git_dockerfile'
        ? compactRecord({
            repositoryUrl: formGitBuild?.repositoryUrl ?? '',
            ref: formGitBuild?.ref || 'main',
            dockerfilePath: formGitBuild?.dockerfilePath || 'Dockerfile',
            contextDir: formGitBuild?.contextDir || '.',
            pull: Boolean(formGitBuild?.pull),
            noCache: Boolean(formGitBuild?.noCache),
          })
        : undefined,
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
    imagePullPolicy:
      rest.sourceKind === 'git_dockerfile' ? 'never' : rest.imagePullPolicy || undefined,
    ports: ports.length ? ports : undefined,
    volumes: volumes.length ? volumes : undefined,
    environmentVariables: environmentVariables.length ? environmentVariables : undefined,
    resources: Object.keys(resources).length ? resources : undefined,
  })
}

function ProjectsTable({ embedded = false }: { embedded?: boolean }) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<DockerProjectInput>()
  const [containerForm] = Form.useForm<ContainerStartFormValues>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [containerStep, setContainerStep] = useState(0)
  const [containerDrawerOpen, setContainerDrawerOpen] = useState(false)
  const [containerSourceKind, setContainerSourceKind] = useState<'image' | 'git_dockerfile'>(
    'image',
  )
  const [containerReviewValues, setContainerReviewValues] = useState<
    Partial<ContainerStartFormValues>
  >({})
  const [editing, setEditing] = useState<DockerProject | null>(null)
  const [deployPlan, setDeployPlan] = useState<{
    action: string
    idempotencyKey: string
    plan: OperationalPlan
    project: DockerProject
  } | null>(null)
  const {
    dockerModuleEnabled,
    canCreateProjects,
    canUpdateProjects,
    canDeleteProjects,
    canDeployProjects,
    canCreatePorts,
    canStartServices,
    canStopServices,
    canRestartServices,
    canViewServices,
    canViewOperations,
  } = useDockerPermissions()
  const { hosts, hostOptions } = useDockerOptions({
    includeProjects: false,
    includeServices: false,
  })
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const projectsQuery = useQuery(dockerQueries.projects(filters, dockerModuleEnabled))
  const tasksQuery = useQuery({
    ...computeQueries.tasks({ domain: 'container_runtime', limit: 100 }),
    enabled: dockerModuleEnabled && canViewOperations,
  })
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
  const deployPlanMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dockerApi.planProjectDeploy(id, action),
    onError: (error) => void message.error(error.message),
  })
  const deployMutation = useMutation({
    mutationFn: ({
      id,
      action,
      idempotencyKey,
    }: {
      id: string
      action: string
      idempotencyKey: string
    }) => dockerApi.deployProject(id, action, idempotencyKey),
    onSuccess: (_response, variables) => {
      message.success(`${operationActionLabel(variables.action)}任务已提交`)
      setDeployPlan(null)
      refreshDocker(queryClient)
    },
    onError: (error) => void message.error(error.message),
  })
  const reviewDeploy = (project: DockerProject, action: string) => {
    deployPlanMutation.mutate(
      { id: project.id, action },
      {
        onSuccess: (plan) => setDeployPlan({ action, idempotencyKey: createUUID(), plan, project }),
      },
    )
  }
  const serviceActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dockerApi.serviceAction(id, action),
    onSuccess: (_response, variables) => {
      message.success(`${operationActionLabel(variables.action)}服务任务已提交`)
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(projectsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const projectServiceQueries = useQueries({
    queries: page.items.map((project) =>
      dockerQueries.projectServices(
        project.id,
        dockerModuleEnabled && canViewServices && !isSingleContainerProject(project),
      ),
    ),
  })
  const canStartContainer = canCreateProjects && canDeployProjects && canCreatePorts
  const serviceActions = [
    { action: 'restart', allowed: canRestartServices, icon: <ReloadOutlined /> },
    { action: 'start', allowed: canStartServices, icon: <PlayCircleOutlined /> },
    { action: 'stop', allowed: canStopServices, icon: <PoweroffOutlined /> },
  ].filter((item) => item.allowed)
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const autoExpandedProjectKeys = useRef(new Set<string>())
  const servicesByProject = useMemo(() => {
    const grouped = new Map<string, DockerService[]>()
    page.items.forEach((project, index) => {
      const services = projectServiceQueries[index]?.data?.items ?? []
      if (services.length > 0) grouped.set(project.id, services)
    })
    return grouped
  }, [page.items, projectServiceQueries])
  const treeRows = useMemo<DockerProjectTreeRow[]>(
    () =>
      page.items.map((project) => {
        const children = isSingleContainerProject(project)
          ? []
          : (servicesByProject.get(project.id) ?? []).map<DockerProjectTreeRow>((service) => ({
              key: `${project.id}:service:${service.id}`,
              kind: 'service',
              project,
              service,
            }))
        return {
          key: project.id,
          kind: 'project',
          project,
          children: children.length > 0 ? children : undefined,
        }
      }),
    [page.items, servicesByProject],
  )
  useEffect(() => {
    const newlyExpandableKeys = treeRows
      .filter((row) => (row.children?.length ?? 0) > 0)
      .map((row) => row.key)
      .filter((key) => !autoExpandedProjectKeys.current.has(key))
    if (newlyExpandableKeys.length === 0) return
    newlyExpandableKeys.forEach((key) => autoExpandedProjectKeys.current.add(key))
    setExpandedRowKeys((current) => {
      const next = Array.from(new Set([...current, ...newlyExpandableKeys]))
      return next.length === current.length && next.every((key, index) => key === current[index])
        ? current
        : next
    })
  }, [treeRows])
  const applyContainerHostDefaults = (hostID?: string) => {
    const host = hosts.find((item) => item.id === hostID)
    if (host?.architecture) {
      containerForm.setFieldsValue({ architecture: host.architecture })
    }
  }
  const columns: ColumnsType<DockerProjectTreeRow> = [
    {
      title: '项目',
      fixed: 'left',
      width: 190,
      render: (_value, record) =>
        record.kind === 'project' ? (
          <Space orientation="vertical" size={4}>
            <Link to={`/compute/runtimes/projects/${record.project.id}`}>
              {record.project.name}
            </Link>
            <MetadataTag label={projectTypeLabel(record.project)} tone="purple" />
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '服务',
      width: 190,
      render: (_value, record) =>
        record.kind === 'service' && record.service ? (
          <Space orientation="vertical" size={4}>
            <Space size={4}>
              <Text>{record.service.name}</Text>
              <MetadataTag label="服务" tone="cyan" />
            </Space>
            <Text type="secondary">{record.service.containerId || record.service.id}</Text>
          </Space>
        ) : (
          stringValue(record.project.config?.serviceName) || <Text type="secondary">-</Text>
        ),
    },
    {
      title: '状态',
      width: 110,
      render: (_value, record) =>
        statusTag(record.kind === 'service' ? record.service?.status : record.project.status),
    },
    {
      title: '主机',
      width: 170,
      render: (_value, record) => {
        const hostId = record.kind === 'service' ? record.service?.hostId : record.project.hostId
        return hostOptions.find((item) => item.value === hostId)?.label || hostId || '-'
      },
    },
    {
      title: '镜像',
      width: 210,
      render: (_value, record) => {
        const image =
          record.kind === 'service'
            ? record.service?.image
            : stringValue(record.project.config?.image)
        return image ? (
          <MetadataTag
            label={<span className="soha-docker-image-value">{image}</span>}
            tone="blue"
          />
        ) : (
          <Text type="secondary">-</Text>
        )
      },
    },
    {
      title: '端口',
      width: 220,
      render: (_value, record) =>
        record.kind === 'project' && isSingleContainerProject(record.project) ? (
          renderProjectPortSummary(record.project)
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      ...tableColumnPresets.task,
      title: '最近任务',
      render: (_value, record) =>
        record.kind === 'service' ? (
          <Text type="secondary">-</Text>
        ) : (
          <ResourceTaskActions
            task={latestTaskForResource(tasksQuery.data?.items ?? [], 'project', record.project.id)}
            resourceKind="project"
            resourceId={record.project.id}
          />
        ),
    },
    {
      title: '操作',
      align: 'center',
      className: 'soha-table-actions-column',
      fixed: 'right',
      width: 200,
      render: (_value, record) => {
        if (record.kind === 'service' && record.service) {
          return (
            <Space className="soha-row-action-icons">
              {serviceActions.map(({ action, icon }) => (
                <ManagementIconButton
                  key={action}
                  aria-label={`${operationActionLabel(action)}服务`}
                  size="small"
                  tooltip={operationActionLabel(action)}
                  icon={icon}
                  loading={serviceActionMutation.isPending}
                  onClick={() => serviceActionMutation.mutate({ id: record.service!.id, action })}
                />
              ))}
            </Space>
          )
        }
        const project = record.project
        return (
          <Space className="soha-row-action-icons">
            {canDeployProjects ? (
              <ManagementIconButton
                aria-label="部署项目"
                size="small"
                tooltip="部署"
                icon={<PlayCircleOutlined />}
                loading={deployPlanMutation.isPending || deployMutation.isPending}
                onClick={() => reviewDeploy(project, 'deploy')}
              />
            ) : null}
            {canDeployProjects ? (
              <ManagementIconButton
                aria-label="重启项目"
                size="small"
                tooltip="重启"
                icon={<ReloadOutlined />}
                loading={deployPlanMutation.isPending || deployMutation.isPending}
                onClick={() => reviewDeploy(project, 'restart')}
              />
            ) : null}
            {canDeployProjects ? (
              <ManagementIconButton
                aria-label="停止项目"
                size="small"
                tooltip="停止"
                icon={<PoweroffOutlined />}
                loading={deployPlanMutation.isPending || deployMutation.isPending}
                onClick={() => reviewDeploy(project, 'down')}
              />
            ) : null}
            {canDeployProjects && isSingleContainerProject(project) ? (
              <ManagementIconButton
                aria-label="销毁重建应用"
                size="small"
                tooltip="销毁重建"
                danger
                icon={<SyncOutlined />}
                loading={deployPlanMutation.isPending || deployMutation.isPending}
                onClick={() => reviewDeploy(project, 'redeploy')}
              />
            ) : null}
            <Link to={`/compute/runtimes/projects/${project.id}`}>
              <ManagementIconButton
                aria-label="查看容器详情"
                size="small"
                tooltip="详情"
                icon={<FileTextOutlined />}
              />
            </Link>
            {canUpdateProjects ? (
              <ManagementIconButton
                aria-label="编辑项目"
                size="small"
                tooltip="编辑"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(project)
                  form.setFieldsValue(project)
                  setCurrentStep(0)
                  setDrawerOpen(true)
                }}
              />
            ) : null}
            {canDeleteProjects ? (
              <Popconfirm
                title={
                  isSingleContainerProject(project)
                    ? '确认删除单容器服务？'
                    : '确认删除 Compose 项目？'
                }
                onConfirm={() => deleteMutation.mutate(project.id)}
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
        )
      },
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
                  setFilters({ page: 1, pageSize: filters.pageSize ?? 10 })
                }}
              />
            }
            onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
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
            <ManagementQueryField minWidth={132} width={150} name="sourceKind" label="类型">
              <Select
                allowClear
                placeholder="全部"
                options={[
                  { value: 'compose', label: 'Compose' },
                  { value: 'single_container', label: '单容器' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={150} width={180} name="environment" label="环境">
              <Input allowClear placeholder="dev / test" />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="key"
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys: readonly Key[]) => setExpandedRowKeys(keys.map(String)),
          rowExpandable: (record: DockerProjectTreeRow) => (record.children?.length ?? 0) > 0,
        }}
        enableColumnSelection={!embedded}
        loading={projectsQuery.isLoading || projectServiceQueries.some((query) => query.isLoading)}
        dataSource={treeRows}
        columns={columns}
        pagination={pageTablePagination(page, embedded, setFilters)}
        actions={
          !embedded ? (
            <>
              {canStartContainer ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    setContainerSourceKind('image')
                    setContainerReviewValues({})
                    setContainerStep(0)
                    setContainerDrawerOpen(true)
                  }}
                >
                  快速启动
                </Button>
              ) : null}
              {canCreateProjects ? (
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
                    setCurrentStep(0)
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
        onRefresh={() => {
          void projectsQuery.refetch()
          projectServiceQueries.forEach((query) => void query.refetch())
        }}
      />
      <OperationalPlanModal
        confirmText={deployPlan ? operationActionLabel(deployPlan.action) : '确认执行'}
        loading={deployMutation.isPending}
        onCancel={() => setDeployPlan(null)}
        onConfirm={() => {
          if (!deployPlan) return
          deployMutation.mutate({
            action: deployPlan.action,
            id: deployPlan.project.id,
            idempotencyKey: deployPlan.idempotencyKey,
          })
        }}
        plan={deployPlan?.plan ?? null}
        title={
          deployPlan ? `${operationActionLabel(deployPlan.action)}：${deployPlan.project.name}` : ''
        }
      />
      <StepFormModal
        title={editing ? '编辑 Compose 项目' : '创建 Compose 项目'}
        current={currentStep}
        form={form}
        loading={saveMutation.isPending}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCurrentChange={setCurrentStep}
        onFinish={(values) => saveMutation.mutate(values)}
        steps={[
          {
            title: '基础信息',
            fieldNames: ['name', 'hostId', 'slug', 'description'],
            children: (
              <>
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
                </div>
                <Form.Item name="description" label="描述">
                  <Input />
                </Form.Item>
              </>
            ),
          },
          {
            title: '项目设置',
            fieldNames: ['environment', 'owner', 'team', 'status', 'desiredState', 'ttlSeconds'],
            children: (
              <div className="grid gap-3 md:grid-cols-2">
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
              </div>
            ),
          },
          {
            title: '部署来源',
            fieldNames: ['sourceKind', 'sourceRef', 'templateId'],
            children: (
              <div className="grid gap-3 md:grid-cols-2">
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
            ),
          },
          {
            title: 'Compose 配置',
            fieldNames: ['composeContent', 'envContent'],
            children: (
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
            ),
          },
        ]}
        submitText="保存"
        width={780}
      />
      <StepFormModal
        title="快速启动 Docker 应用"
        current={containerStep}
        form={containerForm}
        initialValues={{
          sourceKind: 'image',
          gitBuild: {
            ref: 'main',
            dockerfilePath: 'Dockerfile',
            contextDir: '.',
            pull: false,
            noCache: false,
          },
          architecture: 'amd64',
          protocol: 'tcp',
          exposureScope: 'internal',
          restartPolicy: 'unless-stopped',
          domainScheme: 'http',
          domainTlsEnabled: false,
          ports: DEFAULT_CONTAINER_PORTS,
        }}
        loading={containerStartMutation.isPending}
        open={containerDrawerOpen}
        onClose={() => setContainerDrawerOpen(false)}
        onCurrentChange={(nextStep) => {
          if (nextStep === 3) {
            setContainerReviewValues(containerForm.getFieldsValue(true))
          }
          setContainerStep(nextStep)
        }}
        onFinish={(values) => containerStartMutation.mutate(values)}
        steps={[
          {
            title: '来源',
            fieldNames: [
              'sourceKind',
              'name',
              'hostId',
              'image',
              ['gitBuild', 'repositoryUrl'],
              ['gitBuild', 'ref'],
              ['gitBuild', 'dockerfilePath'],
              ['gitBuild', 'contextDir'],
            ],
            children: (
              <div className="soha-docker-quick-form">
                <QuickStartFormSection title="来源方式">
                  <Form.Item name="sourceKind" label="应用来源" rules={[{ required: true }]}>
                    <Segmented
                      block
                      onChange={(value) =>
                        setContainerSourceKind(value as 'image' | 'git_dockerfile')
                      }
                      options={[
                        { value: 'image', label: '已有镜像', icon: <CloudOutlined /> },
                        { value: 'git_dockerfile', label: 'Git 构建', icon: <BranchesOutlined /> },
                      ]}
                    />
                  </Form.Item>
                </QuickStartFormSection>
                <QuickStartFormSection title="应用与目标">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Form.Item name="name" label="应用名称" rules={[{ required: true }]}>
                      <Input placeholder="preview-api" />
                    </Form.Item>
                    <Form.Item name="hostId" label="Docker 主机" rules={[{ required: true }]}>
                      <Select
                        showSearch={{ optionFilterProp: 'label' }}
                        options={hostOptions}
                        onChange={applyContainerHostDefaults}
                      />
                    </Form.Item>
                    <Form.Item name="architecture" label="架构">
                      <Select options={ARCHITECTURE_OPTIONS} />
                    </Form.Item>
                  </div>
                </QuickStartFormSection>
                <QuickStartFormSection title="镜像与构建">
                  <Form.Item
                    name="image"
                    label={containerSourceKind === 'git_dockerfile' ? '构建镜像' : '镜像'}
                    rules={[{ required: true }]}
                  >
                    <Input
                      placeholder={
                        containerSourceKind === 'git_dockerfile'
                          ? 'preview-api:git-main'
                          : 'nginx:alpine'
                      }
                    />
                  </Form.Item>
                  {containerSourceKind === 'git_dockerfile' ? (
                    <>
                      <Form.Item
                        name={['gitBuild', 'repositoryUrl']}
                        label="Git 仓库"
                        rules={[
                          { required: true },
                          {
                            pattern: /^(https?|ssh):\/\/[^\s]+$/i,
                            message: '请输入有效的仓库 URL',
                          },
                        ]}
                      >
                        <Input placeholder="https://github.com/org/repository.git" />
                      </Form.Item>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Form.Item
                          name={['gitBuild', 'ref']}
                          label="分支 / Tag / Commit"
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="main" />
                        </Form.Item>
                        <Form.Item
                          name={['gitBuild', 'dockerfilePath']}
                          label="Dockerfile"
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="Dockerfile" />
                        </Form.Item>
                        <Form.Item
                          name={['gitBuild', 'contextDir']}
                          label="构建目录"
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="." />
                        </Form.Item>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Form.Item
                          name={['gitBuild', 'pull']}
                          label="拉取最新基础镜像"
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item
                          name={['gitBuild', 'noCache']}
                          label="禁用构建缓存"
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                      </div>
                    </>
                  ) : (
                    <Form.Item name="imagePullPolicy" label="拉取策略">
                      <Select
                        allowClear
                        options={['always', 'missing', 'never'].map((item) => ({
                          value: item,
                          label: item,
                        }))}
                      />
                    </Form.Item>
                  )}
                </QuickStartFormSection>
              </div>
            ),
          },
          {
            title: '运行配置',
            fieldNames: ['restartPolicy', 'environmentVariables', 'resources'],
            children: (
              <>
                <div className="grid gap-3 md:grid-cols-2">
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
                <Form.Item name="envContent" label=".env">
                  <TextArea rows={7} spellCheck={false} placeholder="KEY=value" />
                </Form.Item>
              </>
            ),
          },
          {
            title: '网络与存储',
            fieldNames: ['ports', 'volumes', 'network'],
            children: (
              <>
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
                <Form.Item name="network" label="外部网络">
                  <Input placeholder="traefik 或已有 Docker network" />
                </Form.Item>
              </>
            ),
          },
          {
            title: '确认启动',
            children: (
              <Descriptions
                bordered
                column={2}
                size="small"
                items={[
                  {
                    key: 'source',
                    label: '来源',
                    children: containerSourceKind === 'git_dockerfile' ? 'Git 构建' : '已有镜像',
                  },
                  {
                    key: 'name',
                    label: '应用',
                    children: containerReviewValues.name || '-',
                  },
                  {
                    key: 'host',
                    label: 'Docker 主机',
                    children:
                      hostOptions.find((item) => item.value === containerReviewValues.hostId)
                        ?.label ||
                      containerReviewValues.hostId ||
                      '-',
                  },
                  {
                    key: 'image',
                    label: containerSourceKind === 'git_dockerfile' ? '构建镜像' : '镜像',
                    children: containerReviewValues.image || '-',
                  },
                  ...(containerSourceKind === 'git_dockerfile'
                    ? [
                        {
                          key: 'repository',
                          label: 'Git 仓库',
                          children: containerReviewValues.gitBuild?.repositoryUrl || '-',
                        },
                        {
                          key: 'ref',
                          label: '版本',
                          children: containerReviewValues.gitBuild?.ref || 'main',
                        },
                      ]
                    : []),
                  {
                    key: 'ports',
                    label: '端口',
                    children: `${containerReviewValues.ports?.length || 0} 项`,
                  },
                  {
                    key: 'volumes',
                    label: '卷',
                    children: `${containerReviewValues.volumes?.length || 0} 项`,
                  },
                ]}
              />
            ),
          },
        ]}
        submitText="启动"
        width={820}
      />
    </>
  )
}

export function DockerProjectsPage() {
  return (
    <div className="soha-page soha-docker-page">
      <ProjectsTable />
    </div>
  )
}
