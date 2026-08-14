import { useEffect, useMemo } from 'react'
import { Form, Modal, Segmented, Select, Switch } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { visuallyHiddenModalTitleStyle } from '@/components/modal-styles'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { accessQueries } from './queries'
import type { AccessMutationValues, AccessScopeGrant } from './types'

export type ScopeGrantFormValues = {
  applicationIds?: string[]
  businessLineId?: string
  clusterIds?: string[]
  enabled: boolean
  environmentIds?: string[]
  role?: string
  scopeType: 'delivery' | 'legacy' | 'platform'
  subjectId?: string
  subjectType?: 'team' | 'user'
}

interface ScopeGrantEditorProps {
  editing: AccessScopeGrant | null
  fixedSubject?: { id: string; type: 'team' | 'user' }
  onCancel: () => void
  onSubmit: (values: AccessMutationValues) => void
  open: boolean
  pending?: boolean
}

function optionLabel(name: string, id: string) {
  return name && name !== id ? `${name} (${id})` : name || id
}

function withFallback(
  options: Array<{ label: string; value: string }>,
  values: string[] | undefined,
) {
  const seen = new Set(options.map((option) => option.value))
  return [
    ...options,
    ...(values ?? [])
      .filter((value) => value && !seen.has(value))
      .map((value) => ({ label: value, value })),
  ]
}

export function buildScopeGrantPayload(
  values: ScopeGrantFormValues,
  editing: AccessScopeGrant | null,
  fixedSubject?: { id: string; type: 'team' | 'user' },
): AccessMutationValues {
  const preservedRestrictions = editing
    ? {
        applicationIds: editing.applicationIds ?? [],
        businessLineId: editing.businessLineId,
        clusterIds: editing.clusterIds ?? [],
        environmentIds: editing.environmentIds ?? [],
        namespaceSelector: editing.namespaceSelector ?? '',
        namespaces: editing.namespaces ?? [],
        resourceGroups: editing.resourceGroups ?? [],
        resourceKinds: editing.resourceKinds ?? [],
      }
    : {}
  const common = {
    ...preservedRestrictions,
    effect: editing?.effect ?? 'allow',
    enabled: values.enabled,
    role: values.role,
    scopeType: values.scopeType,
    subjectId: fixedSubject?.id ?? values.subjectId,
    subjectType: fixedSubject?.type ?? values.subjectType,
  }

  return values.scopeType === 'platform'
    ? {
        ...common,
        businessLineId: '',
        clusterIds: values.clusterIds ?? [],
      }
    : {
        ...common,
        applicationIds: values.applicationIds ?? [],
        businessLineId: values.businessLineId?.trim() ?? '',
        environmentIds: values.environmentIds ?? [],
      }
}

export function ScopeGrantEditor({
  editing,
  fixedSubject,
  onCancel,
  onSubmit,
  open,
  pending = false,
}: ScopeGrantEditorProps) {
  const [form] = Form.useForm<ScopeGrantFormValues>()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canViewUsers = hasPermission(snapshot, 'access.users.view')
  const canViewTeams = hasPermission(snapshot, 'access.groups.view')
  const canViewApplications = hasPermission(snapshot, 'delivery.applications.view')
  const canViewApplicationEnvironments = hasPermission(
    snapshot,
    'delivery.application-environments.view',
  )
  const canViewClusters = hasPermission(snapshot, 'platform.clusters.view')
  const canViewDelivery = canViewApplications && canViewApplicationEnvironments
  const defaultSubjectType = canViewTeams ? 'team' : 'user'

  const rolesQuery = useQuery(accessQueries.roles(open && canViewRoles))
  const usersQuery = useQuery(accessQueries.users(open && !fixedSubject && canViewUsers))
  const teamsQuery = useQuery(accessQueries.teams(open && !fixedSubject && canViewTeams))
  const applicationsQuery = useQuery(accessQueries.applicationOptions(open && canViewApplications))
  const applicationEnvironmentsQuery = useQuery(
    accessQueries.applicationEnvironments(open && canViewApplicationEnvironments),
  )
  const clustersQuery = useQuery(accessQueries.clusterOptions(open && canViewClusters))

  const defaultScopeType = canViewDelivery ? 'delivery' : 'platform'
  const initialScopeType = editing?.scopeType ?? defaultScopeType
  const scopeType = Form.useWatch('scopeType', form) ?? initialScopeType
  const subjectType =
    Form.useWatch('subjectType', form) ?? editing?.subjectType ?? defaultSubjectType
  const businessLineId = Form.useWatch('businessLineId', form)
  const applicationIds = Form.useWatch('applicationIds', form) ?? []

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      editing
        ? {
            applicationIds: editing.applicationIds ?? [],
            businessLineId: editing.businessLineId,
            clusterIds: editing.clusterIds ?? [],
            enabled: editing.enabled,
            environmentIds: editing.environmentIds ?? [],
            role: editing.role,
            scopeType: editing.scopeType,
            subjectId: fixedSubject?.id ?? editing.subjectId,
            subjectType: fixedSubject?.type ?? editing.subjectType,
          }
        : {
            applicationIds: [],
            clusterIds: [],
            enabled: true,
            environmentIds: [],
            scopeType: defaultScopeType,
            subjectId: fixedSubject?.id,
            subjectType: fixedSubject?.type ?? defaultSubjectType,
          },
    )
  }, [
    defaultScopeType,
    defaultSubjectType,
    editing,
    fixedSubject?.id,
    fixedSubject?.type,
    form,
    open,
  ])

  const roleOptions = withFallback(
    (rolesQuery.data ?? []).map((role) => ({
      label: optionLabel(role.name, role.id),
      value: role.id,
    })),
    editing?.role ? [editing.role] : [],
  )
  const userOptions = withFallback(
    (usersQuery.data ?? []).map((user) => ({
      label: optionLabel(user.displayName || user.username, user.id),
      value: user.id,
    })),
    editing?.subjectType === 'user' ? [editing.subjectId] : [],
  )
  const teamOptions = withFallback(
    (teamsQuery.data ?? []).map((team) => ({
      label: optionLabel(team.name, team.id),
      value: team.id,
    })),
    editing?.subjectType === 'team' ? [editing.subjectId] : [],
  )

  const bindings = applicationEnvironmentsQuery.data ?? []
  const businessLineOptions = withFallback(
    Array.from(
      new Set(
        [
          ...(applicationsQuery.data ?? []).map((item) => item.businessLineId || item.group),
          ...bindings.map((item) => item.businessLineId || item.applicationGroup),
        ].filter((value): value is string => Boolean(value?.trim())),
      ),
    )
      .sort()
      .map((value) => ({ label: value, value })),
    editing?.businessLineId ? [editing.businessLineId] : [],
  )
  const applicationOptions = withFallback(
    (applicationsQuery.data ?? [])
      .filter(
        (application) =>
          !businessLineId ||
          application.businessLineId === businessLineId ||
          application.group === businessLineId ||
          bindings.some(
            (binding) =>
              binding.applicationId === application.id &&
              (binding.businessLineId === businessLineId ||
                binding.applicationGroup === businessLineId),
          ),
      )
      .map((application) => ({
        label: optionLabel(application.name, application.id),
        value: application.id,
      })),
    editing?.applicationIds,
  )
  const environmentOptions = withFallback(
    Array.from(
      new Map(
        bindings
          .filter(
            (binding) =>
              (!businessLineId ||
                binding.businessLineId === businessLineId ||
                binding.applicationGroup === businessLineId) &&
              (applicationIds.length === 0 || applicationIds.includes(binding.applicationId)),
          )
          .map((binding) => [
            binding.environmentId,
            {
              label: optionLabel(binding.environmentKey ?? '', binding.environmentId),
              value: binding.environmentId,
            },
          ]),
      ).values(),
    ),
    editing?.environmentIds,
  )
  const clusterOptions = withFallback(
    (clustersQuery.data ?? []).map((cluster) => ({
      label: optionLabel(cluster.name, cluster.id),
      value: cluster.id,
    })),
    editing?.clusterIds,
  )

  const scopeOptions = useMemo(
    () => [
      ...(editing?.scopeType === 'legacy'
        ? [{ label: '交付范围（兼容）', value: 'legacy' as const }]
        : []),
      {
        disabled: !canViewDelivery && editing?.scopeType !== 'delivery',
        label: '交付范围',
        tooltip: canViewDelivery ? undefined : '需要应用与应用环境查看权限',
        value: 'delivery' as const,
      },
      {
        disabled: !canViewClusters && editing?.scopeType !== 'platform',
        label: '平台范围',
        tooltip: canViewClusters ? undefined : '需要集群查看权限',
        value: 'platform' as const,
      },
    ],
    [canViewClusters, canViewDelivery, editing?.scopeType],
  )

  const submit = async () => {
    try {
      const values = await form.validateFields()
      onSubmit(buildScopeGrantPayload(values, editing, fixedSubject))
    } catch {
      return
    }
  }

  return (
    <Modal
      title={editing ? '编辑授权项' : '新建授权项'}
      styles={{ header: { minHeight: 32 }, title: visuallyHiddenModalTitleStyle }}
      open={open}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={editing ? '更新' : '创建'}
      cancelText="取消"
      confirmLoading={pending}
      width={680}
      destroyOnHidden
      mask={{ closable: false }}
    >
      <Form form={form} layout="vertical">
        {!fixedSubject ? (
          <>
            <Form.Item name="subjectType" label="授权主体">
              <Segmented
                block
                options={[
                  { disabled: !canViewTeams, label: '组织', value: 'team' },
                  { disabled: !canViewUsers, label: '用户', value: 'user' },
                ]}
                onChange={() => form.setFieldValue('subjectId', undefined)}
              />
            </Form.Item>
            <Form.Item
              name="subjectId"
              label={subjectType === 'team' ? '组织' : '用户'}
              rules={[
                { required: true, message: `请选择${subjectType === 'team' ? '组织' : '用户'}` },
              ]}
            >
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                options={subjectType === 'team' ? teamOptions : userOptions}
                loading={subjectType === 'team' ? teamsQuery.isLoading : usersQuery.isLoading}
              />
            </Form.Item>
          </>
        ) : null}

        <Form.Item name="scopeType" label="授权范围">
          <Segmented
            block
            className="soha-form-segmented"
            disabled={Boolean(editing)}
            options={scopeOptions}
            onChange={() =>
              form.setFieldsValue({
                applicationIds: [],
                businessLineId: undefined,
                clusterIds: [],
                environmentIds: [],
              })
            }
          />
        </Form.Item>

        {scopeType === 'platform' ? (
          <Form.Item
            name="clusterIds"
            label="集群（全部命名空间）"
            rules={[{ required: true, message: '请选择至少一个集群' }]}
          >
            <Select
              disabled={Boolean(editing) && !canViewClusters}
              mode="multiple"
              maxTagCount="responsive"
              showSearch={{ optionFilterProp: 'label' }}
              options={clusterOptions}
              loading={clustersQuery.isLoading}
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="businessLineId"
              label="业务范围"
              rules={[{ required: true, message: '请选择业务范围' }]}
            >
              <Select
                disabled={Boolean(editing) && !canViewDelivery}
                showSearch={{ optionFilterProp: 'label' }}
                options={businessLineOptions}
                loading={applicationsQuery.isLoading || applicationEnvironmentsQuery.isLoading}
                onChange={() => form.setFieldsValue({ applicationIds: [], environmentIds: [] })}
              />
            </Form.Item>
            <Form.Item name="applicationIds" label="应用（留空为全部）">
              <Select
                disabled={Boolean(editing) && !canViewDelivery}
                mode="multiple"
                maxTagCount="responsive"
                showSearch={{ optionFilterProp: 'label' }}
                options={applicationOptions}
                loading={applicationsQuery.isLoading}
                onChange={() => form.setFieldValue('environmentIds', [])}
              />
            </Form.Item>
            <Form.Item name="environmentIds" label="环境（留空为全部）">
              <Select
                disabled={Boolean(editing) && !canViewDelivery}
                mode="multiple"
                maxTagCount="responsive"
                showSearch={{ optionFilterProp: 'label' }}
                options={environmentOptions}
                loading={applicationEnvironmentsQuery.isLoading}
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="role"
          label="范围内角色"
          rules={[{ required: true, message: '请选择角色' }]}
        >
          <Select
            disabled={Boolean(editing) && !canViewRoles}
            showSearch={{ optionFilterProp: 'label' }}
            options={roleOptions}
            loading={rolesQuery.isLoading}
          />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
