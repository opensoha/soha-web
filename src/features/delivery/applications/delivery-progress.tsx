import { Grid, Steps, Typography } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import {
  analyzeReleaseDagDefinition,
  getDefaultReleaseDagNodeLabel,
} from '@/components/release-flow-dag-definition'
import { StatusTag } from '@/components/status-tag'
import type { ApplicationRuntimeWorkload, DeliveryApplicationBindingSummary } from '../types'

export function executionStepStatus(status?: string): 'wait' | 'process' | 'finish' | 'error' {
  if (['succeeded', 'success', 'completed', 'passed'].includes(status || '')) return 'finish'
  if (
    ['failed', 'error', 'cancelled', 'canceled', 'rejected', 'timeout', 'timed_out'].includes(
      status || '',
    )
  )
    return 'error'
  if (['running', 'building', 'deploying', 'in_progress'].includes(status || '')) return 'process'
  return 'wait'
}

export function WorkflowProgress({ binding }: { binding: DeliveryApplicationBindingSummary }) {
  const screens = Grid.useBreakpoint()
  const run = binding.latestWorkflow
  const nodes = run?.nodeRuns?.length
    ? run.nodeRuns
    : run?.steps?.length
      ? run.steps.map((step, index) => ({ ...step, nodeId: String(index), type: '' }))
      : binding.workflowTemplate
        ? analyzeReleaseDagDefinition(binding.workflowTemplate.definition).definition.nodes.map(
            (node) => ({
              nodeId: node.id,
              name: node.name,
              type: node.type,
              status: 'unknown',
              summary: '',
            }),
          )
        : []
  if (!nodes.length) return <Typography.Text type="secondary">暂无执行步骤</Typography.Text>
  return (
    <div className="soha-delivery-progress" aria-label="工作流步骤">
      <Steps
        type={screens.md ? 'panel' : 'default'}
        orientation={screens.md ? 'horizontal' : 'vertical'}
        size="small"
        variant="outlined"
        current={nodes.findIndex((node) =>
          ['process', 'error'].includes(executionStepStatus(node.status)),
        )}
        items={nodes.map((node) => ({
          title: node.name || node.nodeId,
          status: executionStepStatus(node.status),
          icon:
            executionStepStatus(node.status) === 'process' ? <LoadingOutlined spin /> : undefined,
          content: (
            <div className="soha-delivery-step-content">
              <StatusTag
                value={node.status}
                label={node.status === 'unknown' ? (run ? '无步骤记录' : '未运行') : undefined}
              />
              {node.summary ? (
                <span title={node.summary}>{node.summary}</span>
              ) : node.type ? (
                <span>
                  {getDefaultReleaseDagNodeLabel(
                    node.type as Parameters<typeof getDefaultReleaseDagNodeLabel>[0],
                  )}
                </span>
              ) : null}
            </div>
          ),
        }))}
      />
    </div>
  )
}

export function WorkloadProgress({ workload }: { workload: ApplicationRuntimeWorkload }) {
  if (!['deployment', 'statefulset', 'daemonset'].includes(workload.workloadKind.toLowerCase()))
    return null
  const {
    desiredReplicas: desired,
    updatedReplicas: updated,
    readyReplicas: ready,
    availableReplicas: available,
  } = workload
  if (![desired, updated, ready, available].every((value) => Number.isFinite(value) && value >= 0))
    return null
  const failed = ['failed', 'error', 'critical', 'unavailable'].includes(
    workload.healthStatus || '',
  )
  const updating = desired > 0 && updated < desired
  return (
    <section
      className="soha-delivery-progress soha-rollout-progress"
      aria-label={`${workload.workloadName} 更新状态`}
    >
      <ul className="soha-rollout-stages">
        {[
          {
            title: '更新副本',
            content: `${updated} / ${desired} 已更新`,
            status: desired === 0 ? 'wait' : updating ? (failed ? 'error' : 'process') : 'finish',
          },
          {
            title: '实例就绪',
            content: `${ready} / ${desired} 已就绪`,
            status:
              desired === 0
                ? 'wait'
                : ready >= desired && !updating
                  ? 'finish'
                  : failed
                    ? 'error'
                    : 'process',
          },
          {
            title: '服务可用',
            content: `${available} / ${desired} 可用`,
            status:
              desired === 0
                ? 'wait'
                : available >= desired && !updating
                  ? 'finish'
                  : failed
                    ? 'error'
                    : 'wait',
          },
        ].map((step) => (
          <li key={step.title} data-status={step.status}>
            {step.status === 'finish' ? (
              <CheckCircleOutlined />
            ) : step.status === 'error' ? (
              <CloseCircleOutlined />
            ) : step.status === 'process' ? (
              <LoadingOutlined spin />
            ) : (
              <ClockCircleOutlined />
            )}
            <div>
              <strong>{step.title}</strong>
              <span>{step.content}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
