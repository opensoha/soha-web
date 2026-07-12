import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { MENU_ICON_OPTIONS, isKnownMenuIcon, resolveMenuIcon } from '../menu-icons'
import { normalizeMenuSection, resolveMenuSectionLabel } from '../menu-schema'
import { systemMutations } from '../mutations'
import { systemQueries } from '../queries'
import {
  MENU_WORKBENCH_LABELS,
  MENU_WORKBENCH_ORDER,
  buildMenuFormValues,
  buildMenuSectionFilterOptions,
  buildWorkbenchMenuTree,
  collectMenuDescendantIds,
  countDirectMenuChildren,
  filterMenuTree,
  findMenuItemByID,
  flattenMenuItems,
  getMenuVisibilityModeOptions,
  normalizeMenuSubmitValues,
  summarizeMenuVisibility,
  summarizeMenuWorkbench,
  type MenuItem,
  type MenuWorkbenchSurface,
} from '../system-model'
import { tableColumnPresets } from '@/utils/table-columns'

const { Text } = Typography
const MODAL_FORM_LAYOUT = {
  labelAlign: 'left' as const,
  labelCol: { flex: '120px' },
  wrapperCol: { flex: 'auto' },
}

function MenuVisibilityTags({
  item,
}: {
  item: Pick<MenuItem, 'id' | 'path' | 'roleIds' | 'visibilityMode' | 'derivedPermissionKeys'>
}) {
  const summary = summarizeMenuVisibility(item)

  if (summary.mode === 'explicit') {
    return (
      <Space wrap size={[4, 4]}>
        <Tag color="gold">显式覆盖</Tag>
        {summary.explicitRoleIds.length > 0 ? (
          <Tooltip title={summary.explicitRoleIds.join(', ')}>
            <Tag>{`角色 ${summary.explicitRoleIds.length}`}</Tag>
          </Tooltip>
        ) : (
          <Tag>未绑定角色</Tag>
        )}
      </Space>
    )
  }

  if (summary.mode === 'derived') {
    return (
      <Space wrap size={[4, 4]}>
        <Tag color="blue">自动派生</Tag>
        <Tooltip title={summary.derivedPermissionKeys.join(', ')}>
          <Tag>
            {summary.derivedPermissionKeys.length === 1
              ? summary.derivedPermissionKeys[0]
              : `权限键 ${summary.derivedPermissionKeys.length}`}
          </Tag>
        </Tooltip>
      </Space>
    )
  }

  return (
    <Space wrap size={[4, 4]}>
      <Tag>未映射</Tag>
      <Tag color="default">需显式配置</Tag>
    </Space>
  )
}

function MenuWorkbenchTag({
  item,
  menuLookup,
}: {
  item: Pick<MenuItem, 'id' | 'path' | 'parentId'>
  menuLookup: Map<string, MenuItem>
}) {
  const summary = summarizeMenuWorkbench(item, menuLookup)
  const color =
    summary.key === 'unmapped'
      ? 'default'
      : summary.key === 'system'
        ? 'purple'
        : summary.key === 'delivery'
          ? 'blue'
          : summary.key === 'platform'
            ? 'cyan'
            : 'geekblue'

  return <Tag color={color}>{summary.label}</Tag>
}

function formatSyntheticChildCount(record: MenuItem) {
  const count = countDirectMenuChildren(record)
  if (count === 0) return ''
  if (
    record.syntheticKind === 'workbench' &&
    (record.children ?? []).every((item) => item.syntheticKind === 'section')
  ) {
    return `${count} 个分组`
  }
  return `${count} 个菜单`
}

export function MenusPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [form] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [sectionFilter, setSectionFilter] = useState<string>('')
  const [workbenchFilter, setWorkbenchFilter] = useState<string>('')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'derived' | 'explicit' | 'unmapped'
  >('all')
  const [treeView, setTreeView] = useState<'workbench' | 'top' | 'all'>('workbench')
  const canManageMenus = hasPermission(permissionSnapshotQuery.data?.data, 'system.menus.manage')

  const { data: menuTree = [], isLoading } = useQuery(systemQueries.menus())
  const { data: roleRecords = [] } = useQuery(
    systemQueries.menuAccessRoles(canManageMenus && modalVisible),
  )
  const createMutation = useMutation(systemMutations.menus.create(queryClient))
  const updateMutation = useMutation(systemMutations.menus.update(queryClient))
  const deleteMutation = useMutation(systemMutations.menus.remove(queryClient))

  const handleSubmit = (values: Record<string, unknown>) => {
    const normalizedValues = normalizeMenuSubmitValues(values)
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values: normalizedValues },
        {
          onSuccess: () => {
            void message.success('菜单更新成功')
            form.resetFields()
            setModalVisible(false)
            setEditing(null)
          },
          onError: (error) => void message.error(error.message),
        },
      )
    } else {
      createMutation.mutate(normalizedValues, {
        onSuccess: () => {
          void message.success('菜单创建成功')
          form.resetFields()
          setModalVisible(false)
        },
        onError: (error) => void message.error(error.message),
      })
    }
  }
  const menuItems = flattenMenuItems(menuTree)
  const menuLookup = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems])
  const rawFilteredMenuTree = useMemo(
    () =>
      filterMenuTree(menuTree, {
        topLevelOnly: treeView === 'top',
        section: sectionFilter,
        workbench: workbenchFilter,
        enabled: enabledFilter,
        visibility: visibilityFilter,
      }),
    [enabledFilter, menuTree, sectionFilter, treeView, visibilityFilter, workbenchFilter],
  )
  const filteredMenuTree = useMemo(
    () =>
      treeView === 'workbench' ? buildWorkbenchMenuTree(rawFilteredMenuTree) : rawFilteredMenuTree,
    [rawFilteredMenuTree, treeView],
  )
  const sectionOptions = useMemo(() => buildMenuSectionFilterOptions(menuItems), [menuItems])
  const workbenchOptions = useMemo(
    () =>
      MENU_WORKBENCH_ORDER.map((value) => ({
        value,
        label: MENU_WORKBENCH_LABELS[value],
      })),
    [],
  )
  const menuPageSize = Math.max(menuItems.length, 1)
  const roleOptions = roleRecords.map((role) => ({
    value: role.id,
    label: role.name || role.id,
  }))
  const blockedParentIds = new Set(
    editing ? [editing.id, ...collectMenuDescendantIds(editing)] : [],
  )
  const parentOptions = [
    { label: '顶级菜单', value: '' },
    ...Array.from(
      menuItems
        .filter((item) => !blockedParentIds.has(item.id))
        .reduce((acc, item) => {
          const workbench = summarizeMenuWorkbench(item, menuLookup)
          const current = acc.get(workbench.key) ?? []
          current.push({
            value: item.id,
            label: `${'— '.repeat(item.depth ?? 0)}${item.labelZh}`,
          })
          acc.set(workbench.key, current)
          return acc
        }, new Map<MenuWorkbenchSurface, Array<{ value: string; label: string }>>()),
    )
      .sort(
        ([left], [right]) =>
          MENU_WORKBENCH_ORDER.indexOf(left) - MENU_WORKBENCH_ORDER.indexOf(right),
      )
      .map(([key, options]) => ({
        label: MENU_WORKBENCH_LABELS[key],
        options,
      })),
  ]

  useEffect(() => {
    if (!modalVisible) return

    form.resetFields()
    form.setFieldsValue(buildMenuFormValues(editing))
  }, [editing, form, modalVisible])

  const columns: TableColumnsType<MenuItem> = [
    {
      title: '菜单名称',
      dataIndex: 'labelZh',
      render: (value: string, record: MenuItem) =>
        record.syntheticKind ? (
          <Space size={8} wrap>
            <Text strong>{value}</Text>
            <Tag color={record.syntheticKind === 'workbench' ? 'blue' : 'default'}>
              {record.syntheticKind === 'workbench' ? '工作台' : '分组'}
            </Tag>
            {formatSyntheticChildCount(record) ? (
              <Tag color="blue">{formatSyntheticChildCount(record)}</Tag>
            ) : null}
          </Space>
        ) : (
          <Space orientation="vertical" size={2}>
            <Space size={8} wrap>
              <Text strong>{value}</Text>
              <Tag>{record.parentId ? '子菜单' : '顶级'}</Tag>
              {countDirectMenuChildren(record) > 0 ? (
                <Tag color="blue">{`${countDirectMenuChildren(record)} 个子项`}</Tag>
              ) : null}
            </Space>
            <Text type="secondary">{record.labelEn || '-'}</Text>
          </Space>
        ),
    },
    {
      title: '路径',
      dataIndex: 'path',
      render: (value: string, record: MenuItem) => (record.syntheticKind ? '-' : value),
    },
    {
      title: '工作台',
      key: 'workbench',
      render: (_: unknown, record: MenuItem) => {
        if (record.syntheticKind === 'workbench' && record.syntheticWorkbenchKey) {
          return <Tag color="blue">{MENU_WORKBENCH_LABELS[record.syntheticWorkbenchKey]}</Tag>
        }
        if (record.syntheticKind === 'section' && record.syntheticWorkbenchKey) {
          return <Tag>{MENU_WORKBENCH_LABELS[record.syntheticWorkbenchKey]}</Tag>
        }
        return <MenuWorkbenchTag item={record} menuLookup={menuLookup} />
      },
    },
    {
      title: '图标',
      dataIndex: 'iconKey',
      render: (value: string, record: MenuItem) =>
        record.syntheticKind ? (
          '-'
        ) : (
          <Space size={8} wrap>
            <span>{resolveMenuIcon(value)}</span>
            <Text code>{value || '-'}</Text>
            {!isKnownMenuIcon(value) ? <Tag color="gold">未映射</Tag> : null}
          </Space>
        ),
    },
    {
      title: '分组',
      dataIndex: 'section',
      render: (value: string, record: MenuItem) => {
        if (record.syntheticKind === 'workbench') return '-'
        const section = normalizeMenuSection(value)
        return section ? <Tag>{resolveMenuSectionLabel(section)}</Tag> : <Tag>未分组</Tag>
      },
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      render: (value: number, record: MenuItem) => (record.syntheticKind ? '-' : value),
    },
    {
      title: '可见',
      dataIndex: 'enabled',
      render: (v: boolean, record: MenuItem) =>
        record.syntheticKind ? '-' : <BooleanTag value={v} />,
    },
    {
      title: '可见性策略',
      key: 'visibilityModel',
      render: (_: unknown, record: MenuItem) =>
        record.syntheticKind ? '-' : <MenuVisibilityTags item={record} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: MenuItem) => (
        <Space className="soha-row-action-icons">
          {canManageMenus && !record.syntheticKind ? (
            <ManagementIconButton
              aria-label="编辑菜单"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => {
                setEditing(findMenuItemByID(menuTree, record.id) ?? record)
                setModalVisible(true)
              }}
            />
          ) : null}
          {canManageMenus && !record.syntheticKind ? (
            <Popconfirm
              title="确认删除？"
              onConfirm={() =>
                deleteMutation.mutate(record.id, {
                  onSuccess: () => void message.success('菜单已删除'),
                  onError: (error) => void message.error(error.message),
                })
              }
            >
              <ManagementIconButton
                aria-label="删除菜单"
                danger
                icon={<DeleteOutlined />}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
          {!canManageMenus || record.syntheticKind ? '-' : null}
        </Space>
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        collapsible: true,
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={
              treeView === 'workbench' &&
              !sectionFilter &&
              !workbenchFilter &&
              enabledFilter === 'all' &&
              visibilityFilter === 'all'
            }
            onReset={() => {
              setTreeView('workbench')
              setSectionFilter('')
              setWorkbenchFilter('')
              setEnabledFilter('all')
              setVisibilityFilter('all')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryField label="树视图" minWidth={300} width={340}>
              <Segmented
                size="small"
                value={treeView}
                onChange={(value) => setTreeView(value as 'workbench' | 'top' | 'all')}
                options={[
                  { value: 'workbench', label: '工作台视图' },
                  { value: 'top', label: '默认看顶级' },
                  { value: 'all', label: '看全部树' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="分组">
              <Select
                allowClear
                placeholder="全部分组"
                value={sectionFilter || undefined}
                onChange={(value) => setSectionFilter(value || '')}
                options={sectionOptions}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="工作台">
              <Select
                allowClear
                placeholder="全部工作台"
                value={workbenchFilter || undefined}
                onChange={(value) => setWorkbenchFilter(value || '')}
                options={workbenchOptions}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="状态">
              <Select
                value={enabledFilter}
                onChange={(value) => setEnabledFilter(value as 'all' | 'enabled' | 'disabled')}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'enabled', label: '仅启用' },
                  { value: 'disabled', label: '仅禁用' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={160} width={180} label="策略">
              <Select
                value={visibilityFilter}
                onChange={(value) =>
                  setVisibilityFilter(value as 'all' | 'derived' | 'explicit' | 'unmapped')
                }
                options={[
                  { value: 'all', label: '全部策略' },
                  { value: 'derived', label: '自动派生' },
                  { value: 'explicit', label: '显式覆盖' },
                  { value: 'unmapped', label: '未映射' },
                ]}
              />
            </ManagementQueryField>
          </>
        ),
      }}
      tableNode={
        <AdminTable
          key={treeView}
          columnSettingIconOnly
          columnSettingPlacement="header"
          shellClassName="soha-management-table-shell"
          columns={columns}
          dataSource={filteredMenuTree}
          rowKey="id"
          loading={isLoading}
          pageSize={menuPageSize}
          pagination={false}
          scroll={{ x: 1320 }}
          headerExtra={
            canManageMenus ? (
              <ManagementTableToolbar>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => {
                    setEditing(null)
                    setModalVisible(true)
                  }}
                >
                  新建菜单
                </Button>
              </ManagementTableToolbar>
            ) : null
          }
          expandable={{
            defaultExpandAllRows: treeView !== 'top',
            rowExpandable: (record: MenuItem) => countDirectMenuChildren(record) > 0,
          }}
        />
      }
      afterTable={
        <Modal
          title={editing ? '编辑菜单' : '新建菜单'}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false)
            setEditing(null)
            form.resetFields()
          }}
          footer={null}
          destroyOnHidden
        >
          <Form
            form={form}
            {...MODAL_FORM_LAYOUT}
            onFinish={(values) => {
              if (!canManageMenus) return
              handleSubmit(values as Record<string, unknown>)
            }}
          >
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) =>
                prev.path !== next.path ||
                prev.roleIds !== next.roleIds ||
                prev.visibilityMode !== next.visibilityMode ||
                prev.id !== next.id
              }
            >
              {({ getFieldValue }) => {
                const draftMenu = {
                  id: String(getFieldValue('id') || ''),
                  path: String(getFieldValue('path') || ''),
                  roleIds: Array.isArray(getFieldValue('roleIds'))
                    ? getFieldValue('roleIds').map(String)
                    : [],
                  visibilityMode:
                    getFieldValue('visibilityMode') === 'explicit' ? 'explicit' : 'derived',
                } satisfies Pick<MenuItem, 'id' | 'path' | 'roleIds' | 'visibilityMode'>
                const visibilitySummary = summarizeMenuVisibility(draftMenu)
                const visibilityMode =
                  getFieldValue('visibilityMode') === 'explicit' ? 'explicit' : 'derived'

                return (
                  <>
                    <Alert
                      showIcon
                      type={visibilitySummary.mode === 'unmapped' ? 'warning' : 'info'}
                      title={
                        visibilitySummary.mode === 'explicit'
                          ? '当前菜单使用显式角色覆盖'
                          : visibilitySummary.mode === 'derived'
                            ? '当前菜单将按权限键自动派生可见性'
                            : '当前菜单尚未映射已知权限键'
                      }
                      description={
                        visibilitySummary.mode === 'explicit'
                          ? '仅为少数例外场景保留显式角色覆盖。保存后会提交 roleIds，覆盖默认的 permissionKeys 派生行为。'
                          : visibilitySummary.mode === 'derived'
                            ? `当前可派生权限键: ${visibilitySummary.derivedPermissionKeys.join(', ')}`
                            : '该菜单没有匹配到前端路由权限键。若仍需控制可见性，请切换为显式覆盖并填写角色 ID。'
                      }
                      style={{ marginBottom: 16 }}
                    />
                    <Form.Item
                      name="visibilityMode"
                      label="可见性模式"
                      rules={[{ required: true, message: '请选择可见性模式' }]}
                    >
                      <Select options={getMenuVisibilityModeOptions(visibilitySummary)} />
                    </Form.Item>
                    {visibilitySummary.derivedPermissionKeys.length > 0 ? (
                      <Form.Item label="派生权限键">
                        <Select
                          mode="multiple"
                          open={false}
                          value={visibilitySummary.derivedPermissionKeys}
                          options={visibilitySummary.derivedPermissionKeys.map((permissionKey) => ({
                            value: permissionKey,
                            label: permissionKey,
                          }))}
                        />
                      </Form.Item>
                    ) : null}
                    {visibilityMode === 'explicit' ? (
                      <Form.Item name="roleIds" label="覆盖角色">
                        <Select
                          mode="tags"
                          options={roleOptions}
                          placeholder="输入角色 ID，或选择已有角色"
                          tokenSeparators={[',']}
                        />
                      </Form.Item>
                    ) : null}
                  </>
                )
              }}
            </Form.Item>
            <Form.Item
              name="labelZh"
              label="中文名称"
              rules={[{ required: true, message: '请输入中文名称' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="labelEn" label="英文名称">
              <Input />
            </Form.Item>
            <Form.Item name="parentId" label="父级菜单">
              <Select options={parentOptions} />
            </Form.Item>
            <Form.Item name="path" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) =>
                prev.id !== next.id || prev.path !== next.path || prev.parentId !== next.parentId
              }
            >
              {({ getFieldValue }) => {
                const draftPlacement = summarizeMenuWorkbench(
                  {
                    id: String(getFieldValue('id') || ''),
                    path: String(getFieldValue('path') || ''),
                    parentId: String(getFieldValue('parentId') || ''),
                  },
                  menuLookup,
                )
                const hasPlacementConflict = Boolean(
                  draftPlacement.parentPlacement &&
                  draftPlacement.pathPlacement !== 'unmapped' &&
                  draftPlacement.parentPlacement !== draftPlacement.pathPlacement,
                )

                return (
                  <Form.Item label="工作台归属">
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color={draftPlacement.key === 'unmapped' ? 'default' : 'blue'}>
                          {draftPlacement.label}
                        </Tag>
                        {draftPlacement.parentPlacement ? (
                          <Text type="secondary">跟随父级菜单</Text>
                        ) : (
                          <Text type="secondary">按路径自动派生</Text>
                        )}
                        {hasPlacementConflict ? <Tag color="gold">父级与路径不一致</Tag> : null}
                      </Space>
                      <Text type={hasPlacementConflict ? 'danger' : 'secondary'}>
                        {hasPlacementConflict
                          ? `当前路径命中 ${draftPlacement.pathPlacementLabel}，但父级菜单属于 ${draftPlacement.parentPlacementLabel}。保存后侧栏将按父级工作台收纳。`
                          : draftPlacement.key === 'unmapped'
                            ? '当前菜单尚未映射到已知工作台；若需要进入侧栏，请确认路径或父级菜单归属。'
                            : `当前菜单会在 ${draftPlacement.label} 的导航树内展示。`}
                      </Text>
                    </Space>
                  </Form.Item>
                )
              }}
            </Form.Item>
            <Form.Item
              name="iconKey"
              label="图标"
              rules={[{ required: true, message: '请选择图标' }]}
            >
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                options={MENU_ICON_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                optionRender={(option) => {
                  const target = MENU_ICON_OPTIONS.find((item) => item.value === option.value)
                  return (
                    <Space size={8}>
                      <span>{target?.preview}</span>
                      <span>{target?.label || option.label}</span>
                      <Text code>{String(option.value)}</Text>
                    </Space>
                  )
                }}
              />
            </Form.Item>
            <Form.Item name="section" label="分组">
              <Select
                mode="tags"
                maxCount={1}
                options={sectionOptions}
                tokenSeparators={[',']}
                placeholder="选择已有分组，或直接输入新的分组键"
              />
            </Form.Item>
            <Form.Item name="sortOrder" label="排序">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="enabled" label="是否启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <div className="soha-form-actions">
              <Button
                onClick={() => {
                  setModalVisible(false)
                  setEditing(null)
                  form.resetFields()
                }}
              >
                取消
              </Button>
              {canManageMenus ? (
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {editing ? '更新' : '创建'}
                </Button>
              ) : null}
            </div>
          </Form>
        </Modal>
      }
    />
  )
}
