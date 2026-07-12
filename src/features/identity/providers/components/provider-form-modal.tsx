import { useEffect } from 'react'
import { App, Button, Form, Input, Modal, Select, Switch } from 'antd'
import {
  defaultProviderValues,
  defaultProxyHeaders,
  providerInputFromValues,
  providerStatusOptions,
  providerTypeOptions,
  providerValuesFor,
  proxyModeOptions,
  type ProviderFormValues,
} from '../provider-form-model'
import type { IdentityProvider, IdentityProviderInput, IdentityRuntimeProviderType } from '../types'

interface ProviderFormModalProps {
  applicationOptions: Array<{ label: string; value: string }>
  applicationsLoading: boolean
  editing: IdentityProvider | null
  onCancel: () => void
  onProviderTypeChange: (providerType: IdentityRuntimeProviderType) => void
  onSubmit: (input: IdentityProviderInput) => void
  open: boolean
  outpostLoading: boolean
  outpostOptions: Array<{ label: string; value: string }>
  providerType: IdentityRuntimeProviderType
  submitting: boolean
}

function ProxyConfigFields({
  outpostLoading,
  outpostOptions,
}: Pick<ProviderFormModalProps, 'outpostLoading' | 'outpostOptions'>) {
  return (
    <div className="soha-identity-provider-config-section">
      <div className="soha-identity-provider-section-title">Proxy runtime</div>
      <div className="soha-identity-provider-form-grid">
        <Form.Item
          label="External hosts"
          name="proxyExternalHosts"
          rules={[{ required: true, message: '至少配置一个 External host' }]}
        >
          <Select mode="tags" placeholder="grafana.example.com" tokenSeparators={[',']} />
        </Form.Item>
        <Form.Item label="Upstream URL" name="proxyUpstreamUrl">
          <Input placeholder="http://grafana.monitoring.svc:3000" />
        </Form.Item>
        <Form.Item label="Mode" name="proxyMode">
          <Select options={proxyModeOptions} />
        </Form.Item>
        <Form.Item label="Cookie domain" name="proxyCookieDomain">
          <Input placeholder=".example.com" />
        </Form.Item>
        <Form.Item label="Protected path prefix" name="proxyPathPrefix">
          <Input placeholder="/" />
        </Form.Item>
        <Form.Item label="Outpost" name="proxyOutpostId">
          <Select
            allowClear
            loading={outpostLoading}
            options={outpostOptions}
            placeholder="Embedded forward-auth"
            showSearch={{ optionFilterProp: 'label' }}
          />
        </Form.Item>
      </div>

      <Form.Item label="Skip auth paths" name="proxySkipAuthPaths">
        <Select mode="tags" placeholder="/healthz, /public" tokenSeparators={[',']} />
      </Form.Item>

      <Form.Item label="WebSocket enabled" name="proxyWebsocketEnabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <div className="soha-identity-provider-section-title">Identity headers</div>
      <div className="soha-identity-provider-form-grid is-three">
        <Form.Item label="User header" name="proxyHeaderUser">
          <Input placeholder={defaultProxyHeaders.user} />
        </Form.Item>
        <Form.Item label="User ID header" name="proxyHeaderUserId">
          <Input placeholder={defaultProxyHeaders.userId} />
        </Form.Item>
        <Form.Item label="Email header" name="proxyHeaderEmail">
          <Input placeholder={defaultProxyHeaders.email} />
        </Form.Item>
        <Form.Item label="Roles header" name="proxyHeaderRoles">
          <Input placeholder={defaultProxyHeaders.roles} />
        </Form.Item>
        <Form.Item label="Teams header" name="proxyHeaderTeams">
          <Input placeholder={defaultProxyHeaders.teams} />
        </Form.Item>
        <Form.Item label="Groups header" name="proxyHeaderGroups">
          <Input placeholder={defaultProxyHeaders.groups} />
        </Form.Item>
      </div>
    </div>
  )
}

export function ProviderFormModal({
  applicationOptions,
  applicationsLoading,
  editing,
  onCancel,
  onProviderTypeChange,
  onSubmit,
  open,
  outpostLoading,
  outpostOptions,
  providerType,
  submitting,
}: ProviderFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ProviderFormValues>()

  useEffect(() => {
    if (open) form.setFieldsValue(editing ? providerValuesFor(editing) : defaultProviderValues())
  }, [editing, form, open])

  const submit = (values: ProviderFormValues) => {
    try {
      onSubmit(providerInputFromValues(values))
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onCancel}
      open={open}
      title={editing ? '编辑 Provider' : '新建 Provider'}
      width={860}
    >
      <Form
        form={form}
        className="soha-identity-provider-form"
        initialValues={defaultProviderValues()}
        layout="vertical"
        onFinish={submit}
        onValuesChange={(changedValues: Partial<ProviderFormValues>) => {
          if (changedValues.type) onProviderTypeChange(changedValues.type)
        }}
      >
        <div className="soha-identity-provider-form-grid">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入 Provider 名称' }]}
          >
            <Input placeholder="Grafana OIDC" />
          </Form.Item>
          <Form.Item
            label="Application"
            name="applicationId"
            rules={[{ required: true, message: '请选择应用' }]}
          >
            <Select
              loading={applicationsLoading}
              options={applicationOptions}
              placeholder="选择下游应用"
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
          <Form.Item label="Type" name="type">
            <Select options={providerTypeOptions} />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select options={providerStatusOptions} />
          </Form.Item>
        </div>

        <Form.Item label="Enabled" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>

        {providerType === 'proxy' ? (
          <ProxyConfigFields outpostLoading={outpostLoading} outpostOptions={outpostOptions} />
        ) : null}

        <div className="soha-identity-provider-json-grid">
          <Form.Item
            label={providerType === 'proxy' ? 'Advanced config JSON' : 'Config JSON'}
            name="configJson"
          >
            <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
          </Form.Item>
          <Form.Item label="Secret refs JSON" name="secretRefsJson">
            <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
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
