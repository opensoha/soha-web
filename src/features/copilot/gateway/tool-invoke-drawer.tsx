import { DeleteOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, App, Button, Descriptions, Drawer, Form, Input, Space, Typography } from 'antd'
import { ManagementIconButton } from '@/components/management-list'
import { SecretRefSelect } from '@/features/secrets'
import { invokeGatewayTool, type GatewayToolInvocationValues } from './mutations'
import { stringifyPayload, type GatewayTool } from './types'

const { Text } = Typography

export function GatewayToolInvokeDrawer({
  aiClientId,
  onClose,
  skillId,
  tool,
}: {
  aiClientId?: string
  onClose: () => void
  skillId?: string
  tool?: GatewayTool
}) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<GatewayToolInvocationValues>()
  const mutation = useMutation({
    mutationFn: (values: GatewayToolInvocationValues) =>
      invokeGatewayTool({ toolName: tool?.name ?? '', values, aiClientId, skillId }),
    onSuccess: (response) => message.success(response.data.result),
    onError: (error: Error) => message.error(error.message),
  })

  const close = () => {
    mutation.reset()
    form.resetFields()
    onClose()
  }

  const submit = async () => {
    let values: GatewayToolInvocationValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (
      tool?.requiresApproval ||
      tool?.riskLevel === 'mutate' ||
      tool?.riskLevel === 'execute' ||
      tool?.riskLevel === 'high'
    ) {
      modal.confirm({
        title: `提交 ${tool.name}？`,
        content: `Risk: ${tool.riskLevel}`,
        okText: '提交',
        onOk: () => mutation.mutateAsync(values),
      })
      return
    }
    mutation.mutate(values)
  }

  return (
    <Drawer
      destroyOnHidden
      size={640}
      open={Boolean(tool)}
      title={tool?.name}
      onClose={close}
      extra={
        <Space>
          <Button onClick={close}>取消</Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={mutation.isPending}
            onClick={() => void submit()}
          >
            调用
          </Button>
        </Space>
      }
    >
      {tool ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            bordered
            column={3}
            items={[
              { key: 'risk', label: 'Risk', children: tool.riskLevel },
              {
                key: 'approval',
                label: 'Approval',
                children: tool.requiresApproval ? 'required' : 'policy',
              },
              { key: 'scopes', label: 'Scopes', children: tool.requiredScopes?.join(', ') || '-' },
            ]}
          />
          <Form
            form={form}
            layout="vertical"
            preserve={false}
            initialValues={{ inputJson: '{}', secretRefs: [] }}
          >
            <Form.Item label="Input JSON" name="inputJson" rules={[{ required: true }]}>
              <Input.TextArea autoSize={{ minRows: 8, maxRows: 16 }} spellCheck={false} />
            </Form.Item>
            <Form.List name="secretRefs">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" style={{ width: '100%' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'alias']}
                        rules={[
                          { required: true },
                          { pattern: /^[A-Z_][A-Z0-9_]*$/, message: '使用大写 alias' },
                        ]}
                      >
                        <Input placeholder="ALIAS" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'ref']}
                        rules={[{ required: true }]}
                        style={{ flex: 1 }}
                      >
                        <SecretRefSelect enabled={Boolean(tool)} />
                      </Form.Item>
                      <ManagementIconButton
                        danger
                        aria-label="删除 Secret reference"
                        tooltip="删除"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                    添加 Secret reference
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form>
          {tool.inputSchema ? (
            <details>
              <summary>Input schema</summary>
              <pre className="soha-system-json-block">{stringifyPayload(tool.inputSchema)}</pre>
            </details>
          ) : null}
          {mutation.data ? (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Alert type="success" showIcon title={mutation.data.data.result} />
              <Text code>{mutation.data.data.toolName}</Text>
              <pre className="soha-system-json-block">{stringifyPayload(mutation.data.data)}</pre>
            </Space>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  )
}
