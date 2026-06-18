/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApplicationsPage,
  BuildTemplatesPage,
  ExecutionTasksPage,
  ReleaseBundlesPage,
  WorkflowsPage,
  buildBuildTemplatePayload,
  type BuildTemplateFormValues,
} from './delivery-app-pages'
import { runtimeEvidencePath } from './template-usage-runtime-links'
import { defaultBuildSources } from './application-center-model'
import { ApplicationEnvironmentsPage, ReleaseBoardPage, WorkflowTemplatesPage } from './delivery-catalog-pages'
import { RegistriesPage } from './delivery-pages'
import {
  DeliveryAnalysisPage,
  DeliveryOnboardingPage,
  DeliveryTestingPage,
} from './delivery-workbench-pages'

const workflowDefinition = {
  schemaVersion: 2,
  mode: 'release_dag',
  nodes: [
    { id: 'build', type: 'build_image', name: '构建镜像', position: { x: 80, y: 120 }, timeoutSeconds: 300, continueOnFailure: false, config: {} },
    { id: 'deploy', type: 'deploy_update_image', name: '更新镜像', position: { x: 280, y: 120 }, timeoutSeconds: 300, continueOnFailure: false, config: {} },
    { id: 'verify', type: 'check_http', name: 'HTTP 验证', position: { x: 480, y: 120 }, timeoutSeconds: 300, continueOnFailure: false, config: { url: 'https://example.com/healthz' } },
  ],
  edges: [
    { id: 'edge-build-deploy', source: 'build', target: 'deploy', condition: 'success' },
    { id: 'edge-deploy-verify', source: 'deploy', target: 'verify', condition: 'success' },
  ],
}

const defaultPermissionKeys = [
  'delivery.applications.view',
  'delivery.application.create',
  'delivery.application.update',
  'delivery.application-environments.view',
  'delivery.application-environments.manage',
  'delivery.build-templates.manage',
  'delivery.workflow-templates.manage',
  'delivery.registries.manage',
  'delivery.release-board.view',
]

const readonlyPermissionKeys = [
  'delivery.applications.view',
  'delivery.application-environments.view',
  'delivery.build-templates.view',
  'delivery.workflow-templates.view',
  'delivery.registries.view',
  'delivery.release-board.view',
]

const testState = vi.hoisted(() => ({
  permissionSnapshot: {
    permissionKeys: [
      'delivery.applications.view',
      'delivery.application.create',
      'delivery.application.update',
      'delivery.application-environments.view',
      'delivery.application-environments.manage',
      'delivery.build-templates.manage',
      'delivery.workflow-templates.manage',
      'delivery.registries.manage',
      'delivery.release-board.view',
    ],
    visibleMenuIds: [],
    visibleMenus: [],
  },
  forceHighBuildTemplateUsage: false,
  gatewayManifestMode: 'approval' as 'approval' | 'restricted' | 'unavailable',
  apiGet: vi.fn(async (path: string) => {
    if (path.startsWith('/ai-gateway/capabilities')) {
      if (testState.gatewayManifestMode === 'unavailable') {
        throw new Error('AI Gateway is unavailable')
      }
      const deliveryTools = [
        'delivery.applications.list',
        'delivery.applications.detail',
        'delivery.applications.create',
        'delivery.application_environments.list',
        'delivery.application_services.list',
        'delivery.build_sources.list',
        'delivery.release_targets.list',
        'delivery.release_bundles.list',
        'delivery.execution_tasks.list',
        'delivery.execution_logs.list',
        'delivery.onboarding.analyze_repo',
        'delivery.standards.dockerfile.generate',
        'delivery.standards.dockerfile.validate',
        'delivery.standards.helm.generate',
        'delivery.standards.k8s.validate',
        'delivery.spec.render',
        'delivery.application.bootstrap',
        'delivery.release.plan',
        'delivery.release_context.diff',
        'delivery.rollback.context',
        'delivery.actions.trigger',
        'diagnosis.release_failure.analyze',
        'k8s.pods.logs',
        'k8s.deployments.events',
      ]
      const tools = testState.gatewayManifestMode === 'restricted'
        ? deliveryTools
            .filter((name) => ['delivery.applications.list', 'delivery.release_bundles.list'].includes(name))
            .map((name) => ({
              name,
              title: name,
              domain: name.startsWith('delivery.') ? 'delivery' : 'diagnosis',
              action: 'read',
              riskLevel: 'read',
              permissionKeys: ['ai.gateway.invoke'],
              requiredScopes: ['application'],
              requiresApproval: false,
            }))
        : deliveryTools.map((name) => ({
            name,
            title: name,
            domain: name.startsWith('delivery.') ? 'delivery' : name.startsWith('k8s.') ? 'kubernetes' : 'diagnosis',
            action: name.includes('trigger') ? 'execute' : name.includes('generate') || name.includes('plan') ? 'analyze' : 'read',
            riskLevel: name === 'delivery.actions.trigger' || name === 'delivery.release.plan' ? 'execute' : 'read',
            permissionKeys: ['ai.gateway.invoke'],
            requiredScopes: name.startsWith('k8s.') ? ['cluster', 'namespace'] : ['application', 'environment'],
            requiresApproval: name === 'delivery.actions.trigger' || name === 'delivery.release.plan',
          }))
      return {
        data: {
          name: 'soha AI Gateway',
          version: 'test',
          generatedAt: '2026-05-08T12:00:00Z',
          permissionKeys: ['ai.gateway.view', 'ai.gateway.invoke'],
          tools,
          skills: [
            {
              id: 'delivery-developer',
              name: 'Delivery Developer',
              category: 'delivery',
              capabilityRefs: tools.map((tool) => tool.name),
              requiredScopes: ['application', 'environment'],
            },
            {
              id: 'delivery-tester',
              name: 'Delivery Tester',
              category: 'delivery',
              capabilityRefs: tools.map((tool) => tool.name),
              requiredScopes: ['application', 'environment'],
            },
          ],
          summary: {
            toolCount: tools.length,
            resourceCount: 0,
            promptCount: 0,
            skillCount: 2,
            deniedCount: testState.gatewayManifestMode === 'restricted' ? 8 : 0,
          },
        },
      }
    }
    if (path === '/applications') {
      return {
        data: [
          {
            id: 'app-1',
            name: 'ERP Front Main',
            key: 'erp-front-main',
            group: 'erp-front, frontend',
            language: 'node',
            repositoryPath: 'erp/front/main',
            defaultBranch: 'main',
            enabled: true,
            buildSources: [
              {
                id: 'source-1',
                name: 'Repo Dockerfile',
                type: 'repo_dockerfile',
                enabled: true,
                isDefault: true,
                buildImage: '',
                defaultTag: '',
                config: { contextDir: '.', dockerfilePath: 'Dockerfile', builderKind: 'docker' },
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
          {
            id: 'app-2',
            name: 'Mall API',
            key: 'mall-api',
            group: 'mall',
            language: 'go',
            repositoryPath: 'mall/api',
            defaultBranch: 'main',
            enabled: true,
            buildSources: [
              {
                id: 'source-2',
                name: 'Platform Template',
                type: 'platform_build_template',
                enabled: true,
                isDefault: true,
                buildImage: '',
                defaultTag: '',
                config: { buildTemplateId: 'tpl-1', contextDir: '.' },
              },
            ],
            createdAt: '2026-05-02T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
        ],
      }
    }
    if (path === '/application-environments') {
      return {
        data: [
          {
            id: 'binding-1',
            applicationId: 'app-1',
            environmentId: 'env-test',
            environmentKey: 'test',
            workflowTemplateId: 'wf-template-1',
            workflowTemplate: {
              id: 'wf-template-1',
              key: 'release-dag',
              name: 'Release DAG',
              category: 'release',
              definition: workflowDefinition,
              enabled: true,
              createdAt: '2026-05-01T00:00:00Z',
              updatedAt: '2026-05-08T12:00:00Z',
            },
            buildPolicy: { sourceId: 'source-1', refType: 'branch', imageTagMode: 'input' },
            releasePolicy: { actionKind: 'deploy', requiresApproval: false, verificationMode: 'workflow' },
            targets: [
              {
                id: 'target-1',
                applicationEnvironmentId: 'binding-1',
                clusterId: 'cluster-a',
                namespace: 'erp-test',
                targetKind: 'k8s_workload',
                executorKind: 'k8s_job_runner',
                workloadKind: 'Deployment',
                workloadName: 'erp-front',
                containerName: 'web',
                enabled: true,
              },
            ],
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
        ],
      }
    }
    if (path === '/workflow-templates') {
      return {
        data: [
          {
            id: 'wf-template-1',
            key: 'release-dag',
            name: 'Release DAG',
            description: 'Standard build deploy verify flow',
            category: 'release',
            definition: workflowDefinition,
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
        ],
      }
    }
    if (path === '/workflow-templates/wf-template-1/usage') {
      return {
        data: {
          templateKind: 'workflow',
          templateId: 'wf-template-1',
          usageCount: 1,
          applicationCount: 1,
          environmentCount: 1,
          productionEnvironmentCount: 0,
          approvalBindingCount: 0,
          targetCount: 1,
          riskLevel: 'low',
          riskReasons: ['1 release targets'],
          recommendedAction: 'save_with_standard_review',
          applications: [{ id: 'app-1', name: 'ERP Front Main', key: 'erp-front-main' }],
          bindings: [{
            id: 'binding-1',
            applicationId: 'app-1',
            environmentId: 'env-test',
            environmentKey: 'test',
            requiresApproval: false,
            targetCount: 1,
            riskLevel: 'low',
            application: { id: 'app-1', name: 'ERP Front Main', key: 'erp-front-main' },
            environment: { id: 'env-test', key: 'test', name: '测试环境', isProduction: false, requiresApproval: false },
          }],
          lastExecutionSummary: {
            source: 'workflow_template_runtime',
            stateCounts: { succeeded: 1, failed: 1, running: 1, pending: 0 },
            statusCounts: { completed: 1, failed: 1, running: 1 },
            latest: {
              kind: 'workflow',
              id: 'workflow-usage-1',
              applicationId: 'app-1',
              applicationEnvironmentId: 'binding-1',
              workflowName: 'release-dag',
              status: 'running',
              observedAt: '2026-05-08T11:30:00Z',
            },
            items: [
              {
                kind: 'workflow',
                id: 'workflow-usage-1',
                applicationId: 'app-1',
                applicationEnvironmentId: 'binding-1',
                workflowName: 'release-dag',
                status: 'running',
                observedAt: '2026-05-08T11:30:00Z',
              },
              {
                kind: 'execution_task',
                id: 'task-usage-1',
                applicationId: 'app-1',
                applicationEnvironmentId: 'binding-1',
                releaseBundleId: 'bundle-1',
                taskKind: 'build_deploy',
                status: 'failed',
                observedAt: '2026-05-08T11:20:00Z',
              },
            ],
          },
        },
      }
    }
    if (path === '/delivery/blueprints') {
      return {
        data: [
          {
            id: 'blueprint-1',
            key: 'node-service',
            name: 'Node Service',
            description: 'Node.js service onboarding',
            applicationDraft: { key: 'node-service', name: 'Node Service', group: 'frontend', language: 'node' },
            buildSources: [],
            environmentBindings: [],
            files: [],
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-08T12:00:00Z',
          },
        ],
      }
    }
    if (path === '/delivery/blueprints/blueprint-1/usage') {
      return {
        data: {
          templateKind: 'blueprint',
          templateId: 'blueprint-1',
          usageCount: 1,
          applicationCount: 1,
          environmentCount: 0,
          productionEnvironmentCount: 0,
          approvalBindingCount: 0,
          targetCount: 0,
          riskLevel: 'low',
          riskReasons: ['1 spec file templates'],
          recommendedAction: 'save_with_standard_review',
          applications: [{ id: 'app-1', name: 'ERP Front Main', key: 'erp-front-main' }],
          fileKindCounts: { dockerfile: 1 },
        },
      }
    }
    if (path === '/clusters') {
      return { data: [] }
    }
    if (path === '/delivery/release-board') {
      return {
        data: [
          {
            applicationEnvironmentId: 'binding-1',
            applicationId: 'app-1',
            applicationName: 'ERP Front Main',
            environmentId: 'env-test',
            environmentName: '测试环境',
            requiresApproval: false,
            buildSource: { id: 'source-1', name: 'Repo Dockerfile', type: 'repo_dockerfile', enabled: true, isDefault: true },
            targets: [{ clusterId: 'cluster-a', namespace: 'erp-test', workloadName: 'erp-front', workloadKind: 'deployment' }],
            latestBuild: { id: 'build-1', applicationId: 'app-1', status: 'completed', sourceSystem: 'application', createdAt: '2026-05-08T10:00:00Z', updatedAt: '2026-05-08T10:30:00Z' },
            latestBundle: { id: 'bundle-1', applicationId: 'app-1', applicationEnvironmentId: 'binding-1', version: '1.2.3', sourceType: 'build', status: 'completed', artifactRef: 'registry.local/erp-front:1.2.3', createdAt: '2026-05-08T10:30:00Z', updatedAt: '2026-05-08T10:40:00Z' },
            latestExecutionTask: {
              id: 'task-1',
              releaseBundleId: 'bundle-1',
              applicationId: 'app-1',
              applicationEnvironmentId: 'binding-1',
              taskKind: 'build_deploy',
              providerKind: 'ci_agent_runner',
              targetKind: 'k8s_workload',
              status: 'running',
              maxRetries: 1,
              attemptCount: 1,
              timeoutSeconds: 600,
              artifacts: [{ kind: 'image', name: 'erp-front', ref: 'registry.local/erp-front:1.2.3' }],
              createdAt: '2026-05-08T10:40:00Z',
              updatedAt: '2026-05-08T11:20:00Z',
            },
            latestWorkflow: {
              id: 'wf-1',
              applicationId: 'app-1',
              workflowName: 'deploy',
              status: 'running',
              steps: [],
              nodeRuns: [{ nodeId: 'smoke', name: 'Smoke', type: 'smoke_test', status: 'completed' }],
              createdAt: '2026-05-08T11:00:00Z',
              updatedAt: '2026-05-08T11:30:00Z',
            },
            latestRelease: { id: 'release-1', applicationId: 'app-1', clusterId: 'cluster-a', namespace: 'erp-test', deploymentName: 'erp-front', status: 'running', createdAt: '2026-05-08T11:15:00Z', updatedAt: '2026-05-08T11:25:00Z' },
          },
          {
            applicationEnvironmentId: 'binding-2',
            applicationId: 'app-2',
            applicationName: 'Mall API',
            environmentId: 'env-staging',
            environmentName: '预发环境',
            requiresApproval: false,
            targets: [{ clusterId: 'cluster-b', namespace: 'mall-staging', workloadName: 'mall-api', workloadKind: 'deployment' }],
            latestWorkflow: { id: 'wf-2', applicationId: 'app-2', workflowName: 'deploy', status: 'failed', steps: [], createdAt: '2026-05-08T11:00:00Z', updatedAt: '2026-05-08T11:30:00Z' },
          },
        ],
      }
    }
    if (path === '/build-templates') {
      return {
        data: [
          {
            id: 'tpl-1',
            key: 'docker-node',
            name: 'Node Docker',
            description: 'Node standard docker build',
            builderKind: 'docker',
            dockerfileTemplate: 'FROM node:22',
            buildCommands: ['npm ci', 'npm run build'],
            variableSchema: { imageTag: { type: 'string', title: '镜像 Tag', required: true } },
            defaultVariables: { imageTag: 'latest' },
            enabled: true,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
          },
        ],
      }
    }
    if (path === '/build-templates/tpl-1/usage') {
      return {
        data: {
          templateKind: 'build',
          templateId: 'tpl-1',
          usageCount: 1,
          applicationCount: 1,
          environmentCount: 1,
          productionEnvironmentCount: testState.forceHighBuildTemplateUsage ? 1 : 0,
          approvalBindingCount: testState.forceHighBuildTemplateUsage ? 1 : 0,
          targetCount: 1,
          riskLevel: testState.forceHighBuildTemplateUsage ? 'high' : 'low',
          riskReasons: testState.forceHighBuildTemplateUsage ? ['1 production environment bindings'] : ['1 release targets'],
          recommendedAction: testState.forceHighBuildTemplateUsage ? 'copy_template_before_editing' : 'save_with_standard_review',
          applications: [{ id: 'app-2', name: 'Mall API', key: 'mall-api' }],
          buildSources: [{
            applicationId: 'app-2',
            buildSourceId: 'source-2',
            buildSourceName: 'Platform Template',
            application: { id: 'app-2', name: 'Mall API', key: 'mall-api' },
            bindingCount: 1,
            riskLevel: 'low',
          }],
          lastExecutionSummary: {
            source: 'build_template_runtime',
            stateCounts: { succeeded: 1, failed: 0, running: 1, pending: 0 },
            statusCounts: { completed: 1, running: 1 },
            latest: {
              kind: 'build',
              id: 'build-usage-1',
              applicationId: 'app-2',
              buildSourceId: 'source-2',
              status: 'completed',
              sourceSystem: 'manual',
              observedAt: '2026-05-08T10:00:00Z',
            },
            items: [
              {
                kind: 'build',
                id: 'build-usage-1',
                applicationId: 'app-2',
                buildSourceId: 'source-2',
                status: 'completed',
                sourceSystem: 'manual',
                observedAt: '2026-05-08T10:00:00Z',
              },
              {
                kind: 'release_bundle',
                id: 'bundle-usage-1',
                applicationId: 'app-2',
                applicationEnvironmentId: 'binding-2',
                version: '2.0.0',
                status: 'building',
                observedAt: '2026-05-08T10:30:00Z',
              },
            ],
          },
        },
      }
    }
    if (path === '/delivery/release-bundles') {
      return {
        data: [
          {
            id: 'bundle-1',
            applicationId: 'app-1',
            applicationEnvironmentId: 'binding-1',
            version: '1.2.3',
            sourceType: 'build',
            status: 'completed',
            artifactRef: 'registry.local/erp-front:1.2.3',
            artifactDigest: 'sha256:123',
            createdAt: '2026-05-08T10:30:00Z',
            updatedAt: '2026-05-08T10:40:00Z',
          },
          {
            id: 'bundle-2',
            applicationId: 'app-2',
            applicationEnvironmentId: 'binding-2',
            version: '2.0.0-rc1',
            sourceType: 'workflow',
            status: 'failed',
            createdAt: '2026-05-08T10:30:00Z',
            updatedAt: '2026-05-08T10:40:00Z',
          },
        ],
      }
    }
    if (path === '/delivery/execution-tasks') {
      return {
        data: [
          {
            id: 'task-running',
            releaseBundleId: 'bundle-1',
            applicationId: 'app-1',
            applicationEnvironmentId: 'binding-1',
            taskKind: 'build_deploy',
            providerKind: 'ci_agent_runner',
            targetKind: 'k8s_workload',
            status: 'running',
            maxRetries: 1,
            attemptCount: 1,
            timeoutSeconds: 600,
            callbackToken: 'token-running',
            artifacts: [{ kind: 'image', name: 'erp-front', ref: 'registry.local/erp-front:1.2.3' }],
            lastHeartbeatAt: '2026-05-08T11:20:00Z',
            createdAt: '2026-05-08T10:40:00Z',
            updatedAt: '2026-05-08T11:20:00Z',
          },
          {
            id: 'task-failed',
            releaseBundleId: 'bundle-2',
            applicationId: 'app-2',
            applicationEnvironmentId: 'binding-2',
            taskKind: 'verify',
            providerKind: 'k8s_job_runner',
            targetKind: 'quality_gate',
            status: 'failed',
            maxRetries: 2,
            attemptCount: 1,
            timeoutSeconds: 300,
            artifacts: [],
            createdAt: '2026-05-08T10:40:00Z',
            updatedAt: '2026-05-08T11:20:00Z',
          },
        ],
      }
    }
    if (path === '/delivery/execution-tasks/task-running/logs' || path === '/delivery/execution-tasks/task-failed/logs') {
      return { data: [] }
    }
    if (path === '/workflows') {
      return {
        data: [
          {
            id: 'workflow-1',
            applicationId: 'app-1',
            workflowName: 'deploy-prod',
            clusterId: 'cluster-a',
            namespace: 'prod',
            deploymentName: 'erp-front',
            status: 'waiting_approval',
            steps: [],
            nodeRuns: [
              {
                nodeId: 'approve',
                name: '人工审批',
                type: 'manual_approval',
                status: 'waiting_approval',
                summary: 'Waiting for production approver',
                startedAt: '2026-05-08T11:10:00Z',
              },
            ],
            metadata: {
              aiGatewayApprovalRequestId: 'approval-1',
              aiGatewayToolName: 'delivery.actions.trigger',
              aiGatewayApprovalPolicyRef: 'policy-prod',
            },
            createdAt: '2026-05-08T11:00:00Z',
            updatedAt: '2026-05-08T11:30:00Z',
          },
        ],
      }
    }
    if (path === '/registries') {
      return {
        data: [
          {
            id: 'registry-1',
            name: 'Harbor Prod',
            type: 'harbor',
            endpoint: 'https://harbor.example.com',
            username: 'robot$delivery',
            status: 'healthy',
          },
        ],
      }
    }
    if (path === '/builds') {
      return {
        data: [
          {
            id: 'build-1',
            applicationId: 'app-1',
            sourceSystem: 'application',
            status: 'completed',
            createdAt: '2026-05-08T10:00:00Z',
            updatedAt: '2026-05-08T10:30:00Z',
          },
        ],
      }
    }
    if (path === '/releases') {
      return {
        data: [
          {
            id: 'release-1',
            applicationId: 'app-1',
            clusterId: 'cluster-a',
            namespace: 'erp-test',
            deploymentName: 'erp-front',
            status: 'completed',
            createdAt: '2026-05-08T10:40:00Z',
            updatedAt: '2026-05-08T10:50:00Z',
          },
        ],
      }
    }
    throw new Error(`Unhandled GET ${path}`)
  }),
  apiPut: vi.fn(async (_path: string, body?: unknown) => ({ data: body })),
  apiPost: vi.fn(async (path: string, body?: unknown) => {
    if (path === '/delivery/drafts') {
      const payload = body as {
        applicationDraft?: Record<string, unknown>
        buildSources?: unknown[]
        environmentBindings?: unknown[]
        files?: unknown[]
        services?: unknown[]
      }
      return {
        data: {
          id: 'draft-1',
          source: 'manual',
          status: 'draft',
          applicationDraft: payload.applicationDraft ?? {},
          services: payload.services ?? [],
          buildSources: payload.buildSources ?? [],
          environmentBindings: payload.environmentBindings ?? [],
          files: payload.files ?? [],
          executionHints: {},
          createdAt: '2026-05-08T12:00:00Z',
          updatedAt: '2026-05-08T12:00:00Z',
        },
      }
    }
    if (path === '/delivery/drafts/draft-1/confirm') {
      return {
        data: {
          draft: {
            id: 'draft-1',
            source: 'manual',
            status: 'confirmed',
            applicationDraft: { name: 'Draft Demo', key: 'draft-demo', group: 'default', language: 'go', enabled: true },
            services: [{ key: 'api', name: 'API', serviceKind: 'kubernetes_workload', enabled: true }],
            buildSources: [],
            environmentBindings: [],
            files: [],
            executionHints: {},
            confirmedAt: '2026-05-08T12:01:00Z',
            createdAt: '2026-05-08T12:00:00Z',
            updatedAt: '2026-05-08T12:01:00Z',
          },
          application: {
            id: 'app-draft',
            name: 'Draft Demo',
            key: 'draft-demo',
            group: 'default',
            language: 'go',
            enabled: true,
            createdAt: '2026-05-08T12:01:00Z',
            updatedAt: '2026-05-08T12:01:00Z',
          },
          services: [{ id: 'svc-api', applicationId: 'app-draft', key: 'api', name: 'API', serviceKind: 'kubernetes_workload', enabled: true }],
          environmentBindings: [],
          spec: { applicationDraft: { name: 'Draft Demo', key: 'draft-demo', group: 'default', language: 'go', enabled: true } },
        },
      }
    }
    throw new Error(`Unhandled POST ${path}`)
  }),
}))

vi.mock('@/features/auth/permission-snapshot', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, key: string) => snapshot?.permissionKeys?.includes(key) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: testState.permissionSnapshot },
    isLoading: false,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    get: (path: string) => testState.apiGet(path),
    post: (path: string, body?: unknown) => testState.apiPost(path, body),
    put: (path: string, body?: unknown) => testState.apiPut(path, body),
    delete: vi.fn(),
  },
}))

vi.mock('@/components/release-flow-dag-editor', () => ({
  ReleaseFlowDagEditor: (props: {
    className?: string
    initialDefinition?: Record<string, unknown>
    onChange?: (definition: Record<string, unknown>) => void
  }) => (
    <div className={props.className} data-testid="release-flow-dag-editor">
      <button
        type="button"
        onClick={() => props.onChange?.({
          ...(props.initialDefinition ?? {}),
          nodes: [
            { id: 'mock-build', type: 'build_image', name: 'Mock Build' },
          ],
          edges: [],
        })}
      >
        Mock DAG change
      </button>
    </div>
  ),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    localeCode: 'zh_CN',
    t: (_key: string, fallback: string) => fallback,
  }),
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

async function renderWithProviders(node: ReactNode, route = '/applications') {
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
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <MemoryRouter initialEntries={[route]}>
            {node}
          </MemoryRouter>
        </AntApp>
      </QueryClientProvider>,
    )
  })

  await act(async () => {
    for (let index = 0; index < 16; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })

  return container
}

function findButton(container: ParentNode, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(text)) as HTMLButtonElement | undefined
  if (!button) {
    throw new Error(`button not found: ${text}`)
  }
  return button
}

function findToolbarButton(container: HTMLElement, toolbarSelector: string, text: string) {
  const toolbar = container.querySelector(toolbarSelector)
  if (!toolbar) {
    throw new Error(`toolbar not found: ${toolbarSelector}`)
  }
  return findButton(toolbar, text)
}

function hasButtonText(container: ParentNode, text: string) {
  return Array.from(container.querySelectorAll('button')).some((item) => item.textContent?.includes(text))
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function clickTab(container: HTMLElement, text: string) {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find((item) => item.textContent?.includes(text)) as HTMLElement | undefined
  if (!tab) {
    throw new Error(`tab not found: ${text}`)
  }
  await act(async () => {
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function waitForText(container: ParentNode, text: string) {
  for (let index = 0; index < 40; index += 1) {
    if (container.textContent?.includes(text)) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('ApplicationsPage workspace layout', () => {
  beforeEach(() => {
    testState.apiGet.mockClear()
    testState.apiPost.mockClear()
    testState.apiPut.mockClear()
    testState.forceHighBuildTemplateUsage = false
    testState.gatewayManifestMode = 'approval'
    testState.permissionSnapshot.permissionKeys = [...defaultPermissionKeys]
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
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('renders application-centered cards before the detailed table', async () => {
    const container = await renderWithProviders(<ApplicationsPage />)

    expect(container.textContent).toContain('接入应用/服务')
    expect(container.textContent).toContain('新建应用档案')
    expect(container.textContent).toContain('ERP Front Main')
    expect(container.textContent).toContain('全部')
    expect(container.textContent).toContain('erp-front')
    expect(container.textContent).toContain('frontend')
    expect(container.textContent).toContain('mall')
    expect(container.textContent).toContain('交付: 执行中')
    expect(container.textContent).toContain('门禁: 等待执行')
    expect(container.textContent).toContain('交付: 失败待处理')
    expect(container.textContent).toContain('门禁: 阻塞')
    expect(container.textContent).toContain('服务线索')
    expect(container.textContent).toContain('最近环境')
    expect(container.querySelector('.soha-application-card-list')).not.toBeNull()
    expect(container.querySelector('.soha-application-center-toolbar')).not.toBeNull()
    expect(container.querySelector('.soha-application-card__more')).not.toBeNull()
    expect(container.querySelector('.soha-application-card .ant-card-actions')).toBeNull()
    expect(container.querySelector('.soha-management-detail-header')).toBeNull()
    expect(container.querySelector('.soha-application-create-card')).toBeNull()
    expect(container.textContent).not.toContain('erp/front/main')
    expect(container.textContent).not.toContain('Repo Dockerfile')
    expect(container.textContent).not.toContain('erp-front-main')
    expect(container.textContent).not.toContain('erp-front / frontend')
    expect(container.textContent).not.toContain('进入应用')
    expect(container.textContent).not.toContain('按应用统一维护配置')
    expect(container.textContent).not.toContain('应用管理')
    expect(container.textContent).not.toContain('围绕应用聚合研发、测试和交付上下文')
    expect(container.textContent).not.toContain('应用详细清单')
    expect(container.querySelector('.soha-admin-table-shell')).toBeNull()
  })

  it('seeds new applications with a repository dockerfile build source', () => {
    expect(defaultBuildSources()).toEqual([
      {
        id: '',
        name: 'Repository Dockerfile',
        type: 'repo_dockerfile',
        enabled: true,
        isDefault: true,
        buildImage: '',
        defaultTag: '',
        config: { contextDir: '.', dockerfilePath: 'Dockerfile', builderKind: 'docker' },
      },
    ])
  })

  it('builds typed build template payloads without form-only text fields', () => {
    const values = {
      key: 'node-docker',
      name: 'Node Docker',
      builderKind: 'docker',
      dockerfileTemplate: 'FROM node:22',
      buildCommandsText: '\n npm ci \n npm run build \n',
      variableSchemaText: '{"imageTag":{"type":"string"}}',
      defaultVariablesText: '{"imageTag":"main"}',
      enabled: true,
    } satisfies BuildTemplateFormValues

    expect(buildBuildTemplatePayload(values)).toEqual({
      key: 'node-docker',
      name: 'Node Docker',
      builderKind: 'docker',
      dockerfileTemplate: 'FROM node:22',
      buildCommands: ['npm ci', 'npm run build'],
      variableSchema: { imageTag: { type: 'string' } },
      defaultVariables: { imageTag: 'main' },
      enabled: true,
    })
  })

  it('renders build templates as a left-list and right-designer workspace', async () => {
    const container = await renderWithProviders(<BuildTemplatesPage />, '/build-templates')

    expect(testState.apiGet).toHaveBeenCalledWith('/build-templates')
    expect(testState.apiGet).toHaveBeenCalledWith('/build-templates/tpl-1/usage')
    expect(container.querySelector('.soha-build-template-workspace')).not.toBeNull()
    expect(container.querySelector('.soha-build-template-list')).not.toBeNull()
    expect(container.querySelector('.soha-build-template-designer')).not.toBeNull()
    expect(container.textContent).toContain('新建模板')
    expect(container.textContent).toContain('保存')
    expect(container.textContent).toContain('取消更改')
    expect(container.textContent).toContain('Node Docker')
    expect(container.textContent).toContain('docker-node')
    expect(container.textContent).toContain('命令 2')
    expect(container.textContent).toContain('变量 1')
    expect(container.textContent).toContain('基础信息')
    expect(container.textContent).toContain('Dockerfile')
    expect(container.textContent).toContain('构建命令')
    expect(container.textContent).toContain('变量')
    expect(container.textContent).toContain('高级预览')
    expect(container.textContent).toContain('模板影响面')
    await waitForText(container, '成功 1')
    expect(container.textContent).toContain('成功 1')
    expect(container.textContent).toContain('运行中 1')
    expect(container.textContent).toContain('最近证据：构建: manual / completed')
    expect(container.textContent).toContain('版本包: 2.0.0')
    expect(container.textContent).toContain('跳转：')
    expect(container.querySelector('.soha-admin-table-shell')).toBeNull()
    expect(container.textContent).not.toContain('变量 Schema(JSON)')
    expect(container.textContent).not.toContain('默认变量(JSON)')
  })

  it('covers build template edit, variable, enable switch, and JSON preview interactions', async () => {
    const container = await renderWithProviders(<BuildTemplatesPage />, '/build-templates')

    expect(findToolbarButton(container, '.soha-build-template-toolbar', '新建模板').disabled).toBe(false)
    expect(findToolbarButton(container, '.soha-build-template-toolbar', '保存').disabled).toBe(false)
    expect(findToolbarButton(container, '.soha-build-template-toolbar', '删除').disabled).toBe(false)

    const enabledSwitch = container.querySelector('.soha-build-template-list__item-actions button[role="switch"]') as HTMLButtonElement | null
    expect(enabledSwitch).not.toBeNull()
    expect(enabledSwitch?.disabled).toBe(false)

    await clickButton(findToolbarButton(container, '.soha-build-template-toolbar', '新建模板'))
    expect(container.textContent).toContain('未保存')

    await clickTab(container, '变量')
    await clickButton(findButton(container, '添加变量'))
    expect(container.textContent).toContain('变量 2')

    await clickTab(container, '高级预览')
    expect(container.querySelector('.soha-build-template-json-preview')?.textContent).toContain('"variableSchema"')
    expect(container.querySelector('.soha-build-template-json-preview')?.textContent).toContain('"imageTag"')
  })

  it('requires secondary confirmation before saving high-risk build template usage', async () => {
    testState.forceHighBuildTemplateUsage = true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const container = await renderWithProviders(<BuildTemplatesPage />, '/build-templates')

    await clickButton(findToolbarButton(container, '.soha-build-template-toolbar', '保存'))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('高风险模板'))
    expect(testState.apiPut).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('keeps build template management controls disabled for readonly users', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const container = await renderWithProviders(<BuildTemplatesPage />, '/build-templates')

    expect(findToolbarButton(container, '.soha-build-template-toolbar', '新建模板').disabled).toBe(true)
    expect(findToolbarButton(container, '.soha-build-template-toolbar', '保存').disabled).toBe(true)
    expect(findToolbarButton(container, '.soha-build-template-toolbar', '删除').disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('.soha-build-template-list__item-actions button[role="switch"]')?.disabled).toBe(true)
  })

  it('renders application environment bindings and create/edit/delete entry points for managers', async () => {
    const container = await renderWithProviders(<ApplicationEnvironmentsPage />, '/application-environments')

    expect(testState.apiGet).toHaveBeenCalledWith('/application-environments')
    expect(testState.apiGet).toHaveBeenCalledWith('/applications')
    expect(testState.apiGet).toHaveBeenCalledWith('/workflow-templates')
    expect(container.textContent).toContain('ERP Front Main')
    expect(container.textContent).toContain('test')
    expect(container.textContent).toContain('Release DAG')
    expect(container.textContent).toContain('1')
    expect(hasButtonText(container, '新建绑定')).toBe(true)
    expect(container.querySelector('[aria-label="编辑绑定"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="删除绑定"]')).not.toBeNull()

    await clickButton(findButton(container, '新建绑定'))
    expect(document.body.textContent).toContain('新建应用环境绑定')
    expect(document.body.textContent).toContain('目标元数据(JSON)')
  })

  it('hides application environment binding writes for readonly users', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const container = await renderWithProviders(<ApplicationEnvironmentsPage />, '/application-environments')

    expect(container.textContent).toContain('ERP Front Main')
    expect(hasButtonText(container, '新建绑定')).toBe(false)
    expect(container.querySelector('[aria-label="编辑绑定"]')).toBeNull()
    expect(container.querySelector('[aria-label="删除绑定"]')).toBeNull()
  })

  it('renders workflow template DAG preview, impact summary, and JSON panel', async () => {
    const container = await renderWithProviders(<WorkflowTemplatesPage />, '/workflow-templates')

    expect(testState.apiGet).toHaveBeenCalledWith('/workflow-templates')
    expect(testState.apiGet).toHaveBeenCalledWith('/workflow-templates/wf-template-1/usage')
    expect(container.textContent).toContain('Release DAG')
    expect(container.textContent).toContain('release-dag')
    expect(container.textContent).toContain('3 nodes')
    expect(container.querySelector('[data-testid="release-flow-dag-editor"]')).not.toBeNull()

    await clickButton(findToolbarButton(container, '.soha-workflow-template-toolbar', 'JSON'))
    expect(container.querySelector('.soha-workflow-template-json-panel')?.textContent).toContain('"mode": "release_dag"')

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="编辑模板设置"]')!)
    expect(document.body.textContent).toContain('模板影响面')
    expect(document.body.textContent).toContain('低风险')
    expect(document.body.textContent).toContain('失败 1')
    expect(document.body.textContent).toContain('运行中 1')
    expect(document.body.textContent).toContain('最近证据：工作流: release-dag / running')
    expect(document.body.textContent).toContain('执行任务: build_deploy')
    expect(document.body.textContent).toContain('跳转：')
    expect(document.body.textContent).toContain('release_dag compatible')
  })

  it('keeps workflow template writes disabled for readonly users while leaving JSON preview readable', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const container = await renderWithProviders(<WorkflowTemplatesPage />, '/workflow-templates')

    expect(findToolbarButton(container, '.soha-workflow-template-toolbar', '新建模板').disabled).toBe(true)
    expect(findToolbarButton(container, '.soha-workflow-template-toolbar', '保存').disabled).toBe(true)
    expect(findToolbarButton(container, '.soha-workflow-template-toolbar', '复制模板').disabled).toBe(true)
    expect(findToolbarButton(container, '.soha-workflow-template-toolbar', '删除').disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('.soha-workflow-template-list__item-actions button[role="switch"]')?.disabled).toBe(true)

    await clickButton(findToolbarButton(container, '.soha-workflow-template-toolbar', 'JSON'))
    expect(container.querySelector('.soha-workflow-template-json-panel')?.textContent).toContain('"mode": "release_dag"')
  })

  it('hides registry save actions for readonly users', async () => {
    testState.permissionSnapshot.permissionKeys = [...readonlyPermissionKeys]
    const container = await renderWithProviders(<RegistriesPage />, '/registries')

    expect(testState.apiGet).toHaveBeenCalledWith('/registries')
    expect(container.textContent).toContain('Harbor Prod')
    expect(hasButtonText(container, '添加仓库')).toBe(false)
    expect(container.querySelector('[aria-label="编辑仓库"]')).toBeNull()
    expect(container.querySelector('[aria-label="删除仓库"]')).toBeNull()
  })

  it('shows Gateway approval drilldown context on workflow list', async () => {
    const container = await renderWithProviders(
      <WorkflowsPage />,
      '/workflows?workflowRunId=workflow-1&gatewayApprovalRequestId=approval-1',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/workflows')
    expect(container.textContent).toContain('已定位工作流 workflow-1')
    expect(container.textContent).toContain('gatewayApprovalRequestId=approval-1')
    expect(container.textContent).toContain('approval-1')
    expect(container.textContent).toContain('delivery.actions.trigger')
    expect(container.textContent).toContain('已定位')
    expect(container.textContent).toContain('Manual approval detail')
    expect(container.textContent).toContain('Workflow node timeline')
    expect(container.textContent).toContain('Raw trace')
    expect(container.textContent).toContain('approve')
    expect(container.textContent).toContain('Waiting for production approver')
  })

  it('renders unified release board workbench signals', async () => {
    const container = await renderWithProviders(<ReleaseBoardPage />, '/release-board')

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-board')
    for (const scope of ['开发', '测试']) {
      expect(container.textContent).not.toContain(`${scope}视角`)
    }
    expect(container.textContent).toContain('环境绑定')
    expect(container.textContent).toContain('2 个发布目标')
    expect(container.textContent).toContain('ERP Front Main')
    expect(container.textContent).toContain('Repo Dockerfile')
    expect(container.textContent).toContain('候选版本')
    expect(container.textContent).toContain('交付态势')
    expect(container.textContent).toContain('交付物')
    expect(container.textContent).toContain('1.2.3')
    expect(container.textContent).toContain('执行中')
    expect(container.textContent).toContain('阻塞')
    expect(container.textContent).toContain('Task')
    expect(testState.apiGet).toHaveBeenCalledWith('/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery-developer')
    expect(container.textContent).toContain('AI Gateway 构建发布辅助')
    expect(container.textContent).toContain('需要审批')
    expect(container.textContent).toContain('AI Gateway 可用，调用需要审批')
    expect(container.textContent).toContain('delivery.actions.trigger / 审批')
    expect(container.textContent).toContain('手工配置')
  })

  it('renders execution task summary for delivery triage', async () => {
    const container = await renderWithProviders(<ExecutionTasksPage />, '/delivery/execution-tasks')

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/execution-tasks')
    expect(container.textContent).toContain('任务总数')
    expect(container.textContent).toContain('1 个执行中')
    expect(container.textContent).toContain('阻塞任务')
    expect(container.textContent).toContain('1 个可重试')
    expect(container.textContent).toContain('交付物线索')
    expect(container.textContent).toContain('回调可用')
    expect(container.textContent).toContain('task-running')
    expect(container.textContent).toContain('binding-1')
    expect(container.textContent).toContain('1 · erp-front')
    expect(container.textContent).toContain('task-failed')
  })

  it('highlights and opens focused execution task from runtime evidence link', async () => {
    const container = await renderWithProviders(
      <ExecutionTasksPage />,
      '/delivery/execution-tasks?executionTaskId=task-running&releaseBundleId=bundle-1',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/execution-tasks')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/execution-tasks/task-running/logs')
    expect(container.textContent).toContain('已定位执行任务 task-running')
    expect(container.textContent).toContain('executionTaskId=task-running')
    expect(container.textContent).toContain('releaseBundleId=bundle-1')
    expect(container.textContent).toContain('已定位')
    expect(document.body.textContent).toContain('任务日志 · task-running')
  })

  it('renders release bundle candidate summary', async () => {
    const container = await renderWithProviders(<ReleaseBundlesPage />, '/delivery/release-bundles')

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-bundles')
    expect(container.textContent).toContain('候选版本')
    expect(container.textContent).toContain('1 个可验证 / 可推广')
    expect(container.textContent).toContain('阻塞版本')
    expect(container.textContent).toContain('缺少交付物')
    expect(container.textContent).toContain('1.2.3')
    expect(container.textContent).toContain('bundle-1')
    expect(container.textContent).toContain('registry.local/erp-front:1.2.3')
    expect(container.textContent).toContain('2.0.0-rc1')
  })

  it('highlights focused release bundle from runtime evidence link', async () => {
    const container = await renderWithProviders(
      <ReleaseBundlesPage />,
      '/delivery/release-bundles?releaseBundleId=bundle-1',
    )

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-bundles')
    expect(container.textContent).toContain('已定位版本包 bundle-1')
    expect(container.textContent).toContain('releaseBundleId=bundle-1')
    expect(container.textContent).toContain('已定位')
  })

  it('routes runtime evidence directly to dedicated detail pages', () => {
    expect(runtimeEvidencePath({ kind: 'build', id: 'build-1' } as any)).toBe('/builds/build-1?highlight=build-1')
    expect(runtimeEvidencePath({ kind: 'workflow', id: 'workflow-1' } as any)).toBe('/workflows/workflow-1?highlight=workflow-1')
    expect(runtimeEvidencePath({ kind: 'release', id: 'release-1' } as any)).toBe('/releases/release-1?highlight=release-1')
    expect(runtimeEvidencePath({ kind: 'release_bundle', id: 'bundle-1' } as any)).toBe('/delivery/release-bundles/bundle-1?highlight=bundle-1')
    expect(runtimeEvidencePath({ kind: 'execution_task', id: 'task-running' } as any)).toBe('/delivery/execution-tasks/task-running?highlight=task-running')
  })

  it('renders application onboarding as a dual-mode workbench entry', async () => {
    const container = await renderWithProviders(<DeliveryOnboardingPage />, '/delivery/onboarding')

    expect(testState.apiGet).toHaveBeenCalledWith('/applications')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/blueprints')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-board')
    expect(container.textContent).toContain('应用 / 服务接入')
    expect(container.textContent).toContain('常规模式保持完整可用')
    expect(container.textContent).toContain('接入对象边界')
    expect(container.textContent).toContain('AI Gateway 接入辅助')
    expect(testState.apiGet).toHaveBeenCalledWith('/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery-developer')
    expect(container.textContent).toContain('AI Gateway 可直接辅助')
    expect(container.textContent).toContain('可见能力')
    expect(container.textContent).toContain('服务组件')
    expect(container.textContent).toContain('DeliveryDraft')
    expect(container.textContent).toContain('接入新服务')
    expect(container.textContent).toContain('待接入服务线索')
    expect(container.textContent).toContain('ERP Front Main')
  })

  it('creates and confirms a manual DeliveryDraft from onboarding', async () => {
    const container = await renderWithProviders(<DeliveryOnboardingPage />, '/delivery/onboarding')

    await setInputValue(container.querySelector('#appName') as HTMLInputElement, 'Draft Demo')
    await setInputValue(container.querySelector('#appKey') as HTMLInputElement, 'draft-demo')
    await setInputValue(container.querySelector('#serviceName') as HTMLInputElement, 'API')
    await setInputValue(container.querySelector('#serviceKey') as HTMLInputElement, 'api')
    await setInputValue(container.querySelector('#environmentKey') as HTMLInputElement, 'dev')
    await clickButton(findButton(container, '生成草稿'))

    expect(testState.apiPost).toHaveBeenCalledWith('/delivery/drafts', expect.objectContaining({
      applicationDraft: expect.objectContaining({ name: 'Draft Demo', key: 'draft-demo' }),
      services: expect.arrayContaining([expect.objectContaining({ key: 'api', name: 'API' })]),
      environmentBindings: expect.arrayContaining([expect.objectContaining({ environmentKey: 'dev' })]),
    }))
    expect(document.body.textContent).toContain('DeliveryDraft 预览确认')
    expect(document.body.textContent).toContain('确认前不会创建或修改平台对象')

    await clickButton(findButton(document, '确认创建交付对象'))

    expect(testState.apiPost).toHaveBeenCalledWith('/delivery/drafts/draft-1/confirm', {})
    expect(document.body.textContent).toContain('草稿已确认')
  })

  it('renders testing verification with candidate evidence and AI assist boundary', async () => {
    const container = await renderWithProviders(<DeliveryTestingPage />, '/delivery/testing')

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-bundles')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/execution-tasks')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-board')
    expect(container.textContent).toContain('测试验证')
    expect(container.textContent).toContain('候选版本')
    expect(container.textContent).toContain('验证任务')
    expect(container.textContent).toContain('AI Gateway 验证辅助')
    expect(testState.apiGet).toHaveBeenCalledWith('/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery-tester')
    expect(container.textContent).toContain('需要审批')
    expect(container.textContent).toContain('常规模式保持完整可用')
    expect(container.textContent).toContain('1.2.3')
    expect(container.textContent).toContain('可晋级')
  })

  it('renders issue analysis with failed task evidence and normal workflow links', async () => {
    const container = await renderWithProviders(<DeliveryAnalysisPage />, '/delivery/analysis')

    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/execution-tasks')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-board')
    expect(testState.apiGet).toHaveBeenCalledWith('/delivery/release-bundles')
    expect(container.textContent).toContain('问题分析')
    expect(container.textContent).toContain('失败任务')
    expect(container.textContent).toContain('AI Gateway 故障分析')
    expect(testState.apiGet).toHaveBeenCalledWith('/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery-tester')
    expect(container.textContent).toContain('AI Gateway 可直接辅助')
    expect(container.textContent).toContain('任务日志')
    expect(container.textContent).toContain('task-failed')
    expect(container.textContent).toContain('需处理')
    expect(container.textContent).toContain('查看影响面')
  })

  it('downgrades delivery AI entrypoints when Gateway capabilities are restricted', async () => {
    testState.gatewayManifestMode = 'restricted'
    const container = await renderWithProviders(<DeliveryOnboardingPage />, '/delivery/onboarding')

    expect(testState.apiGet).toHaveBeenCalledWith('/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery-developer')
    expect(container.textContent).toContain('AI Gateway 能力受限')
    expect(container.textContent).toContain('缺失能力')
    expect(container.textContent).toContain('delivery.onboarding.analyze_repo')
    expect(container.textContent).toContain('手工接入')
    expect(container.textContent).toContain('生成草稿')
  })
})
