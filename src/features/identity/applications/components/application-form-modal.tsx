import { useEffect } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd'
import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import type { IdentityApplication, IdentityApplicationInput } from '../../shared/types'
import {
  buildIdentityApplicationInput,
  defaultIdentityApplicationFormValues,
  identityApplicationAssignmentSubjectOptions,
  identityApplicationFormValuesFor,
  identityApplicationOIDCScopeOptions,
  identityApplicationProviderTypeOptions,
  identityApplicationStatusOptions,
  type IdentityApplicationFormValues,
} from '../application-form-model'

const { Text } = Typography

interface ApplicationFormModalProps {
  application: IdentityApplication | null
  open: boolean
  saving: boolean
  onCancel: () => void
  onSubmit: (input: IdentityApplicationInput) => void
}

export function ApplicationFormModal({
  application,
  open,
  saving,
  onCancel,
  onSubmit,
}: ApplicationFormModalProps) {
  const [form] = Form.useForm<IdentityApplicationFormValues>()
  const providerType = Form.useWatch('providerType', form) ?? 'link'

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(
      application
        ? identityApplicationFormValuesFor(application)
        : defaultIdentityApplicationFormValues(),
    )
  }, [application, form, open])

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title={application ? '编辑应用' : '新建应用'}
      width={900}
      onCancel={onCancel}
    >
      <Form
        form={form}
        className="soha-identity-app-form"
        initialValues={defaultIdentityApplicationFormValues()}
        layout="vertical"
        onFinish={(values) => onSubmit(buildIdentityApplicationInput(values, application))}
      >
        <div className="soha-identity-form-grid">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="Grafana" />
          </Form.Item>
          <Form.Item label="Slug" name="slug">
            <Input placeholder="grafana" />
          </Form.Item>
          <Form.Item label="Provider type" name="providerType">
            <Select options={identityApplicationProviderTypeOptions} />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select options={identityApplicationStatusOptions} />
          </Form.Item>
          <Form.Item label="Category" name="category">
            <Input placeholder="Observability" />
          </Form.Item>
          <Form.Item label="Sort order" name="sortOrder">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item label="Description" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <div className="soha-identity-form-grid">
          <Form.Item label="Launch URL" name="launchUrl">
            <Input prefix={<LinkOutlined />} placeholder="https://grafana.example.com" />
          </Form.Item>
          <Form.Item label="Provider ID" name="providerId">
            <Input disabled={!application} placeholder="reserved for OIDC / Proxy phases" />
          </Form.Item>
        </div>

        {providerType === 'oidc' ? (
          <div className="soha-identity-oidc-launch-editor">
            <Text strong>OIDC launch</Text>
            <div className="soha-identity-form-grid">
              <Form.Item label="Client ID override" name="oidcClientId">
                <Input placeholder="client-id" />
              </Form.Item>
              <Form.Item label="Redirect URI override" name="oidcRedirectUri">
                <Input placeholder="https://app.example.com/callback" />
              </Form.Item>
            </div>
            <Form.Item label="Scopes" name="oidcScopes">
              <Select
                mode="tags"
                options={identityApplicationOIDCScopeOptions}
                tokenSeparators={[',', ' ']}
              />
            </Form.Item>
          </div>
        ) : null}

        <div className="soha-identity-form-grid">
          <Form.Item label="Icon URL" name="iconUrl">
            <Input placeholder="https://example.com/icon.png" />
          </Form.Item>
          <Form.Item label="Tags" name="tags">
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        </div>

        <div className="soha-identity-switch-row">
          <Form.Item label="Portal visible" name="portalVisible" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Featured" name="featured" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>

        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <div className="soha-identity-assignment-editor">
              <div className="soha-identity-assignment-header">
                <Text strong>Assignments</Text>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => add({ effect: 'allow', subjectId: '', subjectType: 'role' })}
                >
                  添加
                </Button>
              </div>
              {fields.length ? (
                fields.map((field) => (
                  <div className="soha-identity-assignment-row" key={field.key}>
                    <Form.Item name={[field.name, 'subjectType']} rules={[{ required: true }]}>
                      <Select options={identityApplicationAssignmentSubjectOptions} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'subjectId']}
                      rules={[{ required: true, message: '请输入 subject id' }]}
                    >
                      <Input placeholder="admin / team-a / user-id" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'effect']}>
                      <Select disabled options={[{ label: 'Allow', value: 'allow' }]} />
                    </Form.Item>
                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </div>
                ))
              ) : (
                <Text type="secondary">未配置 assignment 时，所有已登录用户可访问该应用。</Text>
              )}
            </div>
          )}
        </Form.List>

        <div className="soha-identity-form-actions">
          <Button onClick={onCancel}>取消</Button>
          <Button htmlType="submit" loading={saving} type="primary">
            保存
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
