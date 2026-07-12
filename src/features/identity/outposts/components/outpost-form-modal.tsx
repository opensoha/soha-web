import { useEffect } from 'react'
import { App, Form, Input, Modal, Select, Space } from 'antd'
import { identityOutpostModeOptions, identityOutpostStatusOptions } from '../options'
import type {
  IdentityOutpost,
  IdentityOutpostInput,
  IdentityOutpostMode,
  IdentityOutpostStatus,
} from '../types'

export interface IdentityOutpostFormValues {
  endpoint?: string
  metadataJson?: string
  mode: IdentityOutpostMode
  name: string
  status: IdentityOutpostStatus
  version?: string
}

interface IdentityOutpostFormModalProps {
  editing: IdentityOutpost | null
  onCancel: () => void
  onSubmit: (input: IdentityOutpostInput) => void
  open: boolean
  submitting: boolean
}

function parseMetadata(value?: string) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return {}
  const parsed: unknown = JSON.parse(trimmed)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('metadata must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

function formValues(outpost?: IdentityOutpost | null): IdentityOutpostFormValues {
  return {
    endpoint: outpost?.endpoint ?? '',
    metadataJson: JSON.stringify(outpost?.metadata ?? {}, null, 2),
    mode: outpost?.mode ?? 'embedded',
    name: outpost?.name ?? '',
    status: outpost?.status ?? 'offline',
    version: outpost?.version ?? '',
  }
}

export function buildIdentityOutpostInput(values: IdentityOutpostFormValues): IdentityOutpostInput {
  return {
    endpoint: values.endpoint?.trim(),
    metadata: parseMetadata(values.metadataJson),
    mode: values.mode,
    name: values.name.trim(),
    status: values.status,
    version: values.version?.trim(),
  }
}

export function IdentityOutpostFormModal({
  editing,
  onCancel,
  onSubmit,
  open,
  submitting,
}: IdentityOutpostFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<IdentityOutpostFormValues>()

  useEffect(() => {
    if (open) form.setFieldsValue(formValues(editing))
  }, [editing, form, open])

  const submit = async () => {
    const values = await form.validateFields()
    try {
      onSubmit(buildIdentityOutpostInput(values))
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'metadata JSON 无效')
    }
  }

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnHidden
      okText={editing ? '保存' : '创建'}
      onCancel={onCancel}
      onOk={() => void submit()}
      open={open}
      title={editing ? `编辑 ${editing.name}` : '新建 Outpost'}
      width={720}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: '请输入 Outpost 名称' }]}
        >
          <Input placeholder="edge-grafana" />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="mode" label="Mode" style={{ width: '50%' }} rules={[{ required: true }]}>
            <Select options={identityOutpostModeOptions} />
          </Form.Item>
          <Form.Item
            name="status"
            label="Status"
            style={{ width: '50%' }}
            rules={[{ required: true }]}
          >
            <Select options={identityOutpostStatusOptions} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="endpoint" label="Endpoint">
          <Input placeholder="https://outpost.example.com" />
        </Form.Item>
        <Form.Item name="version" label="Version">
          <Input placeholder="0.1.0" />
        </Form.Item>
        <Form.Item name="metadataJson" label="Metadata JSON">
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} spellCheck={false} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
