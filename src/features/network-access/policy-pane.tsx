import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
} from 'antd'
import type { TableColumnsType, TabsProps } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type {
  EndpointDevicePostureStatus,
  EndpointDeviceStatus,
  NetworkAccessMode,
  NetworkAccessPolicy,
  NetworkAccessPolicyInput,
  NetworkAccessProfile,
  NetworkConflictAnalysisRequest,
  NetworkConflictRange,
  NetworkConflictSourceType,
  NetworkPolicyEffect,
  NetworkPolicyPreviewRequest,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { useI18n } from '@/i18n'
import { networkAccessMutations } from './mutations'
import { networkAccessQueries } from './queries'

interface NetworkPolicyPaneProps {
  canCreate: boolean
  canDelete: boolean
  canUpdate: boolean
}

interface PolicyFormValues {
  accessProfile: NetworkAccessProfile
  deviceStatuses: EndpointDeviceStatus[]
  effect: NetworkPolicyEffect
  enabled: boolean
  modes: NetworkAccessMode[]
  name: string
  postureStatuses: EndpointDevicePostureStatus[]
  priority: number
  resourceIdsText?: string
  siteIdsText?: string
  tagsText?: string
  teamsText?: string
  usersText?: string
}

interface ConflictFormValues {
  rangesText?: string
}

const LIST_FILTER = { limit: 200 } as const
const MODES: NetworkAccessMode[] = [
  'internal_direct',
  'internal_ztna',
  'external_vpn',
  'external_vpn_ztna',
  'external_direct_ztna',
]
const CONFLICT_SOURCE_TYPES: NetworkConflictSourceType[] = [
  'lan',
  'wireguard_overlay',
  'container',
  'kubernetes_pod',
  'kubernetes_service',
  'mihomo_fake_ip',
]

function parseTextList(value?: string) {
  return String(value ?? '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseConflictRanges(value?: string): NetworkConflictRange[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sourceType, name, cidr, sourceId, ...extra] = line
        .split(',')
        .map((item) => item.trim())
      if (
        extra.length ||
        !CONFLICT_SOURCE_TYPES.includes(sourceType as NetworkConflictSourceType) ||
        !name ||
        !cidr
      ) {
        throw new Error('invalid conflict range')
      }
      return {
        sourceType: sourceType as NetworkConflictSourceType,
        name,
        cidr,
        ...(sourceId ? { sourceId } : {}),
      }
    })
}

function textList(values: string[]) {
  return values.join('\n')
}

export function NetworkPolicyPane({ canCreate, canDelete, canUpdate }: NetworkPolicyPaneProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const policies = useQuery(networkAccessQueries.policies(LIST_FILTER))
  const snapshot = useQuery(networkAccessQueries.policySnapshot())
  const createPolicy = useMutation(networkAccessMutations.policy.create(queryClient))
  const updatePolicy = useMutation(networkAccessMutations.policy.update(queryClient))
  const deletePolicy = useMutation(networkAccessMutations.policy.remove(queryClient))
  const compilePolicy = useMutation(networkAccessMutations.policy.compile(queryClient))
  const previewPolicy = useMutation(networkAccessMutations.policy.preview())
  const analyzeConflicts = useMutation(networkAccessMutations.policy.analyzeConflicts())
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<NetworkAccessPolicy | 'new' | null>(null)
  const [policyForm] = Form.useForm<PolicyFormValues>()
  const [previewForm] = Form.useForm<NetworkPolicyPreviewRequest>()
  const [conflictForm] = Form.useForm<ConflictFormValues>()
  const effect = Form.useWatch('effect', policyForm)

  const filteredPolicies = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    if (!keyword) return policies.data ?? []
    return (policies.data ?? []).filter((policy) =>
      [
        policy.name,
        policy.effect,
        policy.accessProfile,
        ...policy.subjects.users,
        ...policy.subjects.teams,
        ...policy.subjects.tags,
        ...policy.siteIds,
        ...policy.resourceIds,
        ...policy.modes,
      ].some((value) => value.toLocaleLowerCase().includes(keyword)),
    )
  }, [policies.data, search])

  function openEditor(policy?: NetworkAccessPolicy) {
    setEditor(policy ?? 'new')
    policyForm.resetFields()
    policyForm.setFieldsValue(
      policy
        ? {
            name: policy.name,
            enabled: policy.enabled,
            priority: policy.priority,
            effect: policy.effect,
            accessProfile: policy.accessProfile,
            usersText: textList(policy.subjects.users),
            teamsText: textList(policy.subjects.teams),
            tagsText: textList(policy.subjects.tags),
            siteIdsText: textList(policy.siteIds),
            resourceIdsText: textList(policy.resourceIds),
            modes: policy.modes,
            deviceStatuses: policy.deviceStatuses,
            postureStatuses: policy.postureStatuses,
          }
        : {
            name: '',
            enabled: true,
            priority: 100,
            effect: 'allow',
            accessProfile: 'full',
            usersText: '',
            teamsText: '',
            tagsText: '',
            siteIdsText: '',
            resourceIdsText: '',
            modes: [],
            deviceStatuses: ['active'],
            postureStatuses: ['compliant'],
          },
    )
  }

  async function submitPolicy() {
    const values = await policyForm.validateFields()
    const input: NetworkAccessPolicyInput = {
      name: values.name.trim(),
      enabled: values.enabled,
      priority: values.priority,
      effect: values.effect,
      subjects: {
        users: parseTextList(values.usersText),
        teams: parseTextList(values.teamsText),
        tags: parseTextList(values.tagsText),
      },
      siteIds: parseTextList(values.siteIdsText),
      resourceIds: parseTextList(values.resourceIdsText),
      modes: values.modes,
      deviceStatuses: values.deviceStatuses,
      postureStatuses: values.postureStatuses,
      accessProfile: values.effect === 'deny' ? 'deny' : values.accessProfile,
    }
    if (editor === 'new') await createPolicy.mutateAsync(input)
    else if (editor) await updatePolicy.mutateAsync({ policyId: editor.id, input })
    void message.success(t('networkAccess.saved', '已保存'))
    setEditor(null)
  }

  function submitPreview(values: NetworkPolicyPreviewRequest) {
    previewPolicy.mutate({
      subjectUserId: values.subjectUserId.trim(),
      deviceId: values.deviceId.trim(),
      resourceId: values.resourceId.trim(),
      mode: values.mode,
      ...(values.siteId?.trim() ? { siteId: values.siteId.trim() } : {}),
    })
  }

  function submitConflicts(values: ConflictFormValues) {
    const input: NetworkConflictAnalysisRequest = {
      runtimeRanges: parseConflictRanges(values.rangesText),
    }
    analyzeConflicts.mutate(input)
  }

  const columns: TableColumnsType<NetworkAccessPolicy> = [
    { title: t('networkAccess.name', '名称'), dataIndex: 'name', width: 180 },
    {
      title: t('networkAccess.policy.effect', '效果'),
      dataIndex: 'effect',
      width: 90,
      render: (value: NetworkPolicyEffect) => (
        <Tag color={value === 'deny' ? 'red' : 'green'}>{value}</Tag>
      ),
    },
    { title: t('networkAccess.policy.priority', '优先级'), dataIndex: 'priority', width: 90 },
    {
      title: t('networkAccess.policy.enabled', '启用'),
      dataIndex: 'enabled',
      width: 80,
      render: (value: boolean) => String(value),
    },
    {
      title: t('networkAccess.policy.profile', '访问等级'),
      dataIndex: 'accessProfile',
      width: 120,
    },
    {
      title: t('networkAccess.policy.subjects', '主体'),
      render: (_: unknown, policy) =>
        [
          ...policy.subjects.users.map((value) => 'user:' + value),
          ...policy.subjects.teams.map((value) => 'team:' + value),
          ...policy.subjects.tags.map((value) => 'tag:' + value),
        ].join(', '),
    },
    {
      title: t('networkAccess.policy.modes', '访问形态'),
      dataIndex: 'modes',
      render: (value: string[]) => value.join(', ') || '*',
    },
    { title: t('networkAccess.version', '版本'), dataIndex: 'version', width: 80 },
    ...(canUpdate || canDelete
      ? [
          {
            key: 'actions',
            width: 90,
            render: (_: unknown, policy: NetworkAccessPolicy) => (
              <Space className="soha-row-action-icons">
                {canUpdate ? (
                  <ManagementIconButton
                    aria-label={t('networkAccess.policy.edit', '编辑策略')}
                    icon={<EditOutlined />}
                    tooltip={t('common.edit', '编辑')}
                    onClick={() => openEditor(policy)}
                  />
                ) : null}
                {canDelete ? (
                  <Popconfirm
                    title={t('networkAccess.policy.confirmDelete', '确认删除策略？')}
                    onConfirm={() =>
                      deletePolicy.mutate(policy.id, {
                        onSuccess: () => void message.success(t('networkAccess.deleted', '已删除')),
                      })
                    }
                  >
                    <ManagementIconButton
                      aria-label={t('networkAccess.policy.delete', '删除策略')}
                      danger
                      icon={<DeleteOutlined />}
                      tooltip={t('common.delete', '删除')}
                    />
                  </Popconfirm>
                ) : null}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const tabs: TabsProps['items'] = [
    {
      key: 'drafts',
      label: t('networkAccess.policy.drafts', '策略草稿'),
      children: (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Card
            size="small"
            title={t('networkAccess.policy.publishedSnapshot', '已发布策略快照')}
            extra={
              canUpdate ? (
                <Button
                  type="primary"
                  loading={compilePolicy.isPending}
                  onClick={() =>
                    compilePolicy.mutate(undefined, {
                      onSuccess: () =>
                        void message.success(t('networkAccess.policy.compiled', '策略已发布')),
                    })
                  }
                >
                  {t('networkAccess.policy.compile', '发布草稿')}
                </Button>
              ) : null
            }
          >
            {snapshot.data ? (
              <Descriptions
                size="small"
                column={{ xs: 1, md: 3 }}
                items={[
                  {
                    key: 'version',
                    label: t('networkAccess.policyVersion', '策略版本'),
                    children: snapshot.data.policyVersion,
                  },
                  {
                    key: 'policies',
                    label: t('networkAccess.policy.policyCount', '策略数'),
                    children: snapshot.data.policyCount,
                  },
                  {
                    key: 'protected',
                    label: 'ProtectedSet',
                    children: snapshot.data.protectedResourceCount,
                  },
                  {
                    key: 'hash',
                    label: t('networkAccess.policy.contentHash', '内容摘要'),
                    children: snapshot.data.contentHash,
                  },
                  {
                    key: 'publishedAt',
                    label: t('networkAccess.policy.publishedAt', '发布时间'),
                    children: snapshot.data.publishedAt,
                  },
                ]}
              />
            ) : (
              <Alert
                showIcon
                type="warning"
                title={t('networkAccess.policy.notPublished', '尚未发布策略快照')}
              />
            )}
          </Card>
          <AdminTable
            columns={columns}
            dataSource={filteredPolicies}
            empty={policies.isError ? <ManagementState compact kind="error" /> : undefined}
            loading={policies.isLoading}
            localSorting
            rowKey="id"
            toolbar={
              <ManagementTableToolbar>
                <ManagementToolbarSearch
                  placeholder={t('networkAccess.policy.search', '搜索策略、主体或资源')}
                  value={search}
                  onChange={setSearch}
                />
                <ManagementIconButton
                  aria-label={t('networkAccess.refresh', '刷新')}
                  icon={<ReloadOutlined />}
                  loading={policies.isFetching}
                  tooltip={t('networkAccess.refresh', '刷新')}
                  onClick={() => void policies.refetch()}
                />
                {canCreate ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openEditor()}
                  >
                    {t('networkAccess.policy.add', '新增策略')}
                  </Button>
                ) : null}
              </ManagementTableToolbar>
            }
            viewportScroll
          />
        </Space>
      ),
    },
    {
      key: 'preview',
      label: t('networkAccess.policy.preview', '预览决策'),
      children: (
        <Card>
          <Form form={previewForm} layout="vertical" onFinish={submitPreview}>
            <Space wrap align="start">
              {[
                ['subjectUserId', t('networkAccess.policy.userId', '用户 ID')],
                ['deviceId', t('networkAccess.policy.deviceId', '设备 ID')],
                ['resourceId', t('networkAccess.policy.resourceId', '资源 ID')],
              ].map(([name, label]) => (
                <Form.Item
                  key={name}
                  name={name}
                  label={label}
                  rules={[{ required: true, whitespace: true }]}
                >
                  <Input maxLength={128} />
                </Form.Item>
              ))}
              <Form.Item
                name="siteId"
                label={t('networkAccess.policy.siteOptional', '站点 ID（可选）')}
              >
                <Input maxLength={128} />
              </Form.Item>
              <Form.Item
                name="mode"
                label={t('networkAccess.policy.mode', '访问形态')}
                rules={[{ required: true }]}
              >
                <Select
                  style={{ width: 220 }}
                  options={MODES.map((value) => ({ value, label: value }))}
                />
              </Form.Item>
              <Form.Item label=" ">
                <Button htmlType="submit" type="primary" loading={previewPolicy.isPending}>
                  {t('networkAccess.policy.preview', '预览决策')}
                </Button>
              </Form.Item>
            </Space>
          </Form>
          {previewPolicy.data ? (
            <>
              <Alert
                showIcon
                type={previewPolicy.data.decision === 'allow' ? 'success' : 'error'}
                title={
                  previewPolicy.data.decision === 'allow'
                    ? t('networkAccess.policy.allow', '允许访问')
                    : t('networkAccess.policy.deny', '拒绝访问')
                }
                description={previewPolicy.data.reasons.join(' · ')}
              />
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, md: 2, xl: 3 }}
                items={[
                  {
                    key: 'path',
                    label: t('networkAccess.policy.path', '执行路径'),
                    children: previewPolicy.data.path,
                  },
                  {
                    key: 'version',
                    label: t('networkAccess.policyVersion', '策略版本'),
                    children: previewPolicy.data.policyVersion,
                  },
                  {
                    key: 'protected',
                    label: 'ProtectedSet',
                    children: String(previewPolicy.data.protected),
                  },
                  {
                    key: 'networkLease',
                    label: t('networkAccess.policy.networkLease', '需要网络租约'),
                    children: String(previewPolicy.data.networkLeaseRequired),
                  },
                  {
                    key: 'resourceLease',
                    label: t('networkAccess.policy.resourceLease', '需要资源租约'),
                    children: String(previewPolicy.data.resourceLeaseRequired),
                  },
                  {
                    key: 'profile',
                    label: t('networkAccess.policy.profile', '访问等级'),
                    children: previewPolicy.data.networkProfile || '-',
                  },
                ]}
              />
            </>
          ) : null}
        </Card>
      ),
    },
    {
      key: 'conflicts',
      label: t('networkAccess.policy.conflicts', 'CIDR 冲突'),
      children: (
        <Card>
          <Form form={conflictForm} layout="vertical" onFinish={submitConflicts}>
            <Form.Item
              name="rangesText"
              label={t('networkAccess.policy.runtimeRanges', '待检查运行时网段')}
              rules={[
                {
                  validator: (_, value) => {
                    try {
                      parseConflictRanges(value)
                      return Promise.resolve()
                    } catch {
                      return Promise.reject(
                        new Error(
                          t(
                            'networkAccess.policy.invalidRanges',
                            '每行格式：类型,名称,CIDR[,来源 ID]',
                          ),
                        ),
                      )
                    }
                  },
                },
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 5, maxRows: 12 }}
                placeholder="wireguard_overlay,VPN overlay,10.200.0.0/16,gateway-1"
              />
            </Form.Item>
            <Button htmlType="submit" type="primary" loading={analyzeConflicts.isPending}>
              {t('networkAccess.policy.analyzeConflicts', '分析冲突')}
            </Button>
          </Form>
          {analyzeConflicts.data ? (
            <Space orientation="vertical" size="small" style={{ width: '100%', marginTop: 16 }}>
              <Alert
                showIcon
                type={analyzeConflicts.data.valid ? 'success' : 'error'}
                title={
                  analyzeConflicts.data.valid
                    ? t('networkAccess.policy.noConflicts', '未发现地址冲突')
                    : t('networkAccess.policy.conflictsFound', '发现地址冲突')
                }
                description={
                  t('networkAccess.policy.rangesAnalyzed', '已分析网段') +
                  ': ' +
                  analyzeConflicts.data.rangesAnalyzed
                }
              />
              {analyzeConflicts.data.conflicts.map((conflict, index) => (
                <Alert
                  key={
                    conflict.left.sourceType +
                    conflict.left.cidr +
                    conflict.right.sourceType +
                    conflict.right.cidr +
                    index
                  }
                  type="warning"
                  title={conflict.reason}
                  description={
                    conflict.left.name +
                    ' (' +
                    conflict.left.cidr +
                    ') ↔ ' +
                    conflict.right.name +
                    ' (' +
                    conflict.right.cidr +
                    ')'
                  }
                />
              ))}
            </Space>
          ) : null}
        </Card>
      ),
    },
  ]

  return (
    <>
      <Tabs items={tabs} />
      <Modal
        centered
        destroyOnHidden
        mask={{ closable: false }}
        open={editor !== null}
        title={
          editor === 'new'
            ? t('networkAccess.policy.add', '新增策略')
            : t('networkAccess.policy.edit', '编辑策略')
        }
        confirmLoading={createPolicy.isPending || updatePolicy.isPending}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        onCancel={() => setEditor(null)}
        onOk={() => void submitPolicy()}
      >
        <Form form={policyForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('networkAccess.name', '名称')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Space wrap align="start">
            <Form.Item
              name="priority"
              label={t('networkAccess.policy.priority', '优先级')}
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={10000} precision={0} />
            </Form.Item>
            <Form.Item
              name="effect"
              label={t('networkAccess.policy.effect', '效果')}
              rules={[{ required: true }]}
            >
              <Select
                style={{ width: 120 }}
                options={['allow', 'deny'].map((value) => ({ value, label: value }))}
                onChange={(value) => {
                  if (value === 'deny') policyForm.setFieldValue('accessProfile', 'deny')
                  else if (policyForm.getFieldValue('accessProfile') === 'deny')
                    policyForm.setFieldValue('accessProfile', 'full')
                }}
              />
            </Form.Item>
            <Form.Item
              name="accessProfile"
              label={t('networkAccess.policy.profile', '访问等级')}
              rules={[{ required: true }]}
            >
              <Select
                style={{ width: 150 }}
                disabled={effect === 'deny'}
                options={(effect === 'deny'
                  ? ['deny']
                  : ['onboarding', 'full', 'restricted', 'quarantine']
                ).map((value) => ({ value, label: value }))}
              />
            </Form.Item>
            <Form.Item
              name="enabled"
              label={t('networkAccess.policy.enabled', '启用')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item
            name="usersText"
            label={t('networkAccess.policy.users', '用户 ID')}
            dependencies={['teamsText', 'tagsText']}
            rules={[
              {
                validator: (_, value) =>
                  parseTextList(value).length ||
                  parseTextList(policyForm.getFieldValue('teamsText')).length ||
                  parseTextList(policyForm.getFieldValue('tagsText')).length
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          t('networkAccess.policy.requiredSubject', '用户、团队或标签至少填写一项'),
                        ),
                      ),
              },
            ]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="teamsText" label={t('networkAccess.policy.teams', '团队 ID')}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="tagsText" label={t('networkAccess.policy.tags', '用户标签')}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="siteIdsText" label={t('networkAccess.policy.siteIds', '站点 ID')}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item
            name="resourceIdsText"
            label={t('networkAccess.policy.resourceIds', '资源 ID')}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="modes" label={t('networkAccess.policy.modes', '访问形态')}>
            <Select mode="multiple" options={MODES.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item
            name="deviceStatuses"
            label={t('networkAccess.policy.deviceStatuses', '设备状态')}
          >
            <Select
              mode="multiple"
              options={['pending', 'active', 'quarantined', 'revoked'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="postureStatuses"
            label={t('networkAccess.policy.postureStatuses', '合规状态')}
          >
            <Select
              mode="multiple"
              options={['compliant', 'non_compliant', 'unknown'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
