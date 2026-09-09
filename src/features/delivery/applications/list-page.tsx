import { useMemo, useState } from 'react'
import './styles.css'
import { App, Button, Card, Dropdown, Select, Typography } from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  ApplicationCenterModals,
  splitApplicationGroups,
  useApplicationCenterState,
} from '../application-center-model'
import { deliveryQueries } from '../queries'
import type { DeliveryApplication, ReleaseBoardEntry } from '../types'
import { ApplicationEntryModal, type ApplicationEntryMode } from '../workbench/onboarding-page'

const { Text } = Typography

type ApplicationListRow = {
  app: DeliveryApplication
  activeTargets: number | null
  environmentCount: number
}

type ApplicationListFilters = {
  group?: string
  search?: string
}

export function ApplicationsPage() {
  const { modal } = App.useApp()
  const managementState = useApplicationCenterState()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<ApplicationListFilters>({ group: 'all', search: '' })
  const requestedMode = searchParams.get('mode')
  const entryMode: ApplicationEntryMode =
    requestedMode === 'manual' || requestedMode === 'ai' ? requestedMode : 'quick'
  const entryOpen = searchParams.get('action') === 'create'

  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const canViewReleaseBoard = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.release-board.view',
  )
  const releaseBoardQuery = useQuery(
    deliveryQueries.releaseBoard.list({ enabled: canViewReleaseBoard }),
  )

  const boardByApp = useMemo(() => {
    return (releaseBoardQuery.data ?? []).reduce<Record<string, ReleaseBoardEntry[]>>(
      (acc, item) => {
        acc[item.applicationId] = [...(acc[item.applicationId] ?? []), item]
        return acc
      },
      {},
    )
  }, [releaseBoardQuery.data])

  const applicationRows = useMemo<ApplicationListRow[]>(
    () =>
      (applicationsQuery.data ?? []).map((app) => {
        const bindings = boardByApp[app.id] ?? []
        const hasBoardData = canViewReleaseBoard && releaseBoardQuery.data !== undefined
        return {
          app,
          activeTargets: hasBoardData
            ? bindings.reduce((sum, item) => sum + (item.targets?.length ?? 0), 0)
            : null,
          environmentCount: (hasBoardData ? bindings.length : 0) || app.environmentCount || 0,
        }
      }),
    [applicationsQuery.data, boardByApp, canViewReleaseBoard, releaseBoardQuery.data],
  )

  const visibleRows = useMemo(() => {
    const keyword = filters.search?.trim().toLowerCase() ?? ''
    return applicationRows.filter(({ app }) => {
      const groups = splitApplicationGroups(app.group)
      const matchesGroup =
        !filters.group ||
        filters.group === 'all' ||
        (filters.group === 'unassigned' ? groups.length === 0 : groups.includes(filters.group))
      const matchesKeyword =
        !keyword ||
        [app.name, app.key, ...groups].some((value) => value.toLowerCase().includes(keyword))
      return matchesGroup && matchesKeyword
    })
  }, [applicationRows, filters])

  const openCreateApplication = () => {
    const next = new URLSearchParams(searchParams)
    next.set('action', 'create')
    next.set('mode', managementState.canCreateApplication ? 'quick' : 'manual')
    setSearchParams(next, { replace: true })
  }

  const closeApplicationEntry = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    next.delete('mode')
    next.delete('templateId')
    setSearchParams(next, { replace: true })
  }

  const changeApplicationEntryMode = (mode: ApplicationEntryMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('action', 'create')
    next.set('mode', mode)
    setSearchParams(next, { replace: true })
  }

  const openEditApplication = (app: DeliveryApplication) => {
    managementState.setEditingApp(app)
    managementState.setBuildSources(app.buildSources ?? [])
    managementState.setAppModalVisible(true)
  }

  return (
    <>
      <ManagementDataPage
        tableNode={
          <section className="soha-application-center-results">
            <div className="soha-application-center-toolbar">
              <div className="soha-application-center-toolbar__groups">
                <ManagementTableToolbar>
                  <Select
                    aria-label="应用分组"
                    value={filters.group}
                    showSearch={{ optionFilterProp: 'label' }}
                    options={[
                      { label: '全部', value: 'all' },
                      { label: '未分组', value: 'unassigned' },
                      ...managementState.applicationGroupOptions.map((group) => ({
                        label: group,
                        value: group,
                      })),
                    ]}
                    onChange={(group) => setFilters((current) => ({ ...current, group }))}
                  />
                </ManagementTableToolbar>
              </div>
              <div className="soha-application-center-toolbar__actions">
                <ManagementTableToolbar>
                  <ManagementToolbarSearch
                    placeholder="搜索应用"
                    value={filters.search ?? ''}
                    onChange={(search) => setFilters((current) => ({ ...current, search }))}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={
                      !managementState.canCreateApplication &&
                      !managementState.canUpdateApplication
                    }
                    onClick={openCreateApplication}
                  >
                    创建 / 接入应用
                  </Button>
                </ManagementTableToolbar>
              </div>
            </div>

            {canViewReleaseBoard && releaseBoardQuery.isError ? (
              <ManagementState
                compact
                kind="error"
                title="发布状态加载失败"
                description="应用仍可使用；发布目标暂时无法读取。"
                actions={
                  <Button size="small" onClick={() => void releaseBoardQuery.refetch()}>
                    重试
                  </Button>
                }
              />
            ) : null}

            {applicationsQuery.isLoading ? (
              <ManagementState compact kind="loading" title="正在加载应用" />
            ) : applicationsQuery.isError ? (
              <ManagementState
                compact
                kind="error"
                title="应用加载失败"
                description="暂时无法读取应用，请重试。"
                actions={
                  <Button
                    aria-label="重试"
                    size="small"
                    onClick={() => void applicationsQuery.refetch()}
                  >
                    重试
                  </Button>
                }
              />
            ) : visibleRows.length === 0 ? (
              <ManagementState
                compact
                title={filters.group === 'all' && !filters.search ? '暂无应用' : '没有匹配的应用'}
              />
            ) : (
              <div className="soha-application-card-grid" role="list">
                {visibleRows.map((row) => {
                  const groups = splitApplicationGroups(row.app.group)
                  return (
                    <Card
                      className="soha-application-card"
                      key={row.app.id}
                      role="listitem"
                      size="small"
                    >
                      <div className="soha-application-card__header">
                        <Link
                          className="soha-application-card__link"
                          to={`/applications/${row.app.id}`}
                        >
                          <span className="soha-application-card__icon" aria-hidden="true">
                            <AppstoreOutlined />
                          </span>
                          <span className="soha-application-card__identity">
                            <Text strong ellipsis title={row.app.name}>
                              {row.app.name}
                            </Text>
                            <Text type="secondary" ellipsis title={row.app.key}>
                              {row.app.key}
                            </Text>
                            <StatusTag value={row.app.enabled ? 'enabled' : 'disabled'} />
                          </span>
                        </Link>
                        {managementState.canUpdateApplication ||
                        managementState.canDeleteApplication ? (
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: [
                                ...(managementState.canUpdateApplication
                                  ? [{ key: 'edit', label: '编辑', icon: <EditOutlined /> }]
                                  : []),
                                ...(managementState.canDeleteApplication
                                  ? [
                                      {
                                        key: 'delete',
                                        label: '删除',
                                        danger: true,
                                        icon: <DeleteOutlined />,
                                      },
                                    ]
                                  : []),
                              ],
                              onClick: ({ key }) => {
                                if (key === 'edit') {
                                  openEditApplication(row.app)
                                  return
                                }
                                modal.confirm({
                                  title: '确认删除应用？',
                                  content: `删除 ${row.app.name} 后不可恢复。`,
                                  okText: '删除',
                                  cancelText: '取消',
                                  okButtonProps: { danger: true },
                                  onOk: () =>
                                    managementState.deleteAppMutation.mutateAsync(row.app.id),
                                })
                              },
                            }}
                          >
                            <ManagementIconButton
                              className="soha-application-card__more"
                              aria-label={`管理 ${row.app.name}`}
                              icon={<MoreOutlined />}
                              tooltip="更多操作"
                            />
                          </Dropdown>
                        ) : null}
                      </div>

                      <div className="soha-application-card__footer">
                        <Text type="secondary" ellipsis title={groups.join(' / ') || '未分组'}>
                          {groups.length > 1
                            ? `${groups[0]} +${groups.length - 1}`
                            : groups[0] || '未分组'}
                        </Text>
                        <Text type="secondary">
                          {row.environmentCount} 环境
                          {row.activeTargets === null ? '' : ` · ${row.activeTargets} 服务`}
                        </Text>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        }
      />
      <ApplicationCenterModals state={managementState} />
      <ApplicationEntryModal
        mode={entryMode}
        open={entryOpen}
        state={managementState}
        templateId={searchParams.get('templateId')}
        onCancel={closeApplicationEntry}
        onModeChange={changeApplicationEntryMode}
      />
    </>
  )
}
