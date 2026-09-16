import { useMemo } from 'react'
import './styles.css'
import { App, Button, Card, Dropdown, Modal, Select, Typography } from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { useAuthStore } from '@/stores/auth-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { scrollableModalBodyStyle, viewportModalStyle } from '@/components/modal-styles'
import {
  ApplicationCenterModals,
  ApplicationForm,
  splitApplicationGroups,
  useApplicationCenterState,
} from '../application-center-model'
import type { DeliveryApplication } from '../types'

const { Text } = Typography

export function ApplicationsPage() {
  const { modal } = App.useApp()
  const managementState = useApplicationCenterState({
    loadWorkflowTemplates: false,
    loadClusters: false,
  })
  const userId = useAuthStore((state) => state.user?.userId ?? '')
  const shortcuts = usePreferencesStore((state) => state.applicationShortcuts[userId])
  const toggleFavorite = usePreferencesStore((state) => state.toggleFavoriteApplication)
  const favorites = shortcuts?.favorites ?? []
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = usePreferencesStore((state) => state.applicationListFilters[userId]) ?? {
    group: 'all',
    search: '',
  }
  const setFilters = usePreferencesStore((state) => state.setApplicationListFilters)
  const entryOpen = searchParams.get('action') === 'create'

  const applicationsQuery = managementState.applicationsQuery

  const visibleRows = useMemo(() => {
    const keyword = filters.search?.trim().toLowerCase() ?? ''
    const rows = (applicationsQuery.data ?? []).filter((app) => {
      const groups = splitApplicationGroups(app.group)
      const matchesGroup =
        !filters.group ||
        filters.group === 'all' ||
        (filters.group === 'unassigned' ? groups.length === 0 : groups.includes(filters.group))
      const matchesKeyword =
        !keyword ||
        [app.name, app.key, app.description || '', ...groups].some((value) =>
          value.toLowerCase().includes(keyword),
        )
      const matchesScope =
        filters.scope === 'favorites'
          ? shortcuts?.favorites.includes(app.id)
          : filters.scope === 'recent'
            ? shortcuts?.recent.includes(app.id)
            : true
      return matchesGroup && matchesKeyword && matchesScope
    })
    return filters.scope === 'recent'
      ? rows.sort(
          (a, b) => (shortcuts?.recent.indexOf(a.id) ?? 0) - (shortcuts?.recent.indexOf(b.id) ?? 0),
        )
      : rows
  }, [applicationsQuery.data, filters, shortcuts])

  const openCreateApplication = () => {
    const next = new URLSearchParams(searchParams)
    next.set('action', 'create')
    next.delete('mode')
    next.delete('templateId')
    setSearchParams(next, { replace: true })
  }

  const closeApplicationEntry = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    next.delete('mode')
    next.delete('templateId')
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
            <nav className="soha-application-center-scopes" aria-label="应用范围">
              {(
                [
                  { key: 'all', label: '全部应用' },
                  { key: 'favorites', label: '我的收藏' },
                  { key: 'recent', label: '最近访问' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={(filters.scope || 'all') === key}
                  onClick={() => setFilters(userId, { ...filters, scope: key })}
                >
                  {label}
                </button>
              ))}
            </nav>
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
                    onChange={(group) => setFilters(userId, { ...filters, group })}
                  />
                </ManagementTableToolbar>
              </div>
              <div className="soha-application-center-toolbar__actions">
                <ManagementTableToolbar>
                  <ManagementToolbarSearch
                    placeholder="搜索应用"
                    value={filters.search ?? ''}
                    onChange={(search) => setFilters(userId, { ...filters, search })}
                  />
                  {managementState.canCreateApplication ? (
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateApplication}>
                      创建应用
                    </Button>
                  ) : null}
                </ManagementTableToolbar>
              </div>
            </div>

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
                title={
                  filters.scope === 'favorites'
                    ? '还没有收藏的应用'
                    : filters.scope === 'recent'
                      ? '还没有最近访问的应用'
                      : filters.group === 'all' && !filters.search
                        ? '暂无应用'
                        : '没有匹配的应用'
                }
                description={
                  filters.scope === 'favorites'
                    ? '点击应用卡片上的星标，方便下次快速进入。'
                    : filters.scope === 'recent'
                      ? '打开应用后，它会出现在这里。最近访问仅保存在当前浏览器。'
                      : undefined
                }
              />
            ) : (
              <div className="soha-application-card-grid" role="list">
                {visibleRows.map((app) => {
                  const groups = splitApplicationGroups(app.group)
                  return (
                    <Card
                      className="soha-application-card"
                      key={app.id}
                      role="listitem"
                      size="small"
                    >
                      <div className="soha-application-card__header">
                        <Link
                          className="soha-application-card__link"
                          to={`/applications/${encodeURIComponent(app.id)}`}
                        >
                          <span className="soha-application-card__icon" aria-hidden="true">
                            <AppstoreOutlined />
                          </span>
                          <span className="soha-application-card__identity">
                            <Text strong ellipsis title={app.name}>
                              {app.name}
                            </Text>
                          </span>
                        </Link>
                        {userId ? (
                          <ManagementIconButton
                            aria-label={`${favorites.includes(app.id) ? '取消收藏' : '收藏'} ${app.name}`}
                            aria-pressed={favorites.includes(app.id)}
                            icon={favorites.includes(app.id) ? <StarFilled /> : <StarOutlined />}
                            tooltip={favorites.includes(app.id) ? '取消收藏' : '收藏到当前浏览器'}
                            onClick={() => toggleFavorite(userId, app.id)}
                          />
                        ) : null}
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
                                  openEditApplication(app)
                                  return
                                }
                                modal.confirm({
                                  title: '确认删除应用？',
                                  content: `删除 ${app.name} 后不可恢复。`,
                                  okText: '删除',
                                  cancelText: '取消',
                                  okButtonProps: { danger: true },
                                  onOk: () => managementState.deleteAppMutation.mutateAsync(app.id),
                                })
                              },
                            }}
                          >
                            <ManagementIconButton
                              className="soha-application-card__more"
                              aria-label={`管理 ${app.name}`}
                              icon={<MoreOutlined />}
                              tooltip="更多操作"
                            />
                          </Dropdown>
                        ) : null}
                      </div>
                      <Text
                        className="soha-application-card__description"
                        type="secondary"
                        ellipsis
                        title={app.description}
                      >
                        {app.description || '暂无备注'}
                      </Text>
                      <Text type="secondary" ellipsis title={groups.join(' / ') || '未分组'}>
                        {groups.length > 1
                          ? `${groups[0]} +${groups.length - 1}`
                          : groups[0] || '未分组'}
                      </Text>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        }
      />
      <ApplicationCenterModals state={managementState} />
      <Modal
        title="创建应用"
        open={entryOpen}
        onCancel={closeApplicationEntry}
        footer={null}
        destroyOnHidden
        width={560}
        style={viewportModalStyle}
        styles={{ body: scrollableModalBodyStyle }}
      >
        {managementState.canCreateApplication ? (
          <ApplicationForm
            application={null}
            state={managementState}
            onCancel={closeApplicationEntry}
            onCreated={(application) => {
              closeApplicationEntry()
              managementState.navigate(`/applications/${encodeURIComponent(application.id)}`)
            }}
          />
        ) : (
          <ManagementState compact kind="no-permission" title="无权创建应用" />
        )}
      </Modal>
    </>
  )
}
