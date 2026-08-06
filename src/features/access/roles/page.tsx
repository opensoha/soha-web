import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Popconfirm, Select, Space } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import {
  ManagementIconButton,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { AccessManagementTablePage } from '../shared/management-page'
import { renderCompactMappedTags } from '../shared/compact-mapped-tags'
import { accessMutations, invalidateAccessRoles } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import type { AccessRole } from '../shared/types'
import { useAccessResourceCrud } from '../shared/use-resource-crud'
import { normalizePermissionKeys } from './permission-model'
import { RolePermissionBrowser } from './permission-browser'
import '../shared/styles.css'

type ColumnProps<T> = TableColumnsType<T>[number]
const ROLE_SCOPE_OPTIONS = [
  { value: 'system', label: '系统角色' },
  { value: 'custom', label: '自定义角色' },
]

export function AccessRolesPage() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canCreateRoles = hasPermission(snapshot, 'access.roles.create')
  const canUpdateRoles = hasPermission(snapshot, 'access.roles.update')
  const canDeleteRoles = hasPermission(snapshot, 'access.roles.delete')
  const permissionCatalogQuery = useQuery(accessQueries.permissionCatalog(canViewRoles))
  const permissionDefinitions = permissionCatalogQuery.data?.permissions ?? []
  const permissionLabelMap = Object.fromEntries(
    permissionDefinitions.map((permission) => [permission.key, permission.displayName]),
  )
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
      title: '精确权限',
      dataIndex: 'permissionKeys',
      width: 320,
      render: (values?: string[]) =>
        renderCompactMappedTags(
          normalizePermissionKeys(values),
          permissionLabelMap,
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
          {canUpdateRoles || canDeleteRoles ? (
            <>
              {canUpdateRoles ? (
                <ManagementIconButton
                  aria-label="编辑角色"
                  icon={<EditOutlined />}
                  size="small"
                  tooltip="编辑"
                  onClick={() => crud.openEdit(record)}
                />
              ) : null}
              {canDeleteRoles ? (
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
              ) : null}
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
      resourceName="角色"
      columns={columns}
      createAction={
        canCreateRoles ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={crud.openCreate}>
            添加角色
          </Button>
        ) : null
      }
      dataSource={filteredRoles}
      rowKey="id"
      loading={crud.isLoading}
      refreshing={crud.isFetching}
      onRefresh={() => void crud.refetch()}
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
            await form.validateFields()
            const values = form.getFieldsValue(true)
            crud.handleSubmit({
              name: String(values.name ?? '').trim(),
              scope: String(values.scope ?? 'custom'),
              capabilities: crud.editing?.capabilities ?? [],
              permissionKeys: normalizePermissionKeys(values.permissionKeys),
            })
          } catch {
            return
          }
        }}
        okText={crud.editing ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={crud.isSaving}
        centered
        width={1000}
        styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' } }}
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
                  permissionKeys: normalizePermissionKeys(crud.editing.permissionKeys),
                }
              : { scope: 'custom', permissionKeys: [] }
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
          <Form.Item label="角色权限">
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) => prev.permissionKeys !== next.permissionKeys}
            >
              {({ getFieldValue, setFieldsValue }) => {
                const permissionKeys = normalizePermissionKeys(getFieldValue('permissionKeys'))
                return (
                  <RolePermissionBrowser
                    definitions={permissionDefinitions}
                    loading={permissionCatalogQuery.isLoading}
                    permissionKeys={permissionKeys}
                    onChange={(nextPermissionKeys) =>
                      setFieldsValue({ permissionKeys: nextPermissionKeys })
                    }
                  />
                )
              }}
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>
    </AccessManagementTablePage>
  )
}
