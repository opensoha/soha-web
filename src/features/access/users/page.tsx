import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  App,
  Avatar,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tree,
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { loginProviderLabel, loginProviderTagColor } from '@/utils/login-provider'
import { tableColumnPresets } from '@/utils/table-columns'
import { accessMutations, invalidateAccessUsers } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import { ScopeGrantManager } from '../shared/scope-grant-manager'
import type { AccessUser } from '../shared/types'
import {
  collectOrganizationDescendantIds,
  getUserInitial,
  getUserLabel,
  toStringArray,
} from '../shared/utils'
import {
  buildOrganizationTree,
  buildOrganizationUserCounts,
  ORG_ALL_KEY,
  organizationMatchesSelection,
  renderMappedTags,
} from './view-model'
import '../shared/styles.css'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]
const USER_STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
]

function avatarFit(value?: string) {
  return value === 'contain' || value === 'fill' ? value : 'cover'
}

export function AccessUsersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewUsers = hasPermission(snapshot, 'access.users.view')
  const canManageUsers = hasPermission(snapshot, 'access.users.manage')
  const canManageScopeGrants = hasPermission(snapshot, 'access.scope-grants.manage')
  const [form] = Form.useForm<Record<string, unknown>>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<AccessUser | null>(null)
  const [grantUser, setGrantUser] = useState<AccessUser | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState(ORG_ALL_KEY)
  const [includeSubOrganizations, setIncludeSubOrganizations] = useState(true)
  const usersQuery = useQuery(accessQueries.users())
  const rolesQuery = useQuery(accessQueries.roles())
  const teamsQuery = useQuery(accessQueries.teams())

  const roleMap = useMemo(
    () => Object.fromEntries((rolesQuery.data ?? []).map((item) => [item.id, item.name])),
    [rolesQuery.data],
  )
  const teamMap = useMemo(
    () => Object.fromEntries((teamsQuery.data ?? []).map((item) => [item.id, item.name])),
    [teamsQuery.data],
  )
  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    [rolesQuery.data],
  )
  const teamOptions = useMemo(
    () =>
      (teamsQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.path ? `${item.name} (${item.path})` : item.name,
      })),
    [teamsQuery.data],
  )
  const userCountByOrg = useMemo(() => {
    return buildOrganizationUserCounts(teamsQuery.data ?? [], usersQuery.data ?? [])
  }, [teamsQuery.data, usersQuery.data])
  const organizationTreeData = useMemo(
    () => buildOrganizationTree(teamsQuery.data ?? [], userCountByOrg),
    [teamsQuery.data, userCountByOrg],
  )
  const scopedOrganizationIds = useMemo(() => {
    if (selectedOrgId === ORG_ALL_KEY) return new Set<string>()
    const ids = new Set<string>([selectedOrgId])
    if (includeSubOrganizations) {
      collectOrganizationDescendantIds(teamsQuery.data ?? [], selectedOrgId).forEach((id) =>
        ids.add(id),
      )
    }
    return ids
  }, [includeSubOrganizations, selectedOrgId, teamsQuery.data])
  const filteredUsers = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return (usersQuery.data ?? []).filter((item) => {
      if (!organizationMatchesSelection(item, selectedOrgId, scopedOrganizationIds)) return false
      if (!query) return true
      return [
        item.username,
        item.displayName,
        item.email,
        ...(item.roles ?? []),
        ...(item.teams ?? []).map((teamID) => teamMap[teamID] || teamID),
        ...(item.loginSources ?? []).flatMap((source) => [
          source.type,
          source.providerId,
          loginProviderLabel(source.type),
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [scopedOrganizationIds, searchText, selectedOrgId, teamMap, usersQuery.data])

  const createMutation = useMutation({
    ...accessMutations.users.create(),
    onSuccess: async () => {
      message.success('用户创建成功')
      await invalidateAccessUsers(queryClient)
      setModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...accessMutations.users.update(),
    onSuccess: async () => {
      message.success('用户更新成功')
      await invalidateAccessUsers(queryClient)
      setModalVisible(false)
      setEditing(null)
    },
    onError: (error) => message.error(error.message),
  })
  const deleteMutation = useMutation({
    ...accessMutations.users.delete(),
    onSuccess: async () => {
      message.success('用户删除成功')
      await invalidateAccessUsers(queryClient)
    },
    onError: (error) => message.error(error.message),
  })

  const closeModal = () => {
    setModalVisible(false)
    setEditing(null)
  }
  const submitUser = (values: Record<string, unknown>) => {
    const payload = {
      username: String(values.username ?? '').trim(),
      displayName: String(values.displayName ?? '').trim(),
      email: String(values.email ?? '').trim(),
      status: String(values.status ?? 'active'),
      password: String(values.password ?? ''),
      roleIds: toStringArray(values.roleIds),
      teamIds: toStringArray(values.teamIds),
      tags: toStringArray(values.tags),
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: payload })
      return
    }
    createMutation.mutate(payload)
  }

  const columns: ColumnProps<AccessUser>[] = [
    {
      title: '头像',
      key: 'avatar',
      width: 76,
      render: (_: unknown, record: AccessUser) => (
        <Avatar
          alt={getUserLabel(record)}
          className="soha-user-avatar"
          size="small"
          src={record.avatarUrl || undefined}
          style={{ '--soha-avatar-fit': avatarFit(record.avatarFit) } as CSSProperties}
        >
          {getUserInitial(record)}
        </Avatar>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 180,
      render: (value: string) => <Text strong>{value || '-'}</Text>,
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      width: 180,
      render: (value: string, record: AccessUser) => (
        <Text type={value ? undefined : 'secondary'}>{value || record.email || '-'}</Text>
      ),
    },
    { title: '邮箱', dataIndex: 'email', width: 240 },
    {
      title: '登录源',
      dataIndex: 'loginSources',
      width: 140,
      render: (sources: AccessUser['loginSources']) =>
        sources?.length ? (
          <Space size={[4, 4]} wrap>
            {sources.map((source) => (
              <Tag
                key={`${source.type}:${source.providerId || ''}`}
                color={loginProviderTagColor(source.type)}
              >
                {loginProviderLabel(source.type)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 180,
      render: (roles: string[]) => renderMappedTags(roles, roleMap, '未绑定'),
    },
    {
      title: '组织',
      dataIndex: 'teams',
      width: 160,
      render: (teams: string[]) => renderMappedTags(teams, teamMap, '未绑定'),
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      render: (value?: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      width: 164,
      dataIndex: 'id',
      render: (_: unknown, record: AccessUser) => (
        <Space className="soha-row-action-icons">
          {canManageUsers || canManageScopeGrants ? (
            <>
              {canManageScopeGrants ? (
                <ManagementIconButton
                  aria-label="授权范围"
                  icon={<FolderOpenOutlined />}
                  size="small"
                  tooltip="授权范围"
                  onClick={() => setGrantUser(record)}
                />
              ) : null}
              {canManageUsers ? (
                <ManagementIconButton
                  aria-label="编辑用户"
                  icon={<EditOutlined />}
                  size="small"
                  tooltip="编辑"
                  onClick={() => {
                    setEditing(record)
                    setModalVisible(true)
                  }}
                />
              ) : null}
              {canManageUsers ? (
                <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
                  <ManagementIconButton
                    aria-label="删除用户"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    tooltip="删除"
                  />
                </Popconfirm>
              ) : null}
            </>
          ) : (
            '-'
          )}
        </Space>
      ),
    },
  ]

  if (!canViewUsers) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有用户管理权限。" />
      </div>
    )
  }

  return (
    <div className="soha-page">
      <div className="soha-access-users-layout">
        <section className="soha-access-org-panel">
          <div className="soha-access-org-panel-header">
            <Space size={8}>
              <ApartmentOutlined />
              <Text strong>公司组织</Text>
            </Space>
            <Tag>{usersQuery.data?.length ?? 0}</Tag>
          </div>
          <Tree
            blockNode
            defaultExpandedKeys={[ORG_ALL_KEY]}
            selectedKeys={[selectedOrgId]}
            treeData={organizationTreeData}
            onSelect={(keys) => setSelectedOrgId(String(keys[0] ?? ORG_ALL_KEY))}
          />
        </section>
        <section className="soha-access-users-panel">
          <ManagementQueryPanel
            onFinish={() => undefined}
            actions={
              <>
                <Button
                  autoInsertSpace={false}
                  disabled={!searchText.trim() && includeSubOrganizations}
                  htmlType="button"
                  onClick={() => {
                    setSearchText('')
                    setIncludeSubOrganizations(true)
                  }}
                >
                  重置
                </Button>
                <Button autoInsertSpace={false} htmlType="submit" type="primary">
                  查询
                </Button>
              </>
            }
          >
            <ManagementKeywordField
              label="关键词"
              placeholder="搜索用户名、显示名、邮箱、角色或组织"
              value={searchText}
              inputProps={{
                className: 'soha-platform-compact-field soha-workload-search-input',
                size: 'small',
              }}
              onChange={setSearchText}
            />
            {selectedOrgId !== ORG_ALL_KEY ? (
              <ManagementQueryField label="下级组织" width={184} minWidth={160}>
                <Switch
                  size="small"
                  checked={includeSubOrganizations}
                  checkedChildren="包含"
                  unCheckedChildren="仅当前"
                  onChange={setIncludeSubOrganizations}
                />
              </ManagementQueryField>
            ) : null}
          </ManagementQueryPanel>
          <AdminTable
            columnSettingIconOnly
            columnSettingPlacement="header"
            shellClassName="soha-management-table-shell"
            className="soha-access-table"
            headerExtra={
              canManageUsers ? (
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
                    添加用户
                  </Button>
                </ManagementTableToolbar>
              ) : null
            }
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            loading={usersQuery.isLoading || teamsQuery.isLoading}
            scroll={{ x: 'max-content' }}
          />
        </section>
      </div>
      <Modal
        title={editing ? `编辑用户: ${getUserLabel(editing)}` : '添加用户'}
        open={modalVisible}
        onCancel={closeModal}
        onOk={async () => {
          try {
            submitUser(await form.validateFields())
          } catch {
            return
          }
        }}
        okText={editing ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={860}
        destroyOnHidden
        mask={{ closable: false }}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Form
          form={form}
          key={editing?.id ?? 'create-user'}
          layout="vertical"
          initialValues={
            editing
              ? {
                  username: editing.username,
                  displayName: editing.displayName,
                  email: editing.email,
                  status: editing.status || 'active',
                  roleIds: editing.roles ?? [],
                  teamIds: editing.teams ?? [],
                  tags: editing.tags ?? [],
                }
              : { status: 'active', roleIds: [], teamIds: [], tags: [] }
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayName" label="显示名">
                <Input placeholder="留空时顶部默认展示用户名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, message: '请输入邮箱' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select options={USER_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="roleIds" label="角色">
                <Select mode="multiple" options={roleOptions} placeholder="选择用户角色" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teamIds" label="所属组织">
                <Select
                  mode="multiple"
                  options={teamOptions}
                  placeholder="选择所属组织或部门"
                  showSearch={{ optionFilterProp: 'label' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" tokenSeparators={[',']} placeholder="输入标签后按回车确认" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '重置密码' : '登录密码'}
            rules={editing ? undefined : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editing ? '留空表示不修改密码' : '请输入初始密码'} />
          </Form.Item>
        </Form>
      </Modal>
      <ScopeGrantManager
        subjectType="user"
        subjectId={grantUser?.id ?? null}
        visible={Boolean(grantUser)}
        title={grantUser ? `用户授权范围: ${getUserLabel(grantUser)}` : '用户授权范围'}
        onClose={() => setGrantUser(null)}
      />
    </div>
  )
}
