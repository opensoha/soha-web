import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Col, Form, Input, InputNumber, Row, Select, Spin, Switch } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import type { StepFormStep } from '@/components/step-form'
import { planResourceUpdate } from '@/features/platform/shared/resource-update-plan'
import { KeyValueFields } from '@/features/platform/resource-creation/forms/field-sections'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { parse, stringify } from 'yaml'
import { workloadMutations } from './mutations'
import { workloadQueries } from './queries'
import {
  mergeWorkloadQuickEditManifest,
  workloadContainerNames,
  workloadQuickEditValuesFromManifest,
  type QuickEditableWorkloadKind,
  type WorkloadQuickEditValues,
} from './workload-quick-edit-model'

interface WorkloadQuickEditModalProps {
  kind: QuickEditableWorkloadKind
  name: string
  namespace: string
  onClose: () => void
}

const kindLabels: Record<QuickEditableWorkloadKind, string> = {
  deployments: 'Deployment',
  statefulsets: 'StatefulSet',
  daemonsets: 'DaemonSet',
  cronjobs: 'CronJob',
}

function RuntimeFields({
  containerNames,
  kind,
  onContainerChange,
}: {
  containerNames: string[]
  kind: QuickEditableWorkloadKind
  onContainerChange: (name: string) => void
}) {
  return (
    <>
      <Row gutter={16}>
        {kind !== 'daemonsets' && kind !== 'cronjobs' ? (
          <Col xs={24} md={8}>
            <Form.Item label="副本数" name="replicas" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        ) : null}
        <Col xs={24} md={kind === 'daemonsets' || kind === 'cronjobs' ? 10 : 8}>
          <Form.Item label="目标容器" name="containerName" rules={[{ required: true }]}>
            <Select
              options={containerNames.map((value) => ({ label: value, value }))}
              onChange={onContainerChange}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={kind === 'daemonsets' || kind === 'cronjobs' ? 14 : 8}>
          <Form.Item label="镜像" name="image" rules={[{ required: true, message: '请输入镜像' }]}>
            <Input placeholder="nginx:latest" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="CPU 请求" name="cpuRequest">
            <Input placeholder="100m" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="CPU 限制" name="cpuLimit">
            <Input placeholder="500m" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="内存请求" name="memoryRequest">
            <Input placeholder="128Mi" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="内存限制" name="memoryLimit">
            <Input placeholder="512Mi" />
          </Form.Item>
        </Col>
      </Row>
    </>
  )
}

function SchedulingFields() {
  return (
    <>
      <Form.Item label="ServiceAccount" name="serviceAccountName">
        <Input placeholder="default" />
      </Form.Item>
      <KeyValueFields label="节点选择器" name="nodeSelector" />
      <KeyValueFields label="环境变量" name="env" />
    </>
  )
}

function CronPolicyFields() {
  return (
    <>
      <Row gutter={16}>
        <Col xs={24} md={14}>
          <Form.Item label="Cron 表达式" name="schedule" rules={[{ required: true }]}>
            <Input placeholder="0 * * * *" />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item label="暂停调度" name="suspend" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="并发策略" name="concurrencyPolicy">
            <Select options={[{ value: 'Allow' }, { value: 'Forbid' }, { value: 'Replace' }]} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="时区" name="timeZone">
            <Input placeholder="Asia/Shanghai" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="成功任务保留数" name="successfulJobsHistoryLimit">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="失败任务保留数" name="failedJobsHistoryLimit">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </>
  )
}

export function WorkloadQuickEditModal({
  kind,
  name,
  namespace,
  onClose,
}: WorkloadQuickEditModalProps) {
  const { message } = App.useApp()
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const scope = toScopeKey(clusterId, namespace)
  const yamlQuery = useQuery(workloadQueries.yaml(kind, scope, name))
  const updateMutation = useMutation(workloadMutations.updateYAML(kind, queryClient))
  const planMutation = useMutation({ mutationFn: planResourceUpdate })
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const [form] = Form.useForm<WorkloadQuickEditValues>()
  const [current, setCurrent] = useState(0)
  const loaded = useMemo(() => {
    if (!yamlQuery.data) return {}
    try {
      const manifest = parse(yamlQuery.data.content)
      return {
        manifest,
        containerNames: workloadContainerNames(manifest, kind),
        values: workloadQuickEditValuesFromManifest(manifest, kind),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [kind, yamlQuery.data])

  useEffect(() => {
    if (!loaded.values) return
    form.setFieldsValue(loaded.values)
    setCurrent(0)
  }, [form, loaded.values])

  const title = `${localeCode === 'zh_CN' ? '编辑' : 'Edit'} ${kindLabels[kind]} · ${name}`
  const error = yamlQuery.isError ? yamlQuery.error.message : loaded.error

  if (yamlQuery.isLoading || error || !loaded.manifest || !loaded.values) {
    return (
      <StepFormModal onClose={onClose} open title={title} width={860}>
        {yamlQuery.isLoading ? (
          <div className="soha-resource-create-loading">
            <Spin size="large" />
          </div>
        ) : (
          <Alert
            description={error || 'Workload manifest is unavailable'}
            showIcon
            title={localeCode === 'zh_CN' ? '配置加载失败' : 'Failed to load configuration'}
            type="error"
          />
        )}
      </StepFormModal>
    )
  }

  const selectContainer = (containerName: string) => {
    form.setFieldsValue(workloadQuickEditValuesFromManifest(loaded.manifest, kind, containerName))
  }
  const runtimeStep: StepFormStep = {
    title: localeCode === 'zh_CN' ? '运行配置' : 'Runtime',
    fieldNames: ['containerName', 'image', 'replicas'],
    children: (
      <RuntimeFields
        containerNames={loaded.containerNames ?? []}
        kind={kind}
        onContainerChange={selectContainer}
      />
    ),
  }
  const steps: StepFormStep[] =
    kind === 'cronjobs'
      ? [
          {
            title: localeCode === 'zh_CN' ? '调度策略' : 'Schedule',
            fieldNames: ['schedule'],
            children: <CronPolicyFields />,
          },
          runtimeStep,
          {
            title: localeCode === 'zh_CN' ? '环境与调度' : 'Environment',
            children: <SchedulingFields />,
          },
        ]
      : [
          runtimeStep,
          {
            title: localeCode === 'zh_CN' ? '环境与调度' : 'Environment',
            children: <SchedulingFields />,
          },
        ]

  const clearPlan = () => {
    planMutation.reset()
    setPendingContent(null)
  }
  const applyUpdate = () => {
    if (!pendingContent) return
    updateMutation.mutate(
      { scope, name, content: pendingContent },
      {
        onSuccess: () => {
          void message.success(
            localeCode === 'zh_CN' ? `${kindLabels[kind]} 已更新` : `${kindLabels[kind]} updated`,
          )
          clearPlan()
          onClose()
        },
        onError: (mutationError) => void message.error(mutationError.message),
      },
    )
  }

  return (
    <>
      <StepFormModal
        contentMaxWidth={760}
        current={current}
        form={form}
        initialValues={loaded.values}
        loading={planMutation.isPending || updateMutation.isPending}
        onClose={onClose}
        onCurrentChange={setCurrent}
        onFinish={(values) => {
          try {
            const content = stringify(mergeWorkloadQuickEditManifest(loaded.manifest, kind, values))
            setPendingContent(content)
            planMutation.mutate(
              { scope, kind: kindLabels[kind], name, content },
              { onError: (mutationError) => void message.error(mutationError.message) },
            )
          } catch (saveError) {
            void message.error(saveError instanceof Error ? saveError.message : String(saveError))
          }
        }}
        open
        steps={steps}
        submitText={localeCode === 'zh_CN' ? '保存更改' : 'Save changes'}
        title={title}
        width={860}
      />
      <OperationalPlanModal
        confirmText={localeCode === 'zh_CN' ? '确认更新' : 'Confirm update'}
        loading={updateMutation.isPending}
        onCancel={clearPlan}
        onConfirm={applyUpdate}
        plan={planMutation.data ?? null}
        title={localeCode === 'zh_CN' ? '确认资源变更' : 'Confirm resource change'}
      />
    </>
  )
}
