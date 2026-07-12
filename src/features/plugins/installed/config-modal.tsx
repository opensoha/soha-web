import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Card, Form, Input, Modal, Space, Typography } from 'antd'
import type { InstalledPlugin, PluginConfigRequest } from '../plugin-model'
import { requiredSecretValues } from '../plugin-model'
import {
  isPluginSchemaObject,
  pluginSchemaFieldControl,
  pluginSchemaFieldLabel,
  pluginSchemaProperties,
  pluginSchemaRequired,
  renderPluginSchemaInput,
} from '../shared/schema'
import './styles.css'

const { Text } = Typography

function parseJSONObject(input: string, label: string) {
  const trimmed = input.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object`)
  }
  return parsed as Record<string, unknown>
}

export function PluginConfigModal({
  canEditSecrets,
  onCancel,
  onSubmit,
  open,
  plugin,
}: {
  canEditSecrets: boolean
  onCancel: () => void
  onSubmit: (input: PluginConfigRequest) => Promise<unknown>
  open: boolean
  plugin?: InstalledPlugin
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Record<string, unknown>>()
  const [secretRefsText, setSecretRefsText] = useState('')
  const [metadataText, setMetadataText] = useState('')
  const schemaFields = useMemo(
    () => pluginSchemaProperties(plugin?.manifest.configSchema),
    [plugin?.manifest.configSchema],
  )
  const requiredFields = useMemo(
    () => pluginSchemaRequired(plugin?.manifest.configSchema),
    [plugin?.manifest.configSchema],
  )
  const requiredSecrets = useMemo(
    () => requiredSecretValues(plugin?.manifest.secrets),
    [plugin?.manifest.secrets],
  )
  const schemaFieldNames = useMemo(
    () => new Set(schemaFields.map((field) => field.name)),
    [schemaFields],
  )

  useEffect(() => {
    if (!open || !plugin) return
    const metadata = plugin.metadata && typeof plugin.metadata === 'object' ? plugin.metadata : {}
    const config = isPluginSchemaObject(metadata.config) ? metadata.config : {}
    const secretRefs = plugin.configuredSecretRefs ?? {}
    const values: Record<string, unknown> = {}
    schemaFields.forEach(({ name, schema }) => {
      values[name] =
        pluginSchemaFieldControl(schema) === 'secret-ref' ? secretRefs[name] : config[name]
    })
    requiredSecrets.forEach((secret) => {
      if (!schemaFieldNames.has(secret.name)) {
        values[`secret:${secret.name}`] = secretRefs[secret.name] ?? secret.secretRef
      }
    })
    form.setFieldsValue(values)
    setSecretRefsText(JSON.stringify(secretRefs, null, 2))
    setMetadataText(JSON.stringify(metadata, null, 2))
  }, [form, open, plugin, requiredSecrets, schemaFieldNames, schemaFields])

  return (
    <Modal
      open={open}
      title="配置插件"
      width={860}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={async () => {
        try {
          const formValues = await form.validateFields()
          const secretRefs = parseJSONObject(secretRefsText, 'Secret refs')
          const metadata = parseJSONObject(metadataText, 'Metadata')
          const config = isPluginSchemaObject(metadata.config) ? { ...metadata.config } : {}
          schemaFields.forEach(({ name, schema }) => {
            const value = formValues[name]
            if (value === undefined || value === '') return
            if (pluginSchemaFieldControl(schema) === 'secret-ref') {
              secretRefs[name] = String(value)
              return
            }
            config[name] = value
          })
          requiredSecrets.forEach((secret) => {
            if (schemaFieldNames.has(secret.name)) return
            const value = formValues[`secret:${secret.name}`]
            if (value !== undefined && value !== '') secretRefs[secret.name] = String(value)
          })
          if (Object.keys(config).length) metadata.config = config
          await onSubmit({
            secretRefs: canEditSecrets
              ? Object.fromEntries(
                  Object.entries(secretRefs).map(([key, value]) => [key, String(value)]),
                )
              : undefined,
            metadata,
          })
          onCancel()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '配置解析失败')
        }
      }}
    >
      <Space orientation="vertical" size={12} className="soha-plugin-config-modal">
        <Alert
          showIcon
          type="info"
          title="这里只保存 secret 引用和插件配置元数据；secret 内容仍由外部 secret 管理。"
        />
        {schemaFields.length || requiredSecrets.length ? (
          <Card size="small" title="Schema 配置">
            <Form form={form} layout="vertical">
              {schemaFields.map(({ name, schema }) => {
                const isBoolean = schema.type === 'boolean'
                const isSecretRef = pluginSchemaFieldControl(schema) === 'secret-ref'
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={pluginSchemaFieldLabel(name, schema)}
                    extra={typeof schema.description === 'string' ? schema.description : undefined}
                    valuePropName={isBoolean ? 'checked' : 'value'}
                    rules={
                      requiredFields.has(name)
                        ? [
                            {
                              required: true,
                              message: `请填写 ${pluginSchemaFieldLabel(name, schema)}`,
                            },
                          ]
                        : undefined
                    }
                  >
                    {isSecretRef ? (
                      <Input.Password disabled={!canEditSecrets} placeholder="secret://..." />
                    ) : (
                      renderPluginSchemaInput(schema)
                    )}
                  </Form.Item>
                )
              })}
              {requiredSecrets
                .filter((secret) => !schemaFieldNames.has(secret.name))
                .map((secret) => (
                  <Form.Item
                    key={secret.name}
                    name={`secret:${secret.name}`}
                    label={secret.name}
                    extra={secret.description}
                    rules={
                      secret.required === false
                        ? undefined
                        : [{ required: true, message: `请填写 ${secret.name} secret ref` }]
                    }
                  >
                    <Input.Password disabled={!canEditSecrets} placeholder="secret://..." />
                  </Form.Item>
                ))}
            </Form>
          </Card>
        ) : null}
        <div>
          <Text strong>Secret refs</Text>
          <Input.TextArea
            disabled={!canEditSecrets}
            rows={6}
            value={secretRefsText}
            onChange={(event) => setSecretRefsText(event.target.value)}
          />
          {!canEditSecrets ? (
            <Text type="secondary">当前账号没有 plugin.configure_secrets 权限。</Text>
          ) : null}
        </div>
        <div>
          <Text strong>Metadata</Text>
          <Input.TextArea
            rows={6}
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
          />
        </div>
      </Space>
    </Modal>
  )
}
