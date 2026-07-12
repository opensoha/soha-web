import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import { BorderBeam, Button, Card, Dropdown, Popconfirm, Space, Tag } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import type { BorderBeamGradient, MenuProps } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { summarizeDeliveryBuildSignal, summarizeDeliveryValidationSignal } from '../delivery-status'
import {
  ApplicationCenterModals,
  defaultBuildSources,
  splitApplicationGroups,
  useApplicationCenterState,
} from '../application-center-model'
import { deliveryQueries } from '../queries'
import type { DeliveryApplication, ReleaseBoardEntry } from '../types'

type ApplicationWorkspaceCard = {
  app: DeliveryApplication
  bindings: ReleaseBoardEntry[]
  deliverySignal: { color: string; label: string }
  gateSignal: { color: string; label: string }
  activeTargets: number
  serviceClues: number
  latestEnvironmentName: string
  latestBundleLabel: string
  latestWorkflowLabel: string
  latestTaskLabel: string
  blockedReason: string
}

function summarizeApplicationRole(app: DeliveryApplication) {
  const language = app.language ? app.language.toUpperCase() : 'APP'
  return language
}

function applicationBeamTone(app: DeliveryApplication, index: number) {
  const seed = `${app.language || ''}:${app.key || app.id || app.name}`.toLowerCase()
  if (seed.includes('go')) return 'cyan'
  if (seed.includes('java')) return 'volcano'
  if (seed.includes('node') || seed.includes('js') || seed.includes('ts')) return 'lime'
  if (seed.includes('python') || seed.includes('py')) return 'purple'
  return ['blue', 'cyan', 'purple', 'lime', 'volcano'][index % 5]
}

function applicationBeamGradient(tone: string): BorderBeamGradient {
  switch (tone) {
    case 'cyan':
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-accent-cyan)', percent: 52 },
        { color: 'var(--soha-info)', percent: 100 },
      ]
    case 'purple':
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-graph-span)', percent: 48 },
        { color: 'var(--soha-graph-hypothesis)', percent: 100 },
      ]
    case 'lime':
      return [
        { color: 'var(--soha-success)', percent: 0 },
        { color: 'var(--soha-accent-teal)', percent: 54 },
        { color: 'var(--soha-warning)', percent: 100 },
      ]
    case 'volcano':
      return [
        { color: 'var(--soha-warning)', percent: 0 },
        { color: 'var(--soha-danger)', percent: 46 },
        { color: 'var(--soha-primary)', percent: 100 },
      ]
    default:
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-accent-cyan)', percent: 52 },
        { color: 'var(--soha-accent-teal)', percent: 100 },
      ]
  }
}

function summarizeApplicationServiceClues(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  const sourceIDs = new Set([
    ...(app.buildSources ?? []).map((source) => source.id || source.name || source.type),
    ...bindings
      .map(
        (binding) => binding.buildSourceId || binding.buildSource?.id || binding.buildSource?.name,
      )
      .filter(Boolean),
  ])
  return Math.max(sourceIDs.size, app.buildSources?.length ?? 0)
}

function summarizeEnvironmentCoverage(bindings: ReleaseBoardEntry[]) {
  const names = Array.from(
    new Set(
      bindings
        .map((item) => item.environmentName || item.environmentKey || item.environmentId)
        .filter(Boolean),
    ),
  )
  if (names.length === 0) return '尚未绑定环境'
  if (names.length === 1) return names[0]
  return `${names.slice(0, 2).join(' / ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`
}

function latestByUpdatedAt<T extends { updatedAt?: string; createdAt?: string }>(
  items: Array<T | undefined>,
) {
  return items
    .filter(Boolean)
    .sort(
      (a, b) =>
        Date.parse(b!.updatedAt || b!.createdAt || '') -
        Date.parse(a!.updatedAt || a!.createdAt || ''),
    )[0]
}

function summarizeLatestBundle(bindings: ReleaseBoardEntry[]) {
  const bundle = latestByUpdatedAt(bindings.map((binding) => binding.latestBundle))
  return bundle ? `${bundle.version} / ${bundle.status}` : '-'
}

function summarizeLatestWorkflow(bindings: ReleaseBoardEntry[]) {
  const workflow = latestByUpdatedAt(bindings.map((binding) => binding.latestWorkflow))
  return workflow ? `${workflow.workflowName} / ${workflow.status}` : '-'
}

function summarizeLatestTask(bindings: ReleaseBoardEntry[]) {
  const task = latestByUpdatedAt(bindings.map((binding) => binding.latestExecutionTask))
  return task ? `${task.taskKind} / ${task.status}` : '-'
}

function summarizeBlockedReason(bindings: ReleaseBoardEntry[]) {
  if (bindings.length === 0) return '未绑定环境'
  if (bindings.every((binding) => !binding.targets?.length)) return '未配置发布目标'
  const failedTask = latestByUpdatedAt(
    bindings
      .map((binding) => binding.latestExecutionTask)
      .filter((task) => task && ['failed', 'callback_timeout', 'canceled'].includes(task.status)),
  )
  if (failedTask) return `执行任务 ${failedTask.status}`
  const failedWorkflow = latestByUpdatedAt(
    bindings
      .map((binding) => binding.latestWorkflow)
      .filter((workflow) => workflow && ['failed', 'canceled'].includes(workflow.status)),
  )
  if (failedWorkflow) return `工作流 ${failedWorkflow.status}`
  if (bindings.some((binding) => binding.requiresApproval)) return '存在审批门禁'
  return '无阻塞'
}

function metadataText(metadata: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

export function ApplicationsPage() {
  const navigate = useNavigate()
  const managementState = useApplicationCenterState()
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [deleteConfirmApp, setDeleteConfirmApp] = useState<DeliveryApplication | null>(null)

  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const releaseBoardQuery = useQuery(deliveryQueries.releaseBoard.list())

  const boardByApp = useMemo(() => {
    const items = releaseBoardQuery.data ?? []
    return items.reduce<Record<string, ReleaseBoardEntry[]>>((acc, item) => {
      acc[item.applicationId] = [...(acc[item.applicationId] ?? []), item]
      return acc
    }, {})
  }, [releaseBoardQuery.data])
  const applicationCards = useMemo<ApplicationWorkspaceCard[]>(() => {
    return (applicationsQuery.data ?? []).map((app) => {
      const bindings = boardByApp[app.id] ?? []
      return {
        app,
        bindings,
        deliverySignal: summarizeDeliveryBuildSignal(bindings, { completedLabel: '最近已构建' }),
        gateSignal: summarizeDeliveryValidationSignal(bindings, { readyLabel: '可验证' }),
        activeTargets: bindings.reduce((sum, item) => sum + (item.targets?.length ?? 0), 0),
        serviceClues: summarizeApplicationServiceClues(app, bindings),
        latestEnvironmentName: summarizeEnvironmentCoverage(bindings),
        latestBundleLabel: summarizeLatestBundle(bindings),
        latestWorkflowLabel: summarizeLatestWorkflow(bindings),
        latestTaskLabel: summarizeLatestTask(bindings),
        blockedReason: summarizeBlockedReason(bindings),
      }
    })
  }, [applicationsQuery.data, boardByApp])
  const groupOptions = useMemo(() => {
    return ['all', ...managementState.applicationGroupOptions]
  }, [managementState.applicationGroupOptions])
  const visibleApplicationCards = useMemo(
    () =>
      applicationCards.filter(
        ({ app }) =>
          activeGroup === 'all' || splitApplicationGroups(app.group).includes(activeGroup),
      ),
    [activeGroup, applicationCards],
  )
  useEffect(() => {
    if (!groupOptions.includes(activeGroup)) {
      setActiveGroup('all')
    }
  }, [activeGroup, groupOptions])
  const openCreateApplication = () => {
    managementState.setEditingApp(null)
    managementState.setBuildSources(defaultBuildSources())
    managementState.setAppModalVisible(true)
  }
  const openOnboarding = () => {
    navigate('/delivery/onboarding')
  }
  const openEditApplication = (app: DeliveryApplication) => {
    managementState.setEditingApp(app)
    managementState.setBuildSources(app.buildSources ?? [])
    managementState.setAppModalVisible(true)
  }

  return (
    <div className="soha-page">
      <div className="soha-application-center-toolbar">
        <div className="soha-application-group-tags">
          {groupOptions.map((group) => (
            <Tag
              key={group}
              className={`soha-application-group-tag ${activeGroup === group ? 'is-active' : ''}`}
              variant="filled"
              onClick={() => setActiveGroup(group)}
            >
              {group === 'all' ? '全部' : group}
            </Tag>
          ))}
        </div>
        <Space className="soha-application-center-toolbar__actions" size={8} wrap>
          <Button icon={<RocketOutlined />} onClick={openOnboarding}>
            接入应用/服务
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!managementState.canCreateApplication}
            onClick={openCreateApplication}
          >
            新建应用档案
          </Button>
        </Space>
      </div>

      {applicationsQuery.isLoading || releaseBoardQuery.isLoading ? (
        <ManagementState kind="loading" />
      ) : visibleApplicationCards.length > 0 ? (
        <div className="soha-application-card-list">
          {visibleApplicationCards.map(
            (
              {
                app,
                bindings,
                deliverySignal,
                gateSignal,
                activeTargets,
                serviceClues,
                latestEnvironmentName,
                latestBundleLabel,
                latestWorkflowLabel,
                latestTaskLabel,
                blockedReason,
              },
              index,
            ) => {
              const beamTone = applicationBeamTone(app, index)
              const ownerTeam = metadataText(app.metadata, 'ownerTeam', 'owner', 'team')
              const actionMenuItems: MenuProps['items'] = [
                ...(managementState.canUpdateApplication
                  ? [{ key: 'edit', icon: <EditOutlined />, label: '编辑' }]
                  : []),
                ...(managementState.canDeleteApplication
                  ? [{ key: 'delete', danger: true, icon: <DeleteOutlined />, label: '删除' }]
                  : []),
              ]
              return (
                <BorderBeam key={app.id} color={applicationBeamGradient(beamTone)} outset={0}>
                  <Card
                    className="soha-application-card"
                    hoverable
                    onClick={() => navigate(`/applications/${app.id}`)}
                  >
                    <div className="soha-application-card__header">
                      <div className="soha-application-card__title-wrap">
                        <div className="soha-application-card__title-row">
                          <h3 className="soha-application-card__title">{app.name}</h3>
                        </div>
                        <div className="soha-application-card__subline">
                          <Tag className="soha-application-card__language-tag" color={beamTone}>
                            {summarizeApplicationRole(app)}
                          </Tag>
                          <Tag>{app.key}</Tag>
                          {ownerTeam ? <Tag>{ownerTeam}</Tag> : null}
                          <Tag
                            className="soha-application-card__state-tag"
                            color={app.enabled ? 'success' : 'default'}
                          >
                            {app.enabled ? 'enabled' : 'disabled'}
                          </Tag>
                        </div>
                      </div>
                      <div className="soha-application-card__header-actions">
                        {actionMenuItems.length > 0 ? (
                          <Popconfirm
                            title="确认删除应用？"
                            description={
                              deleteConfirmApp?.id === app.id
                                ? `删除 ${app.name} 后不可恢复。`
                                : undefined
                            }
                            open={deleteConfirmApp?.id === app.id}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            placement="bottomRight"
                            onCancel={(event) => {
                              event?.stopPropagation()
                              setDeleteConfirmApp(null)
                            }}
                            onConfirm={(event) => {
                              event?.stopPropagation()
                              managementState.deleteAppMutation.mutate(app.id)
                              setDeleteConfirmApp(null)
                            }}
                            onOpenChange={(open) => {
                              if (!open && deleteConfirmApp?.id === app.id) {
                                setDeleteConfirmApp(null)
                              }
                            }}
                          >
                            <Dropdown
                              trigger={['click']}
                              placement="bottomRight"
                              menu={{
                                items: actionMenuItems,
                                onClick: ({ key, domEvent }) => {
                                  domEvent.stopPropagation()
                                  if (key === 'edit') {
                                    openEditApplication(app)
                                  }
                                  if (key === 'delete') {
                                    setDeleteConfirmApp(app)
                                  }
                                },
                              }}
                            >
                              <Button
                                aria-label={`${app.name} 操作`}
                                className="soha-application-card__more"
                                icon={<MoreOutlined />}
                                size="small"
                                type="text"
                                onClick={(event) => event.stopPropagation()}
                              />
                            </Dropdown>
                          </Popconfirm>
                        ) : null}
                      </div>
                    </div>

                    <div className="soha-application-card__signals">
                      <Tag color={deliverySignal.color}>{`交付: ${deliverySignal.label}`}</Tag>
                      <Tag color={gateSignal.color}>{`门禁: ${gateSignal.label}`}</Tag>
                      <Tag
                        color={blockedReason === '无阻塞' ? 'success' : 'warning'}
                      >{`阻塞: ${blockedReason}`}</Tag>
                    </div>

                    <div className="soha-application-card__stats">
                      <div className="soha-application-card__stat">
                        <Tag className="soha-application-card__metric-tag" color="processing">
                          服务线索 {serviceClues}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat">
                        <Tag
                          className="soha-application-card__metric-tag"
                          color={
                            (bindings.length || app.environmentCount || 0) > 0
                              ? 'success'
                              : 'default'
                          }
                        >
                          环境 {bindings.length || app.environmentCount || 0}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat">
                        <Tag
                          className="soha-application-card__metric-tag"
                          color={activeTargets > 0 ? 'geekblue' : 'default'}
                        >
                          目标 {activeTargets}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat is-wide">
                        <Tag
                          className="soha-application-card__metric-tag soha-application-card__metric-tag--wide"
                          color={bindings.length > 0 ? 'purple' : 'default'}
                        >
                          最近环境 {latestEnvironmentName}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat is-wide">
                        <Tag
                          className="soha-application-card__metric-tag soha-application-card__metric-tag--wide"
                          color={latestBundleLabel === '-' ? 'default' : 'blue'}
                        >
                          Bundle {latestBundleLabel}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat is-wide">
                        <Tag
                          className="soha-application-card__metric-tag soha-application-card__metric-tag--wide"
                          color={latestWorkflowLabel === '-' ? 'default' : 'cyan'}
                        >
                          Workflow {latestWorkflowLabel}
                        </Tag>
                      </div>
                      <div className="soha-application-card__stat is-wide">
                        <Tag
                          className="soha-application-card__metric-tag soha-application-card__metric-tag--wide"
                          color={latestTaskLabel === '-' ? 'default' : 'geekblue'}
                        >
                          Task {latestTaskLabel}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </BorderBeam>
              )
            },
          )}
        </div>
      ) : (
        <Card className="soha-application-empty-card">
          <ManagementState
            bordered={false}
            compact
            title={activeGroup === 'all' ? '暂无应用' : '分组暂无应用'}
            description=""
          />
        </Card>
      )}
      <ApplicationCenterModals state={managementState} />
    </div>
  )
}
