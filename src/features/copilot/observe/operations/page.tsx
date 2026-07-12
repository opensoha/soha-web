import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { getAIWorkbenchPathForMode, getAIWorkbenchPathForSession } from '../../workbench/navigation'
import { observeKeys } from '../keys'
import { observeMutations, policyFormValuesFromRecord } from '../mutations'
import { observeQueries } from '../queries'
import type {
  AnalysisProfile,
  AutomationPolicy,
  AutomationPolicyFormValues,
  InspectionTask,
  InspectionTaskFormValues,
} from '../types'
import '../../copilot-pages.css'

const { Paragraph, Text } = Typography

const INSPECTION_CHECK_OPTIONS = [
  { value: 'cluster_health', label: 'Cluster Health' },
  { value: 'alert_pressure', label: 'Alert Pressure' },
  { value: 'audit_denials', label: 'Audit Denials' },
  { value: 'resource_pressure', label: 'Resource Pressure' },
  { value: 'delivery_risk', label: 'Delivery Risk' },
]

const AUTOMATION_ANALYSIS_KIND_OPTIONS = [
  { value: 'root_cause', label: 'Root Cause' },
  { value: 'performance', label: 'Performance' },
  { value: 'trace', label: 'Trace' },
  { value: 'inspection_review', label: 'Inspection Review' },
]

const AUTOMATION_TRIGGER_TYPE_OPTIONS = [{ value: 'alert_webhook', label: 'Alert Webhook' }]

const AUTOMATION_REMEDIATION_POLICY_OPTIONS = [
  { value: 'suggest_only', label: 'Suggest Only' },
  { value: 'require_approval', label: 'Require Approval' },
  { value: 'disabled', label: 'Disabled' },
]

const AUTOMATION_SEVERITY_OPTIONS = [
  { value: 'critical', label: 'critical' },
  { value: 'warning', label: 'warning' },
  { value: 'info', label: 'info' },
]

const AUTOMATION_STATUS_OPTIONS = [
  { value: 'firing', label: 'firing' },
  { value: 'resolved', label: 'resolved' },
]

function defaultInspectionTaskValues(): InspectionTaskFormValues {
  return {
    title: '',
    scopeType: 'platform',
    clusterId: '',
    namespace: '',
    checks: ['cluster_health', 'alert_pressure', 'audit_denials'],
    enabled: true,
    intervalMinutes: 30,
    analysisProfileId: '',
  }
}

function defaultAutomationPolicyValues(): AutomationPolicyFormValues {
  return {
    name: '',
    triggerType: 'alert_webhook',
    analysisKinds: ['root_cause'],
    agentProviderId: 'internal',
    analysisProfileId: 'default',
    remediationPolicy: 'suggest_only',
    dedupWindowSeconds: 900,
    cooldownSeconds: 900,
    enabled: true,
    triggerSeverity: [],
    triggerStatus: ['firing'],
    triggerMinDurationSeconds: 120,
    triggerLabelKey: '',
    triggerLabelValue: '',
    triggerTimeRangeMinutes: 60,
    approvalRequired: false,
    approvalRoles: [],
  }
}

export function AIOperationsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [taskForm] = Form.useForm<InspectionTaskFormValues>()
  const [policyForm] = Form.useForm<AutomationPolicyFormValues>()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewAI = hasPermission(permissionSnapshotQuery.data?.data, 'observe.ai.view')
  const canUseChat = hasPermission(permissionSnapshotQuery.data?.data, 'observe.ai.chat')
  const canRunInspection = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.ai.inspection.run',
  )
  const canManageInspection = hasPermission(
    permissionSnapshotQuery.data?.data,
    'observe.ai.inspection.manage',
  )
  const canCreateSessionFromRun = canViewAI && canUseChat
  const canManageAISettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.ai.manage',
  )
  const requestedView = searchParams.get('view')
  const requestedInspectionRunId = searchParams.get('inspectionRunId')?.trim() ?? ''
  const [activeView, setActiveView] = useState<'tasks' | 'runs' | 'policies'>(
    requestedView === 'runs' ? 'runs' : requestedView === 'policies' ? 'policies' : 'tasks',
  )
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<InspectionTask | null>(null)
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<AutomationPolicy | null>(null)
  const tasksQuery = useQuery(observeQueries.operations.tasks())
  const runsQuery = useQuery(observeQueries.operations.runs())
  const policiesQuery = useQuery(observeQueries.operations.policies(canManageAISettings))
  const catalogQuery = useQuery(observeQueries.operations.catalog())
  const createSessionMutation = useMutation({
    ...observeMutations.operations.createSession(),
    onSuccess: (response) => {
      void message.success('已从巡检运行创建 AI 会话')
      void queryClient.invalidateQueries({ queryKey: observeKeys.overview.sessions() })
      navigate(getAIWorkbenchPathForSession(response))
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const createTaskMutation = useMutation({
    ...observeMutations.operations.createTask(),
    onSuccess: async () => {
      void message.success('巡检任务已创建')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.tasks() })
      setTaskModalOpen(false)
      setEditingTask(null)
      taskForm.resetFields()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const updateTaskMutation = useMutation({
    ...observeMutations.operations.updateTask(),
    onSuccess: async () => {
      void message.success('巡检任务已更新')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.tasks() })
      setTaskModalOpen(false)
      setEditingTask(null)
      taskForm.resetFields()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const deleteTaskMutation = useMutation({
    ...observeMutations.operations.deleteTask(),
    onSuccess: async () => {
      void message.success('巡检任务已删除')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.tasks() })
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.runs() })
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const createPolicyMutation = useMutation({
    ...observeMutations.operations.createPolicy(),
    onSuccess: async () => {
      void message.success('自动化策略已创建')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.policies() })
      setPolicyModalOpen(false)
      setEditingPolicy(null)
      policyForm.resetFields()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const updatePolicyMutation = useMutation({
    ...observeMutations.operations.updatePolicy(),
    onSuccess: async () => {
      void message.success('自动化策略已更新')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.policies() })
      setPolicyModalOpen(false)
      setEditingPolicy(null)
      policyForm.resetFields()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const deletePolicyMutation = useMutation({
    ...observeMutations.operations.deletePolicy(),
    onSuccess: async () => {
      void message.success('自动化策略已删除')
      await queryClient.invalidateQueries({ queryKey: observeKeys.operations.policies() })
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const executeMutation = useMutation({
    ...observeMutations.operations.executeTask(),
    onSuccess: () => {
      void message.success('巡检已执行')
      void queryClient.invalidateQueries({ queryKey: observeKeys.operations.runs() })
      void queryClient.invalidateQueries({ queryKey: observeKeys.operations.tasks() })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const tasks = tasksQuery.data ?? []
  const runs = runsQuery.data ?? []
  const policies = policiesQuery.data ?? []
  const profiles: AnalysisProfile[] = catalogQuery.data?.analysisProfiles ?? []
  const agentProviders = catalogQuery.data?.agentProviders ?? []
  const profileOptions = profiles
    .filter((item) => item.enabled)
    .map((item) => ({ value: item.id, label: `${item.name} (${item.mode})` }))
  const agentProviderOptions = agentProviders
    .filter((item) => item.enabled)
    .map((item) => ({
      value: item.id,
      label: `${item.name}${item.supportsAsync ? ' / async' : ' / inline'}`,
    }))
  const watchedScopeType = Form.useWatch('scopeType', taskForm)
  const taskSaving = createTaskMutation.isPending || updateTaskMutation.isPending
  const policySaving = createPolicyMutation.isPending || updatePolicyMutation.isPending

  useEffect(() => {
    if (requestedView === 'runs' || requestedInspectionRunId) {
      setActiveView('runs')
      return
    }
    if (requestedView === 'policies') {
      setActiveView('policies')
    }
  }, [requestedInspectionRunId, requestedView])

  const openCreateTask = () => {
    setEditingTask(null)
    taskForm.setFieldsValue(defaultInspectionTaskValues())
    setTaskModalOpen(true)
  }
  const openEditTask = (task: InspectionTask) => {
    setEditingTask(task)
    taskForm.setFieldsValue({
      title: task.title,
      scopeType: task.scopeType || 'platform',
      clusterId: task.clusterId || '',
      namespace: task.namespace || '',
      checks: task.checks ?? [],
      enabled: task.enabled,
      intervalMinutes: task.intervalMinutes || 30,
      analysisProfileId: String(task.metadata?.analysisProfileId ?? ''),
    })
    setTaskModalOpen(true)
  }
  const closeTaskModal = () => {
    setTaskModalOpen(false)
    setEditingTask(null)
    taskForm.resetFields()
  }
  const submitTaskForm = async () => {
    const values = await taskForm.validateFields()
    if (editingTask) {
      updateTaskMutation.mutate({ taskId: editingTask.id, values })
    } else {
      createTaskMutation.mutate(values)
    }
  }
  const openCreatePolicy = () => {
    if (!canManageAISettings) return
    setEditingPolicy(null)
    policyForm.setFieldsValue(defaultAutomationPolicyValues())
    setPolicyModalOpen(true)
  }
  const openEditPolicy = (policy: AutomationPolicy) => {
    if (!canManageAISettings) return
    setEditingPolicy(policy)
    policyForm.setFieldsValue(policyFormValuesFromRecord(policy))
    setPolicyModalOpen(true)
  }
  const closePolicyModal = () => {
    setPolicyModalOpen(false)
    setEditingPolicy(null)
    policyForm.resetFields()
  }
  const submitPolicyForm = async () => {
    const values = await policyForm.validateFields()
    if (editingPolicy) {
      updatePolicyMutation.mutate({ policyId: editingPolicy.id, values })
    } else {
      createPolicyMutation.mutate(values)
    }
  }

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="巡检与自动化"
        description="统一查看巡检任务、巡检运行、自动化策略，并把发现结果送入 AI 会话。"
        actions={
          <ManagementTableToolbar>
            <Button
              onClick={() => navigate(getAIWorkbenchPathForMode('inspection_review'))}
              disabled={!canUseChat}
            >
              进入巡检复盘工作台
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={openCreateTask}
              disabled={!canManageInspection}
              title={canManageInspection ? undefined : '缺少 observe.ai.inspection.manage 权限'}
            >
              新建巡检任务
            </Button>
            <Button
              type="primary"
              onClick={() => navigate(getAIWorkbenchPathForMode('general'))}
              disabled={!canUseChat}
            >
              新建会话
            </Button>
          </ManagementTableToolbar>
        }
      />
      <Card styles={{ body: { paddingBottom: 8 } }}>
        <Segmented
          value={activeView}
          onChange={(value) => setActiveView(value as typeof activeView)}
          options={[
            { value: 'tasks', label: '巡检任务' },
            { value: 'runs', label: '巡检运行' },
            { value: 'policies', label: '自动化策略' },
          ]}
        />
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          把巡检任务、巡检运行与自动化策略放在同一工作区，避免在调查和自动化之间来回跳转。
        </Paragraph>
      </Card>

      {activeView === 'tasks' ? (
        <Card
          size="small"
          variant="outlined"
          className="soha-management-panel-card"
          title="巡检任务"
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={openCreateTask}
              disabled={!canManageInspection}
            >
              新建任务
            </Button>
          }
        >
          <AdminTable
            shellClassName="soha-management-table-shell"
            columnSettingIconOnly
            columnSettingPlacement="header"
            rowKey="id"
            dataSource={tasks}
            loading={tasksQuery.isLoading}
            tableSize="small"
            pageSize={10}
            columns={[
              { title: '任务名称', dataIndex: 'title' },
              {
                title: '范围',
                dataIndex: 'scopeType',
                render: (_value: string, record: InspectionTask) =>
                  [record.scopeType, record.clusterId, record.namespace]
                    .filter(Boolean)
                    .join(' / '),
              },
              {
                title: '检查项',
                dataIndex: 'checks',
                render: (value: string[]) => (
                  <Space wrap>
                    {(value ?? []).map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: '间隔',
                dataIndex: 'intervalMinutes',
                render: (value: number) => `${value} min`,
              },
              {
                title: '启用',
                dataIndex: 'enabled',
                render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
              },
              {
                ...tableColumnPresets.action,
                title: '操作',
                dataIndex: 'id',
                render: (_value: string, record: InspectionTask) => (
                  <Space className="soha-row-action-icons">
                    <ManagementIconButton
                      aria-label="编辑巡检任务"
                      size="small"
                      tooltip="编辑"
                      icon={<EditOutlined />}
                      onClick={() => openEditTask(record)}
                      disabled={!canManageInspection}
                      title={
                        canManageInspection ? undefined : '缺少 observe.ai.inspection.manage 权限'
                      }
                    />
                    <ManagementIconButton
                      aria-label="立即执行巡检"
                      size="small"
                      tooltip="立即执行"
                      icon={<PlayCircleOutlined />}
                      loading={executeMutation.isPending}
                      onClick={() => executeMutation.mutate(record.id)}
                      disabled={!canRunInspection}
                      title={canRunInspection ? undefined : '缺少 observe.ai.inspection.run 权限'}
                    />
                    <Popconfirm
                      title="确认删除巡检任务？"
                      description="关联巡检运行记录会一并删除。"
                      onConfirm={() => deleteTaskMutation.mutate(record.id)}
                      okButtonProps={{ danger: true, loading: deleteTaskMutation.isPending }}
                    >
                      <ManagementIconButton
                        aria-label="删除巡检任务"
                        size="small"
                        tooltip="删除"
                        icon={<DeleteOutlined />}
                        danger
                        disabled={!canManageInspection}
                        title={
                          canManageInspection ? undefined : '缺少 observe.ai.inspection.manage 权限'
                        }
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      <Modal
        title={editingTask ? '编辑巡检任务' : '新建巡检任务'}
        open={taskModalOpen}
        onCancel={closeTaskModal}
        onOk={submitTaskForm}
        okText={editingTask ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={taskSaving}
        okButtonProps={{ disabled: !canManageInspection }}
        width={640}
      >
        <Form form={taskForm} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：支付命名空间巡检" />
          </Form.Item>
          <Form.Item
            name="scopeType"
            label="巡检范围"
            rules={[{ required: true, message: '请选择巡检范围' }]}
          >
            <Select
              options={[
                { value: 'platform', label: '平台级' },
                { value: 'cluster', label: '集群级' },
                { value: 'namespace', label: '命名空间级' },
              ]}
            />
          </Form.Item>
          {watchedScopeType === 'cluster' || watchedScopeType === 'namespace' ? (
            <Form.Item
              name="clusterId"
              label="集群 ID"
              rules={[{ required: true, message: '请输入集群 ID' }]}
            >
              <Input placeholder="local-k3s" />
            </Form.Item>
          ) : null}
          {watchedScopeType === 'namespace' ? (
            <Form.Item
              name="namespace"
              label="命名空间"
              rules={[{ required: true, message: '请输入命名空间' }]}
            >
              <Input placeholder="default" />
            </Form.Item>
          ) : null}
          <Form.Item
            name="checks"
            label="检查项"
            rules={[{ required: true, message: '请选择检查项' }]}
          >
            <Select mode="multiple" options={INSPECTION_CHECK_OPTIONS} />
          </Form.Item>
          <Form.Item name="analysisProfileId" label="巡检模板">
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              allowClear
              loading={catalogQuery.isLoading}
              placeholder="可选：按分析模板覆盖巡检 playbooks"
              options={profiles
                .filter((item) => item.mode === 'inspection' && item.enabled)
                .map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
            />
          </Form.Item>
          <Form.Item
            name="intervalMinutes"
            label="执行间隔(分钟)"
            rules={[{ required: true, message: '请输入执行间隔' }]}
          >
            <InputNumber min={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {activeView === 'runs' ? (
        <Card
          size="small"
          variant="outlined"
          className="soha-management-panel-card"
          title="巡检运行记录"
        >
          {requestedInspectionRunId ? (
            <Alert
              type={runs.some((item) => item.id === requestedInspectionRunId) ? 'info' : 'warning'}
              showIcon
              title={
                runs.some((item) => item.id === requestedInspectionRunId)
                  ? `已定位巡检运行 ${requestedInspectionRunId}`
                  : '未找到关联巡检运行'
              }
              description={
                runs.some((item) => item.id === requestedInspectionRunId)
                  ? '该运行来自分析工件关联入口。'
                  : `inspectionRunId=${requestedInspectionRunId}`
              }
              style={{ marginBottom: 12 }}
            />
          ) : null}
          <AdminTable
            shellClassName="soha-management-table-shell"
            columnSettingIconOnly
            columnSettingPlacement="header"
            rowKey="id"
            dataSource={runs}
            loading={runsQuery.isLoading}
            tableSize="small"
            pageSize={10}
            columns={[
              {
                title: '运行 ID',
                dataIndex: 'id',
                render: (value: string) => (
                  <Space size={6} wrap>
                    <Text>{value}</Text>
                    {value === requestedInspectionRunId ? <Tag color="blue">已定位</Tag> : null}
                  </Space>
                ),
              },
              { title: '任务', dataIndex: 'taskId' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: '严重度',
                dataIndex: 'severity',
                render: (value: string) => <StatusTag value={value} />,
              },
              {
                title: '发现项',
                dataIndex: 'findings',
                render: (value: Array<{ id: string }>) => value?.length ?? 0,
              },
              { title: '摘要', dataIndex: 'summary' },
              {
                ...tableColumnPresets.action,
                title: '联动',
                dataIndex: 'id',
                render: (value: string) => (
                  <ManagementIconButton
                    aria-label="创建 AI 会话"
                    size="small"
                    tooltip="创建 AI 会话"
                    icon={<RobotOutlined />}
                    onClick={() => createSessionMutation.mutate(value)}
                    disabled={!canCreateSessionFromRun}
                    title={
                      canCreateSessionFromRun
                        ? undefined
                        : !canUseChat
                          ? '缺少 observe.ai.chat 权限'
                          : '缺少 observe.ai.view 权限'
                    }
                  />
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      {activeView === 'policies' ? (
        <Card
          size="small"
          variant="outlined"
          className="soha-management-panel-card"
          title="自动化策略"
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={openCreatePolicy}
              disabled={!canManageAISettings}
              title={canManageAISettings ? undefined : '缺少 settings.ai.manage 权限'}
            >
              新建策略
            </Button>
          }
        >
          <Paragraph type="secondary">
            自动化策略只负责触发和分析范围，不应隐式替代会话级 toolset
            选择。需要深入分析时，优先把结果送回 AI 工作台。
          </Paragraph>
          {!canManageAISettings ? (
            <Alert
              type="warning"
              showIcon
              title="缺少 settings.ai.manage 权限"
              description="自动化策略包含全局 AI 执行配置，当前账号不能查看或编辑。巡检任务和运行记录仍可继续使用。"
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <AdminTable
            shellClassName="soha-management-table-shell"
            columnSettingIconOnly
            columnSettingPlacement="header"
            rowKey="id"
            dataSource={policies}
            loading={policiesQuery.isLoading}
            tableSize="small"
            pageSize={10}
            columns={[
              { title: '名称', dataIndex: 'name' },
              { title: '触发类型', dataIndex: 'triggerType' },
              {
                title: '分析类型',
                dataIndex: 'analysisKinds',
                render: (value: string[]) => (
                  <Space wrap>
                    {(value ?? []).map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: 'Agent',
                dataIndex: 'agentProviderId',
                render: (value: string) =>
                  agentProviders.find((item) => item.id === (value || 'internal'))?.name ||
                  value ||
                  'internal',
              },
              {
                title: '分析模板',
                dataIndex: 'analysisProfileId',
                render: (value: string) =>
                  profiles.find((item) => item.id === value)?.name || value,
              },
              { title: '修复策略', dataIndex: 'remediationPolicy' },
              {
                title: '启用',
                dataIndex: 'enabled',
                render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
              },
              {
                ...tableColumnPresets.action,
                title: '操作',
                dataIndex: 'id',
                render: (_value: string, record: AutomationPolicy) => (
                  <Space className="soha-row-action-icons">
                    <ManagementIconButton
                      aria-label="编辑自动化策略"
                      size="small"
                      tooltip="编辑"
                      icon={<EditOutlined />}
                      onClick={() => openEditPolicy(record)}
                      disabled={!canManageAISettings}
                      title={canManageAISettings ? undefined : '缺少 settings.ai.manage 权限'}
                    />
                    <Popconfirm
                      title="确认删除自动化策略？"
                      description="删除后不会再由该策略触发新的 AI 分析。"
                      onConfirm={() => deletePolicyMutation.mutate(record.id)}
                      okButtonProps={{ danger: true, loading: deletePolicyMutation.isPending }}
                    >
                      <ManagementIconButton
                        aria-label="删除自动化策略"
                        size="small"
                        tooltip="删除"
                        icon={<DeleteOutlined />}
                        danger
                        disabled={!canManageAISettings}
                        title={canManageAISettings ? undefined : '缺少 settings.ai.manage 权限'}
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      <Modal
        title={editingPolicy ? '编辑自动化策略' : '新建自动化策略'}
        open={policyModalOpen}
        onCancel={closePolicyModal}
        onOk={submitPolicyForm}
        okText={editingPolicy ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={policySaving}
        okButtonProps={{ disabled: !canManageAISettings }}
        width={680}
      >
        <Form form={policyForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：P1 告警根因分析" />
          </Form.Item>
          <Form.Item
            name="triggerType"
            label="触发类型"
            rules={[{ required: true, message: '请选择触发类型' }]}
          >
            <Select options={AUTOMATION_TRIGGER_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="analysisKinds"
            label="分析类型"
            rules={[{ required: true, message: '请选择分析类型' }]}
          >
            <Select mode="multiple" options={AUTOMATION_ANALYSIS_KIND_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="agentProviderId"
            label="Agent Provider"
            rules={[{ required: true, message: '请选择 Agent Provider' }]}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              loading={catalogQuery.isLoading}
              options={
                agentProviderOptions.length > 0
                  ? agentProviderOptions
                  : [{ value: 'internal', label: 'soha 内置分析 / inline' }]
              }
            />
          </Form.Item>
          <Form.Item
            name="analysisProfileId"
            label="分析模板"
            rules={[{ required: true, message: '请选择分析模板' }]}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              allowClear
              loading={catalogQuery.isLoading}
              placeholder="选择后端分析模板"
              options={profileOptions}
            />
          </Form.Item>
          <Form.Item name="remediationPolicy" label="修复策略">
            <Select options={AUTOMATION_REMEDIATION_POLICY_OPTIONS} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="dedupWindowSeconds" label="去重窗口(秒)" style={{ flex: 1 }}>
              <InputNumber min={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cooldownSeconds" label="冷却时间(秒)" style={{ flex: 1 }}>
              <InputNumber min={60} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
          <Form.Item name="triggerSeverity" label="告警级别">
            <Select mode="multiple" allowClear options={AUTOMATION_SEVERITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="triggerStatus" label="告警状态">
            <Select mode="multiple" allowClear options={AUTOMATION_STATUS_OPTIONS} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="triggerMinDurationSeconds" label="最小持续(秒)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="triggerTimeRangeMinutes"
              label="分析时间范围(分钟)"
              style={{ flex: 1 }}
            >
              <InputNumber min={5} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
          <Flex gap={12}>
            <Form.Item name="triggerLabelKey" label="标签 Key" style={{ flex: 1 }}>
              <Input placeholder="service" />
            </Form.Item>
            <Form.Item name="triggerLabelValue" label="标签 Value" style={{ flex: 1 }}>
              <Input placeholder="payment-api" />
            </Form.Item>
          </Flex>
          <Form.Item name="approvalRequired" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approvalRoles" label="审批角色">
            <Select mode="tags" tokenSeparators={[',']} placeholder="ops / sre / owner" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
