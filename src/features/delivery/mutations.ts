import { mutationOptions, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { deliveryApi } from './api'
import { deliveryKeys, deliveryMutationKeys } from './keys'
import type {
  ApplicationServiceCreateInput,
  ApplicationServiceDeleteInput,
  ApplicationServiceUpdateInput,
  BuildTemplateInput,
  DeliveryDeploymentRollbackInput,
  DeliveryDraftInput,
  DeliveryPlanRequest,
  DeliveryRecordInput,
  DeliveryStringRecordInput,
  DeliveryUpdateInput,
  DeliveryWorkloadRestartInput,
  ExecutionCallbackInput,
  ExecutionTaskActionInput,
  ReleaseTriggerInput,
  WorkflowDecisionInput,
  WorkflowTriggerInput,
} from './types'

function uniqueKeys(keys: QueryKey[]) {
  const seen = new Set<string>()
  return keys.filter((key) => {
    const fingerprint = JSON.stringify(key)
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

export function invalidateDeliveryKeys(queryClient: QueryClient, keys: QueryKey[]) {
  return Promise.all(
    uniqueKeys(keys).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}

export function invalidateApplicationQueries(queryClient: QueryClient) {
  return invalidateDeliveryKeys(queryClient, [
    deliveryKeys.applications.all,
    deliveryKeys.environments.all,
    deliveryKeys.releaseBoard.all,
  ])
}

export function invalidateEnvironmentQueries(queryClient: QueryClient) {
  return invalidateDeliveryKeys(queryClient, [
    deliveryKeys.environments.all,
    deliveryKeys.applications.all,
    deliveryKeys.releaseBoard.all,
  ])
}

export function invalidateRuntimeQueries(queryClient: QueryClient) {
  return invalidateDeliveryKeys(queryClient, [
    deliveryKeys.applications.all,
    deliveryKeys.builds.all,
    deliveryKeys.workflows.all,
    deliveryKeys.releases.all,
    deliveryKeys.releaseBoard.all,
    deliveryKeys.releaseBundles.all,
    deliveryKeys.executionTasks.all,
    deliveryKeys.runtime.all,
  ])
}

export const deliveryMutations = {
  applications: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applications('create'),
        mutationFn: (payload: DeliveryRecordInput) => deliveryApi.applications.create(payload),
        onSuccess: () => invalidateApplicationQueries(queryClient),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applications('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<DeliveryRecordInput>) =>
          deliveryApi.applications.update(id, payload),
        onSuccess: () => invalidateApplicationQueries(queryClient),
      }),
    delete: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applications('delete'),
        mutationFn: deliveryApi.applications.delete,
        onSuccess: () => invalidateApplicationQueries(queryClient),
      }),
    createService: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applicationServices('create'),
        mutationFn: ({ applicationId, payload }: ApplicationServiceCreateInput) =>
          deliveryApi.applications.createService(applicationId, payload),
        onSuccess: (_result, variables) =>
          queryClient.invalidateQueries({
            queryKey: deliveryKeys.applications.detail(variables.applicationId),
          }),
      }),
    updateService: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applicationServices('update'),
        mutationFn: ({ applicationId, serviceId, payload }: ApplicationServiceUpdateInput) =>
          deliveryApi.applications.updateService(applicationId, serviceId, payload),
        onSuccess: (_result, variables) =>
          queryClient.invalidateQueries({
            queryKey: deliveryKeys.applications.detail(variables.applicationId),
          }),
      }),
    deleteService: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.applicationServices('delete'),
        mutationFn: ({ applicationId, serviceId }: ApplicationServiceDeleteInput) =>
          deliveryApi.applications.deleteService(applicationId, serviceId),
        onSuccess: (_result, variables) =>
          queryClient.invalidateQueries({
            queryKey: deliveryKeys.applications.detail(variables.applicationId),
          }),
      }),
  },
  environments: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.environments('create'),
        mutationFn: deliveryApi.environments.create,
        onSuccess: () => invalidateEnvironmentQueries(queryClient),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.environments('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<DeliveryRecordInput>) =>
          deliveryApi.environments.update(id, payload),
        onSuccess: () => invalidateEnvironmentQueries(queryClient),
      }),
    delete: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.environments('delete'),
        mutationFn: deliveryApi.environments.delete,
        onSuccess: () => invalidateEnvironmentQueries(queryClient),
      }),
  },
  buildTemplates: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.buildTemplates('create'),
        mutationFn: deliveryApi.buildTemplates.create,
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: deliveryKeys.buildTemplates.all }),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.buildTemplates('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<BuildTemplateInput>) =>
          deliveryApi.buildTemplates.update(id, payload),
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: deliveryKeys.buildTemplates.all }),
      }),
    delete: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.buildTemplates('delete'),
        mutationFn: deliveryApi.buildTemplates.delete,
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: deliveryKeys.buildTemplates.all }),
      }),
  },
  workflowTemplates: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflowTemplates('create'),
        mutationFn: deliveryApi.workflowTemplates.create,
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.workflowTemplates.all,
            deliveryKeys.environments.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflowTemplates('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<DeliveryRecordInput>) =>
          deliveryApi.workflowTemplates.update(id, payload),
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.workflowTemplates.all,
            deliveryKeys.environments.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
    delete: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflowTemplates('delete'),
        mutationFn: deliveryApi.workflowTemplates.delete,
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.workflowTemplates.all,
            deliveryKeys.environments.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
  },
  blueprints: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.blueprints('create'),
        mutationFn: deliveryApi.blueprints.create,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.blueprints.all }),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.blueprints('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<DeliveryRecordInput>) =>
          deliveryApi.blueprints.update(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.blueprints.all }),
      }),
    renderSpec: () =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.blueprints('render-spec'),
        mutationFn: deliveryApi.blueprints.renderSpec,
      }),
    bootstrapApplication: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.blueprints('bootstrap-application'),
        mutationFn: deliveryApi.blueprints.bootstrapApplication,
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.blueprints.all,
            deliveryKeys.applications.all,
            deliveryKeys.environments.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
  },
  workflows: {
    trigger: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflows('trigger'),
        mutationFn: (payload: WorkflowTriggerInput) => deliveryApi.workflows.trigger(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
    approve: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflows('approve'),
        mutationFn: (payload: WorkflowDecisionInput) => deliveryApi.workflows.approve(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
    reject: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workflows('reject'),
        mutationFn: (payload: WorkflowDecisionInput) => deliveryApi.workflows.reject(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
  },
  releases: {
    trigger: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.releases('trigger'),
        mutationFn: (payload: ReleaseTriggerInput) => deliveryApi.releases.trigger(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
  },
  registries: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.registries('create'),
        mutationFn: (payload: DeliveryStringRecordInput) => deliveryApi.registries.create(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.registries.all }),
      }),
    update: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.registries('update'),
        mutationFn: ({ id, payload }: DeliveryUpdateInput<DeliveryStringRecordInput>) =>
          deliveryApi.registries.update(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.registries.all }),
      }),
    delete: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.registries('delete'),
        mutationFn: deliveryApi.registries.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.registries.all }),
      }),
  },
  executionTasks: {
    callback: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.executionTasks('callback'),
        mutationFn: (payload: ExecutionCallbackInput) =>
          deliveryApi.executionTasks.callback(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
    cancel: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.executionTasks('cancel'),
        mutationFn: (payload: ExecutionTaskActionInput) =>
          deliveryApi.executionTasks.cancel(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
    retry: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.executionTasks('retry'),
        mutationFn: (payload: ExecutionTaskActionInput) =>
          deliveryApi.executionTasks.retry(payload),
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
  },
  workloads: {
    restart: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.workloads('restart'),
        mutationFn: (payload: DeliveryWorkloadRestartInput) =>
          deliveryApi.workloads.restart(payload),
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.workloads.all,
            deliveryKeys.applications.all,
          ]),
      }),
  },
  deployments: {
    rollback: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.deployments('rollback'),
        mutationFn: (payload: DeliveryDeploymentRollbackInput) =>
          deliveryApi.deployments.rollback(payload),
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.deployments.all,
            deliveryKeys.environments.all,
            deliveryKeys.applications.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
  },
  drafts: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.drafts('create'),
        mutationFn: (payload: DeliveryDraftInput) => deliveryApi.drafts.create(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKeys.drafts.all }),
      }),
    confirm: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.drafts('confirm'),
        mutationFn: deliveryApi.drafts.confirm,
        onSuccess: () =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.drafts.all,
            deliveryKeys.applications.all,
            deliveryKeys.environments.all,
            deliveryKeys.releaseBoard.all,
          ]),
      }),
  },
  plans: {
    create: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.plans('create'),
        mutationFn: (payload: DeliveryPlanRequest) => deliveryApi.plans.create(payload),
        onSuccess: (plan) =>
          invalidateDeliveryKeys(queryClient, [
            deliveryKeys.plans.detail(plan.id),
            deliveryKeys.applications.detail(plan.applicationId),
          ]),
      }),
    confirm: (queryClient: QueryClient) =>
      mutationOptions({
        mutationKey: deliveryMutationKeys.plans('confirm'),
        mutationFn: deliveryApi.plans.confirm,
        onSuccess: () => invalidateRuntimeQueries(queryClient),
      }),
  },
}
