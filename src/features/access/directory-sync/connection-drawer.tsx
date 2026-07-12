import { Alert, Form, Input, Modal, Select, Switch } from 'antd'
import type { LoginProviderSettings } from '@/features/settings'
import type { DirectoryConnection, DirectoryConnectionInput } from './types'
import { DirectoryPolicyForm } from './policy-form'

const defaults: DirectoryConnectionInput = {
  name: '',
  providerType: 'feishu',
  enabled: true,
  policy: {
    syncOrganizations: true,
    syncPeople: false,
    mode: 'manual',
    provisionMode: 'review_before_link',
  },
}

export function DirectoryConnectionModal({
  canManagePeople,
  confirm,
  connection,
  loading,
  loginProviders,
  loginProvidersLoading,
  onCancel,
  onSubmit,
  open,
}: {
  canManagePeople: boolean
  confirm: (onConfirmed: () => void) => void
  connection: DirectoryConnection | null
  loading: boolean
  loginProviders: LoginProviderSettings[]
  loginProvidersLoading: boolean
  onCancel: () => void
  onSubmit: (input: DirectoryConnectionInput) => void
  open: boolean
}) {
  const [form] = Form.useForm<DirectoryConnectionInput>()
  const providerType = Form.useWatch('providerType', form)
  const loginProviderId = Form.useWatch('loginProviderId', form)
  const mode = Form.useWatch(['policy', 'mode'], form)
  const loginProviderOptions = loginProviders
    .filter((provider) => provider.enabled && provider.type === providerType)
    .map((provider) => ({
      label: `${provider.name || provider.id} (${provider.id})`,
      value: provider.id,
    }))
  const loginProviderInvalid =
    !loginProvidersLoading &&
    Boolean(loginProviderId) &&
    !loginProviderOptions.some((option) => option.value === loginProviderId)
  const initialValues: DirectoryConnectionInput = connection
    ? {
        name: connection.name,
        providerType: connection.providerType,
        loginProviderId: connection.loginProviderId,
        credentialRef: connection.credentialRef,
        enabled: connection.enabled,
        policy: connection.policy,
        metadata: connection.metadata as DirectoryConnectionInput['metadata'],
      }
    : defaults

  return (
    <Modal
      title={connection ? `编辑目录连接: ${connection.name}` : '新增目录连接'}
      open={open}
      width={720}
      confirmLoading={loading}
      destroyOnHidden
      mask={{ closable: false }}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => void form.validateFields().then(onSubmit)}
    >
      <Form
        form={form}
        key={connection?.id ?? 'new-directory-connection'}
        layout="vertical"
        initialValues={initialValues}
      >
        <Form.Item
          name="name"
          label="连接名称"
          rules={[{ required: true, message: '请输入连接名称' }]}
        >
          <Input placeholder="例如：飞书通讯录" />
        </Form.Item>
        <Form.Item name="providerType" label="目录类型">
          <Select
            onChange={() => form.setFieldValue('loginProviderId', undefined)}
            options={[
              { value: 'feishu', label: '飞书' },
              { value: 'wecom', label: '企业微信' },
              { value: 'dingtalk', label: '钉钉' },
              { value: 'ldap', label: 'LDAP' },
              { value: 'scim', label: 'SCIM' },
              { value: 'custom', label: '自定义' },
            ]}
          />
        </Form.Item>
        {['feishu', 'wecom', 'dingtalk'].includes(providerType ?? '') ? (
          <Form.Item
            name="loginProviderId"
            label="登录源"
            extra="选择登录设置中的登录源，复用应用凭据且不复制 Client Secret。"
            validateStatus={loginProviderInvalid ? 'error' : undefined}
            help={
              loginProviderInvalid
                ? '当前登录源不存在、已禁用或类型不匹配，请重新选择'
                : undefined
            }
            rules={[
              { required: true, message: '请选择登录源' },
              {
                validator: async (_rule, value?: string) => {
                  if (!value || loginProviderOptions.some((option) => option.value === value)) {
                    return
                  }
                  throw new Error('当前登录源不存在、已禁用或类型不匹配，请重新选择')
                },
              },
            ]}
          >
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              loading={loginProvidersLoading}
              options={loginProviderOptions}
              placeholder={`请选择${providerType === 'feishu' ? '飞书' : providerType === 'wecom' ? '企业微信' : '钉钉'}登录源`}
              notFoundContent={
                loginProvidersLoading ? '正在加载登录源...' : '没有可用的同类型登录源'
              }
            />
          </Form.Item>
        ) : (
          <Form.Item name="credentialRef" label="凭据引用">
            <Input placeholder="SecretRef" />
          </Form.Item>
        )}
        <Form.Item name="enabled" label="启用连接" valuePropName="checked">
          <Switch />
        </Form.Item>
        <DirectoryPolicyForm
          canManagePeople={canManagePeople}
          form={form}
          onRequestEnablePeople={() =>
            confirm(() => form.setFieldValue(['policy', 'syncPeople'], true))
          }
        />
        {['feishu', 'wecom', 'dingtalk'].includes(providerType ?? '') &&
        mode === 'scheduled_and_realtime' ? (
          <>
            <Alert
              showIcon
              type="info"
              title="目录事件回调"
              description="凭据加密保存且不会回显；编辑时留空将保留现有配置。"
            />
            <Form.Item
              name="webhookVerificationToken"
              label="Verification Token"
              rules={connection ? [] : [{ required: true, message: '请输入 Verification Token' }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="webhookEncryptKey" label="Encrypt Key">
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </>
        ) : null}
        {providerType === 'scim' ? (
          <>
            <Alert
              showIcon
              type="info"
              title="SCIM 入站凭据"
              description="Bearer Token 仅保存哈希且不会回显；编辑时留空将保留现有 Token。"
            />
            <Form.Item
              name="scimBearerToken"
              label="Bearer Token"
              rules={connection ? [] : [{ required: true, message: '请输入 Bearer Token' }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </>
        ) : null}
        {providerType === 'ldap' ? (
          <>
            <Alert
              showIcon
              type="info"
              title="LDAP 连接"
              description="Bind 密码加密保存且不会回显；编辑时留空将保留现有密码。"
            />
            <Form.Item
              name={['metadata', 'endpoint']}
              label="LDAP Endpoint"
              rules={[{ required: true, message: '请输入 LDAP Endpoint' }]}
            >
              <Input placeholder="ldaps://ldap.example.com:636" />
            </Form.Item>
            <Form.Item
              name={['metadata', 'baseDN']}
              label="Base DN"
              rules={[{ required: true, message: '请输入 Base DN' }]}
            >
              <Input placeholder="dc=example,dc=com" />
            </Form.Item>
            <Form.Item name="ldapBindDn" label="Bind DN">
              <Input placeholder="cn=service,ou=system,dc=example,dc=com" />
            </Form.Item>
            <Form.Item
              name="ldapBindPassword"
              label="Bind Password"
              rules={connection ? [] : [{ required: true, message: '请输入 Bind Password' }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item name={['metadata', 'startTLS']} label="StartTLS" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        ) : null}
        {connection?.policy.syncPeople && !canManagePeople ? (
          <Alert
            showIcon
            type="info"
            title="人员同步策略保持不变"
            description="当前账号不能修改人员同步策略。"
          />
        ) : null}
      </Form>
    </Modal>
  )
}
