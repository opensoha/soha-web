import { useMemo, useState } from 'react'
import { Alert, App, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { planResourceUpdate } from '@/features/platform/shared/resource-update-plan'
import { getResourceFormDefinition } from '@/features/platform/resource-creation/forms'
import type { ServiceFormValues } from '@/features/platform/resource-creation/forms'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
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
  const updateMutation = useMutation(serviceMutations.updateYAML(queryClient))
  const planMutation = useMutation({ mutationFn: planResourceUpdate })
  const [pendingContent, setPendingContent] = useState<string | null>(null)
  const loaded = useMemo<LoadedService>(() => {
    if (!yamlQuery.data) return {}
    try {
      const manifest = parse(yamlQuery.data.content)
      return { manifest, values: serviceFormValuesFromManifest(manifest) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [yamlQuery.data])

  const error = yamlQuery.isError
    ? yamlQuery.error.message
    : loaded.error || (!serviceFormDefinition ? 'Service form is unavailable' : undefined)
  const isChinese = localeCode === 'zh_CN'

  function save(submitted: unknown) {
    if (!serviceFormDefinition || !loaded.manifest) return
    try {
      const lockedValues = {
        ...(submitted as ServiceFormValues),
        name: service.name,
        namespace: service.namespace,
      }
      const edited = serviceFormDefinition.buildManifest(lockedValues)
      const content = stringify(mergeServiceManifest(loaded.manifest, edited))
      setPendingContent(content)
      planMutation.mutate(
        { scope, kind: 'Service', name: service.name, content },
        { onError: (mutationError) => void message.error(mutationError.message) },
      )
    } catch (saveError) {
      void message.error(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  function clearPlan() {
    planMutation.reset()
    setPendingContent(null)
  }

  function applyUpdate() {
    if (!pendingContent) return
    updateMutation.mutate(
      { scope, name: service.name, content: pendingContent },
      {
        onSuccess: () => {
          void message.success(isChinese ? 'Service 已更新' : 'Service updated')
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
        onClose={onClose}
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
              loading: planMutation.isPending || updateMutation.isPending,
              localeCode,
              namespaceOptions: [service.namespace],
              onChange: () => undefined,
              onSubmit: save,
              submitText: isChinese ? '保存更改' : 'Save changes',
              value: loaded.values,
            })}
          </div>
        ) : null}
      </StepFormModal>
      <OperationalPlanModal
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
