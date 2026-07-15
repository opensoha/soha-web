import { useMemo, useState } from 'react'
import { Button, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { AccessManagementTablePage } from '../shared/management-page'
import { renderCompactMappedTags } from '../shared/compact-mapped-tags'
import { accessMutations, invalidateAccessPolicies } from '../shared/mutations'
import { ACCESS_ACTION_OPTIONS } from '../shared/options'
import { accessQueries } from '../shared/queries'
import type { AccessPolicy } from '../shared/types'
import { useAccessResourceCrud } from '../shared/use-resource-crud'
import { joinCSV, parseCSV, toStringArray } from '../shared/utils'
import { buildPolicySubjectsSummary, buildPolicyTargetsSummary } from './view-model'
import '../shared/styles.css'

type ColumnProps<T> = TableColumnsType<T>[number]
const POLICY_EFFECT_OPTIONS = [
  { value: 'allow', label: '允许' },
  { value: 'deny', label: '拒绝' },
]

export function AccessPoliciesPage() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewPolicies = hasPermission(snapshot, 'access.policies.view')
  const canManagePolicies = hasPermission(snapshot, 'access.policies.manage')
  const [form] = Form.useForm<Record<string, unknown>>()
  const crud = useAccessResourceCrud({
    query: accessQueries.policies(),
    create: accessMutations.policies.create(),
    update: accessMutations.policies.update(),
    delete: accessMutations.policies.delete(),
    invalidate: invalidateAccessPolicies,
  })
  const [searchKeyword, setSearchKeyword] = useState('')
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
  const columns: ColumnProps<AccessPolicy>[] = [
    { title: '策略名称', dataIndex: 'name' },
    { title: '效果', dataIndex: 'effect', render: (value: string) => <StatusTag value={value} /> },
    { title: '优先级', dataIndex: 'priority' },
    {
      title: '动作',
      dataIndex: 'actions',
      width: 180,
      render: (values: string[]) => renderCompactMappedTags(values, {}, '未配置', 2, '动作'),
    },
    {
      title: '主体',
      dataIndex: 'subjects',
      ellipsis: true,
      render: (_: unknown, record: AccessPolicy) =>
        buildPolicySubjectsSummary(record, roleMap, teamMap),
    },
    {
      title: '目标',
      dataIndex: 'resources',
      ellipsis: true,
      render: (_: unknown, record: AccessPolicy) => buildPolicyTargetsSummary(record, teamMap),
    },
    { title: '原因', dataIndex: 'reason', ellipsis: true, render: (value: string) => value || '-' },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessPolicy) => (
        <Space className="soha-row-action-icons">
          {canManagePolicies ? (
            <>
              <ManagementIconButton
                aria-label="编辑策略"
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
                  aria-label="删除策略"
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
  const filteredPolicies = useManagementTextFilter(crud.data, searchKeyword, (item) => [
    item.name,
    item.effect,
    item.reason,
    ...(item.actions ?? []),
    ...(item.subjects?.roles ?? []).map((id) => roleMap[id] || id),
    ...(item.subjects?.teams ?? []).map((id) => teamMap[id] || id),
    ...(item.subjects?.users ?? []),
    ...(item.subjects?.tags ?? []),
    ...(item.clusters?.ids ?? []),
    ...(item.namespaces?.names ?? []),
    ...(item.resources?.kinds ?? []),
    ...(item.resources?.names ?? []),
  ])

  const submitPolicy = (values: Record<string, unknown>) => {
    const current = crud.editing
    const baseSubjects = current?.subjects ?? {
      roles: [],
      teams: [],
      projects: [],
      users: [],
      tags: [],
    }
    const baseClusters = current?.clusters ?? { ids: [], regions: [], environments: [], labels: {} }
    const baseNamespaces = current?.namespaces ?? { names: [], ownerTeams: [], labels: {} }
    const baseResources = current?.resources ?? { kinds: [], names: [], labels: {} }
    const baseConditions = current?.conditions ?? { sources: [], approvalStates: [] }
    crud.handleSubmit({
      name: String(values.name ?? '').trim(),
      effect: String(values.effect ?? 'allow'),
      priority: Number(values.priority ?? 0),
      actions: toStringArray(values.actions),
      subjects: {
        ...baseSubjects,
        roles: toStringArray(values.subjectRoleIds),
        teams: toStringArray(values.subjectTeamIds),
        users: parseCSV(values.subjectUsers),
        tags: parseCSV(values.subjectTags),
      },
      clusters: {
        ...baseClusters,
        ids: parseCSV(values.clusterIds),
        regions: parseCSV(values.clusterRegions),
        environments: parseCSV(values.clusterEnvironments),
      },
      namespaces: {
        ...baseNamespaces,
        names: parseCSV(values.namespaceNames),
        ownerTeams: toStringArray(values.ownerTeamIds),
      },
      resources: {
        ...baseResources,
        kinds: parseCSV(values.resourceKinds),
        names: parseCSV(values.resourceNames),
      },
      conditions: {
        ...baseConditions,
        sources: parseCSV(values.sources),
        approvalStates: parseCSV(values.approvalStates),
      },
      reason: String(values.reason ?? '').trim(),
    })
  }

  if (!canViewPolicies) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有策略管理权限。" />
      </div>
    )
  }

  return (
    <AccessManagementTablePage<AccessPolicy>
      columns={columns}
      createAction={
        canManagePolicies ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={crud.openCreate}>
            添加策略
          </Button>
        ) : null
      }
      dataSource={filteredPolicies}
      rowKey="id"
      loading={crud.isLoading}
      placeholder="搜索策略、主体、目标或动作"
      searchKeyword={searchKeyword}
      setSearchKeyword={setSearchKeyword}
    >
      <Modal
        title={crud.editing ? `编辑策略: ${crud.editing.name}` : '添加策略'}
        open={crud.modalVisible}
        onCancel={crud.closeModal}
        onOk={async () => {
          try {
            submitPolicy(await form.validateFields())
          } catch {
            return
          }
        }}
        okText={crud.editing ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={crud.isSaving}
        width={920}
        destroyOnHidden
        mask={{ closable: false }}
        styles={{ body: { maxHeight: '72vh', overflow: 'auto' } }}
      >
        <Form
          form={form}
          key={crud.editing?.id ?? 'create-policy'}
          layout="vertical"
          initialValues={
            crud.editing
              ? {
                  name: crud.editing.name,
                  effect: crud.editing.effect,
                  priority: crud.editing.priority,
                  actions: crud.editing.actions ?? [],
                  subjectRoleIds: crud.editing.subjects?.roles ?? [],
                  subjectTeamIds: crud.editing.subjects?.teams ?? [],
                  subjectUsers: joinCSV(crud.editing.subjects?.users),
                  subjectTags: joinCSV(crud.editing.subjects?.tags),
                  clusterIds: joinCSV(crud.editing.clusters?.ids),
                  clusterRegions: joinCSV(crud.editing.clusters?.regions),
                  clusterEnvironments: joinCSV(crud.editing.clusters?.environments),
                  namespaceNames: joinCSV(crud.editing.namespaces?.names),
                  ownerTeamIds: crud.editing.namespaces?.ownerTeams ?? [],
                  resourceKinds: joinCSV(crud.editing.resources?.kinds),
                  resourceNames: joinCSV(crud.editing.resources?.names),
                  sources: joinCSV(crud.editing.conditions?.sources),
                  approvalStates: joinCSV(crud.editing.conditions?.approvalStates),
                  reason: crud.editing.reason,
                }
              : {
                  effect: 'allow',
                  priority: 0,
                  actions: [],
                  subjectRoleIds: [],
                  subjectTeamIds: [],
                  ownerTeamIds: [],
                }
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="策略名称"
                rules={[{ required: true, message: '请输入策略名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="effect"
                label="效果"
                rules={[{ required: true, message: '请选择效果' }]}
              >
                <Select options={POLICY_EFFECT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="priority" label="优先级">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="actions"
            label="动作"
            rules={[
              {
                validator: (_, value) =>
                  toStringArray(value).length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('请选择至少一个动作')),
              },
            ]}
          >
            <Select mode="multiple" options={ACCESS_ACTION_OPTIONS} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subjectRoleIds" label="主体角色">
                <Select mode="multiple" options={roleOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subjectTeamIds" label="主体组织">
                <Select
                  mode="multiple"
                  options={teamOptions}
                  showSearch={{ optionFilterProp: 'label' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subjectUsers" label="主体用户">
                <Input placeholder="多个用户名以逗号分隔" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subjectTags" label="主体标签">
                <Input placeholder="多个标签以逗号分隔" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="clusterEnvironments" label="集群环境">
                <Input placeholder="development, staging" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="clusterRegions" label="集群地域">
                <Input placeholder="cn-beijing, us-west" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="clusterIds" label="集群 IDs">
                <Input placeholder="多个集群 ID 以逗号分隔" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="namespaceNames" label="命名空间">
                <Input placeholder="多个命名空间以逗号分隔" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ownerTeamIds" label="归属组织">
                <Select
                  mode="multiple"
                  options={teamOptions}
                  showSearch={{ optionFilterProp: 'label' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="resourceKinds" label="资源类型">
                <Input placeholder="Pod, Deployment, Namespace" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="resourceNames" label="资源名称">
                <Input placeholder="多个资源名称以逗号分隔" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sources" label="请求来源">
                <Input placeholder="console, api, oidc" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvalStates" label="审批状态">
                <Input placeholder="approved, pending" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="原因说明">
            <Input.TextArea rows={3} placeholder="说明该策略的意图和生效边界" />
          </Form.Item>
        </Form>
      </Modal>
    </AccessManagementTablePage>
  )
}
