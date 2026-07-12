import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { permissionSnapshotQueryKey } from '@/features/auth'
import { settingsApi } from './api'
import { settingsKeys, settingsMutationKeys } from './keys'

export function invalidateBrandingSettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: settingsKeys.branding.all })
}

export function invalidateIdentitySettings(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: settingsKeys.identity.all }),
    queryClient.invalidateQueries({ queryKey: permissionSnapshotQueryKey }),
  ])
}

export function invalidateMonitoringSettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: settingsKeys.monitoring.all })
}

export function invalidateAISettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: settingsKeys.ai.all })
}

export const settingsMutations = {
  branding: {
    save: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.branding('save'),
        mutationFn: settingsApi.branding.save,
        onSuccess: () => invalidateBrandingSettings(queryClient),
      }),
    upload: () =>
      mutationOptions({
        mutationKey: settingsMutationKeys.branding('upload'),
        mutationFn: settingsApi.branding.upload,
      }),
  },
  identity: {
    save: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.identity('save'),
        mutationFn: settingsApi.identity.save,
        onSuccess: () => invalidateIdentitySettings(queryClient),
      }),
  },
  monitoring: {
    save: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.monitoring('save'),
        mutationFn: settingsApi.monitoring.savePrometheus,
        onSuccess: () => invalidateMonitoringSettings(queryClient),
      }),
  },
  ai: {
    saveWorkbenchModel: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('save-workbench-model'),
        mutationFn: settingsApi.ai.saveWorkbenchModel,
        onSuccess: () => invalidateAISettings(queryClient),
      }),
    saveSkills: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('save-skills'),
        mutationFn: settingsApi.ai.saveSkills,
        onSuccess: () => invalidateAISettings(queryClient),
      }),
    upsertDataSource: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('upsert-data-source'),
        mutationFn: settingsApi.ai.upsertDataSource,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.ai.dataSources() }),
      }),
    validateDataSource: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('validate-data-source'),
        mutationFn: settingsApi.ai.validateDataSource,
        onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.ai.dataSources() }),
      }),
    upsertAnalysisProfile: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('upsert-analysis-profile'),
        mutationFn: settingsApi.ai.upsertAnalysisProfile,
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: settingsKeys.ai.analysisProfiles() }),
      }),
    upsertAutomationPolicy: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: settingsMutationKeys.ai('upsert-automation-policy'),
        mutationFn: settingsApi.ai.upsertAutomationPolicy,
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: settingsKeys.ai.automationPolicies() }),
      }),
  },
}
