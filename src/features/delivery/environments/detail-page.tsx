import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Input, Select, Space, Tag, Typography } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { DeliveryTable } from '../delivery-table'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { ApplicationEnvironment, WorkflowRun } from '../types'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

interface ReleaseRecord {
  id: string
  applicationId: string
  clusterId: string
  namespace: string
  deploymentName: string
  status: string
  createdAt: string
}

function matchesBindingTarget(
  target: NonNullable<ApplicationEnvironment['targets']>[number] | undefined,
  clusterId: string,
  namespace: string,
  deploymentName: string,
) {
  if (!target) return false
  return (
    target.clusterId === clusterId &&
    target.namespace === namespace &&
    target.workloadName === deploymentName &&
    target.workloadKind.toLowerCase() === 'deployment' &&
    target.enabled !== false
  )
}

function pickLatest<T>(
  items: T[],
  matcher: (item: T) => boolean,
  timeSelector: (item: T) => string,
) {
  return items
    .filter(matcher)
    .sort(
      (left, right) =>
        new Date(timeSelector(right)).getTime() - new Date(timeSelector(left)).getTime(),
    )[0]
}

function findLatestWorkflowForTarget(
  target: NonNullable<ApplicationEnvironment['targets']>[number],
  binding: ApplicationEnvironment,
  workflows: WorkflowRun[],
) {
  return pickLatest(
    workflows,
    (item) =>
      item.applicationId === binding.applicationId &&
      matchesBindingTarget(
        target,
        item.clusterId ?? '',
        item.namespace ?? '',
        item.deploymentName ?? '',
      ),
    (item) => item.updatedAt,
  )
}

function findLatestReleaseForTarget(
  target: NonNullable<ApplicationEnvironment['targets']>[number],
  binding: ApplicationEnvironment,
  releases: ReleaseRecord[],
) {
  return pickLatest(
    releases,
    (item) =>
      item.applicationId === binding.applicationId &&
      matchesBindingTarget(target, item.clusterId, item.namespace, item.deploymentName),
    (item) => item.createdAt,
  )
}

function summarizeLatestActivity(
  localeCode: 'zh_CN' | 'en_US',
  build?: { createdAt: string },
  workflow?: { updatedAt: string },
  release?: { createdAt: string },
) {
  if (release?.createdAt) {
    return localeCode === 'zh_CN'
      ? `最近发布 ${formatDateTime(release.createdAt)}`
      : `Latest release ${formatDateTime(release.createdAt)}`
  }
  if (workflow?.updatedAt) {
    return localeCode === 'zh_CN'
      ? `最近工作流 ${formatDateTime(workflow.updatedAt)}`
      : `Latest workflow ${formatDateTime(workflow.updatedAt)}`
  }
  if (build?.createdAt) {
    return localeCode === 'zh_CN'
      ? `最近构建 ${formatDateTime(build.createdAt)}`
      : `Latest build ${formatDateTime(build.createdAt)}`
  }
  return localeCode === 'zh_CN' ? '暂无执行记录' : 'No execution history'
}

export function ApplicationEnvironmentDetailPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const { applicationEnvironmentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [imageTag, setImageTag] = useState('')
  const [releaseName, setReleaseName] = useState('')
  const [containerName, setContainerName] = useState('')
  const [rollbackRevision, setRollbackRevision] = useState('')
  const focusedReleaseId = searchParams.get('releaseId')?.trim() ?? ''
  const canViewReleaseBoard = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.release-board.view',
  )
  const canTriggerWorkflow = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.workflows.trigger',
  )
  const canTriggerRelease = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.releases.trigger',
  )
  const canRollbackDeployment = hasPermission(
    permissionSnapshotQuery.data?.data,
    'platform.deployment.rollback',
  )
  const backPath = canViewReleaseBoard ? '/release-board' : '/application-environments'
  const backLabel = canViewReleaseBoard
    ? localeCode === 'zh_CN'
      ? '返回发布看板'
      : 'Back to Release Board'
    : localeCode === 'zh_CN'
      ? '返回应用环境绑定'
      : 'Back to App Environment Bindings'

  const bindingQuery = useQuery(
    deliveryQueries.environments.detail(
      applicationEnvironmentId ?? '',
      Boolean(applicationEnvironmentId),
    ),
  )
  const workflowsQuery = useQuery(deliveryQueries.workflows.list())
  const releasesQuery = useQuery(deliveryQueries.releases.list())

  const detail = bindingQuery.data
  const binding = detail?.binding
  const latestBuild = detail?.latestBuild
  const latestWorkflow = detail?.latestWorkflow
  const latestRelease = detail?.latestRelease

  useEffect(() => {
    if (!binding?.targets?.length) {
      setSelectedTargetId('')
      return
    }
    if (selectedTargetId && binding.targets.some((target) => target.id === selectedTargetId)) {
      return
    }
    setSelectedTargetId(binding.targets[0].id)
  }, [binding, selectedTargetId])

  const selectedTarget = useMemo(
    () =>
      binding?.targets?.find((target) => target.id === selectedTargetId) ?? binding?.targets?.[0],
    [binding, selectedTargetId],
  )

  useEffect(() => {
    if (!selectedTarget) {
      setContainerName('')
      return
    }
    setContainerName(selectedTarget.containerName || '')
  }, [selectedTarget])

  useEffect(() => {
    if (!detail?.buildSource?.defaultTag || imageTag) return
    setImageTag(detail.buildSource.defaultTag)
  }, [detail, imageTag])

  const rolloutHistoryQuery = useQuery(
    deliveryQueries.deployments.rollouts(
      {
        clusterId: selectedTarget?.clusterId ?? '',
        namespace: selectedTarget?.namespace ?? '',
        workloadName: selectedTarget?.workloadName ?? '',
      },
      Boolean(selectedTarget && selectedTarget.workloadKind.toLowerCase() === 'deployment'),
    ),
  )

  useEffect(() => {
    const rollouts = rolloutHistoryQuery.data ?? []
    if (rollbackRevision && rollouts.some((item) => item.revision === rollbackRevision)) {
      return
    }
    if (rollouts.length > 1) {
      setRollbackRevision(rollouts[1].revision)
      return
    }
    setRollbackRevision('')
  }, [rollbackRevision, rolloutHistoryQuery.data])

  const targetRows = useMemo(() => {
    if (!binding) return []
    return (binding.targets ?? []).map((target) => ({
      ...target,
      latestWorkflow: findLatestWorkflowForTarget(target, binding, workflowsQuery.data ?? []),
      latestRelease: findLatestReleaseForTarget(target, binding, releasesQuery.data ?? []),
    }))
  }, [binding, workflowsQuery.data, releasesQuery.data])

  const targetColumns: ColumnProps<(typeof targetRows)[number]>[] = [
    { title: t('common.cluster', 'Cluster'), dataIndex: 'clusterId' },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace' },
    {
      title: localeCode === 'zh_CN' ? '工作负载' : 'Workload',
      dataIndex: 'workloadName',
      render: (_: string, record) => `${record.workloadKind} / ${record.workloadName}`,
    },
    {
      title: t('common.container', 'Container'),
      dataIndex: 'containerName',
      render: (value: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '启用' : 'Enabled',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    {
      title: 'Workflow',
      dataIndex: 'latestWorkflow',
      render: (_: unknown, record) => (
        <StatusTag value={record.latestWorkflow?.status || 'unknown'} />
      ),
    },
    {
      title: 'Release',
      dataIndex: 'latestRelease',
      render: (_: unknown, record) => (
        <Space size={6} wrap>
          <StatusTag value={record.latestRelease?.status || 'unknown'} />
          {record.latestRelease?.id === focusedReleaseId ? <Tag color="blue">已定位</Tag> : null}
        </Space>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '最近动作' : 'Latest Activity',
      dataIndex: 'latestRelease',
      render: (_: unknown, record) =>
        summarizeLatestActivity(localeCode, undefined, record.latestWorkflow, record.latestRelease),
    },
  ]

  const workflowOptions = deliveryMutations.workflows.trigger(queryClient)
  const workflowMutation = useMutation({
    ...workflowOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void workflowOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(localeCode === 'zh_CN' ? '工作流已触发' : 'Workflow triggered')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const releaseOptions = deliveryMutations.releases.trigger(queryClient)
  const releaseMutation = useMutation({
    ...releaseOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void releaseOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(localeCode === 'zh_CN' ? '发布已触发' : 'Release triggered')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const rollbackOptions = deliveryMutations.deployments.rollback(queryClient)
  const rollbackMutation = useMutation({
    ...rollbackOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void rollbackOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(localeCode === 'zh_CN' ? '回滚已触发' : 'Rollback triggered')
    },
    onError: (err: Error) => message.error(err.message),
  })

  if (bindingQuery.isLoading) {
    return (
      <div className="soha-page">
        <ManagementDetailHeader
          title={localeCode === 'zh_CN' ? '环境详情' : 'Environment Detail'}
          description={
            localeCode === 'zh_CN'
              ? '加载应用环境绑定详情。'
              : 'Loading application-environment binding details.'
          }
        />
        <ManagementState kind="loading" title={t('common.loading', 'Loading...')} />
      </div>
    )
  }

  if (!binding) {
    return (
      <div className="soha-page">
        <ManagementDetailHeader
          title={localeCode === 'zh_CN' ? '环境详情' : 'Environment Detail'}
          description={
            localeCode === 'zh_CN'
              ? '当前绑定不存在或已被删除。'
              : 'The current binding does not exist or has been removed.'
          }
          actions={<Button onClick={() => navigate(backPath)}>{backLabel}</Button>}
        />
        <ManagementState
          kind="not-found"
          description={
            localeCode === 'zh_CN'
              ? '未找到应用环境绑定'
              : 'Application-environment binding not found'
          }
        />
      </div>
    )
  }

  const application = detail?.application
  const environment = detail?.environment
  const selectedTargetIsDeployment = selectedTarget?.workloadKind.toLowerCase() === 'deployment'
  const selectedTargetSupportsDirectRelease =
    !!selectedTarget &&
    (selectedTarget.executorKind !== 'k8s_job_runner' ||
      selectedTarget.targetKind !== 'k8s_workload' ||
      selectedTargetIsDeployment)
  const targetOptions = (binding.targets ?? []).map((target) => ({
    value: target.id,
    label: `${target.clusterId} / ${target.namespace} / ${target.workloadName}`,
  }))
  const rolloutOptions = (rolloutHistoryQuery.data ?? [])
    .filter((item) => item.revision)
    .map((item) => ({
      value: item.revision,
      label: `${item.revision}${item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}`,
    }))
  const releaseImagePreview =
    detail?.buildSource?.buildImage && (imageTag.trim() || detail.buildSource.defaultTag)
      ? `${detail.buildSource.buildImage}:${imageTag.trim() || detail.buildSource.defaultTag}`
      : ''
  const releaseActionLabel =
    detail?.actionKind === 'release'
      ? localeCode === 'zh_CN'
        ? '触发发布'
        : 'Trigger Release'
      : localeCode === 'zh_CN'
        ? '触发部署'
        : 'Trigger Deploy'

  const triggerWorkflow = () => {
    if (!binding || !selectedTarget) {
      message.error(t('common.selectTarget', 'Select a release target'))
      return
    }
    workflowMutation.mutate({
      applicationId: binding.applicationId,
      workflowName:
        binding.workflowTemplate?.key || binding.workflowTemplate?.name || 'build-release-verify',
      clusterId: selectedTarget.clusterId,
      namespace: selectedTarget.namespace,
      deploymentName: selectedTarget.workloadName,
      triggerBuild: true,
      triggerRelease: false,
    })
  }

  const triggerRelease = () => {
    if (!binding || !selectedTarget) {
      message.error(t('common.selectTarget', 'Select a release target'))
      return
    }
    const effectiveImageTag = imageTag.trim() || detail?.buildSource?.defaultTag || ''
    if (!effectiveImageTag) {
      message.error(
        localeCode === 'zh_CN'
          ? '请提供 Image Tag，或先在应用中配置默认 Tag'
          : 'Provide an image tag, or configure a default tag on the application first',
      )
      return
    }
    releaseMutation.mutate({
      applicationId: binding.applicationId,
      applicationEnvironmentId: binding.id,
      clusterId: selectedTarget.clusterId,
      namespace: selectedTarget.namespace,
      deploymentName: selectedTarget.workloadName,
      containerName: containerName.trim() || selectedTarget.containerName || '',
      image: releaseImagePreview || undefined,
      imageTag: effectiveImageTag,
      releaseName: releaseName.trim(),
      actionKind: detail?.actionKind || 'deploy',
    })
  }

  const triggerRollback = () => {
    if (!selectedTarget) {
      message.error(t('common.selectTarget', 'Select a release target'))
      return
    }
    if (!rollbackRevision) {
      message.error(t('common.selectRevision', 'Select a revision to roll back to'))
      return
    }
    rollbackMutation.mutate({
      clusterId: selectedTarget.clusterId,
      namespace: selectedTarget.namespace,
      workloadName: selectedTarget.workloadName,
      revision: rollbackRevision,
    })
  }

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={`${application?.name || binding.applicationId} / ${environment?.name || binding.environmentKey || binding.environmentId}`}
        description={
          localeCode === 'zh_CN'
            ? '查看单个应用环境绑定的工作流模板、发布目标和最新执行状态。'
            : 'Inspect the workflow template, release targets, and latest execution state for a single application-environment binding.'
        }
        actions={<Button onClick={() => navigate(backPath)}>{backLabel}</Button>}
      />
      {focusedReleaseId ? (
        <Alert
          showIcon
          title={
            latestRelease?.id === focusedReleaseId
              ? `已定位发布 ${latestRelease.id}`
              : '发布记录定位'
          }
          description={`releaseId=${focusedReleaseId}`}
          type={
            latestRelease?.id === focusedReleaseId || bindingQuery.isLoading ? 'info' : 'warning'
          }
        />
      ) : null}
      <Card className="soha-management-panel-card">
        <Descriptions
          items={[
            {
              key: 'environmentKey',
              label: localeCode === 'zh_CN' ? '环境 Key' : 'Environment Key',
              children: binding.environmentKey || environment?.key || '-',
            },
            {
              key: 'workflowTemplate',
              label: localeCode === 'zh_CN' ? '发布流程模板' : 'Workflow Template',
              children: binding.workflowTemplate?.name || '-',
            },
            {
              key: 'templateCategory',
              label: localeCode === 'zh_CN' ? '模板分类' : 'Template Category',
              children: binding.workflowTemplate?.category || '-',
            },
            {
              key: 'buildSource',
              label: localeCode === 'zh_CN' ? '构建来源' : 'Build Source',
              children: detail?.buildSource?.name || binding.buildPolicy?.sourceId || '-',
            },
            {
              key: 'strategyProfile',
              label: localeCode === 'zh_CN' ? '策略 Profile' : 'Strategy Profile',
              children: binding.strategyProfileId || '-',
            },
            {
              key: 'approvalGate',
              label: localeCode === 'zh_CN' ? '审批配置' : 'Approval Gate',
              children:
                localeCode === 'zh_CN'
                  ? '由发布流程模板中的审批节点配置'
                  : 'Configured by approval nodes in the workflow template',
            },
            {
              key: 'latestBundle',
              label: localeCode === 'zh_CN' ? '最新 Bundle' : 'Latest Bundle',
              children: <StatusTag value={detail?.latestBundle?.status || 'unknown'} />,
            },
            {
              key: 'latestTask',
              label: localeCode === 'zh_CN' ? '最新任务' : 'Latest Task',
              children: <StatusTag value={detail?.latestExecutionTask?.status || 'unknown'} />,
            },
            {
              key: 'latestBuild',
              label: localeCode === 'zh_CN' ? '最新 Build' : 'Latest Build',
              children: <StatusTag value={latestBuild?.status || 'unknown'} />,
            },
            {
              key: 'latestWorkflow',
              label: localeCode === 'zh_CN' ? '最新 Workflow' : 'Latest Workflow',
              children: <StatusTag value={latestWorkflow?.status || 'unknown'} />,
            },
            {
              key: 'latestRelease',
              label: localeCode === 'zh_CN' ? '最新 Release' : 'Latest Release',
              children: (
                <Space size={6} wrap>
                  <StatusTag value={latestRelease?.status || 'unknown'} />
                  {latestRelease?.id === focusedReleaseId ? <Tag color="blue">已定位</Tag> : null}
                </Space>
              ),
            },
            {
              key: 'latestActivity',
              label: localeCode === 'zh_CN' ? '最近活动' : 'Latest Activity',
              children: summarizeLatestActivity(
                localeCode,
                latestBuild,
                latestWorkflow,
                latestRelease,
              ),
            },
          ]}
        />
      </Card>
      <Card
        className="soha-management-panel-card"
        title={localeCode === 'zh_CN' ? '交付动作' : 'Delivery Actions'}
      >
        <div className="soha-delivery-action-grid">
          <div className="soha-delivery-action-block">
            <Text strong>{localeCode === 'zh_CN' ? '发布目标' : 'Release Target'}</Text>
            <Select
              value={selectedTarget?.id}
              options={targetOptions}
              onChange={(value) => setSelectedTargetId(String(value))}
              placeholder={
                localeCode === 'zh_CN' ? '选择目标 deployment' : 'Select target deployment'
              }
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {binding.workflowTemplate?.name
                ? `${localeCode === 'zh_CN' ? '工作流模板' : 'Workflow Template'}: ${binding.workflowTemplate.name}${binding.workflowTemplate.category ? ` / ${binding.workflowTemplate.category}` : ''}`
                : localeCode === 'zh_CN'
                  ? '当前未绑定工作流模板，将使用默认流程名'
                  : 'No workflow template is bound. The default workflow name will be used.'}
            </Text>
          </div>
          <div className="soha-delivery-action-block">
            <Text strong>{localeCode === 'zh_CN' ? '触发工作流' : 'Trigger Workflow'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {localeCode === 'zh_CN'
                ? '生成一条 workflow run，只做流程编排，不直接改 deployment 镜像。'
                : 'Create a workflow run for orchestration only without directly changing the deployment image.'}
            </Text>
            <Button
              icon={<PlayCircleOutlined />}
              type="primary"
              onClick={triggerWorkflow}
              loading={workflowMutation.isPending}
              disabled={!canTriggerWorkflow || !selectedTarget}
            >
              {localeCode === 'zh_CN' ? '触发工作流' : 'Trigger Workflow'}
            </Button>
          </div>
          <div className="soha-delivery-action-block">
            <Text strong>{localeCode === 'zh_CN' ? '触发发布' : 'Trigger Release'}</Text>
            <Input
              value={imageTag}
              onChange={(event) => setImageTag(event.target.value)}
              placeholder={
                localeCode === 'zh_CN'
                  ? 'Image Tag，默认取应用默认 Tag'
                  : 'Image tag, defaulting to the application default tag'
              }
            />
            <Input
              value={releaseName}
              onChange={(event) => setReleaseName(event.target.value)}
              placeholder={
                localeCode === 'zh_CN'
                  ? 'Release Name，可留空自动生成'
                  : 'Release name, leave empty to auto-generate'
              }
            />
            <Input
              value={containerName}
              onChange={(event) => setContainerName(event.target.value)}
              placeholder={
                localeCode === 'zh_CN'
                  ? 'Container Name，可留空使用绑定值'
                  : 'Container name, leave empty to use the binding value'
              }
            />
            {releaseImagePreview ? (
              <Text
                type="secondary"
                style={{ fontSize: 12 }}
              >{`${localeCode === 'zh_CN' ? '目标镜像' : 'Target Image'}: ${releaseImagePreview}`}</Text>
            ) : null}
            {!selectedTargetSupportsDirectRelease ? (
              <Text type="warning">
                {localeCode === 'zh_CN'
                  ? '当前目标暂不支持直接发布。'
                  : 'The current target does not support direct release yet.'}
              </Text>
            ) : null}
            <Button
              icon={<SendOutlined />}
              type="primary"
              onClick={triggerRelease}
              loading={releaseMutation.isPending}
              disabled={
                !canTriggerRelease || !selectedTarget || !selectedTargetSupportsDirectRelease
              }
            >
              {releaseActionLabel}
            </Button>
          </div>
          <div className="soha-delivery-action-block">
            <Text strong>{localeCode === 'zh_CN' ? '回滚' : 'Rollback'}</Text>
            <Select
              value={rollbackRevision || undefined}
              options={rolloutOptions}
              onChange={(value) => setRollbackRevision(String(value))}
              placeholder={t('common.selectRevision', 'Select a revision to roll back to')}
              loading={rolloutHistoryQuery.isLoading}
              disabled={!selectedTarget || rolloutOptions.length === 0}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {!selectedTargetIsDeployment
                ? localeCode === 'zh_CN'
                  ? '当前目标不是 Deployment，暂不支持回滚。'
                  : 'The current target is not a Deployment, so rollback is not supported yet.'
                : rolloutOptions.length > 0
                  ? localeCode === 'zh_CN'
                    ? '回滚会直接对目标 deployment 发起 Kubernetes rollback。'
                    : 'Rollback will issue a Kubernetes rollback directly against the target deployment.'
                  : localeCode === 'zh_CN'
                    ? '当前没有可用的 rollout history。'
                    : 'No rollout history is currently available.'}
            </Text>
            <Button
              icon={<ReloadOutlined />}
              danger
              onClick={triggerRollback}
              loading={rollbackMutation.isPending}
              disabled={
                !canRollbackDeployment ||
                !selectedTarget ||
                !selectedTargetIsDeployment ||
                !rollbackRevision
              }
            >
              {localeCode === 'zh_CN' ? '回滚到所选版本' : 'Rollback to Selected Revision'}
            </Button>
          </div>
        </div>
      </Card>
      <DeliveryTable
        title={localeCode === 'zh_CN' ? '发布目标' : 'Release Targets'}
        columns={targetColumns}
        dataSource={targetRows}
        rowKey="id"
        pagination={false}
      />
      <Card
        className="soha-management-panel-card"
        title={localeCode === 'zh_CN' ? 'Workflow Template 定义' : 'Workflow Template Definition'}
      >
        {binding.workflowTemplate?.definition ? (
          <pre className="soha-json-block">
            {JSON.stringify(binding.workflowTemplate.definition, null, 2)}
          </pre>
        ) : (
          <ManagementState
            bordered={false}
            compact
            kind="not-configured"
            description={
              localeCode === 'zh_CN'
                ? '当前未配置工作流模板定义'
                : 'No workflow template definition is configured'
            }
          />
        )}
      </Card>
      <Card
        className="soha-management-panel-card"
        title={localeCode === 'zh_CN' ? '构建与发布策略' : 'Build and Release Policy'}
      >
        <Descriptions
          items={[
            {
              key: 'buildPolicy',
              label: 'Build Policy',
              children: (
                <pre className="soha-json-block">
                  {JSON.stringify(binding.buildPolicy ?? {}, null, 2)}
                </pre>
              ),
            },
            {
              key: 'releasePolicy',
              label: 'Release Policy',
              children: (
                <pre className="soha-json-block">
                  {JSON.stringify(binding.releasePolicy ?? {}, null, 2)}
                </pre>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
