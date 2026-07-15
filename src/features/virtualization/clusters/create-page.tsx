import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Descriptions, Form, Input, Select, Switch } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import type { StepFormStep } from '@/components/step-form'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import {
  buildClusterPayload,
  type VirtualizationClusterFormValues,
} from '@/features/virtualization/virtualization-model'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import type { VirtualizationCluster } from '@/features/virtualization/virtualization-types'

interface VirtualizationConnectionStepModalProps {
  editing?: VirtualizationCluster | null
  initialProvider?: 'kubevirt' | 'pve'
  onClose: () => void
  onSuccess?: () => void
  open: boolean
}

function connectionFormValues(
  record?: VirtualizationCluster | null,
): Partial<VirtualizationClusterFormValues> {
  if (!record) return { provider: 'kubevirt', enabled: true, verifyTls: true }
  return {
    name: record.name,
    provider: record.provider === 'pve' ? 'pve' : 'kubevirt',
    endpoint: record.endpoint,
    kubernetesClusterId: record.kubernetesClusterId,
    defaultNamespace: record.defaultNamespace,
    enabled: record.enabled !== false,
    verifyTls: record.verifyTls !== false,
    region: record.region,
    description: record.description,
    defaultNode:
      typeof record.config?.defaultNode === 'string' ? record.config.defaultNode : undefined,
    defaultStorage:
      typeof record.config?.defaultStorage === 'string' ? record.config.defaultStorage : undefined,
    defaultBridge:
      typeof record.config?.defaultBridge === 'string' ? record.config.defaultBridge : undefined,
    defaultSnippetStorage:
      typeof record.config?.defaultSnippetStorage === 'string'
        ? record.config.defaultSnippetStorage
        : typeof record.config?.snippetStorage === 'string'
          ? record.config.snippetStorage
          : undefined,
    backendUrl:
      typeof record.config?.backendUrl === 'string' ? record.config.backendUrl : undefined,
    prometheusUrl:
      typeof record.config?.prometheusUrl === 'string' ? record.config.prometheusUrl : undefined,
    prometheusBearerTokenSecretRef:
      typeof record.config?.prometheusBearerTokenSecretRef === 'string'
        ? record.config.prometheusBearerTokenSecretRef
        : undefined,
    mode: typeof record.config?.mode === 'string' ? record.config.mode : undefined,
  }
}

export function VirtualizationConnectionStepModal({
  editing,
  initialProvider = 'kubevirt',
  onClose,
  onSuccess,
  open,
}: VirtualizationConnectionStepModalProps) {
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm<VirtualizationClusterFormValues>()
  const provider = Form.useWatch('provider', form) ?? 'kubevirt'
  const selectedKubernetesClusterId = Form.useWatch('kubernetesClusterId', form)
  const { virtualizationModuleEnabled, canManageClusters } = useVirtualizationPermissions()
  const platformClustersQuery = useQuery(
    virtualizationQueries.platformClusterOptions(virtualizationModuleEnabled && canManageClusters),
  )
  const selectedPlatformCluster = useMemo(
    () =>
      (platformClustersQuery.data ?? []).find((item) => item.id === selectedKubernetesClusterId),
    [platformClustersQuery.data, selectedKubernetesClusterId],
  )
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const finish = () => {
    message.success(editing ? '虚拟化连接已更新' : '虚拟化连接已创建')
    onSuccess?.()
    onClose()
  }
  const createMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.createCluster(queryClient), () => {
      finish()
    }),
  )
  const updateMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.updateCluster(queryClient), finish),
  )

  useEffect(() => {
    if (!open) return
    setCurrent(0)
    form.setFieldsValue(
      editing
        ? connectionFormValues(editing)
        : { ...connectionFormValues(), provider: initialProvider },
    )
  }, [editing, form, initialProvider, open])

  const steps: StepFormStep[] = [
    {
      title: '基本信息',
      fieldNames: ['name', 'provider'],
      children: (
        <>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="provider"
            label="Provider"
            rules={[{ required: true, message: '请选择 Provider' }]}
          >
            <Select
              options={[
                { value: 'kubevirt', label: 'KubeVirt' },
                { value: 'pve', label: 'PVE' },
              ]}
              onChange={() => {
                form.setFieldsValue({
                  endpoint: undefined,
                  kubernetesClusterId: undefined,
                  mode: undefined,
                })
              }}
            />
          </Form.Item>
          <Form.Item name="region" label="Region">
            <Input />
          </Form.Item>
        </>
      ),
    },
    {
      title: '连接配置',
      fieldNames:
        provider === 'kubevirt' ? ['kubernetesClusterId'] : ['endpoint', 'username', 'tokenID'],
      children: (
        <>
          <Form.Item name="mode" hidden>
            <Input />
          </Form.Item>
          {provider === 'kubevirt' ? (
            <>
              <Alert
                showIcon
                type={selectedPlatformCluster?.connectionMode === 'agent' ? 'warning' : 'info'}
                title={
                  selectedPlatformCluster?.connectionMode === 'agent'
                    ? '当前集群使用 Agent 通道'
                    : '当前连接使用直连 kubeconfig 通道'
                }
              />
              <Form.Item
                name="kubernetesClusterId"
                label="Kubernetes 集群"
                rules={[{ required: true, message: '请选择 Kubernetes 集群' }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={platformClustersQuery.isLoading}
                  options={(platformClustersQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.connectionMode})`,
                  }))}
                  onChange={(value) => {
                    const cluster = (platformClustersQuery.data ?? []).find(
                      (item) => item.id === value,
                    )
                    form.setFieldValue(
                      'mode',
                      cluster?.connectionMode === 'agent' ? 'agent' : 'direct_kubeconfig',
                    )
                  }}
                />
              </Form.Item>
              <Form.Item name="defaultNamespace" label="默认命名空间">
                <Input />
              </Form.Item>
              <Form.Item name="backendUrl" label="Console Backend URL">
                <Input placeholder="https://kube-api.example:6443" />
              </Form.Item>
              <Form.Item name="prometheusUrl" label="Prometheus URL">
                <Input placeholder="https://prometheus.example" />
              </Form.Item>
              <Form.Item name="prometheusBearerTokenSecretRef" label="Prometheus Token SecretRef">
                <Input />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="endpoint"
                label="Endpoint"
                rules={[{ required: true, message: '请输入 PVE Endpoint' }]}
              >
                <Input placeholder="https://pve.example:8006" />
              </Form.Item>
              <Form.Item name="username" label="Username">
                <Input placeholder="root@pam" />
              </Form.Item>
              <Form.Item name="password" label="Password">
                <Input.Password />
              </Form.Item>
              <Form.Item name="tokenID" label="Token ID">
                <Input />
              </Form.Item>
              <Form.Item name="tokenSecret" label="Token Secret">
                <Input.Password />
              </Form.Item>
              <Form.Item name="ticket" label="Ticket">
                <Input.Password />
              </Form.Item>
              <Form.Item name="csrfToken" label="CSRF Token">
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="verifyTls" label="校验 TLS" valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      ),
    },
    {
      title: '默认配置',
      children: (
        <>
          {provider === 'pve' ? (
            <>
              <Form.Item name="defaultNode" label="默认节点">
                <Input />
              </Form.Item>
              <Form.Item name="defaultStorage" label="默认存储">
                <Input />
              </Form.Item>
              <Form.Item name="defaultBridge" label="默认网桥">
                <Input />
              </Form.Item>
              <Form.Item name="defaultSnippetStorage" label="默认 Snippet Storage">
                <Input />
              </Form.Item>
            </>
          ) : null}
          <Form.Item name="enabled" label="创建后启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Provider">{provider}</Descriptions.Item>
            <Descriptions.Item label="接入方式">
              {provider === 'kubevirt'
                ? selectedPlatformCluster?.connectionMode || 'direct'
                : 'direct'}
            </Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
  ]

  return (
    <StepFormModal
      current={current}
      form={form}
      loading={createMutation.isPending || updateMutation.isPending}
      onClose={onClose}
      onCurrentChange={setCurrent}
      onFinish={(values) => {
        const payload = buildClusterPayload(values)
        if (editing) updateMutation.mutate({ id: editing.id, payload })
        else createMutation.mutate(payload)
      }}
      open={open}
      steps={steps}
      submitText={editing ? '保存连接' : '创建连接'}
      title={editing ? '编辑虚拟化连接' : '新增虚拟化连接'}
    />
  )
}
