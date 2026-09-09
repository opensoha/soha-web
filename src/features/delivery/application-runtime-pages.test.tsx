/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationDetailPage } from './applications/detail-page'
import { ApplicationWorkflowDesignerPage } from './applications/workflow-designer-page'
import { I18nProvider } from '@/i18n'
import { api } from '@/services/api-client'
import { ApiError } from '@/services/api-error'
import { usePreferencesStore } from '@/stores/preferences-store'

const workflowDefinition = {
  schemaVersion: 2,
  mode: 'release_dag',
  nodes: [
    {
      id: 'approval',
      type: 'manual_approval',
      name: '审批',
      position: { x: 120, y: 120 },
      timeoutSeconds: 300,
      continueOnFailure: false,
      config: {},
    },
    {
      id: 'deploy',
      type: 'deploy_update_image',
      name: '更新镜像',
      position: { x: 320, y: 120 },
      timeoutSeconds: 300,
      continueOnFailure: false,
      config: {},
    },
  ],
  edges: [{ id: 'edge-1', source: 'approval', target: 'deploy', condition: 'success' }],
}

const testState = vi.hoisted(() => ({
  permissionSnapshot: {
    permissionKeys: [
      'delivery.applications.view',
      'delivery.application.update',
      'delivery.application-environments.create',
      'delivery.application-environments.update',
      'delivery.application-environments.delete',
      'delivery.application-services.view',
      'delivery.application-services.create',
      'delivery.application-services.update',
      'delivery.application-services.delete',
      'delivery.builds.trigger',
      'delivery.workflows.trigger',
      'delivery.releases.trigger',
      'access.scope-grants.view',
      'access.users.view',
    ],
    visibleMenuIds: [],
    visibleMenus: [],
  },
  detailWithoutWorkflow: false,
  detailWithoutValidationNodes: false,
  detailWithoutImageTagDefaults: false,
  deliveryActionsAgentStatus: 'available' as 'available' | 'partial' | 'unsupported',
  deliveryClusterConnectionMode: 'direct_kubeconfig',
  runtimeStatus: 'ok' as 'ok' | 'not-found' | 'error',
  runtimePending: false,
  runtimeWithProductionEnvironment: false,
  runtimeWithUnavailableEnvironment: false,
  repositoriesEmpty: false,
  gitProjectsEmpty: false,
  createdRepository: undefined as Record<string, unknown> | undefined,
  lastDeliveryPlan: undefined as undefined | Record<string, unknown>,
  apiGet: vi.fn(async (path: string) => {
    if (path === '/applications') {
      return {
        data: [
          {
            id: 'app-1',
            name: 'Checkout Platform',
            key: 'checkout-platform',
            group: 'commerce',
            language: 'go',
            repositoryPath: 'commerce/checkout',
            defaultBranch: 'main',
            defaultTag: testState.detailWithoutImageTagDefaults ? undefined : 'latest',
            enabled: true,
            buildSources: [
              {
                id: 'source-api',
                name: 'API Dockerfile',
                type: 'repo_dockerfile',
                enabled: true,
                isDefault: true,
                defaultTag: testState.detailWithoutImageTagDefaults ? undefined : 'latest',
                config: {
                  repositoryId: 'repository-api',
                  repositoryBindings: [
                    {
                      repositoryId: 'repository-api',
                      checkoutPath: '.',
                      defaultBranch: 'main',
                      allowCommitSelection: true,
                      submodules: false,
                    },
                    {
                      repositoryId: 'repository-shared',
                      checkoutPath: 'shared',
                      defaultBranch: 'main',
                      allowCommitSelection: false,
                      submodules: true,
                    },
                  ],
                },
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/users') {
      return {
        data: [
          {
            id: 'user-1',
            username: 'release-owner',
            displayName: 'Release Owner',
            roles: [],
            teams: [],
            projects: [],
            tags: [],
            loginSources: [],
          },
        ],
      }
    }
    if (path === '/access/users') {
      return {
        data: [
          {
            id: 'user-1',
            username: 'release-owner',
            displayName: 'Release Owner',
            roles: [],
            teams: [],
            projects: [],
            tags: [],
            loginSources: [],
          },
        ],
      }
    }
    if (path === '/access/scope-grants') {
      return {
        data: [
          {
            id: 'grant-1',
            subjectType: 'user',
            subjectId: 'user-1',
            businessLineId: 'commerce',
            environmentIds: [],
            applicationIds: ['app-1'],
            scopeType: 'delivery',
            role: 'release-manager',
            effect: 'allow',
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/application-environments') {
      return {
        data: [
          {
            id: 'binding-test',
            applicationId: 'app-1',
            environmentId: 'env-test',
            alias: '集成测试',
            clusterId: 'cluster-a',
            namespace: 'checkout-test',
            registryId: 'registry-a',
            workflowTemplateId: 'wf-template-1',
            buildPolicy: { sourceId: 'source-api', refType: 'branch' },
            releasePolicy: { actionKind: 'deploy', requiresApproval: false },
            resourceSelector: { matchLabels: { app: 'checkout-api' } },
            targets: [
              {
                id: 'target-1',
                applicationEnvironmentId: 'binding-test',
                clusterId: 'cluster-a',
                namespace: 'checkout-test',
                workloadKind: 'Deployment',
                workloadName: 'checkout-api',
                containerName: 'api',
                enabled: true,
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/delivery/environments') {
      return {
        data: [
          {
            id: 'env-test',
            key: 'test',
            name: '测试环境',
            stageLevel: 1,
            sortOrder: 1,
            isProduction: false,
            requiresApproval: false,
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          {
            id: 'env-staging',
            key: 'staging',
            name: '预发布环境',
            stageLevel: 2,
            sortOrder: 2,
            isProduction: false,
            requiresApproval: false,
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/registries') {
      return {
        items: [
          {
            id: 'registry-a',
            name: 'Harbor 主仓库',
            type: 'harbor',
            endpoint: 'https://harbor.example.com',
            enabled: true,
          },
        ],
      }
    }
    if (path === '/clusters/cluster-a/namespaces') {
      return { data: [{ name: 'checkout-staging', status: 'Active' }] }
    }
    if (path === '/workflow-templates') {
      return {
        data: [
          {
            id: 'wf-template-1',
            key: 'release-dag',
            name: 'Release DAG',
            enabled: true,
            definition: workflowDefinition,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/clusters') {
      return {
        data: [
          {
            id: 'cluster-a',
            name: 'cluster-a',
            connectionMode: testState.deliveryClusterConnectionMode,
            status: 'ready',
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/clusters/capabilities') {
      return {
        data: [
          {
            key: 'delivery.actions',
            label: 'Delivery actions',
            category: 'delivery',
            direct: { status: 'available' },
            agent: {
              status: testState.deliveryActionsAgentStatus,
              notes:
                testState.deliveryActionsAgentStatus === 'available'
                  ? []
                  : [
                      'build actions remain available; deploy, build-deploy, verification, and rollback against agent-connected targets require delivery runner parity',
                    ],
            },
          },
        ],
      }
    }
    if (path === '/delivery/manifest-packages?applicationId=app-1&page=1&pageSize=20') {
      return {
        data: {
          items: [
            {
              id: 'manifest-1',
              name: 'Checkout ingress',
              applicationId: 'app-1',
              serviceId: 'svc-api',
              renderer: 'raw_yaml',
              status: 'draft',
              currentRevision: 0,
              files: [],
              bindings: [],
              createdAt: '2026-05-01T00:00:00Z',
              updatedAt: '2026-05-10T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      }
    }
    if (
      path ===
      '/delivery/manifest-packages?applicationId=app-1&serviceId=svc-api&page=1&pageSize=20'
    ) {
      return {
        data: {
          items: [
            {
              id: 'manifest-1',
              name: 'Checkout ingress',
              applicationId: 'app-1',
              serviceId: 'svc-api',
              renderer: 'raw_yaml',
              status: 'draft',
              currentRevision: 0,
              files: [],
              bindings: [],
              createdAt: '2026-05-01T00:00:00Z',
              updatedAt: '2026-05-10T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      }
    }
    if (path === '/applications/app-1/runtime') {
      if (testState.runtimePending) await new Promise<never>(() => {})
      if (testState.runtimeStatus === 'not-found') {
        throw new ApiError(404, 'application not found')
      }
      if (testState.runtimeStatus === 'error') {
        throw new ApiError(500, 'runtime unavailable')
      }
      const defaultTag = testState.detailWithoutImageTagDefaults ? undefined : 'latest'
      return {
        data: {
          application: {
            id: 'app-1',
            name: 'Checkout Platform',
            key: 'checkout-platform',
            group: 'commerce',
            language: 'go',
            repositoryPath: 'commerce/checkout',
            defaultBranch: 'main',
            defaultTag,
            enabled: true,
            buildSources: [
              {
                id: 'source-api',
                name: 'API Dockerfile',
                type: 'repo_dockerfile',
                enabled: true,
                isDefault: true,
                defaultTag,
                config: {
                  repositoryId: 'repository-api',
                  repositoryBindings: [
                    {
                      repositoryId: 'repository-api',
                      checkoutPath: '.',
                      defaultBranch: 'main',
                      allowCommitSelection: true,
                      submodules: false,
                    },
                    {
                      repositoryId: 'repository-shared',
                      checkoutPath: 'shared',
                      defaultBranch: 'main',
                      allowCommitSelection: false,
                      submodules: true,
                    },
                  ],
                },
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          environments: [
            {
              applicationEnvironmentId: 'binding-test',
              environmentId: 'env-test',
              environmentName: '测试环境',
              requiresApproval: false,
              workloads: [
                {
                  applicationEnvironmentId: 'binding-test',
                  clusterId: 'cluster-a',
                  namespace: 'checkout-test',
                  workloadKind: 'Deployment',
                  workloadName: 'checkout-api',
                  serviceId: 'svc-api',
                  serviceKey: 'api',
                  desiredReplicas: 2,
                  readyReplicas: 2,
                  updatedReplicas: 2,
                  availableReplicas: 2,
                  latestBundle: {
                    id: 'bundle-1',
                    applicationId: 'app-1',
                    applicationEnvironmentId: 'binding-test',
                    version: '1.2.3',
                    sourceType: 'build',
                    status: 'completed',
                    artifactRef: 'registry.example.com/checkout/api:1.2.3',
                    createdAt: '2026-05-10T00:00:00Z',
                    updatedAt: '2026-05-10T00:00:00Z',
                  },
                },
              ],
            },
            ...(testState.runtimeWithProductionEnvironment
              ? [
                  {
                    applicationEnvironmentId: 'binding-production',
                    environmentId: 'env-production',
                    environmentName: '生产环境',
                    requiresApproval: true,
                    workloads: [
                      {
                        applicationEnvironmentId: 'binding-production',
                        clusterId: 'cluster-production',
                        namespace: 'checkout-production',
                        workloadKind: 'StatefulSet',
                        workloadName: 'payments-worker',
                        serviceKey: 'payments',
                        desiredReplicas: 3,
                        readyReplicas: 2,
                        updatedReplicas: 3,
                        availableReplicas: 2,
                      },
                    ],
                  },
                ]
              : []),
            ...(testState.runtimeWithUnavailableEnvironment
              ? [
                  {
                    applicationEnvironmentId: 'binding-down',
                    environmentId: 'env-down',
                    environmentName: '不可用环境',
                    status: 'unavailable',
                    requiresApproval: false,
                    workloads: [],
                  },
                ]
              : []),
          ],
        },
      }
    }
    if (path === '/applications/app-1/detail') {
      const defaultTag = testState.detailWithoutImageTagDefaults ? undefined : 'latest'
      return {
        data: {
          application: {
            id: 'app-1',
            name: 'Checkout Platform',
            key: 'checkout-platform',
            group: 'commerce',
            language: 'go',
            repositoryPath: 'commerce/checkout',
            defaultBranch: 'main',
            defaultTag,
            enabled: true,
            buildSources: [
              {
                id: 'source-api',
                name: 'API Dockerfile',
                type: 'repo_dockerfile',
                enabled: true,
                isDefault: true,
                defaultTag,
                config: {
                  repositoryId: 'repository-api',
                  repositoryBindings: [
                    {
                      repositoryId: 'repository-api',
                      checkoutPath: '.',
                      defaultBranch: 'main',
                      allowCommitSelection: true,
                      submodules: false,
                    },
                    {
                      repositoryId: 'repository-shared',
                      checkoutPath: 'shared',
                      defaultBranch: 'main',
                      allowCommitSelection: false,
                      submodules: true,
                    },
                  ],
                },
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          bindings: [
            {
              applicationEnvironmentId: 'binding-test',
              environmentId: 'env-test',
              environmentName: '测试环境',
              workflowTemplateId: 'wf-template-1',
              workflowTemplateName: 'Release DAG',
              workflowTemplate: testState.detailWithoutWorkflow
                ? undefined
                : {
                    id: 'wf-template-1',
                    key: 'release-dag',
                    name: 'Release DAG',
                    category: 'release',
                    definition: testState.detailWithoutValidationNodes
                      ? {
                          ...workflowDefinition,
                          nodes: workflowDefinition.nodes.filter(
                            (node) =>
                              node.type !== 'check_http' &&
                              node.type !== 'check_k8s_event' &&
                              node.type !== 'smoke_test' &&
                              node.type !== 'verify' &&
                              node.type !== 'check',
                          ),
                        }
                      : {
                          ...workflowDefinition,
                          nodes: [
                            ...workflowDefinition.nodes,
                            {
                              id: 'verify',
                              type: 'verify',
                              name: 'AI 回归验证',
                              executorKind: 'mcp',
                              targetKind: 'ai_test',
                              capabilityRef: 'testing.ui.run',
                              providerRef: 'external-test-platform',
                              artifactKinds: ['test_report', 'screenshot', 'junit'],
                              config: { url: 'https://example.com/healthz' },
                            },
                          ],
                        },
                  },
              targetCount: 1,
              targets: [
                {
                  id: 'target-1',
                  applicationEnvironmentId: 'binding-test',
                  clusterId: 'cluster-a',
                  namespace: 'checkout-test',
                  workloadKind: 'Deployment',
                  workloadName: 'checkout-api',
                  containerName: 'api',
                  enabled: true,
                },
              ],
              latestBundle: {
                id: 'bundle-1',
                applicationId: 'app-1',
                applicationEnvironmentId: 'binding-test',
                version: '1.2.3',
                sourceType: 'build',
                status: 'completed',
                artifactRef: 'registry.example.com/checkout/api:1.2.3',
                artifactDigest: 'sha256:abc',
                createdAt: '2026-05-10T00:00:00Z',
                updatedAt: '2026-05-10T00:00:00Z',
              },
              latestExecutionTask: {
                id: 'task-1',
                applicationId: 'app-1',
                releaseBundleId: 'bundle-1',
                taskKind: 'build_release',
                providerKind: 'ci_agent_runner',
                targetKind: 'k8s_workload',
                status: 'completed',
                maxRetries: 1,
                attemptCount: 1,
                timeoutSeconds: 600,
                artifacts: [
                  {
                    kind: 'image',
                    name: 'checkout-api',
                    ref: 'registry.example.com/checkout/api:1.2.3',
                  },
                ],
                createdAt: '2026-05-10T00:00:00Z',
                updatedAt: '2026-05-10T00:00:00Z',
              },
              latestBuild: {
                id: 'build-1',
                applicationId: 'app-1',
                sourceSystem: 'application',
                status: 'completed',
                createdAt: '2026-05-10T00:00:00Z',
              },
              latestWorkflow: {
                id: 'workflow-1',
                applicationId: 'app-1',
                workflowName: 'release-dag',
                status: 'completed',
                steps: [],
                nodeRuns: [
                  {
                    nodeId: 'approval',
                    name: '审批',
                    type: 'manual_approval',
                    status: 'completed',
                  },
                  {
                    nodeId: 'deploy',
                    name: '更新镜像',
                    type: 'deploy_update_image',
                    status: 'completed',
                  },
                ],
                metadata: { nodes: workflowDefinition.nodes },
                createdAt: '2026-05-10T00:00:00Z',
                updatedAt: '2026-05-10T00:00:00Z',
              },
              latestRelease: {
                id: 'release-1',
                applicationId: 'app-1',
                clusterId: 'cluster-a',
                namespace: 'checkout-test',
                deploymentName: 'checkout-api',
                status: 'completed',
                createdAt: '2026-05-10T00:00:00Z',
              },
            },
          ],
          latestBundle: {
            id: 'bundle-1',
            applicationId: 'app-1',
            applicationEnvironmentId: 'binding-test',
            version: '1.2.3',
            sourceType: 'build',
            status: 'completed',
            artifactRef: 'registry.example.com/checkout/api:1.2.3',
            artifactDigest: 'sha256:abc',
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          latestExecutionTask: {
            id: 'task-1',
            applicationId: 'app-1',
            releaseBundleId: 'bundle-1',
            taskKind: 'build_release',
            providerKind: 'ci_agent_runner',
            targetKind: 'k8s_workload',
            status: 'completed',
            maxRetries: 1,
            attemptCount: 1,
            timeoutSeconds: 600,
            artifacts: [
              {
                kind: 'image',
                name: 'checkout-api',
                ref: 'registry.example.com/checkout/api:1.2.3',
              },
            ],
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          latestBuild: {
            id: 'build-1',
            applicationId: 'app-1',
            sourceSystem: 'application',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
          latestWorkflow: {
            id: 'workflow-1',
            applicationId: 'app-1',
            workflowName: 'release-dag',
            status: 'completed',
            steps: [],
            nodeRuns: [
              { nodeId: 'approval', name: '审批', type: 'manual_approval', status: 'completed' },
              {
                nodeId: 'deploy',
                name: '更新镜像',
                type: 'deploy_update_image',
                status: 'completed',
              },
            ],
            metadata: { nodes: workflowDefinition.nodes },
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
          latestRelease: {
            id: 'release-1',
            applicationId: 'app-1',
            clusterId: 'cluster-a',
            namespace: 'checkout-test',
            deploymentName: 'checkout-api',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
        },
      }
    }
    if (path === '/applications/app-1/services') {
      return {
        data: [
          {
            id: 'svc-api',
            applicationId: 'app-1',
            key: 'api',
            name: 'Checkout API',
            serviceKind: 'kubernetes_workload',
            ownerTeam: 'checkout-dev',
            repositoryPath: 'commerce/checkout/api',
            buildSourceId: 'source-api',
            enabled: true,
            containers: [
              {
                id: 'svc-api:api',
                serviceId: 'svc-api',
                name: 'api',
                imageRepository: 'registry.example.com/checkout/api',
                runtimePorts: [8080],
              },
            ],
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/repositories?applicationId=app-1') {
      if (testState.createdRepository) return { data: [testState.createdRepository] }
      if (testState.repositoriesEmpty) return { data: [] }
      return {
        data: [
          {
            id: 'repository-api',
            name: 'checkout-api',
            provider: 'gitlab',
            protocol: 'https',
            url: 'https://git.example.com/commerce/checkout-api.git',
            path: 'commerce/checkout-api',
            defaultBranch: 'main',
            applicationIds: ['app-1'],
          },
          {
            id: 'repository-shared',
            name: 'checkout-shared',
            provider: 'git',
            protocol: 'ssh',
            url: 'git@git.example.com:commerce/checkout-shared.git',
            path: 'commerce/checkout-shared',
            defaultBranch: 'main',
            applicationIds: ['app-1'],
          },
        ],
      }
    }
    if (path === '/integrations/gitlab/projects') {
      return {
        items: testState.gitProjectsEmpty
          ? []
          : [
              {
                id: 'gitlab-project-1',
                name: 'checkout-imported',
                path: 'checkout-imported',
                pathWithNamespace: 'commerce/checkout-imported',
                defaultBranch: 'main',
                webUrl: 'https://git.example.com/commerce/checkout-imported.git',
              },
            ],
        data: undefined,
      }
    }
    if (path === '/integrations/gitlab/branches?projectId=gitlab-project-1') {
      return { items: [{ name: 'main', commitSha: 'abc123' }], data: undefined }
    }
    if (path === '/build-templates') {
      return {
        data: [
          {
            id: 'build-template-1',
            key: 'container-standard',
            name: '标准容器构建',
            buildCommands: ['docker build .'],
            variableSchema: {},
            defaultVariables: {},
            enabled: true,
          },
        ],
      }
    }
    if (path === '/delivery/release-bundles/bundle-1/artifacts') {
      return {
        data: [
          {
            id: 'artifact-1',
            releaseBundleId: 'bundle-1',
            applicationId: 'app-1',
            kind: 'image',
            name: 'checkout-api',
            ref: 'registry.example.com/checkout/api:1.2.3',
            digest: 'sha256:abc',
            status: 'completed',
          },
        ],
      }
    }
    if (path === '/delivery/execution-tasks/task-1/artifacts') {
      return {
        data: [
          {
            id: 'artifact-2',
            executionTaskId: 'task-1',
            applicationId: 'app-1',
            kind: 'image',
            name: 'checkout-api',
            ref: 'registry.example.com/checkout/api:1.2.3',
            digest: 'sha256:abc',
            status: 'completed',
          },
        ],
      }
    }
    if (path === '/builds?applicationId=app-1') {
      return {
        items: [
          {
            id: 'build-1',
            applicationId: 'app-1',
            sourceSystem: 'application',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/builds') {
      return {
        items: [
          {
            id: 'build-1',
            applicationId: 'app-1',
            sourceSystem: 'application',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/releases?applicationId=app-1') {
      return {
        items: [
          {
            id: 'release-1',
            applicationId: 'app-1',
            clusterId: 'cluster-a',
            namespace: 'checkout-test',
            deploymentName: 'checkout-api',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/releases') {
      return {
        items: [
          {
            id: 'release-1',
            applicationId: 'app-1',
            clusterId: 'cluster-a',
            namespace: 'checkout-test',
            deploymentName: 'checkout-api',
            status: 'completed',
            createdAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/workflows?applicationId=app-1') {
      return {
        items: [
          {
            id: 'workflow-1',
            applicationId: 'app-1',
            workflowName: 'release-dag',
            status: 'completed',
            steps: [],
            nodeRuns: [
              { nodeId: 'approval', name: '审批', type: 'manual_approval', status: 'completed' },
              {
                nodeId: 'deploy',
                name: '更新镜像',
                type: 'deploy_update_image',
                status: 'completed',
              },
            ],
            metadata: { nodes: workflowDefinition.nodes },
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/workflows') {
      return {
        items: [
          {
            id: 'workflow-1',
            applicationId: 'app-1',
            workflowName: 'release-dag',
            status: 'completed',
            steps: [],
            nodeRuns: [
              { nodeId: 'approval', name: '审批', type: 'manual_approval', status: 'completed' },
              {
                nodeId: 'deploy',
                name: '更新镜像',
                type: 'deploy_update_image',
                status: 'completed',
              },
            ],
            metadata: { nodes: workflowDefinition.nodes },
            createdAt: '2026-05-10T00:00:00Z',
            updatedAt: '2026-05-10T00:00:00Z',
          },
        ],
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
}))

const defaultPermissionKeys = [
  'delivery.applications.view',
  'delivery.application.update',
  'delivery.application-environments.create',
  'delivery.application-environments.update',
  'delivery.application-environments.delete',
  'delivery.application-services.view',
  'delivery.application-services.create',
  'delivery.application-services.update',
  'delivery.application-services.delete',
  'delivery.builds.trigger',
  'delivery.workflows.trigger',
  'delivery.releases.trigger',
  'access.scope-grants.view',
  'access.users.view',
]

const readonlyPermissionKeys = [
  'delivery.applications.view',
  'delivery.application-environments.view',
  'delivery.application-services.view',
]

vi.mock('@/features/auth/permission-snapshot', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, key: string) =>
    snapshot?.permissionKeys?.includes(key) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: testState.permissionSnapshot },
    isLoading: false,
  }),
}))

vi.mock('@/features/observability', () => ({
  LogExplorer: () => null,
}))

vi.mock('@/components/pod-terminal', () => ({
  PodTerminal: () => null,
}))

vi.mock('@/components/resource-metrics-panel', () => ({
  ResourceMetricsPanel: () => null,
}))

vi.mock('@/components/release-flow-dag-editor', () => ({
  ReleaseFlowDagEditor: ({ initialDefinition }: { initialDefinition: { nodes: unknown[] } }) => (
    <div data-testid="release-flow-dag-editor">{`${initialDefinition.nodes.length} 个节点`}</div>
  ),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: async (path: string) => {
      const body = await testState.apiGet(path)
      if (body && typeof body === 'object' && 'items' in body && !('data' in body)) {
        return { data: (body as { items: unknown }).items }
      }
      return body
    },
    getEnvelope: async (path: string) => testState.apiGet(path),
    post: vi.fn(async (path: string, body?: unknown) => {
      if (path === '/repositories') {
        const repository = {
          id: 'repository-imported',
          ...(body as Record<string, unknown>),
        }
        testState.createdRepository = repository
        return { data: repository }
      }
      if (path === '/delivery/plans') {
        const payload = body as Record<string, unknown>
        const plan = {
          id: 'plan-1',
          source: 'manual',
          status: 'draft',
          applicationId: payload.applicationId,
          applicationName: 'Checkout Platform',
          applicationEnvironmentId: payload.applicationEnvironmentId,
          environmentKey: 'test',
          action: payload.action,
          targetId: payload.targetId,
          targetSummary: 'cluster-a / checkout-test / checkout-api',
          buildSourceId: payload.buildSourceId,
          refType: payload.refType,
          refName: payload.refName,
          imageTag: payload.imageTag,
          riskLevel: payload.action === 'build' ? 'low' : 'medium',
          requiresApproval: payload.action !== 'build',
          impact: { applicationId: payload.applicationId, action: payload.action },
          rollbackStrategy:
            payload.action === 'build'
              ? 'Build only; no runtime rollback required.'
              : 'Use rollback context if rollout fails.',
          createdAt: '2026-05-10T01:00:00Z',
          updatedAt: '2026-05-10T01:00:00Z',
        }
        testState.lastDeliveryPlan = plan
        return { data: plan }
      }
      if (path === '/delivery/plans/plan-1/confirm') {
        const plan = testState.lastDeliveryPlan ?? {}
        return {
          data: {
            plan: {
              ...plan,
              status: 'confirmed',
              confirmedAt: '2026-05-10T01:01:00Z',
              updatedAt: '2026-05-10T01:01:00Z',
            },
            result: {
              action: plan.action ?? 'build',
              applicationId: plan.applicationId ?? 'app-1',
              applicationEnvironmentId: plan.applicationEnvironmentId ?? 'binding-test',
              relatedIds: { executionTaskId: 'task-planned' },
            },
          },
        }
      }
      return { data: { id: 'ok', path, body } }
    }),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

async function renderWithProviders(node: ReactNode, route = '/applications/app-1') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  await act(async () => {
    root.render(
      <I18nProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route
                  path="/applications/:applicationId/workflows/design"
                  element={
                    <>
                      {node}
                      <LocationProbe />
                    </>
                  }
                />
                <Route
                  path="/applications/:applicationId"
                  element={
                    <>
                      {node}
                      <LocationProbe />
                    </>
                  }
                />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AntApp>
      </I18nProvider>,
    )
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  return container
}

function clickTab(container: HTMLElement, text: string) {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find((item) =>
    item.textContent?.includes(text),
  ) as HTMLElement | undefined
  if (!tab) {
    throw new Error(`tab not found: ${text}`)
  }
  act(() => {
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

function findButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  ) as HTMLButtonElement | undefined
  if (!button) {
    throw new Error(`button not found: ${text}`)
  }
  return button
}

function findModal(text: string) {
  const modal = Array.from(document.body.querySelectorAll<HTMLElement>('.ant-modal')).find((item) =>
    item.textContent?.includes(text),
  )
  if (!modal) {
    throw new Error(`modal not found: ${text}`)
  }
  return modal
}

describe('ApplicationDetailPage workbench', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ localeCode: 'zh_CN' })
    testState.apiGet.mockClear()
    testState.permissionSnapshot.permissionKeys = [...defaultPermissionKeys]
    testState.detailWithoutWorkflow = false
    testState.detailWithoutValidationNodes = false
    testState.detailWithoutImageTagDefaults = false
    testState.deliveryActionsAgentStatus = 'available'
    testState.deliveryClusterConnectionMode = 'direct_kubeconfig'
    testState.runtimeStatus = 'ok'
    testState.runtimePending = false
    testState.runtimeWithProductionEnvironment = false
    testState.runtimeWithUnavailableEnvironment = false
    testState.repositoriesEmpty = false
    testState.gitProjectsEmpty = false
    testState.createdRepository = undefined
    vi.mocked(api.post).mockClear()
    vi.mocked(api.put).mockClear()
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn().mockReturnValue({
        width: '0px',
        height: '0px',
        overflow: 'auto',
        getPropertyValue: () => '',
      }),
    })

    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) root.unmount()
    })
    roots = []
    for (const container of containers) container.remove()
    containers = []
    vi.clearAllMocks()
  })

  it('renders overview, service, environment and delivery workspaces', async () => {
    const container = await renderWithProviders(<ApplicationDetailPage />)

    expect(testState.apiGet).toHaveBeenCalledWith('/applications/app-1/runtime')
    expect(testState.apiGet).toHaveBeenCalledWith('/applications/app-1/detail')
    expect(testState.apiGet).toHaveBeenCalledWith('/applications/app-1/services')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/applications')
    expect(testState.apiGet).toHaveBeenCalledWith('/application-environments')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/workflow-templates')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/clusters')
    expect(container.querySelector('.soha-management-detail-header')).toBeNull()
    expect(container.textContent).not.toContain(
      '围绕应用查看服务组件、容器、环境运行态和交付入口。',
    )
    expect(container.textContent).not.toContain('返回应用中心')
    const page = container.querySelector('.soha-page')
    const tabs = container.querySelector('.soha-page > .ant-tabs')
    const overviewPane = container.querySelector('[role="tabpanel"][aria-hidden="false"]')
    expect(page?.firstElementChild).toBe(tabs)
    expect(tabs?.classList.contains('soha-resource-tabs')).toBe(true)
    expect(
      Array.from(
        container.querySelectorAll('.soha-page > .ant-tabs > .ant-tabs-nav .ant-tabs-tab'),
      ).map((tab) => tab.textContent),
    ).toEqual(['概览', '工作流', '服务', '测试', '扩展资源', '服务配置', '权限', '交付能力'])
    expect(overviewPane?.querySelector('.soha-application-runtime-service-summary')).toBeNull()
    expect(overviewPane?.querySelector('.soha-application-delivery-actions')).toBeNull()
    expect(overviewPane?.querySelector('.soha-application-section-tabs')).toBeNull()
    expect(
      overviewPane?.querySelector('.soha-application-overview-list--environments'),
    ).not.toBeNull()
    expect(overviewPane?.querySelector('.soha-application-overview-list--workflows')).not.toBeNull()
    expect(overviewPane?.querySelector('.ant-table')).toBeNull()
    expect(container.textContent).toContain('环境信息')
    expect(container.textContent).toContain('工作流信息')
    expect(container.textContent).toContain('测试环境')
    expect(container.textContent).toContain('env-test')
    expect(container.textContent).toContain('Release DAG')
    expect(container.textContent).toContain('release-dag')
    expect(container.textContent).not.toContain('新建服务')
    expect(container.textContent).not.toContain('交付操作')

    clickTab(container, '服务')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).not.toContain('服务 Workload')
    expect(container.textContent).not.toContain('新建服务')
    expect(container.querySelector('.soha-application-service-environment-grid')).not.toBeNull()
    expect(container.querySelector('.soha-application-service-environment-tabs')).toBeNull()
    expect(container.textContent).toContain('集成测试')
    expect(container.textContent).toContain('cluster-a')
    expect(container.textContent).toContain('checkout-test')
    expect(findButton(container, '新增环境')).not.toBeNull()
    expect(container.textContent).toContain('Deployment')
    expect(container.textContent).toContain('checkout-api')
    expect(container.textContent).toContain('运行正常')
    expect(container.textContent).toContain('Pod 就绪')
    expect(container.textContent).toContain('镜像 / 版本')
    expect(container.textContent).toContain('1.2.3')
    expect(container.textContent).toContain('checkout-dev')
    expect(container.textContent).toContain('部署位置')
    expect(container.querySelector('.soha-application-service-workload-summary')).toBeNull()
    expect(container.querySelector('.soha-application-service-workload-list')).toBeNull()
    expect(
      container.querySelector('.soha-application-service-runtime-panel.ant-card'),
    ).not.toBeNull()
    expect(container.querySelector('ul.soha-application-service-runtime-list')).not.toBeNull()
    expect(container.querySelector('.soha-application-service-runtime-list .ant-list')).toBeNull()
    expect(container.querySelector('.soha-application-service-runtime-list .ant-table')).toBeNull()
    expect(container.querySelector('.soha-application-service-runtime-item')).not.toBeNull()
    expect(container.querySelector('[aria-label="查看 checkout-api Pod 与诊断"]')).not.toBeNull()

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="查看服务详情"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const serviceDrawer = document.body.querySelector<HTMLElement>('.ant-drawer')!
    expect(serviceDrawer.textContent).toContain('Checkout API')
    expect(serviceDrawer.textContent).toContain('基本信息')
    expect(serviceDrawer.textContent).toContain('构建')
    expect(serviceDrawer.textContent).toContain('部署')
    expect(serviceDrawer.textContent).toContain('扩展资源')
    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain(
      'serviceId=svc-api',
    )

    clickTab(serviceDrawer, '扩展资源')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(testState.apiGet).toHaveBeenCalledWith(
      '/delivery/manifest-packages?applicationId=app-1&serviceId=svc-api&page=1&pageSize=20',
    )

    clickTab(container, '扩展资源')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(testState.apiGet).toHaveBeenCalledWith(
      '/delivery/manifest-packages?applicationId=app-1&page=1&pageSize=20',
    )
    expect(container.textContent).toContain('Checkout ingress')
    expect(container.textContent).toContain('Checkout API')
    expect(container.textContent).toContain('新建清单包')
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/applications/app-1?tab=resources',
    )

    clickTab(container, '概览')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(
      container.querySelector('[role="tabpanel"][aria-hidden="false"] .soha-application-overview'),
    ).not.toBeNull()
    clickTab(container, '服务配置')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('服务配置')
    expect(container.textContent).toContain('新建服务')
    expect(container.textContent).toContain('编辑应用档案')
    expect(container.textContent).toContain('构建来源')
    expect(container.textContent).toContain('环境绑定')
    expect(container.textContent).toContain('新建绑定')
    expect(container.querySelector('.soha-application-runtime-settings-grid')).not.toBeNull()

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="查看运行态"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/applications/app-1?tab=services&applicationEnvironmentId=binding-test',
    )

    clickTab(container, '权限')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('应用环境授权')
    expect(testState.apiGet).toHaveBeenCalledWith('/access/scope-grants')
    expect(container.textContent).toContain('授权主体')
    expect(container.textContent).toContain('Release Owner')
    expect(container.textContent).toContain('应用默认')
    expect(container.textContent).toContain('release-manager')
    expect(container.textContent).toContain('允许')
    expect(container.textContent).toContain('当前操作者权限')
    expect(container.textContent).not.toContain('选择用户')
    expect(container.textContent).not.toContain('管理授权')
    expect(container.textContent).toContain('权限快照')
    expect(container.textContent).toContain('构建: 允许')
    expect(container.textContent).toContain('环境授权上下文')

    clickTab(container, '工作流')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('1 个已创建工作流')
    expect(container.textContent).toContain('创建工作流')
    expect(container.textContent).toContain('release-dag')
    expect(container.querySelector('.soha-application-runtime-pipeline-grid')).not.toBeNull()
    expect(container.querySelectorAll('.soha-application-runtime-binding-row')).toHaveLength(1)
    expect(container.textContent).not.toContain('版本包')
    expect(container.textContent).not.toContain('构建 / 发布记录')
    expect(container.textContent).not.toContain('最近工作流运行')

    await act(async () => {
      findButton(container, '创建工作流').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const createWorkflowModal = Array.from(
      document.body.querySelectorAll<HTMLElement>('.ant-modal'),
    ).find((modal) => modal.textContent?.includes('创建工作流'))!
    expect(createWorkflowModal.textContent).toContain('空白画布')
    expect(createWorkflowModal.textContent).toContain('从模板开始')
    expect(createWorkflowModal.textContent).toContain('自行添加构建、部署、测试与审批节点')
    expect(createWorkflowModal.textContent).toContain('复制平台模板作为起点，创建后可独立编辑')
    expect(createWorkflowModal.textContent).not.toContain('发布流程模板设置')
    expect(
      createWorkflowModal.querySelector('.soha-application-workflow-source-options'),
    ).not.toBeNull()
    expect(findButton(createWorkflowModal, '创建工作流')).not.toBeNull()
    expect(createWorkflowModal.textContent).not.toContain('进入画布')
    const templateChoice = Array.from(
      createWorkflowModal.querySelectorAll<HTMLElement>('label, [role="radio"]'),
    ).find((item) => item.textContent?.includes('从模板开始'))!
    await act(async () => {
      templateChoice.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(testState.apiGet).toHaveBeenCalledWith('/workflow-templates')
    expect(createWorkflowModal.textContent).toContain('起始模板')
    expect(createWorkflowModal.textContent).toContain('选择模板创建工作流')
    await act(async () => {
      createWorkflowModal
        .querySelector<HTMLButtonElement>('.ant-modal-close')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      findButton(container, '运行').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const workflowModal = Array.from(
      document.body.querySelectorAll<HTMLElement>('.ant-modal'),
    ).find((modal) => modal.textContent?.includes('运行工作流'))!
    expect(workflowModal.textContent).toContain('运行工作流')
    expect(workflowModal.textContent).toContain('服务 / Workload')
    expect(workflowModal.textContent).toContain('运行版本')
    await act(async () => {
      workflowModal
        .querySelector<HTMLButtonElement>('.ant-modal-close')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    clickTab(container, '测试')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('测试门禁')
    expect(container.textContent).toContain('DAG 节点数')
    expect(container.querySelector('.soha-application-runtime-verification-grid')).not.toBeNull()

    clickTab(container, '交付能力')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('能力就绪')
    expect(container.textContent).toContain('Workflow Capability Refs')
    expect(container.textContent).toContain('testing.ui.run')
    expect(container.textContent).toContain('external-test-platform')
    expect(container.textContent).toContain('外部 AI 测试平台尚未接入')

    clickTab(container, '概览')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('环境信息')
    expect(container.textContent).toContain('工作流信息')
    expect(container.querySelector('.soha-application-overview')).not.toBeNull()
  })

  it('opens a project canvas from a reusable template and saves an application workflow', async () => {
    const container = await renderWithProviders(
      <ApplicationWorkflowDesignerPage />,
      '/applications/app-1/workflows/design?bindingId=binding-test&source=template&templateId=wf-template-1&name=测试发布',
    )

    expect(container.textContent).toContain('项目工作流设计')
    expect(container.textContent).toContain('基于 Release DAG')
    expect(container.querySelector('[data-testid="release-flow-dag-editor"]')?.textContent).toBe(
      '2 个节点',
    )
    vi.mocked(api.put).mockResolvedValueOnce({ data: { id: 'binding-test' } } as never)

    await act(async () => {
      findButton(container, '保存工作流').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).not.toHaveBeenCalledWith('/workflow-templates', expect.anything())
    expect(api.put).toHaveBeenCalledWith(
      '/applications/app-1/application-environments/binding-test/workflow',
      {
        name: '测试发布',
        description: '应用内工作流',
        definition: workflowDefinition,
        enabled: true,
      },
    )
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/applications/app-1?tab=delivery',
    )
  })

  it('localizes the application workflow designer in English', async () => {
    usePreferencesStore.setState({ localeCode: 'en_US' })
    const container = await renderWithProviders(
      <ApplicationWorkflowDesignerPage />,
      '/applications/app-1/workflows/design?bindingId=binding-test&source=template&templateId=wf-template-1',
    )

    expect(container.textContent).toContain('Application workflow designer')
    expect(container.textContent).toContain('Based on Release DAG')
    expect(findButton(container, 'Save workflow')).not.toBeNull()
    expect(container.textContent).not.toContain('项目工作流设计')
  })

  it('renders the application workspace while runtime query is pending', async () => {
    testState.runtimePending = true

    const container = await renderWithProviders(<ApplicationDetailPage />)

    expect(container.querySelector('.soha-page > .soha-resource-tabs')).not.toBeNull()
    expect(
      Array.from(container.querySelectorAll('.soha-page > .ant-tabs .ant-tabs-tab')).map(
        (tab) => tab.textContent,
      ),
    ).toEqual(['概览', '工作流', '服务', '测试', '扩展资源', '服务配置', '权限', '交付能力'])
    expect(container.querySelector('.ant-tabs-tab-active')?.textContent).toBe('概览')
    expect(container.querySelector('.soha-application-overview')).not.toBeNull()
    expect(container.textContent).toContain('正在加载运行态')
    expect(container.textContent).toContain('Release DAG')
    expect(container.textContent).not.toContain('正在加载应用')
    expect(container.querySelector('.soha-page > .soha-management-state')).toBeNull()

    clickTab(container, '服务')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('Checkout API')
    expect(container.textContent).toContain('读取中')
    expect(container.textContent).not.toContain('未部署')
  })

  it('filters services by the selected environment', async () => {
    testState.runtimeWithProductionEnvironment = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=services',
    )

    expect(container.querySelector('[aria-label="查看 checkout-api Pod 与诊断"]')).not.toBeNull()
    expect(container.textContent).not.toContain('payments-worker')

    const environmentSwitcher = container.querySelector(
      '.soha-application-service-environment-grid',
    ) as HTMLElement
    expect(environmentSwitcher).not.toBeNull()
    expect(environmentSwitcher.querySelectorAll('[aria-pressed]')).toHaveLength(2)
    expect(container.querySelector('.soha-application-service-environment-select')).toBeNull()

    const productionOption = Array.from(
      environmentSwitcher.querySelectorAll<HTMLElement>('[aria-pressed]'),
    ).find((item) => item.textContent?.includes('生产环境')) as HTMLElement
    await act(async () => {
      productionOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('payments-worker')
    expect(container.querySelector('[aria-label="查看 checkout-api Pod 与诊断"]')).toBeNull()
    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain(
      'applicationEnvironmentId=binding-production',
    )
  })

  it('shows cluster-unavailable environments instead of treating them as undeployed', async () => {
    testState.runtimeWithUnavailableEnvironment = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=services',
    )

    expect(container.textContent).toContain('不可用环境')
    expect(container.textContent).toContain('集群不可用')
  })

  it('creates an application environment from the service context switcher', async () => {
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=services',
    )

    expect(testState.apiGet).not.toHaveBeenCalledWith('/delivery/environments')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/registries')

    await act(async () => {
      findButton(container, '新增环境').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/environments')
    expect(testState.apiGet).toHaveBeenCalledWith('/registries')
    const modal = findModal('新增环境')
    expect(modal.textContent).toContain('新增环境')
    expect(modal.textContent).toContain('环境目录')
    expect(modal.textContent).toContain('环境别名')
    expect(modal.textContent).toContain('集群')
    expect(modal.textContent).toContain('Namespace')
    expect(modal.textContent).toContain('镜像仓库')
    expect(modal.textContent).toContain('发布目标')
  })

  it('keeps repository, build definition, and artifact output in service configuration', async () => {
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=application',
    )

    expect(container.querySelector('.ant-tabs-tab-active')?.textContent).toBe('服务配置')
    expect(container.textContent).toContain('服务 → Git 仓库 → 构建定义 → 产物镜像')

    await act(async () => {
      findButton(container, '新建服务').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const serviceDrawer = document.querySelector('.ant-drawer') as HTMLElement
    expect(serviceDrawer.textContent).toContain('新建服务组件')
    expect(serviceDrawer.textContent).toContain('基础信息')
    expect(serviceDrawer.textContent).toContain('源码仓库')
    expect(serviceDrawer.textContent).toContain('构建定义')
    expect(serviceDrawer.textContent).toContain('添加构建')
    expect(serviceDrawer.textContent).toContain('编辑构建')
    expect(serviceDrawer.textContent).toContain('checkout-shared')
    expect(serviceDrawer.textContent).toContain('Submodule')
    expect(serviceDrawer.textContent).toContain('构建步骤')
    expect(serviceDrawer.textContent).toContain('产物容器')
    expect(serviceDrawer.textContent).toContain('产物镜像仓库')

    await act(async () => {
      serviceDrawer
        .querySelector<HTMLElement>('.ant-drawer-close')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      findButton(container, '添加构建').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const buildModal = findModal('构建方式')
    expect(buildModal.textContent).toContain('构建方式')
    expect(buildModal.textContent).toContain('源码仓库')
    expect(buildModal.textContent).toContain('添加检出项')
    expect(buildModal.textContent).toContain('运行时允许选择 Commit')
    expect(buildModal.textContent).toContain('拉取 Git Submodule')
    expect(buildModal.textContent).toContain('产物镜像')
    expect(buildModal.textContent).toContain('Dockerfile')
    expect(buildModal.textContent).toContain('构建完成后自动推送产物镜像')
  })

  it('connects a configured source repository and selects it for the current checkout', async () => {
    testState.repositoriesEmpty = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=application',
    )

    await act(async () => {
      findButton(container, '添加构建').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const buildModal = findModal('已接入仓库')
    expect(buildModal.textContent).toContain('已接入仓库')
    expect(buildModal.textContent).toContain('从代码源接入')

    await act(async () => {
      findButton(buildModal, '从代码源接入').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const repositoryModals = Array.from(document.querySelectorAll<HTMLElement>('.ant-modal'))
    const repositoryModal = repositoryModals[repositoryModals.length - 1]!
    expect(repositoryModal.textContent).toContain('从代码源接入仓库')
    expect(repositoryModal.textContent).toContain('代码源仓库')
    expect(testState.apiGet).toHaveBeenCalledWith('/integrations/gitlab/projects')

    await act(async () => {
      repositoryModal
        .querySelector<HTMLInputElement>('#gitlabProjectId')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const projectOption = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
    ).find((item) => item.textContent?.includes('commerce/checkout-imported'))!
    await act(async () => {
      projectOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      const currentRepositoryModal = Array.from(
        document.querySelectorAll<HTMLElement>('.ant-modal'),
      ).find((modal) => modal.textContent?.includes('从代码源接入仓库'))!
      currentRepositoryModal
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).toHaveBeenCalledWith(
      '/repositories',
      expect.objectContaining({
        gitlabProjectId: 'gitlab-project-1',
        applicationIds: ['app-1'],
      }),
    )
    expect(buildModal.textContent).toContain('checkout-imported · commerce/checkout-imported')
    expect(buildModal.querySelector<HTMLInputElement>('input[id$="_defaultBranch"]')?.value).toBe(
      'main',
    )
  })

  it('explains when a saved code source has no authorized repositories', async () => {
    testState.repositoriesEmpty = true
    testState.gitProjectsEmpty = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=application',
    )

    await act(async () => {
      findButton(container, '添加构建').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const buildModal = findModal('已接入仓库')
    await act(async () => {
      findButton(buildModal, '从代码源接入').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const repositoryModals = Array.from(document.querySelectorAll<HTMLElement>('.ant-modal'))
    const repositoryModal = repositoryModals[repositoryModals.length - 1]!
    await act(async () => {
      repositoryModal
        .querySelector<HTMLInputElement>('#gitlabProjectId')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.body.textContent).toContain('没有可用仓库，请确认代码源已启用并完成授权')
    expect(findButton(document.body, '检查代码源设置')).not.toBeNull()
  })

  it('ignores stale evidence params without loading evidence panels', async () => {
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery&buildId=build-1',
    )

    expect(testState.apiGet).not.toHaveBeenCalledWith('/builds?applicationId=app-1')
    expect(container.querySelector('.soha-page > .ant-alert')).toBeNull()
    expect(container.textContent).not.toContain('交付证据定位')
    expect(container.querySelector('.ant-tabs-tab-active')?.textContent).toBe('工作流')
    expect(container.textContent).toContain('Release DAG')
    expect(container.textContent).not.toContain('构建 / 发布记录')
  })

  it('creates and confirms a DeliveryPlan when a workflow is run', async () => {
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )
    await act(async () => {
      findButton(container, '运行').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      findButton(document.body, '运行工作流').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).toHaveBeenCalledWith(
      '/delivery/plans',
      expect.objectContaining({
        applicationId: 'app-1',
        action: 'build_deploy',
        applicationEnvironmentId: 'binding-test',
        targetId: 'target-1',
        buildSourceId: 'source-api',
        refType: 'branch',
        refName: 'main',
        repositoryRefs: [
          { repositoryId: 'repository-api', refType: 'branch', refName: 'main' },
          { repositoryId: 'repository-shared', refType: 'branch', refName: 'main' },
        ],
      }),
    )
    expect(api.post).not.toHaveBeenCalledWith(
      '/applications/app-1/delivery-actions',
      expect.anything(),
    )
    expect(document.body.textContent).toContain('交付计划确认')
    expect(document.body.textContent).toContain('确认前不会触发执行')

    await act(async () => {
      findButton(document.body, '确认执行').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).toHaveBeenCalledWith('/delivery/plans/plan-1/confirm', {})
    expect(document.body.textContent).toContain('计划已确认并触发执行')
  })

  it('persists flat tabs in the URL', async () => {
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=capabilities',
    )
    const location = container.querySelector('[data-testid="location"]') as HTMLOutputElement

    expect(container.textContent).toContain('能力就绪')
    expect(location.textContent).toContain('tab=capabilities')

    clickTab(container, '权限')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(location.textContent).toContain('tab=permissions')

    clickTab(container, '工作流')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(location.textContent).toContain('tab=delivery')
  })

  it.each(['not-found', 'error'] as const)(
    'keeps the application workspace available for %s runtime failures',
    async (runtimeStatus) => {
      testState.runtimeStatus = runtimeStatus
      const container = await renderWithProviders(<ApplicationDetailPage />)

      expect(container.querySelector('.soha-application-overview')).not.toBeNull()
      expect(container.textContent).toContain('运行态加载失败')
      expect(container.textContent).toContain('应用基础信息仍可使用')
      expect(findButton(container, '重试运行态')).not.toBeNull()
      expect(container.textContent).not.toContain('应用不存在')
      expect(container.textContent).not.toContain('应用加载失败')
    },
  )

  it('disables target delivery actions for agent clusters without delivery runner parity', async () => {
    testState.deliveryClusterConnectionMode = 'agent'
    testState.deliveryActionsAgentStatus = 'partial'

    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )

    await act(async () => {
      findButton(container, '运行').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const runButton = findButton(document.body, '运行工作流')

    expect(document.body.textContent).toContain('当前集群连接模式仅部分支持该能力')
    expect(runButton.disabled).toBe(true)

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).not.toHaveBeenCalledWith('/delivery/plans', expect.anything())
    expect(api.post).not.toHaveBeenCalledWith(
      '/applications/app-1/delivery-actions',
      expect.anything(),
    )
  })

  it('disables running when the workflow template is missing', async () => {
    testState.detailWithoutWorkflow = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )

    expect(findButton(container, '运行').disabled).toBe(true)
  })

  it('disables running for readonly users', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )

    const runButton = findButton(container, '运行')
    expect(runButton.disabled).toBe(true)

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(api.post).not.toHaveBeenCalledWith('/delivery/plans', expect.anything())
    expect(api.post).not.toHaveBeenCalledWith(
      '/applications/app-1/delivery-actions',
      expect.anything(),
    )
  })

  it('hides workflow and build editing controls for readonly users', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const workflowContainer = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )
    const workflowPanel = workflowContainer.querySelector('.soha-application-workflow-list')!
    const workflowButtons = Array.from(workflowPanel.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    )

    expect(workflowButtons).not.toContain('创建工作流')
    expect(workflowButtons).not.toContain('设计')

    const serviceContainer = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=services&serviceId=svc-api',
    )
    const serviceDrawer = serviceContainer.ownerDocument.querySelector('.ant-drawer')!

    expect(serviceDrawer.textContent).not.toContain('添加构建')
    expect(serviceDrawer.textContent).not.toContain('编辑构建')
  })

  it('disables workflow execution when image tag defaults are missing', async () => {
    testState.detailWithoutImageTagDefaults = true
    const container = await renderWithProviders(
      <ApplicationDetailPage />,
      '/applications/app-1?tab=delivery',
    )

    await act(async () => {
      findButton(container, '运行').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(findButton(document.body, '运行工作流').disabled).toBe(true)
  })
})
