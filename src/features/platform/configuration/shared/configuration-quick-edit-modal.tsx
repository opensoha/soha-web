import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Col, Form, Input, InputNumber, Row, Select, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { planResourceUpdate } from '@/features/platform/shared/resource-update-plan'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { parse, stringify } from 'yaml'
import { configurationMutations } from './mutations'
import { configurationQueries } from './queries'
import {
  configurationQuickEditValuesFromManifest,
  mergeConfigurationQuickEditManifest,
  type ConfigurationQuickEditValues,
  type QuickEditableConfigurationKind,
} from './configuration-quick-edit-model'

interface ConfigurationQuickEditModalProps {
  kind: QuickEditableConfigurationKind
  name: string
  namespace: string
  onClose: () => void
}

const kindLabels: Record<QuickEditableConfigurationKind, string> = {
  hpas: 'HorizontalPodAutoscaler',
  poddisruptionbudgets: 'PodDisruptionBudget',
}

export function ConfigurationQuickEditModal({
  kind,
  name,
  namespace,
  onClose,
}: ConfigurationQuickEditModalProps) {
  const { message } = App.useApp()
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const scope = toScopeKey(clusterId, namespace)
  const yamlQuery = useQuery(configurationQueries.yaml(kind, scope, name))
  const updateMutation = useMutation(configurationMutations.updateYAML(kind, queryClient))
  const planMutation = useMutation({ mutationFn: planResourceUpdate })
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const [form] = Form.useForm<ConfigurationQuickEditValues>()
  const loaded = useMemo(() => {
    if (!yamlQuery.data) return {}
    try {
      const manifest = parse(yamlQuery.data.content)
      return {
        manifest,
        values: configurationQuickEditValuesFromManifest(manifest, kind),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [kind, yamlQuery.data])

  useEffect(() => {
    if (loaded.values) form.setFieldsValue(loaded.values)
  }, [form, loaded.values])

  const title = `${localeCode === 'zh_CN' ? '编辑' : 'Edit'} ${kindLabels[kind]} · ${name}`
  const error = yamlQuery.isError ? yamlQuery.error.message : loaded.error
  if (yamlQuery.isLoading || error || !loaded.manifest || !loaded.values) {
    return (
      <StepFormModal onClose={onClose} open title={title} width={680}>
        {yamlQuery.isLoading ? (
          <div className="soha-resource-create-loading">
            <Spin size="large" />
          </div>
        ) : (
          <Alert
            description={error || 'Resource manifest is unavailable'}
            showIcon
            title={localeCode === 'zh_CN' ? '配置加载失败' : 'Failed to load configuration'}
            type="error"
          />
        )}
      </StepFormModal>
    )
  }

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
        contentMaxWidth={560}
        current={0}
        form={form}
        initialValues={loaded.values}
        loading={planMutation.isPending || updateMutation.isPending}
        onClose={onClose}
        onCurrentChange={() => undefined}
        onFinish={(values) => {
          try {
            const content = stringify(
              mergeConfigurationQuickEditManifest(loaded.manifest, kind, values),
            )
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
        steps={[
          {
            title: localeCode === 'zh_CN' ? '配置' : 'Configuration',
            children:
              kind === 'hpas' ? (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="最小副本数" name="minReplicas" rules={[{ required: true }]}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="最大副本数" name="maxReplicas" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="可用性规则" name="availabilityMode">
                      <Select
                        options={[
                          { label: 'Min Available', value: 'minAvailable' },
                          { label: 'Max Unavailable', value: 'maxUnavailable' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="数值或百分比"
                      name="availabilityValue"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="1 / 25%" />
                    </Form.Item>
                  </Col>
                </Row>
              ),
          },
        ]}
        submitText={localeCode === 'zh_CN' ? '保存更改' : 'Save changes'}
        title={title}
        width={680}
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
