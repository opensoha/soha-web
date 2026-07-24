import { useEffect } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Switch } from 'antd'
import {
  defaultOIDCClientValues,
  oidcClientInputFromValues,
  oidcClientStatusOptions,
  oidcClientValuesFor,
  oidcGrantTypeOptions,
  type OIDCClientFormValues,
} from '../provider-form-model'
import type { IdentityOIDCClient, IdentityOIDCClientInput } from '../types'

interface OIDCClientFormModalProps {
  editing: IdentityOIDCClient | null
  onCancel: () => void
  onSubmit: (input: IdentityOIDCClientInput) => void
  open: boolean
  providerId: string
  submitting: boolean
}

export function OIDCClientFormModal({
  editing,
  onCancel,
  onSubmit,
  open,
  providerId,
  submitting,
}: OIDCClientFormModalProps) {
  const [form] = Form.useForm<OIDCClientFormValues>()

  useEffect(() => {
    if (open)
      form.setFieldsValue(editing ? oidcClientValuesFor(editing) : defaultOIDCClientValues())
  }, [editing, form, open])

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onCancel}
      open={open}
      title={editing ? '编辑 OIDC client' : '新建 OIDC client'}
      width={840}
    >
      <Form
        form={form}
        className="soha-identity-provider-form"
        initialValues={defaultOIDCClientValues()}
        layout="vertical"
        onFinish={(values) => onSubmit(oidcClientInputFromValues(providerId, values))}
      >
        <div className="soha-identity-provider-form-grid">
          <Form.Item
            label="Client ID"
            name="clientId"
            rules={[{ required: true, message: '请输入 Client ID' }]}
          >
            <Input placeholder="grafana" />
          </Form.Item>
          <Form.Item label="Client Secret" name="clientSecret">
            <Input.Password placeholder={editing ? '留空表示不轮换' : '留空自动生成'} />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select options={oidcClientStatusOptions} />
          </Form.Item>
          <Form.Item label="Require PKCE" name="requirePkce" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>

        <Form.Item
          label="Redirect URIs"
          name="redirectUris"
          rules={[{ required: true, message: '至少配置一个 Redirect URI' }]}
        >
          <Select
            mode="tags"
            placeholder="https://grafana.example.com/login/generic_oauth"
            tokenSeparators={[',']}
          />
        </Form.Item>

        <div className="soha-identity-provider-form-grid">
          <Form.Item label="Allowed scopes" name="allowedScopes">
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
          <Form.Item
            extra="启用 refresh_token 后，授权请求还需包含 offline_access 才会签发刷新令牌。"
            label="Allowed grant types"
            name="allowedGrantTypes"
          >
            <Select mode="multiple" options={oidcGrantTypeOptions} />
          </Form.Item>
        </div>

        <div className="soha-identity-provider-form-grid is-three">
          <Form.Item label="Access token TTL" name="accessTokenTtlSeconds">
            <InputNumber min={60} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="ID token TTL" name="idTokenTtlSeconds">
            <InputNumber min={60} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            extra="留空或填 0 使用服务端默认绝对过期时间。"
            label="Refresh token TTL"
            name="refreshTokenTtlSeconds"
          >
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className="soha-identity-provider-form-actions">
          <Button onClick={onCancel}>取消</Button>
          <Button htmlType="submit" loading={submitting} type="primary">
            保存
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
