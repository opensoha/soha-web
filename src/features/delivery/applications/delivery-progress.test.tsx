import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { WorkflowProgress, WorkloadProgress, executionStepStatus } from './delivery-progress'
import type { ApplicationRuntimeWorkload, DeliveryApplicationBindingSummary } from '../types'

const workload: ApplicationRuntimeWorkload = {
  applicationEnvironmentId: 'test',
  clusterId: 'c',
  namespace: 'ns',
  workloadName: 'web',
  workloadKind: 'Deployment',
  desiredReplicas: 3,
  updatedReplicas: 1,
  readyReplicas: 3,
  availableReplicas: 3,
}

it('keeps old ready replicas separate from the new rollout and handles zero and failure explicitly', () => {
  const rolling = renderToStaticMarkup(<WorkloadProgress workload={workload} />)
  expect(rolling).toContain('1 / 3 已更新')
  expect(rolling).toContain('3 / 3 已就绪')
  expect(rolling).not.toContain('当前版本已就绪')
  expect(rolling).toContain('data-status="process"')
  expect(rolling).not.toContain('data-status="finish"')
  expect(
    renderToStaticMarkup(
      <WorkloadProgress
        workload={{
          ...workload,
          desiredReplicas: 0,
          readyReplicas: 0,
          updatedReplicas: 0,
          availableReplicas: 0,
        }}
      />,
    ),
  ).toContain('data-status="wait"')
  expect(
    renderToStaticMarkup(<WorkloadProgress workload={{ ...workload, healthStatus: 'failed' }} />),
  ).toContain('data-status="error"')
  expect(
    renderToStaticMarkup(<WorkloadProgress workload={{ ...workload, workloadKind: 'Job' }} />),
  ).toBe('')
})

it('renders recorded node results without marking missing or skipped steps successful', () => {
  const binding: DeliveryApplicationBindingSummary = {
    applicationEnvironmentId: 'test',
    environmentId: 'test',
    targetCount: 1,
    requiresApproval: false,
    latestWorkflow: {
      id: 'run-1',
      applicationId: 'app',
      workflowName: 'release',
      createdAt: '',
      updatedAt: '',
      status: 'failed',
      steps: [],
      nodeRuns: [
        { nodeId: 'build', name: '构建镜像', type: 'build', status: 'succeeded' },
        {
          nodeId: 'deploy',
          name: '部署服务',
          type: 'deploy',
          status: 'failed',
          summary: '镜像无法拉取',
        },
      ],
    },
  }
  const output = renderToStaticMarkup(<WorkflowProgress binding={binding} />)
  expect(output).toContain('构建镜像')
  expect(output).toContain('镜像无法拉取')
  expect(executionStepStatus('running')).toBe('process')
  expect(executionStepStatus('succeeded')).toBe('finish')
  expect(executionStepStatus('failed')).toBe('error')
  expect(executionStepStatus('skipped')).toBe('wait')
  expect(executionStepStatus()).toBe('wait')
})
