import { useState } from 'react'
import {
  Alert,
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
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepForm } from '@/components/step-form'
import type { StepFormStep } from '@/components/step-form'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { accessQueries } from '@/features/access/shared/queries'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeleteOutlined, EditOutlined, PlusOutlined, StarOutlined } from '@ant-design/icons'
import {
  applyProviderPreset,
  defaultFrontendRedirectPath,
  defaultRedirectPath,
  LOGIN_PROVIDER_TYPE_OPTIONS,
  LOGIN_SYNC_MODE_OPTIONS,
  newLoginProviderID,
} from './model'
import { settingsMutations } from '../mutations'
import { settingsQueries } from '../queries'
import { SettingsAdminTable, TagSelect } from '../shared/components'
import type { LoginProviderSettings, SaveIdentitySettingsInput, SettingsPageProps } from '../types'
import '../shared/styles.css'

const { Text } = Typography

export function LoginSettingsPage({ embedded = false }: SettingsPageProps = {}) {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [providerForm] = Form.useForm()
  const syncRolesOnLogin = Form.useWatch('syncRolesOnLogin', providerForm)
  const syncOrgsOnLogin = Form.useWatch('syncOrgsOnLogin', providerForm)
  const [providerModalVisible, setProviderModalVisible] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LoginProviderSettings | null>(null)
  const [providerStep, setProviderStep] = useState(0)
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const canViewLoginSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.identity.view',
  )
  const canManageLoginSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.identity.manage',
  )

  const identityQuery = useQuery(settingsQueries.identity())
  const { data, isLoading } = identityQuery
  const rolesQuery = useQuery({
    ...accessQueries.roles(),
    enabled: canViewLoginSettings,
  })
  const saveMutation = useMutation(settingsMutations.identity.save(queryClient))
  const saveIdentity = (input: SaveIdentitySettingsInput) =>
    saveMutation.mutate(
      {
        ...input,
        values: {
          localPasswordLoginEnabled: settings?.localPasswordLoginEnabled ?? true,
          ...input.values,
        },
      },
      {
        onSuccess: () => void message.success(input.successMessage || '登陆设置已保存'),
        onError: (err) => void message.error(err.message),
      },
    )

  const settings = data
  const providers = settings?.providers ?? []
  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: role.id,
    label: role.name || role.id,
  }))
  const providerInitialType = editingProvider?.type || 'oidc'
  const providerInitialID = editingProvider?.id || newLoginProviderID()
  const providerInitialValues = applyProviderPreset(providerInitialType, {
    ...editingProvider,
    id: providerInitialID,
    redirectUrl: editingProvider?.redirectUrl || defaultRedirectPath(providerInitialID),
    frontendRedirectUrl: editingProvider?.frontendRedirectUrl || defaultFrontendRedirectPath(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!canViewLoginSettings) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看登陆设置的权限。" />
      </div>
    )
  }

  const providerColumns: TableColumnsType<LoginProviderSettings> = [
    {
      title: '图标',
      key: 'icon',
      width: 64,
      align: 'center',
      render: (_: unknown, record: LoginProviderSettings) => (
        <Avatar
          alt={record.name}
          shape="square"
          size={24}
          src={record.iconUrl || undefined}
          style={{ background: '#1677ff', fontSize: 12 }}
        >
          {Array.from(record.name || record.type || '?')[0]}
        </Avatar>
      ),
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: string) => {
        const item = LOGIN_PROVIDER_TYPE_OPTIONS.find((current) => current.value === value)
        return item?.label || value
      },
    },
    {
      title: '回调地址',
      dataIndex: 'redirectUrl',
      render: (value: string) => value || '-',
    },
    {
      title: '登录映射',
      dataIndex: 'id',
      render: (_: unknown, record: LoginProviderSettings) => {
        const items = []
        if (record.syncRolesOnLogin) {
          items.push(<Tag key="roles">角色</Tag>)
        }
        if (record.syncOrgsOnLogin) {
          items.push(<Tag key="orgs">组织</Tag>)
        }
        return items.length > 0 ? items : '-'
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean, record: LoginProviderSettings) => (
        <Switch
          checked={value}
          aria-label={`启用 ${record.name}`}
          disabled={!canManageLoginSettings || saveMutation.isPending}
          loading={saveMutation.isPending}
          size="small"
          onChange={(checked) => {
            const nextProviders = providers.map((item) =>
              item.id === record.id ? { ...item, enabled: checked } : item,
            )
            saveIdentity({
              values: {
                providers: nextProviders,
                defaultProviderId: settings?.defaultProviderId,
              },
            })
          }}
        />
      ),
    },
    {
      title: '默认',
      dataIndex: 'id',
      render: (value: string) =>
        settings?.defaultProviderId === value ? <Tag color="blue">默认</Tag> : '-',
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: LoginProviderSettings) =>
        canManageLoginSettings ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="编辑登录源"
              tooltip="编辑"
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingProvider(record)
                setProviderStep(0)
                setProviderModalVisible(true)
              }}
            />
            <Popconfirm
              title="确认删除登录源？"
              description="删除后会立即保存；已有账号不会被禁用，关联记录保留，但该入口不可再登录。"
              okButtonProps={{ danger: true, loading: saveMutation.isPending }}
              onConfirm={() => {
                const nextProviders = providers.filter((item) => item.id !== record.id)
                saveIdentity({
                  values: {
                    providers: nextProviders,
                    defaultProviderId:
                      settings?.defaultProviderId === record.id
                        ? nextProviders[0]?.id || ''
                        : settings?.defaultProviderId,
                  },
                  successMessage: '登录源已删除',
                })
              }}
            >
              <ManagementIconButton
                aria-label="删除登录源"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
                loading={saveMutation.isPending}
                size="small"
              />
            </Popconfirm>
            {settings?.defaultProviderId !== record.id ? (
              <ManagementIconButton
                aria-label="设为默认登录源"
                tooltip="设为默认"
                icon={<StarOutlined />}
                size="small"
                onClick={() =>
                  saveIdentity({
                    values: {
                      providers,
                      defaultProviderId: record.id,
                    },
                  })
                }
              />
            ) : null}
          </Space>
        ) : (
          '-'
        ),
    },
  ]
  const providerSteps: StepFormStep[] = [
    {
      title: '连接配置',
      fieldNames: [
        'name',
        'type',
        'iconUrl',
        'enabled',
        'issuer',
        'authorizeUrl',
        'tokenUrl',
        'userInfoUrl',
        'profileUrl',
        'metadataUrl',
        'entityId',
        'certificate',
        'clientId',
        'clientSecret',
        'redirectUrl',
        'frontendRedirectUrl',
      ],
      children: (
        <>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="企业统一登录 / 飞书 / 钉钉" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="type"
                label="类型"
                rules={[{ required: true, message: '请选择登录类型' }]}
              >
                <Select
                  options={LOGIN_PROVIDER_TYPE_OPTIONS}
                  onChange={(value) => {
                    const current = providerForm.getFieldsValue()
                    providerForm.setFieldsValue(
                      applyProviderPreset(String(value), {
                        ...current,
                        frontendRedirectUrl:
                          current.frontendRedirectUrl || defaultFrontendRedirectPath(),
                      }),
                    )
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="iconUrl" label="登录图标 URL">
            <Input placeholder="https://example.com/provider-icon.png" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.type !== next.type}>
            {({ getFieldValue }) => {
              const type = String(getFieldValue('type') || 'oidc')
              return (
                <>
                  {type === 'saml' ? (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title="SAML 当前为配置态"
                      description="本次改动已支持 SAML 配置保存和菜单/登录入口展示，但后端断言消费与 ACS 运行链路尚未启用。"
                    />
                  ) : null}
                  {type === 'oidc' ? (
                    <Form.Item
                      name="issuer"
                      label="Issuer URL"
                      rules={[{ required: true, message: '请输入 Issuer URL' }]}
                    >
                      <Input placeholder="https://accounts.example.com" />
                    </Form.Item>
                  ) : null}
                  {type !== 'saml' ? (
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="authorizeUrl" label="Authorize URL">
                          <Input placeholder="https://provider.example.com/oauth2/authorize" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="tokenUrl" label="Token URL">
                          <Input placeholder="https://provider.example.com/oauth2/token" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="userInfoUrl" label="UserInfo URL">
                          <Input placeholder="https://provider.example.com/userinfo" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="profileUrl" label="用户详情 URL（可选）">
                          <Input placeholder="企业微信等需要二次查询用户详情时填写" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ) : (
                    <>
                      <Form.Item name="metadataUrl" label="Metadata URL">
                        <Input placeholder="https://idp.example.com/metadata" />
                      </Form.Item>
                      <Form.Item name="entityId" label="Entity ID">
                        <Input placeholder="https://soha.example.com/saml/sp" />
                      </Form.Item>
                      <Form.Item name="certificate" label="证书">
                        <Input.TextArea rows={4} placeholder="粘贴 IdP 证书内容" />
                      </Form.Item>
                    </>
                  )}
                </>
              )
            }}
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="clientId" label="Client ID">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="clientSecret" label="Client Secret">
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="redirectUrl" label="回调地址">
            <Input />
          </Form.Item>
          <Form.Item name="frontendRedirectUrl" label="前端回跳地址">
            <Input />
          </Form.Item>
        </>
      ),
    },
    {
      title: '账号映射',
      children: (
        <>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="scopes" label="Scopes">
                <TagSelect mode="tags" placeholder="openid / profile / email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="defaultRoles" label="默认角色">
                <TagSelect mode="tags" options={roleOptions} placeholder="选择默认角色" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="syncRolesOnLogin" label="登录补充角色" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="syncOrgsOnLogin" label="登录补充组织" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            {syncRolesOnLogin ? (
              <>
                <Col xs={24} md={12}>
                  <Form.Item name="roleField" label="角色字段">
                    <Input placeholder="roles / role_ids / realm_access.roles" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="roleSyncMode" label="角色模式">
                    <Select options={LOGIN_SYNC_MODE_OPTIONS} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            {syncOrgsOnLogin ? (
              <>
                <Col xs={24} md={12}>
                  <Form.Item name="organizationField" label="组织字段">
                    <Input placeholder="groups / department_ids / department" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="orgSyncMode" label="组织模式">
                    <Select options={LOGIN_SYNC_MODE_OPTIONS} />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24} md={12}>
              <Form.Item name="userIdField" label="用户ID字段">
                <Input placeholder="sub / open_id / unionId / UserId" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="userNameField" label="显示名字段">
                <Input placeholder="name / nick / display_name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="emailField" label="邮箱字段">
                <Input placeholder="email / enterprise_email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phoneField" label="手机号字段">
                <Input placeholder="mobile / phone_number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="avatarField" label="头像字段">
                <Input placeholder="avatar_url / avatarUrl / picture" />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
  ]
  const content = (
    <div className="soha-settings-table-section">
      <SettingsAdminTable
        columnSettingPlacement="toolbar"
        toolbarExtra={
          <ManagementTableToolbar>
            <Space size={6}>
              <Switch
                size="small"
                checked={settings?.localPasswordLoginEnabled ?? true}
                aria-label="本地账号密码登录"
                disabled={!canManageLoginSettings || saveMutation.isPending}
                loading={saveMutation.isPending}
                onChange={(checked) =>
                  saveIdentity({
                    values: {
                      providers,
                      defaultProviderId: settings?.defaultProviderId,
                      localPasswordLoginEnabled: checked,
                    },
                    successMessage: checked ? '本地账号密码登录已开启' : '本地账号密码登录已关闭',
                  })
                }
              />
              <span>本地账号密码登录</span>
            </Space>
            {canManageLoginSettings ? (
              <Button
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={() => {
                  setEditingProvider(null)
                  setProviderStep(0)
                  setProviderModalVisible(true)
                }}
              >
                新增登录源
              </Button>
            ) : null}
            <ManagementDensityButton
              aria-label="切换表格密度"
              tooltip={tableSize === 'small' ? '切换为舒展密度' : '切换为紧凑密度'}
              onClick={() => setTableSize((current) => (current === 'small' ? 'middle' : 'small'))}
            />
            <ManagementRefreshButton
              aria-label="刷新登录源"
              loading={identityQuery.isFetching}
              tooltip="刷新"
              onClick={() => void identityQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        rowKey="id"
        tableSize={tableSize}
        paginationSummary={(total, range) => (
          <Text type="secondary">
            当前 {range[0]}-{range[1]} / {total} 条
          </Text>
        )}
        dataSource={providers}
        columns={providerColumns}
        empty={
          <ManagementState
            bordered={false}
            compact
            title="暂无登录源配置"
            description="新增登录源后，登录入口会按启用状态展示。"
          />
        }
      />
      <Modal
        title={editingProvider ? '编辑登录源' : '新增登录源'}
        open={providerModalVisible}
        width={760}
        onCancel={() => {
          setProviderModalVisible(false)
          setEditingProvider(null)
          setProviderStep(0)
        }}
        footer={null}
        destroyOnHidden
      >
        <StepForm
          key={editingProvider?.id || 'new-login-provider'}
          contentMaxWidth={680}
          current={providerStep}
          form={providerForm}
          initialValues={providerInitialValues}
          loading={saveMutation.isPending}
          onCancel={() => {
            setProviderModalVisible(false)
            setEditingProvider(null)
            setProviderStep(0)
          }}
          onCurrentChange={setProviderStep}
          onFinish={(values) => {
            if (!canManageLoginSettings) return
            const sourceType = String(values.type || 'oidc')
            const sourceID = String(values.id || editingProvider?.id || newLoginProviderID()).trim()
            const nextProvider = applyProviderPreset(sourceType, {
              ...values,
              id: sourceID,
              redirectUrl: String(values.redirectUrl || defaultRedirectPath(sourceID)),
              frontendRedirectUrl: String(
                values.frontendRedirectUrl || defaultFrontendRedirectPath(),
              ),
            })
            const nextProviders = [...providers]
            const index = nextProviders.findIndex((item) => item.id === nextProvider.id)
            if (index >= 0) {
              nextProviders[index] = nextProvider
            } else {
              nextProviders.push(nextProvider)
            }
            saveIdentity({
              values: {
                providers: nextProviders,
                defaultProviderId: settings?.defaultProviderId || nextProvider.id,
              },
              successMessage: editingProvider ? '登录源已保存' : '登录源已新增',
            })
            setProviderModalVisible(false)
            setEditingProvider(null)
            setProviderStep(0)
          }}
          steps={providerSteps}
        />
      </Modal>
    </div>
  )

  if (embedded) {
    return content
  }

  return <div className="soha-page">{content}</div>
}
