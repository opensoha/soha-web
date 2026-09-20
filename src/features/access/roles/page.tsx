import { useMemo, useState } from 'react'
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
import { useI18n } from '@/i18n'
import { AccessManagementTablePage } from '../shared/management-page'
import { renderCompactMappedTags } from '../shared/compact-mapped-tags'
import { accessMutations, invalidateAccessRoles } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import type { AccessRole } from '../shared/types'
import { useAccessResourceCrud } from '../shared/use-resource-crud'
import { AccessMutationFooter, accessMutationModalStyles } from '../shared/mutation-footer'
import {
  localizePermissionDefinitions,
  normalizePermissionKeys,
  normalizeRolePermissionKeys,
} from './permission-model'
import { RolePermissionBrowser } from './permission-browser'
import '../shared/styles.css'

type ColumnProps<T> = TableColumnsType<T>[number]

export function AccessRolesPage() {
  const { localeCode, t } = useI18n()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canCreateRoles = hasPermission(snapshot, 'access.roles.create')
  const canUpdateRoles = hasPermission(snapshot, 'access.roles.update')
  const canDeleteRoles = hasPermission(snapshot, 'access.roles.delete')
  const permissionCatalogQuery = useQuery(accessQueries.permissionCatalog(canViewRoles))
  const permissionDefinitions = useMemo(
    () =>
      localizePermissionDefinitions(permissionCatalogQuery.data?.permissions ?? [], localeCode, t),
    [localeCode, permissionCatalogQuery.data?.permissions, t],
  )
  const permissionLabelMap = Object.fromEntries(
    permissionDefinitions.map((permission) => [permission.key, permission.displayName]),
  )
  const [form] = Form.useForm<Record<string, unknown>>()
  const crud = useAccessResourceCrud({
    query: accessQueries.roles(canViewRoles),
    create: accessMutations.roles.create(),
    update: accessMutations.roles.update(),
    delete: accessMutations.roles.delete(),
    invalidate: invalidateAccessRoles,
  })
  const [searchKeyword, setSearchKeyword] = useState('')
  const columns: ColumnProps<AccessRole>[] = [
    { title: t('access.roles.column.name', '角色名称'), dataIndex: 'name', width: 128 },
    {
      title: t('access.roles.column.scope', '范围'),
      dataIndex: 'scope',
      width: 88,
      render: (value: string) => value || 'custom',
    },
    {
      title: t('access.roles.column.permissions', '精确权限'),
      dataIndex: 'permissionKeys',
      width: 320,
      render: (values?: string[]) =>
        renderCompactMappedTags(
          normalizePermissionKeys(values),
          permissionLabelMap,
          t('access.roles.unconfigured', '未配置'),
          1,
          t('access.roles.permissionKey', '权限键'),
        ),
    },
    { title: t('access.roles.column.users', '绑定用户'), dataIndex: 'userCount', width: 88 },
    {
      ...tableColumnPresets.action,
      title: t('common.actions', '操作'),
      dataIndex: 'id',
      render: (_: unknown, record: AccessRole) => (
        <Space className="soha-row-action-icons">
          {canUpdateRoles || canDeleteRoles ? (
            <>
              {canUpdateRoles ? (
                <ManagementIconButton
                  aria-label={t('access.roles.edit', '编辑角色')}
                  icon={<EditOutlined />}
                  size="small"
                  tooltip={t('common.edit', '编辑')}
                  onClick={() => crud.openEdit(record)}
                />
              ) : null}
              {canDeleteRoles ? (
                <Popconfirm
                  title={t('access.roles.confirmDelete', '确认删除？')}
                  onConfirm={() => crud.deleteMutation.mutate(record.id)}
                >
                  <ManagementIconButton
                    aria-label={t('access.roles.delete', '删除角色')}
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    tooltip={t('common.delete', '删除')}
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
        <ManagementState
          kind="no-permission"
          description={t('access.roles.noPermission', '当前账号没有角色管理权限。')}
        />
      </div>
    )
  }

  return (
    <AccessManagementTablePage<AccessRole>
      resourceName={t('access.roles.resourceName', '角色')}
      columns={columns}
      createAction={
        canCreateRoles ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={crud.openCreate}>
            {t('access.roles.add', '添加角色')}
          </Button>
        ) : null
      }
      dataSource={filteredRoles}
      rowKey="id"
      loading={crud.isLoading}
      refreshing={crud.isFetching}
      onRefresh={() => void crud.refetch()}
      placeholder={t('access.roles.search', '搜索角色、范围或权限键')}
      searchKeyword={searchKeyword}
      setSearchKeyword={setSearchKeyword}
    >
      <Modal
        title={
          crud.editing
            ? `${t('access.roles.edit', '编辑角色')}: ${crud.editing.name}`
            : t('access.roles.add', '添加角色')
        }
        open={crud.modalVisible}
        onCancel={crud.closeModal}
        onOk={async () => {
          try {
            await form.validateFields()
            const values = form.getFieldsValue(true)
            crud.handleSubmit({
              name: String(values.name ?? '').trim(),
              scope: String(values.scope ?? 'custom'),
              capabilities: [],
              permissionKeys: normalizeRolePermissionKeys(values.permissionKeys),
            })
          } catch {
            return
          }
        }}
        okText={crud.editing ? t('common.update', '更新') : t('common.create', '创建')}
        cancelText={t('common.cancel', '取消')}
        confirmLoading={crud.isSaving}
        cancelButtonProps={{ disabled: crud.isSaving }}
        closable={{ disabled: crud.isSaving }}
        keyboard={!crud.isSaving}
        styles={accessMutationModalStyles}
        footer={(buttons) => (
          <AccessMutationFooter error={crud.saveError} saving={crud.isSaving}>
            {buttons}
          </AccessMutationFooter>
        )}
        style={{ top: 32, marginTop: 0 }}
        width={1000}
        destroyOnHidden
        mask={{ closable: false }}
      >
        <Form
          form={form}
          disabled={crud.isSaving}
          key={crud.editing?.id ?? 'create-role'}
          layout="vertical"
          initialValues={
            crud.editing
              ? {
                  name: crud.editing.name,
                  scope: crud.editing.scope || 'custom',
                  permissionKeys: normalizeRolePermissionKeys(crud.editing.permissionKeys),
                }
              : { scope: 'custom', permissionKeys: [] }
          }
        >
          <Form.Item
            name="name"
            label={t('access.roles.form.name', '角色名称')}
            rules={[
              { required: true, message: t('access.roles.form.nameRequired', '请输入角色名称') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="scope" label={t('access.roles.form.scope', '角色范围')}>
            <Select
              options={[
                { value: 'system', label: t('access.roles.scope.system', '系统角色') },
                { value: 'custom', label: t('access.roles.scope.custom', '自定义角色') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('access.roles.form.permissions', '角色权限')}>
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) => prev.permissionKeys !== next.permissionKeys}
            >
              {({ getFieldValue, setFieldsValue }) => {
                const permissionKeys = normalizeRolePermissionKeys(getFieldValue('permissionKeys'))
                return (
                  <RolePermissionBrowser
                    definitions={permissionDefinitions}
                    error={permissionCatalogQuery.isError}
                    loading={permissionCatalogQuery.isLoading}
                    permissionKeys={permissionKeys}
                    onRetry={() => void permissionCatalogQuery.refetch()}
                    onChange={(nextPermissionKeys) =>
                      setFieldsValue({
                        permissionKeys: normalizeRolePermissionKeys(nextPermissionKeys),
                      })
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
