import { useMemo, useState } from 'react'
import { Button, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { AccessManagementTablePage } from '../shared/management-page'
import { accessMutations, invalidateAccessTeams } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import { ScopeGrantManager } from '../shared/scope-grant-manager'
import type { AccessTeam } from '../shared/types'
import { useAccessResourceCrud } from '../shared/use-resource-crud'
import {
  collectOrganizationDescendantIds,
  getGroupDescription,
  getOrganizationDisplayPath,
  getOrganizationLabel,
} from '../shared/utils'
import {
  buildOrganizationSourceLabelMap,
  buildOrganizationSourceOptions,
  organizationSourceLabel,
} from './provider-options'
import '../shared/styles.css'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]
const directoryProviderLabels: Record<string, string> = {
  feishu: '飞书',
  wecom: '企业微信',
  dingtalk: '钉钉',
  ldap: 'LDAP',
  scim: 'SCIM',
}

export function AccessTeamsPage() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewGroups = hasPermission(snapshot, 'access.groups.view')
  const canManageGroups = hasPermission(snapshot, 'access.groups.manage')
  const canManageScopeGrants = hasPermission(snapshot, 'access.scope-grants.manage')
  const canViewLoginSettings = hasPermission(snapshot, 'settings.identity.view')
  const [form] = Form.useForm<Record<string, unknown>>()
  const crud = useAccessResourceCrud({
    query: accessQueries.teams(),
    create: accessMutations.teams.create(),
    update: accessMutations.teams.update(),
    delete: accessMutations.teams.delete(),
    invalidate: invalidateAccessTeams,
  })
  const [grantTeam, setGrantTeam] = useState<AccessTeam | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const loginProvidersQuery = useQuery(
    accessQueries.loginProviders(canManageGroups && canViewLoginSettings),
  )
  const loginProviders = loginProvidersQuery.data ?? []
  const organizationSourceOptions = useMemo(
    () => buildOrganizationSourceOptions(loginProviders),
    [loginProviders],
  )
  const organizationSourceLabelMap = useMemo(
    () => buildOrganizationSourceLabelMap(loginProviders),
    [loginProviders],
  )
  const blockedOrganizationIds = new Set(
    crud.editing
      ? [crud.editing.id, ...collectOrganizationDescendantIds(crud.data, crud.editing.id)]
      : [],
  )
  const parentOrganizationOptions = [
    { value: '', label: '根组织' },
    ...crud.data
      .filter((item) => !blockedOrganizationIds.has(item.id))
      .map((item) => ({
        value: item.id,
        label: `${getOrganizationLabel(item)} (${getOrganizationDisplayPath(crud.data, item)})`,
      })),
  ]
  const columns: ColumnProps<AccessTeam>[] = [
    {
      title: '组织名称',
      dataIndex: 'name',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: '上级组织',
      dataIndex: 'parentId',
      render: (value: string) =>
        value ? getOrganizationLabel(crud.data.find((item) => item.id === value)) : '根组织',
    },
    {
      title: '组织路径',
      key: 'displayPath',
      render: (_value: unknown, record: AccessTeam) => (
        <Text title={record.path}>{getOrganizationDisplayPath(crud.data, record)}</Text>
      ),
    },
    {
      title: '映射来源',
      dataIndex: 'source',
      render: (value: string, record: AccessTeam) => {
        const providerType = String(record.metadata?.directoryProviderType ?? '').trim()
        const sourceLabel = providerType
          ? directoryProviderLabels[providerType] ?? providerType
          : organizationSourceLabel(value, organizationSourceLabelMap)
        const directoryName = String(record.metadata?.directoryConnectionName ?? '').trim()
        const technicalDetails = [directoryName, value, record.externalId].filter(Boolean).join(' · ')
        return (
          <Tag color={value?.startsWith('directory:') ? 'blue' : undefined} title={technicalDetails}>
            {sourceLabel}
          </Tag>
        )
      },
    },
    {
      title: '说明',
      dataIndex: 'metadata',
      render: (value: Record<string, unknown>) => getGroupDescription(value) || '-',
    },
    { title: '成员数', dataIndex: 'userCount' },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessTeam) => (
        <Space className="soha-row-action-icons">
          {canManageGroups || canManageScopeGrants ? (
            <>
              {canManageScopeGrants ? (
                <ManagementIconButton
                  aria-label="授权范围"
                  icon={<FolderOpenOutlined />}
                  size="small"
                  tooltip="授权范围"
                  onClick={() => setGrantTeam(record)}
                />
              ) : null}
              {canManageGroups ? (
                <ManagementIconButton
                  aria-label="编辑组织"
                  icon={<EditOutlined />}
                  size="small"
                  tooltip="编辑"
                  onClick={() => crud.openEdit(record)}
                />
              ) : null}
              {canManageGroups ? (
                <Popconfirm
                  title="确认删除？"
                  onConfirm={() => crud.deleteMutation.mutate(record.id)}
                >
                  <ManagementIconButton
                    aria-label="删除组织"
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
  const filteredTeams = useManagementTextFilter(crud.data, searchKeyword, (item) => [
    item.name,
    item.slug,
    item.path,
    item.source,
    item.externalId,
    getGroupDescription(item.metadata),
  ])

  if (!canViewGroups) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有组织管理权限。" />
      </div>
    )
  }

  return (
    <AccessManagementTablePage<AccessTeam>
      columns={columns}
      createAction={
        canManageGroups ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={crud.openCreate}>
            添加组织
          </Button>
        ) : null
      }
      dataSource={filteredTeams}
      rowKey="id"
      loading={crud.isLoading}
      placeholder="搜索组织、路径或来源"
      searchKeyword={searchKeyword}
      setSearchKeyword={setSearchKeyword}
    >
      <Modal
        title={crud.editing ? `编辑组织: ${crud.editing.name}` : '添加组织'}
        open={crud.modalVisible}
        onCancel={crud.closeModal}
        onOk={async () => {
          try {
            const values = await form.validateFields()
            crud.handleSubmit({
              name: String(values.name ?? '').trim(),
              slug: String(values.slug ?? '').trim(),
              parentId: String(values.parentId ?? '').trim(),
              source: String(values.source ?? 'local').trim() || 'local',
              externalId: String(values.externalId ?? '').trim(),
              metadata: {
                ...(crud.editing?.metadata ?? {}),
                description: String(values.description ?? '').trim(),
              },
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
          key={crud.editing?.id ?? 'create-group'}
          layout="vertical"
          initialValues={
            crud.editing
              ? {
                  name: crud.editing.name,
                  slug: crud.editing.slug,
                  parentId: crud.editing.parentId ?? '',
                  source: crud.editing.source || 'local',
                  externalId: crud.editing.externalId ?? '',
                  description: getGroupDescription(crud.editing.metadata),
                }
              : { parentId: '', source: 'local' }
          }
        >
          <Form.Item name="parentId" label="上级组织">
            <Select
              allowClear
              options={parentOrganizationOptions}
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="组织名称"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="标识">
            <Input placeholder="留空时按名称自动生成" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="source"
                label="映射来源"
                extra="App Key 和 Secret 在登录设置的登录源应用中维护。"
              >
                <Select
                  loading={loginProvidersQuery.isFetching}
                  options={organizationSourceOptions}
                  showSearch={{ optionFilterProp: 'label' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="externalId"
                label="外部组织 ID"
                extra="填写第三方目录返回的部门或组织 ID，用于登录后匹配本地组织。"
              >
                <Input placeholder="飞书 department_id / 钉钉 dept_id / 企业微信 department_id" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={4} placeholder="说明该组织的职责边界和适用成员" />
          </Form.Item>
        </Form>
      </Modal>
      <ScopeGrantManager
        subjectType="team"
        subjectId={grantTeam?.id ?? null}
        visible={Boolean(grantTeam)}
        title={grantTeam ? `组织授权范围: ${grantTeam.name}` : '组织授权范围'}
        onClose={() => setGrantTeam(null)}
      />
    </AccessManagementTablePage>
  )
}
