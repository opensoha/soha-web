import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementIconButton } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { ApplicationEnvironment, BuildSource, WorkflowTemplate } from '../types'
import {
  parseReleaseTargets,
  RELEASE_TARGET_KIND_OPTIONS,
  summarizeReleaseTargets,
} from '../release-targets'

type ColumnProps<T> = TableColumnsType<T>[number]

function parseJSONObject(raw: unknown, field: string) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid')
    }
    return parsed
  } catch {
    throw new Error(`${field} 需要是合法 JSON 对象`)
  }
}

function applicationEnvironmentLabel(
  binding: Pick<ApplicationEnvironment, 'environmentKey' | 'environmentId'>,
) {
  return binding.environmentKey || binding.environmentId || '-'
}

function normalizeEnvironmentFormValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim()
  }
  return String(value || '').trim()
}

function initialEnvironmentFormValue(
  binding: Pick<ApplicationEnvironment, 'environmentKey' | 'environmentId'>,
) {
  const label = applicationEnvironmentLabel(binding)
  return label === '-' ? [] : [label]
}
export function ApplicationEnvironmentsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [form] = Form.useForm<Record<string, unknown>>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<ApplicationEnvironment | null>(null)
  const selectedApplicationId = Form.useWatch('applicationId', form) as string | undefined
  const selectedClusterId = Form.useWatch('targetClusterId', form) as string | undefined
  const selectedNamespace = Form.useWatch('targetNamespace', form) as string | undefined
  const selectedTargetKind = Form.useWatch('targetKind', form) as string | undefined
  const selectedExecutorKind = Form.useWatch('executorKind', form) as string | undefined
  const canManageBindings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.application-environments.manage',
  )

  const bindingsQuery = useQuery(deliveryQueries.environments.list())
  const appsQuery = useQuery(deliveryQueries.applications.list())
  const workflowTemplatesQuery = useQuery(deliveryQueries.workflowTemplates.list())
  const targetCandidatesQuery = useQuery(
    deliveryQueries.environments.targetCandidates(
      {
        clusterId: selectedClusterId ?? '',
        namespace: selectedNamespace ?? '',
      },
      Boolean(
        selectedClusterId &&
        selectedNamespace &&
        modalVisible &&
        (selectedTargetKind || 'k8s_workload') === 'k8s_workload' &&
        (selectedExecutorKind || 'k8s_job_runner') === 'k8s_job_runner',
      ),
    ),
  )

  const appNameMap = useMemo(
    () => Object.fromEntries((appsQuery.data ?? []).map((item) => [item.id, item.name])),
    [appsQuery.data],
  )
  const environmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        (bindingsQuery.data ?? [])
          .filter((item) => !selectedApplicationId || item.applicationId === selectedApplicationId)
          .map(applicationEnvironmentLabel)
          .filter((item) => item !== '-'),
      ),
    ).map((item) => ({ value: item, label: item }))
  }, [bindingsQuery.data, selectedApplicationId])

  const createOptions = deliveryMutations.environments.create(queryClient)
  const createMutation = useMutation({
    ...createOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用环境绑定创建成功')
      setModalVisible(false)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const updateOptions = deliveryMutations.environments.update(queryClient)
  const updateMutation = useMutation({
    ...updateOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用环境绑定更新成功')
      setModalVisible(false)
      setEditing(null)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const deleteOptions = deliveryMutations.environments.delete(queryClient)
  const deleteMutation = useMutation({
    ...deleteOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void deleteOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用环境绑定已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const columns: ColumnProps<ApplicationEnvironment>[] = [
    {
      title: '应用',
      dataIndex: 'applicationId',
      render: (value: string) => appNameMap[value] || value,
    },
    {
      title: '环境',
      dataIndex: 'environmentId',
      render: (_: string, record: ApplicationEnvironment) => applicationEnvironmentLabel(record),
    },
    { title: '策略', dataIndex: 'strategyProfileId', render: (value: string) => value || '-' },
    {
      title: '构建来源',
      dataIndex: 'buildPolicy',
      render: (value: ApplicationEnvironment['buildPolicy']) => value?.sourceId || '-',
    },
    {
      title: '动作',
      dataIndex: 'releasePolicy',
      render: (value: ApplicationEnvironment['releasePolicy']) => value?.actionKind || 'deploy',
    },
    {
      title: '发布流程模板',
      dataIndex: 'workflowTemplate',
      render: (_: WorkflowTemplate, record: ApplicationEnvironment) =>
        record.workflowTemplate?.name || record.workflowTemplateId || '-',
    },
    {
      title: '目标数',
      dataIndex: 'targets',
      render: (targets: ApplicationEnvironment['targets']) => (
        <span title={summarizeReleaseTargets(targets)}>
          {targets?.length ?? 0} · {summarizeReleaseTargets(targets)}
        </span>
      ),
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: ApplicationEnvironment) => (
        <Space className="soha-row-action-icons" size={2}>
          {canManageBindings ? (
            <ManagementIconButton
              aria-label="编辑绑定"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => {
                setEditing(record)
                setModalVisible(true)
              }}
            />
          ) : null}
          {canManageBindings ? (
            <Popconfirm
              title="确认删除？"
              onConfirm={() => deleteMutation.mutate(record.id)}
              placement="topRight"
            >
              <ManagementIconButton
                aria-label="删除绑定"
                danger
                icon={<DeleteOutlined />}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
          {!canManageBindings ? '-' : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      <DeliveryTable
        actions={
          canManageBindings ? (
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setEditing(null)
                setModalVisible(true)
              }}
            >
              新建绑定
            </Button>
          ) : null
        }
        refreshing={bindingsQuery.isFetching}
        onRefresh={() => void bindingsQuery.refetch()}
        columns={columns}
        dataSource={bindingsQuery.data ?? []}
        rowKey="id"
        loading={bindingsQuery.isLoading}
      />
      <Modal
        title={editing ? '编辑应用环境绑定' : '新建应用环境绑定'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        footer={null}
        width={760}
        destroyOnHidden
      >
        <Form
          form={form}
          key={editing?.id ?? 'create-application-environment'}
          layout="vertical"
          onFinish={(values) => {
            const selectedTarget = (targetCandidatesQuery.data ?? []).find(
              (item) =>
                `${item.clusterId}/${item.namespace}/${item.workloadName}` ===
                values.targetWorkload,
            )
            let variables: Record<string, unknown>
            let buildArgs: Record<string, unknown>
            let targetMetadata: Record<string, unknown>
            let matrixTargets: ReturnType<typeof parseReleaseTargets>
            try {
              variables = parseJSONObject(values.buildVariablesText, '构建变量')
              buildArgs = parseJSONObject(values.buildArgsText, '构建参数')
              targetMetadata = parseJSONObject(values.targetMetadataText, '目标元数据')
              matrixTargets = parseReleaseTargets(values.targetsText)
            } catch (err) {
              message.error((err as Error).message)
              return
            }
            const resolvedTargetKind = String(values.targetKind || 'k8s_workload')
            const resolvedExecutorKind = String(values.executorKind || 'k8s_job_runner')
            const targetRecord = selectedTarget
              ? {
                  clusterId: selectedTarget.clusterId,
                  namespace: selectedTarget.namespace,
                  workloadKind: selectedTarget.workloadKind,
                  workloadName: selectedTarget.workloadName,
                }
              : {
                  clusterId: String(values.targetClusterId || ''),
                  namespace: String(values.targetNamespace || ''),
                  workloadKind: String(
                    values.targetWorkloadKind ||
                      (resolvedTargetKind === 'host_service' ? 'Service' : 'Deployment'),
                  ),
                  workloadName: String(values.targetWorkload || ''),
                }
            const payload: Record<string, unknown> = {
              applicationId: values.applicationId,
              environmentId: normalizeEnvironmentFormValue(values.environmentId),
              strategyProfileId: values.strategyProfileId || '',
              promotionPolicyId: values.promotionPolicyId || '',
              artifactPolicyId: values.artifactPolicyId || '',
              workflowTemplateId: values.workflowTemplateId,
              buildPolicy: {
                sourceId: values.buildSourceId,
                refType: values.refType || 'branch',
                refValue: values.refValue || '',
                imageTagMode: values.imageTagMode || 'input',
                imageTagTemplate: values.imageTagTemplate || '',
                variables,
                buildArgs,
              },
              releasePolicy: {
                actionKind: values.actionKind || 'deploy',
                requiresApproval: Boolean(values.requiresApproval),
                approverRoles: String(values.approverRoles || '')
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
                autoRollback: Boolean(values.autoRollback),
                rolloutTimeoutSeconds: Number(values.rolloutTimeoutSeconds || 300),
                verificationMode: values.verificationMode || 'workflow',
              },
              targets: matrixTargets.length
                ? matrixTargets
                : targetRecord.workloadName
                ? [
                    {
                      clusterId: targetRecord.clusterId,
                      namespace: targetRecord.namespace,
                      targetKind: resolvedTargetKind,
                      executorKind: resolvedExecutorKind,
                      groupKey: values.groupKey || '',
                      waveKey: values.waveKey || '',
                      regionKey: values.regionKey || '',
                      configRef: values.configRef || '',
                      workloadKind: targetRecord.workloadKind,
                      workloadName: targetRecord.workloadName,
                      containerName: values.targetContainer || '',
                      metadata: targetMetadata,
                      enabled: true,
                    },
                  ]
                : [],
            }
            if (editing) {
              updateMutation.mutate({ id: editing.id, payload })
            } else {
              createMutation.mutate(payload)
            }
          }}
          initialValues={
            editing
              ? {
                  applicationId: editing.applicationId,
                  environmentId: initialEnvironmentFormValue(editing),
                  strategyProfileId: editing.strategyProfileId || '',
                  promotionPolicyId: editing.promotionPolicyId || '',
                  artifactPolicyId: editing.artifactPolicyId || '',
                  workflowTemplateId: editing.workflowTemplateId,
                  buildSourceId: editing.buildPolicy?.sourceId,
                  refType: editing.buildPolicy?.refType || 'branch',
                  refValue: editing.buildPolicy?.refValue || '',
                  imageTagMode: editing.buildPolicy?.imageTagMode || 'input',
                  imageTagTemplate: editing.buildPolicy?.imageTagTemplate || '',
                  buildVariablesText: JSON.stringify(editing.buildPolicy?.variables ?? {}, null, 2),
                  buildArgsText: JSON.stringify(editing.buildPolicy?.buildArgs ?? {}, null, 2),
                  actionKind: editing.releasePolicy?.actionKind || 'deploy',
                  requiresApproval: editing.releasePolicy?.requiresApproval,
                  approverRoles: (editing.releasePolicy?.approverRoles ?? []).join(', '),
                  autoRollback: editing.releasePolicy?.autoRollback,
                  rolloutTimeoutSeconds: editing.releasePolicy?.rolloutTimeoutSeconds || 300,
                  verificationMode: editing.releasePolicy?.verificationMode || 'workflow',
                  targetClusterId: editing.targets?.[0]?.clusterId,
                  targetNamespace: editing.targets?.[0]?.namespace,
                  targetKind: editing.targets?.[0]?.targetKind || 'k8s_workload',
                  executorKind: editing.targets?.[0]?.executorKind || 'k8s_job_runner',
                  groupKey: editing.targets?.[0]?.groupKey || '',
                  waveKey: editing.targets?.[0]?.waveKey || '',
                  regionKey: editing.targets?.[0]?.regionKey || '',
                  configRef: editing.targets?.[0]?.configRef || '',
                  targetWorkload:
                    editing.targets?.[0]?.targetKind === 'k8s_workload' &&
                    editing.targets?.[0]?.executorKind === 'k8s_job_runner'
                      ? `${editing.targets[0].clusterId}/${editing.targets[0].namespace}/${editing.targets[0].workloadName}`
                      : editing.targets?.[0]?.workloadName,
                  targetWorkloadKind: editing.targets?.[0]?.workloadKind || 'Deployment',
                  targetContainer: editing.targets?.[0]?.containerName,
                  targetMetadataText: JSON.stringify(editing.targets?.[0]?.metadata ?? {}, null, 2),
                  targetsText: JSON.stringify(editing.targets ?? [], null, 2),
                }
              : {
                  refType: 'branch',
                  imageTagMode: 'input',
                  buildVariablesText: '{}',
                  buildArgsText: '{}',
                  actionKind: 'deploy',
                  rolloutTimeoutSeconds: 300,
                  verificationMode: 'workflow',
                  targetKind: 'k8s_workload',
                  executorKind: 'k8s_job_runner',
                  targetWorkloadKind: 'Deployment',
                  targetMetadataText: '{}',
                  targetsText: '[]',
                }
          }
        >
          <Form.Item
            name="applicationId"
            label="应用"
            rules={[{ required: true, message: '请选择应用' }]}
          >
            <Select
              options={(appsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item
            name="environmentId"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              showSearch
              mode="tags"
              maxCount={1}
              placeholder="dev / test / prod"
              options={environmentOptions}
            />
          </Form.Item>
          <Form.Item
            name="buildSourceId"
            label="构建来源"
            rules={[{ required: true, message: '请选择构建来源' }]}
          >
            <Select
              options={(
                (appsQuery.data ?? []).find((item) => item.id === selectedApplicationId)
                  ?.buildSources ?? []
              ).map((item: BuildSource) => ({
                value: item.id,
                label: `${item.name} / ${item.type}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="strategyProfileId" label="发布策略 Profile">
            <Input placeholder="rolling-default / canary-prod" />
          </Form.Item>
          <Form.Item name="promotionPolicyId" label="晋级策略 Policy">
            <Input placeholder="promote-prod-only" />
          </Form.Item>
          <Form.Item name="artifactPolicyId" label="制品策略 Policy">
            <Input placeholder="signed-sbom-required" />
          </Form.Item>
          <Form.Item name="refType" label="构建引用类型">
            <Select
              options={[
                { value: 'branch', label: 'branch' },
                { value: 'tag', label: 'tag' },
              ]}
            />
          </Form.Item>
          <Form.Item name="refValue" label="构建引用值">
            <Input placeholder="main / v1.0.0" />
          </Form.Item>
          <Form.Item name="imageTagMode" label="镜像 Tag 模式">
            <Select
              options={[
                { value: 'input', label: 'input' },
                { value: 'template', label: 'template' },
                { value: 'build_output', label: 'build_output' },
              ]}
            />
          </Form.Item>
          <Form.Item name="imageTagTemplate" label="镜像 Tag 模板">
            <Input placeholder="{{branch}}-{{timestamp}}" />
          </Form.Item>
          <Form.Item name="buildVariablesText" label="构建变量(JSON)">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="buildArgsText" label="构建参数(JSON)">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="actionKind" label="交付动作">
            <Select
              options={[
                { value: 'deploy', label: 'deploy' },
                { value: 'release', label: 'release' },
              ]}
            />
          </Form.Item>
          <Form.Item name="requiresApproval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approverRoles" label="审批角色">
            <Input placeholder="release-manager, ops-lead" />
          </Form.Item>
          <Form.Item name="autoRollback" label="失败自动回滚" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="rolloutTimeoutSeconds" label="Rollout 超时秒数">
            <InputNumber min={30} step={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="verificationMode" label="校验模式">
            <Select
              options={[
                { value: 'workflow', label: 'workflow' },
                { value: 'none', label: 'none' },
              ]}
            />
          </Form.Item>
          <Form.Item name="workflowTemplateId" label="发布流程模板">
            <Select
              options={(workflowTemplatesQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="targetClusterId"
            label="目标集群"
            rules={[{ required: true, message: '请输入目标集群 ID' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="targetNamespace"
            label="目标命名空间"
            rules={[{ required: true, message: '请输入目标命名空间' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="targetKind" label="目标类型">
            <Select
              options={[...RELEASE_TARGET_KIND_OPTIONS]}
            />
          </Form.Item>
          <Form.Item name="executorKind" label="执行器">
            <Select
              options={[
                { value: 'k8s_job_runner', label: 'k8s_job_runner' },
                { value: 'ci_agent_runner', label: 'ci_agent_runner' },
                { value: 'external_pipeline_adapter', label: 'external_pipeline_adapter' },
              ]}
            />
          </Form.Item>
          <Form.Item name="groupKey" label="Target Group">
            <Input placeholder="core-services / edge-cn" />
          </Form.Item>
          <Form.Item name="waveKey" label="Wave">
            <Input placeholder="wave-1 / wave-2" />
          </Form.Item>
          <Form.Item name="regionKey" label="Region">
            <Input placeholder="cn-shanghai / ap-southeast" />
          </Form.Item>
          <Form.Item name="configRef" label="配置引用">
            <Input placeholder="helm-values-prod / kustomize/prod" />
          </Form.Item>
          <Form.Item name="targetWorkloadKind" label="资源 Kind">
            <Input placeholder="Deployment / Service / Release" />
          </Form.Item>
          {(selectedTargetKind || 'k8s_workload') === 'k8s_workload' &&
          (selectedExecutorKind || 'k8s_job_runner') === 'k8s_job_runner' ? (
            <Form.Item
              name="targetWorkload"
              label="目标 Deployment"
              rules={[{ required: true, message: '请选择目标 Deployment' }]}
            >
              <Select
                showSearch
                options={(targetCandidatesQuery.data ?? []).map((item) => ({
                  value: `${item.clusterId}/${item.namespace}/${item.workloadName}`,
                  label: `${item.clusterId} / ${item.namespace} / ${item.workloadName}`,
                }))}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="targetWorkload"
              label="目标名称"
              rules={[{ required: true, message: '请输入目标名称' }]}
            >
              <Input placeholder="billing.service / helm-release / overlay-prod" />
            </Form.Item>
          )}
          <Form.Item name="targetContainer" label="目标容器">
            <Select
              allowClear
              options={(() => {
                const selectedTarget = (targetCandidatesQuery.data ?? []).find(
                  (item) =>
                    `${item.clusterId}/${item.namespace}/${item.workloadName}` ===
                    form.getFieldValue('targetWorkload'),
                )
                return (selectedTarget?.containers ?? []).map((item) => ({
                  value: item,
                  label: item,
                }))
              })()}
            />
          </Form.Item>
          <Form.Item name="targetMetadataText" label="目标元数据(JSON)">
            <Input.TextArea
              rows={5}
              placeholder='{"commands":["systemctl restart billing"],"serviceUnit":"billing.service"}'
            />
          </Form.Item>
          <Form.Item
            name="targetsText"
            label="多目标矩阵(JSON Array，非空时覆盖上方单目标)"
            extra="YAML: metadata.manifestPath；Helm: metadata.chartRef/valuesRef；Kustomize: metadata.basePath/overlayPath。可用 groupKey、waveKey、regionKey 编排发布批次。"
          >
            <Input.TextArea
              rows={10}
              spellCheck={false}
              placeholder='[{"clusterId":"prod-cn","namespace":"app","targetKind":"helm_release","executorKind":"k8s_job_runner","groupKey":"core","waveKey":"wave-1","regionKey":"cn","workloadKind":"Release","workloadName":"billing","metadata":{"chartRef":"charts/billing","valuesRef":"values/prod.yaml"},"enabled":true}]'
            />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
