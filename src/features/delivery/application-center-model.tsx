import { useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Switch } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { deliveryMutations } from './mutations'
import { deliveryQueries } from './queries'
import { parseReleaseTargets } from './release-targets'
import type { ApplicationEnvironment, BuildSource, DeliveryApplication } from './types'

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

export function summarizeBuildSource(source?: BuildSource) {
  if (!source) return '-'
  switch (source.type) {
    case 'repo_dockerfile':
      return 'Repo Dockerfile'
    case 'platform_build_template':
      return 'Platform Template'
    case 'external_pipeline':
      return 'External Pipeline'
    default:
      return source.type
  }
}

export function defaultBuildSources() {
  return [
    {
      id: '',
      name: 'Repository Dockerfile',
      type: 'repo_dockerfile' as const,
      enabled: true,
      isDefault: true,
      buildImage: '',
      defaultTag: '',
      config: { contextDir: '.', dockerfilePath: 'Dockerfile', builderKind: 'docker' },
    },
  ] satisfies BuildSource[]
}

export function splitApplicationGroups(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '')
  return Array.from(
    new Set(
      raw
        .split(/[,，;；/]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export function joinApplicationGroups(value?: string | string[] | null) {
  return splitApplicationGroups(value ?? []).join(', ')
}

export function buildApplicationGroupOptions(apps: DeliveryApplication[] = []) {
  return Array.from(new Set(apps.flatMap((app) => splitApplicationGroups(app.group))))
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

export function useApplicationCenterState() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const [appForm] = Form.useForm<Record<string, unknown>>()
  const [bindingForm] = Form.useForm<Record<string, unknown>>()
  const [appModalVisible, setAppModalVisible] = useState(false)
  const [bindingModalVisible, setBindingModalVisible] = useState(false)
  const [editingApp, setEditingApp] = useState<DeliveryApplication | null>(null)
  const [editingBinding, setEditingBinding] = useState<ApplicationEnvironment | null>(null)
  const [buildSources, setBuildSources] = useState<BuildSource[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('')

  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const bindingsQuery = useQuery(deliveryQueries.environments.list())
  const workflowTemplatesQuery = useQuery(deliveryQueries.workflowTemplates.list())
  const clustersQuery = useQuery(deliveryQueries.dependencies.clusters())

  useEffect(() => {
    const appList = applicationsQuery.data ?? []
    if (applicationId && appList.some((item) => item.id === applicationId)) {
      if (selectedApplicationId !== applicationId) {
        setSelectedApplicationId(applicationId)
      }
      return
    }
    if (!selectedApplicationId && appList.length > 0) {
      setSelectedApplicationId(appList[0].id)
    }
  }, [applicationId, applicationsQuery.data, selectedApplicationId])

  const selectedApplication = useMemo(
    () => (applicationsQuery.data ?? []).find((item) => item.id === selectedApplicationId) ?? null,
    [applicationsQuery.data, selectedApplicationId],
  )
  const filteredBindings = useMemo(
    () =>
      (bindingsQuery.data ?? []).filter(
        (item) => !selectedApplicationId || item.applicationId === selectedApplicationId,
      ),
    [bindingsQuery.data, selectedApplicationId],
  )
  const workflowTemplateMap = useMemo(
    () => Object.fromEntries((workflowTemplatesQuery.data ?? []).map((item) => [item.id, item])),
    [workflowTemplatesQuery.data],
  )
  const applicationGroupOptions = useMemo(
    () => buildApplicationGroupOptions(applicationsQuery.data ?? []),
    [applicationsQuery.data],
  )
  const applicationEnvironmentOptions = useMemo(() => {
    return Array.from(
      new Set(filteredBindings.map(applicationEnvironmentLabel).filter((item) => item !== '-')),
    ).map((item) => ({ value: item, label: item }))
  }, [filteredBindings])

  const selectedClusterId = Form.useWatch('targetClusterId', bindingForm) as string | undefined
  const selectedNamespace = Form.useWatch('targetNamespace', bindingForm) as string | undefined

  const targetCandidatesQuery = useQuery(
    deliveryQueries.environments.targetCandidates(
      {
        clusterId: selectedClusterId ?? '',
        namespace: selectedNamespace ?? '',
      },
      Boolean(selectedClusterId && selectedNamespace && bindingModalVisible),
    ),
  )

  const canCreateApplication = hasPermission(permissionSnapshot, 'delivery.application.create')
  const canUpdateApplication = hasPermission(permissionSnapshot, 'delivery.application.update')
  const canDeleteApplication = hasPermission(permissionSnapshot, 'delivery.application.delete')
  const canManageBindings = hasPermission(
    permissionSnapshot,
    'delivery.application-environments.manage',
  )

  const createAppOptions = deliveryMutations.applications.create(queryClient)
  const createAppMutation = useMutation({
    ...createAppOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createAppOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用创建成功')
      setSelectedApplicationId(result.id || '')
      setAppModalVisible(false)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const updateAppOptions = deliveryMutations.applications.update(queryClient)
  const updateAppMutation = useMutation({
    ...updateAppOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateAppOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用更新成功')
      setAppModalVisible(false)
      setEditingApp(null)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const deleteAppOptions = deliveryMutations.applications.delete(queryClient)
  const deleteAppMutation = useMutation({
    ...deleteAppOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void deleteAppOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('应用已删除')
      setSelectedApplicationId('')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const createBindingOptions = deliveryMutations.environments.create(queryClient)
  const createBindingMutation = useMutation({
    ...createBindingOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createBindingOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('环境绑定创建成功')
      setBindingModalVisible(false)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const updateBindingOptions = deliveryMutations.environments.update(queryClient)
  const updateBindingMutation = useMutation({
    ...updateBindingOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateBindingOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('环境绑定更新成功')
      setBindingModalVisible(false)
      setEditingBinding(null)
    },
    onError: (err: Error) => message.error(err.message),
  })

  const deleteBindingOptions = deliveryMutations.environments.delete(queryClient)
  const deleteBindingMutation = useMutation({
    ...deleteBindingOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void deleteBindingOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('环境绑定已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  return {
    navigate,
    appForm,
    bindingForm,
    appModalVisible,
    setAppModalVisible,
    bindingModalVisible,
    setBindingModalVisible,
    editingApp,
    setEditingApp,
    editingBinding,
    setEditingBinding,
    buildSources,
    setBuildSources,
    applicationsQuery,
    bindingsQuery,
    workflowTemplatesQuery,
    clustersQuery,
    targetCandidatesQuery,
    selectedApplicationId,
    setSelectedApplicationId,
    selectedApplication,
    filteredBindings,
    workflowTemplateMap,
    applicationGroupOptions,
    applicationEnvironmentOptions,
    canCreateApplication,
    canUpdateApplication,
    canDeleteApplication,
    canManageBindings,
    createAppMutation,
    updateAppMutation,
    deleteAppMutation,
    createBindingMutation,
    updateBindingMutation,
    deleteBindingMutation,
  }
}

export type ApplicationCenterState = ReturnType<typeof useApplicationCenterState>

export function ApplicationCenterModals({ state }: { state: ApplicationCenterState }) {
  const selectedTargetCandidate = (record: Record<string, unknown>) =>
    (state.targetCandidatesQuery.data ?? []).find(
      (item) =>
        `${item.clusterId}/${item.namespace}/${item.workloadName}` === record.targetWorkload,
    )

  return (
    <>
      <Modal
        title={state.editingApp ? '编辑应用档案' : '新建应用档案'}
        open={state.appModalVisible}
        onCancel={() => {
          state.setAppModalVisible(false)
          state.setEditingApp(null)
        }}
        footer={null}
        destroyOnHidden
        width={860}
      >
        <Form
          form={state.appForm}
          key={state.editingApp?.id ?? 'application-center-app'}
          layout="vertical"
          initialValues={
            state.editingApp
              ? {
                  ...state.editingApp,
                  group: splitApplicationGroups(state.editingApp.group),
                  enabled: state.editingApp.enabled,
                }
              : { enabled: true, language: 'go', group: [] }
          }
          onFinish={(values) => {
            const payload = {
              ...values,
              group: joinApplicationGroups(values.group as string[] | string),
              buildSources: state.buildSources,
            }
            if (state.editingApp) {
              state.updateAppMutation.mutate({ id: state.editingApp.id, payload })
            } else {
              state.createAppMutation.mutate(payload)
            }
          }}
        >
          <Form.Item
            name="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="key"
            label="应用 Key"
            rules={[{ required: true, message: '请输入应用 Key' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="group"
            label="应用分组"
            rules={[{ required: true, message: '请输入应用分组' }]}
          >
            <Select
              mode="tags"
              tokenSeparators={[',', '，', ';', '；', '/']}
              placeholder="输入一个或多个分组"
              maxTagCount="responsive"
              options={state.applicationGroupOptions.map((group) => ({
                value: group,
                label: group,
              }))}
            />
          </Form.Item>
          <Form.Item name="language" label="语言">
            <Select
              options={[
                { value: 'go', label: 'Go' },
                { value: 'java', label: 'Java' },
                { value: 'node', label: 'Node.js' },
                { value: 'python', label: 'Python' },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => state.setAppModalVisible(false)}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={state.createAppMutation.isPending || state.updateAppMutation.isPending}
            >
              保存
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={state.editingBinding ? '编辑环境绑定' : '新建环境绑定'}
        open={state.bindingModalVisible}
        onCancel={() => {
          state.setBindingModalVisible(false)
          state.setEditingBinding(null)
        }}
        footer={null}
        destroyOnHidden
        width={760}
      >
        <Form
          form={state.bindingForm}
          key={state.editingBinding?.id ?? `binding-${state.selectedApplicationId || 'new'}`}
          layout="vertical"
          initialValues={
            state.editingBinding
              ? {
                  environmentId: initialEnvironmentFormValue(state.editingBinding),
                  workflowTemplateId: state.editingBinding.workflowTemplateId,
                  buildSourceId: state.editingBinding.buildPolicy?.sourceId,
                  refType: state.editingBinding.buildPolicy?.refType || 'branch',
                  refValue: state.editingBinding.buildPolicy?.refValue,
                  imageTagTemplate: state.editingBinding.buildPolicy?.imageTagTemplate,
                  buildVariablesText: JSON.stringify(state.editingBinding.buildPolicy?.variables ?? {}, null, 2),
                  buildArgsText: JSON.stringify(state.editingBinding.buildPolicy?.buildArgs ?? {}, null, 2),
                  targetsText: JSON.stringify(state.editingBinding.targets ?? [], null, 2),
                  actionKind: state.editingBinding.releasePolicy?.actionKind || 'deploy',
                  requiresApproval: state.editingBinding.releasePolicy?.requiresApproval,
                  targetClusterId: state.editingBinding.targets?.[0]?.clusterId,
                  targetNamespace: state.editingBinding.targets?.[0]?.namespace,
                  targetWorkload: state.editingBinding.targets?.[0]
                    ? `${state.editingBinding.targets[0].clusterId}/${state.editingBinding.targets[0].namespace}/${state.editingBinding.targets[0].workloadName}`
                    : undefined,
                  targetContainer: state.editingBinding.targets?.[0]?.containerName,
                  resourceSelectorText: JSON.stringify(
                    state.editingBinding.resourceSelector?.matchLabels ?? {},
                    null,
                    2,
                  ),
                }
              : {
                  actionKind: 'deploy',
                  requiresApproval: false,
                  refType: 'branch',
                  buildVariablesText: '{}',
                  buildArgsText: '{}',
                  targetsText: '[]',
                  resourceSelectorText: '{}',
                }
          }
          onFinish={(values) => {
            if (!state.selectedApplication) return
            const target = selectedTargetCandidate(values)
            const matchLabels = parseJSONObject(values.resourceSelectorText, '选择器标签')
            const configuredTargets = parseReleaseTargets(values.targetsText)
            const payload: Record<string, unknown> = {
              applicationId: state.selectedApplication.id,
              environmentId: normalizeEnvironmentFormValue(values.environmentId),
              workflowTemplateId: values.workflowTemplateId,
              buildPolicy: {
                sourceId: values.buildSourceId,
                refType: values.refType || 'branch',
                refValue: values.refValue || '',
                imageTagMode: 'input',
                imageTagTemplate: values.imageTagTemplate || '',
                variables: parseJSONObject(values.buildVariablesText, '构建变量'),
                buildArgs: parseJSONObject(values.buildArgsText, '构建参数'),
              },
              releasePolicy: {
                actionKind: values.actionKind || 'deploy',
                requiresApproval: Boolean(values.requiresApproval),
                approverRoles: [],
                autoRollback: false,
                rolloutTimeoutSeconds: 300,
                verificationMode: 'workflow',
              },
              resourceSelector: {
                matchLabels,
              },
              targets: configuredTargets.length ? configuredTargets : target
                ? [
                    {
                      clusterId: target.clusterId,
                      namespace: target.namespace,
                      targetKind: 'k8s_workload',
                      executorKind: 'k8s_job_runner',
                      workloadKind: target.workloadKind,
                      workloadName: target.workloadName,
                      containerName: String(values.targetContainer || ''),
                      metadata: {},
                      enabled: true,
                    },
                  ]
                : [],
            }
            if (state.editingBinding) {
              state.updateBindingMutation.mutate({ id: state.editingBinding.id, payload })
            } else {
              state.createBindingMutation.mutate(payload)
            }
          }}
        >
          <Form.Item label="应用">
            <Input value={state.selectedApplication?.name || ''} disabled />
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
              options={state.applicationEnvironmentOptions}
            />
          </Form.Item>
          <Form.Item name="workflowTemplateId" label="发布流程模板">
            <Select
              allowClear
              options={(state.workflowTemplatesQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="buildSourceId" label="构建来源">
            <Select
              allowClear
              options={(state.selectedApplication?.buildSources ?? []).map((item) => ({
                value: item.id,
                label: item.name || summarizeBuildSource(item),
              }))}
            />
          </Form.Item>
          <Form.Item name="refType" label="Ref 类型">
            <Select options={[{ value: 'branch', label: 'Branch' }, { value: 'tag', label: 'Tag' }, { value: 'commit', label: 'Commit' }]} />
          </Form.Item>
          <Form.Item name="refValue" label="环境默认 Ref">
            <Input placeholder="main / v1.0.0 / commit SHA" />
          </Form.Item>
          <Form.Item name="imageTagTemplate" label="镜像 Tag 模板">
            <Input placeholder="{{branch}}-{{sha}}" />
          </Form.Item>
          <Form.Item name="buildVariablesText" label="构建变量(JSON)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="buildArgsText" label="Build Args(JSON)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="actionKind" label="动作">
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
          <Form.Item name="targetClusterId" label="目标集群">
            <Select
              allowClear
              options={(state.clustersQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="targetNamespace" label="目标命名空间">
            <Input />
          </Form.Item>
          <Form.Item name="targetWorkload" label="目标服务 / Deployment">
            <Select
              allowClear
              showSearch
              options={(state.targetCandidatesQuery.data ?? []).map((item) => ({
                value: `${item.clusterId}/${item.namespace}/${item.workloadName}`,
                label: `${item.workloadName} · ${item.namespace}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="targetContainer" label="容器">
            <Input />
          </Form.Item>
          <Form.Item name="targetsText" label="发布目标矩阵(JSON)">
            <Input.TextArea rows={8} placeholder='[{"targetKind":"helm_release",...}]' />
          </Form.Item>
          <Form.Item name="resourceSelectorText" label="资源选择器标签(JSON)">
            <Input.TextArea rows={4} placeholder={`{\n  "app": "erp-front"\n}`} />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => state.setBindingModalVisible(false)}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={
                state.createBindingMutation.isPending || state.updateBindingMutation.isPending
              }
            >
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
