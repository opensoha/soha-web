import { queryOptions } from '@tanstack/react-query'
import {
  listApplicationEnvironments,
  listApplications,
  listBuilds,
  listReleases,
  listWorkflows,
} from './linkage-api'
import { deploymentLinkageKeys } from './linkage-keys'
import type {
  ApplicationEnvironment,
  ApplicationSummary,
  BuildRecord,
  ReleaseRecord,
  WorkflowRecord,
} from './types'

export const deploymentLinkageQueries = {
  applicationEnvironments: () =>
    queryOptions<ApplicationEnvironment[]>({
      queryKey: deploymentLinkageKeys.applicationEnvironments(),
      queryFn: listApplicationEnvironments,
    }),
  applications: () =>
    queryOptions<ApplicationSummary[]>({
      queryKey: deploymentLinkageKeys.applications(),
      queryFn: listApplications,
    }),
  builds: () =>
    queryOptions<BuildRecord[]>({
      queryKey: deploymentLinkageKeys.builds(),
      queryFn: listBuilds,
    }),
  workflows: () =>
    queryOptions<WorkflowRecord[]>({
      queryKey: deploymentLinkageKeys.workflows(),
      queryFn: listWorkflows,
    }),
  releases: () =>
    queryOptions<ReleaseRecord[]>({
      queryKey: deploymentLinkageKeys.releases(),
      queryFn: listReleases,
    }),
}
