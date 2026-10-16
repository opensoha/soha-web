import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { ReadFeedback } from '@/components/request-feedback'
import { StepFormModal } from '@/components/step-form-modal'
import type { ServiceFormValues } from '@/features/platform/resource-creation/forms'
import { getResourceFormDefinition } from '@/features/platform/resource-creation/forms'
import { planResourceUpdate } from '@/features/platform/shared/resource-update-plan'
import {
  platformResourceTarget,
  usePlatformMutation,
} from '@/features/platform/shared/use-platform-mutation'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { readableQueryData } from '@/utils/query-feedback'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Spin } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parse, stringify } from 'yaml'
import { networkQueries } from '../shared/queries'
import { serviceMutations } from './mutations'
import { mergeServiceManifest, serviceFormValuesFromManifest } from './service-edit-model'
import type { Service } from './types'

const serviceFormDefinition = getResourceFormDefinition('Service')

type LoadedService = {
  error?: string
  manifest?: unknown
  values?: ServiceFormValues
}

export function ServiceEditModal({ service, onClose }: { service: Service; onClose: () => void }) {
  const { message } = App.useApp()
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const scope = toScopeKey(clusterId, service.namespace)
  const yamlQuery = useQuery(networkQueries.yaml('services', scope, service.name))
  const visibleYamlQueryData = readableQueryData(yamlQuery)
  const updateMutation = usePlatformMutation(serviceMutations.updateYAML(queryClient), {
    label: ['更新资源', 'Update resource'],
    target: platformResourceTarget,
  })
  const platformWriteBlocked = updateMutation.blocked
  const planMutation = usePlatformMutation(
    { mutationFn: planResourceUpdate },
    {
      label: ['资源变更预检', 'Resource change preflight'],
      target: platformResourceTarget,
      readOnly: true,
    },
  )
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const loaded = useMemo<LoadedService>(() => {
    if (!visibleYamlQueryData) return {}
    try {
      const manifest = parse(visibleYamlQueryData.content)
      return { manifest, values: serviceFormValuesFromManifest(manifest) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [visibleYamlQueryData])

  const error =
    yamlQuery.isError && !visibleYamlQueryData
      ? yamlQuery.error.message
      : loaded.error || (!serviceFormDefinition ? 'Service form is unavailable' : undefined)
  const [formValues, setFormValues] = useState<ServiceFormValues | null>(null)
  const initialized = useRef('')
  const identity = JSON.stringify([clusterId, service.namespace, service.name])
  useEffect(() => {
    if (!loaded.values || initialized.current === identity) return
    setFormValues(loaded.values)
    initialized.current = identity
  }, [identity, loaded.values])
  const isChinese = localeCode === 'zh_CN'

  function save(submitted: unknown) {
    if (!serviceFormDefinition || !loaded.manifest || platformWriteBlocked || yamlQuery.isError)
      return
    try {
      const lockedValues = {
        ...(submitted as ServiceFormValues),
        name: service.name,
        namespace: service.namespace,
      }
      const edited = serviceFormDefinition.buildManifest(lockedValues)
      const content = stringify(mergeServiceManifest(loaded.manifest, edited))
      setPendingContent(content)
      planMutation.mutate({ scope, kind: 'Service', name: service.name, content }, {})
    } catch (saveError) {
      void message.error(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  function clearPlan() {
    if (platformWriteBlocked) return
    planMutation.reset()
    setPendingContent(null)
  }

  function applyUpdate() {
    if (!pendingContent || platformWriteBlocked || yamlQuery.isError) return
    updateMutation.mutate(
      { scope, name: service.name, content: pendingContent },
      {
        onSuccess: () => {
          clearPlan()
        },
      },
    )
  }

  if (updateMutation.isSuccess)
    return (
      <StepFormModal
        open
        title={isChinese ? `编辑 Service · ${service.name}` : `Edit Service · ${service.name}`}
        width={1120}
        onClose={onClose}
        feedback={updateMutation.feedback}
      >
        <Button type="primary" onClick={onClose}>
          {localeCode === 'zh_CN' ? '完成' : 'Done'}
        </Button>
      </StepFormModal>
    )

  return (
    <>
      <ReadFeedback canRead={yamlQuery.isEnabled} query={yamlQuery} label="YAML" />

      <StepFormModal
        feedback={
          <>
            <ReadFeedback canRead={yamlQuery.isEnabled} query={yamlQuery} label="YAML" />
            {updateMutation.feedback}
            {planMutation.feedback}
          </>
        }
        onClose={() => {
          if (!platformWriteBlocked) onClose?.()
        }}
        open
        title={isChinese ? `编辑 Service · ${service.name}` : `Edit Service · ${service.name}`}
        width="min(1120px, calc(100vw - 32px))"
      >
        {yamlQuery.isLoading ? (
          <div className="soha-resource-create-loading">
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert
            description={error}
            showIcon
            title={isChinese ? 'Service 配置加载失败' : 'Failed to load Service configuration'}
            type="error"
          />
        ) : serviceFormDefinition && loaded.values ? (
          <div className="soha-resource-create-form">
            {serviceFormDefinition.renderForm({
              clusterId: clusterId || '',
              identityDisabled: true,
              disabled: platformWriteBlocked || Boolean(yamlQuery.error),
              loading: planMutation.isPending || updateMutation.isPending,
              localeCode,
              namespaceOptions: [service.namespace],
              onChange: (values) => setFormValues(values as ServiceFormValues),
              onSubmit: save,
              submitText: isChinese ? '保存更改' : 'Save changes',
              value: formValues ?? loaded.values,
            })}
          </div>
        ) : null}
      </StepFormModal>
      <OperationalPlanModal
        disabled={platformWriteBlocked || Boolean(yamlQuery.error)}
        feedback={
          <>
            <ReadFeedback canRead={yamlQuery.isEnabled} query={yamlQuery} label="YAML" />
            {updateMutation.feedback}
            {planMutation.feedback}
          </>
        }
        confirmText={isChinese ? '确认更新' : 'Confirm update'}
        loading={updateMutation.isPending}
        onCancel={clearPlan}
        onConfirm={applyUpdate}
        plan={planMutation.data ?? null}
        title={isChinese ? '确认资源变更' : 'Confirm resource change'}
      />
    </>
  )
}
