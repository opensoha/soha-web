import { useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Tag, Tree, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import {
  ManagementIconButton,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { consolePermissionLabelMap, hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { AccessManagementTablePage } from '../shared/management-page'
import { renderCompactMappedTags } from '../shared/compact-mapped-tags'
import { accessMutations, invalidateAccessRoles } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import type { AccessRole } from '../shared/types'
import { useAccessResourceCrud } from '../shared/use-resource-crud'
import { toStringArray } from '../shared/utils'
import {
  ACCESS_ACTION_LABEL_MAP,
  ACCESS_ACTION_OPTIONS,
  checkedPermissionTreeKeys,
  extractPermissionKeysFromTreeCheck,
  normalizePermissionKeys,
  rolePermissionTreeData,
} from './permission-model'
import '../shared/styles.css'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]
const ROLE_SCOPE_OPTIONS = [
  { value: 'system', label: '系统角色' },
  { value: 'custom', label: '自定义角色' },
]

export function AccessRolesPage() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canManageRoles = hasPermission(snapshot, 'access.roles.manage')
  const [form] = Form.useForm<Record<string, unknown>>()
  const crud = useAccessResourceCrud({
    query: accessQueries.roles(),
    create: accessMutations.roles.create(),
    update: accessMutations.roles.update(),
    delete: accessMutations.roles.delete(),
    invalidate: invalidateAccessRoles,
  })
  const [searchKeyword, setSearchKeyword] = useState('')
  const columns: ColumnProps<AccessRole>[] = [
    { title: '角色名称', dataIndex: 'name', width: 128 },
    { title: '范围', dataIndex: 'scope', width: 88, render: (value: string) => value || 'custom' },
    {
      title: '权限动作',
      dataIndex: 'capabilities',
      width: 170,
      render: (values: string[]) =>
        renderCompactMappedTags(values, ACCESS_ACTION_LABEL_MAP, '未配置', 1, '权限动作'),
    },
    {
      title: '菜单/动作权限',
      dataIndex: 'permissionKeys',
      width: 320,
      render: (values?: string[]) =>
        renderCompactMappedTags(
          normalizePermissionKeys(values),
          consolePermissionLabelMap,
          '未配置',
          1,
          '权限键',
        ),
    },
    { title: '绑定用户', dataIndex: 'userCount', width: 88 },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessRole) => (
        <Space className="soha-row-action-icons">
          {canManageRoles ? (
            <>
              <ManagementIconButton
                aria-label="编辑角色"
                icon={<EditOutlined />}
                size="small"
                tooltip="编辑"
                onClick={() => crud.openEdit(record)}
              />
              <Popconfirm
                title="确认删除？"
                onConfirm={() => crud.deleteMutation.mutate(record.id)}
              >
                <ManagementIconButton
                  aria-label="删除角色"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  tooltip="删除"
                />
              </Popconfirm>
            </>
          ) : (
            '-'
          )}
        </Space>
      ),
    },
  ]
  const filteredRoles = useManagementTextFilter(crud.data, searchKeyword, (item) => [
    item.name,
    item.scope,
    ...(item.capabilities ?? []),
    ...(item.permissionKeys ?? []),
  ])

  if (!canViewRoles) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有角色管理权限。" />
      </div>
    )
  }

  return (
    <AccessManagementTablePage<AccessRole>
      columns={columns}
      createAction={
        canManageRoles ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={crud.openCreate}>
            添加角色
          </Button>
        ) : null
      }
      dataSource={filteredRoles}
      rowKey="id"
      loading={crud.isLoading}
      placeholder="搜索角色、范围或权限键"
      searchKeyword={searchKeyword}
      setSearchKeyword={setSearchKeyword}
    >
      <Modal
        title={crud.editing ? `编辑角色: ${crud.editing.name}` : '添加角色'}
        open={crud.modalVisible}
        onCancel={crud.closeModal}
        onOk={async () => {
          try {
            const values = await form.validateFields()
            crud.handleSubmit({
              name: String(values.name ?? '').trim(),
              scope: String(values.scope ?? 'custom'),
              capabilities: toStringArray(values.capabilities),
              permissionKeys: normalizePermissionKeys(values.permissionKeys),
            })
          } catch {
            return
          }
        }}
        okText={crud.editing ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={crud.isSaving}
        width={720}
        destroyOnHidden
        mask={{ closable: false }}
      >
        <Form
          form={form}
          key={crud.editing?.id ?? 'create-role'}
          layout="vertical"
          initialValues={
            crud.editing
              ? {
                  name: crud.editing.name,
                  scope: crud.editing.scope || 'custom',
                  capabilities: crud.editing.capabilities ?? [],
                  permissionKeys: normalizePermissionKeys(crud.editing.permissionKeys),
                }
              : { scope: 'custom', capabilities: [], permissionKeys: [] }
          }
        >
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="scope" label="角色范围">
            <Select options={ROLE_SCOPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="capabilities"
            label="权限动作"
            rules={[
              {
                validator: (_, value) =>
                  toStringArray(value).length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('请选择至少一个权限动作')),
              },
            ]}
          >
            <Select mode="multiple" options={ACCESS_ACTION_OPTIONS} />
          </Form.Item>
          <Form.Item label="菜单与动作权限">
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) => prev.permissionKeys !== next.permissionKeys}
            >
              {({ getFieldValue, setFieldsValue }) => {
                const permissionKeys = normalizePermissionKeys(getFieldValue('permissionKeys'))
                return (
                  <Space orientation="vertical" size={8} className="soha-role-permission-tree">
                    <Space size={8} wrap>
                      <Tag>{`${permissionKeys.length} 个权限键`}</Tag>
                      <Text type="secondary">父级菜单勾选会自动带出下级页面与动作权限。</Text>
                    </Space>
                    <Tree
                      checkable
                      defaultExpandAll
                      height={380}
                      treeData={rolePermissionTreeData}
                      checkedKeys={checkedPermissionTreeKeys(permissionKeys)}
                      onCheck={(checkedKeys) =>
                        setFieldsValue({
                          permissionKeys: extractPermissionKeysFromTreeCheck(checkedKeys),
                        })
                      }
                    />
                  </Space>
                )
              }}
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>
    </AccessManagementTablePage>
  )
}
