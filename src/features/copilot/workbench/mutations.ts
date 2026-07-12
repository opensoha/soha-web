import { mutationOptions } from '@tanstack/react-query'

import {
  workbenchApi,
  type CreateInspectionTaskInput,
  type CreateWorkbenchSessionInput,
  type PatchWorkbenchSessionInput,
} from './api'
import { workbenchMutationKeys } from './keys'

export const workbenchMutations = {
  sessions: {
    create: () =>
      mutationOptions({
        mutationKey: workbenchMutationKeys.sessions('create'),
        mutationFn: (input: CreateWorkbenchSessionInput) => workbenchApi.sessions.create(input),
      }),
    patch: () =>
      mutationOptions({
        mutationKey: workbenchMutationKeys.sessions('patch'),
        mutationFn: (input: PatchWorkbenchSessionInput) => workbenchApi.sessions.patch(input),
      }),
    archive: () =>
      mutationOptions({
        mutationKey: workbenchMutationKeys.sessions('archive'),
        mutationFn: (sessionId: string) => workbenchApi.sessions.archive(sessionId),
      }),
    createInspectionTask: () =>
      mutationOptions({
        mutationKey: workbenchMutationKeys.sessions('create-inspection-task'),
        mutationFn: (input: CreateInspectionTaskInput) =>
          workbenchApi.sessions.createInspectionTask(input),
      }),
  },
}
