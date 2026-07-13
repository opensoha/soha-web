import { useEffect } from 'react'
import { AutoComplete, Button, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { accessQueries } from '@/features/access'
import { useI18n } from '@/i18n'
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

interface AssignmentSubjectSelectProps {
  fieldName: number
  form: FormInstance<IdentityApplicationFormValues>
  options: Record<string, Array<{ label: string; value: string }>>
  placeholder: string
}

function AssignmentSubjectSelect({
  fieldName,
  form,
  options,
  placeholder,
}: AssignmentSubjectSelectProps) {
  const subjectType = Form.useWatch(['assignments', fieldName, 'subjectType'], form) ?? 'role'
  return (
    <AutoComplete
      options={options[subjectType] ?? []}
      placeholder={placeholder}
      showSearch={{ filterOption: true }}
    />
  )
}

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
  const { t } = useI18n()
  const providerType = Form.useWatch('providerType', form) ?? 'link'
  const usersQuery = useQuery({ ...accessQueries.users(), enabled: open, retry: false })
  const rolesQuery = useQuery({ ...accessQueries.roles(), enabled: open, retry: false })
  const teamsQuery = useQuery({ ...accessQueries.teams(), enabled: open, retry: false })
  const subjectOptions = {
    user: (usersQuery.data ?? []).map((user) => ({
      label: `${user.displayName || user.username} (${user.email || user.username})`,
      value: user.id,
    })),
    role: (rolesQuery.data ?? []).map((role) => ({ label: role.name, value: role.id })),
    team: (teamsQuery.data ?? []).map((team) => ({
      label: team.path || `${team.name} (${team.slug})`,
      value: team.id,
    })),
    tag: [],
  }

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
      title={application ? t('identity.applications.edit', '编辑应用') : t('identity.applications.create', '新建应用')}
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
            label={t('identity.applications.name', '名称')}
            name="name"
            rules={[{ required: true, message: t('identity.applications.nameRequired', '请输入应用名称') }]}
          >
            <Input placeholder="Grafana" />
          </Form.Item>
          <Form.Item label="Slug" name="slug">
            <Input placeholder="grafana" />
          </Form.Item>
          <Form.Item label={t('identity.applications.providerType', 'Provider 类型')} name="providerType">
            <Select options={identityApplicationProviderTypeOptions} />
          </Form.Item>
          <Form.Item label={t('identity.applications.status', '状态')} name="status">
            <Select options={identityApplicationStatusOptions} />
          </Form.Item>
          <Form.Item label={t('identity.applications.category', '分类')} name="category">
            <Input placeholder="Observability" />
          </Form.Item>
          <Form.Item label={t('identity.applications.sortOrder', '排序')} name="sortOrder">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item label={t('identity.applications.descriptionField', '描述')} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <div className="soha-identity-form-grid">
          <Form.Item label={t('identity.applications.launchUrl', '访问地址')} name="launchUrl">
            <Input prefix={<LinkOutlined />} placeholder="https://grafana.example.com" />
          </Form.Item>
          <Form.Item label={t('identity.applications.providerId', 'Provider ID')} name="providerId">
            <Input disabled={!application} placeholder="reserved for OIDC / Proxy phases" />
          </Form.Item>
        </div>

        {providerType === 'oidc' ? (
          <div className="soha-identity-oidc-launch-editor">
            <Text strong>{t('identity.applications.oidcLaunch', 'OIDC 启动配置')}</Text>
            <div className="soha-identity-form-grid">
              <Form.Item label={t('identity.applications.clientIdOverride', '覆盖 Client ID')} name="oidcClientId">
                <Input placeholder="client-id" />
              </Form.Item>
              <Form.Item label={t('identity.applications.redirectOverride', '覆盖 Redirect URI')} name="oidcRedirectUri">
                <Input placeholder="https://app.example.com/callback" />
              </Form.Item>
            </div>
            <Form.Item label={t('identity.applications.scopes', 'Scopes')} name="oidcScopes">
              <Select
                mode="tags"
                options={identityApplicationOIDCScopeOptions}
                tokenSeparators={[',', ' ']}
              />
            </Form.Item>
          </div>
        ) : null}

        <div className="soha-identity-form-grid">
          <Form.Item label={t('identity.applications.iconUrl', '图标地址')} name="iconUrl">
            <Input placeholder="https://example.com/icon.png" />
          </Form.Item>
          <Form.Item label={t('identity.applications.tags', '标签')} name="tags">
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        </div>

        <div className="soha-identity-switch-row">
          <Form.Item label={t('identity.applications.portalVisible', '门户可见')} name="portalVisible" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('identity.applications.featured', '推荐应用')} name="featured" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>

        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <div className="soha-identity-assignment-editor">
              <div className="soha-identity-assignment-header">
                <Text strong>{t('identity.applications.assignments', '访问授权')}</Text>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => add({ effect: 'allow', subjectId: '', subjectType: 'role' })}
                >
                  {t('common.add', '添加')}
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
                      rules={[{ required: true, message: t('identity.applications.subjectRequired', '请选择或输入授权主体') }]}
                    >
                      <AssignmentSubjectSelect
                        fieldName={field.name}
                        form={form}
                        options={subjectOptions}
                        placeholder={t('identity.applications.subjectPlaceholder', '搜索或输入用户、角色、团队或标签')}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'effect']}>
                      <Select disabled options={[{ label: t('identity.applications.allow', '允许'), value: 'allow' }]} />
                    </Form.Item>
                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </div>
                ))
              ) : (
                <Text type="secondary">
                  {t('identity.applications.assignmentEmpty', '未配置访问授权时，所有已登录用户都可访问该应用。')}
                </Text>
              )}
            </div>
          )}
        </Form.List>

        <div className="soha-identity-form-actions">
          <Button onClick={onCancel}>{t('common.cancel', '取消')}</Button>
          <Button htmlType="submit" loading={saving} type="primary">
            {t('common.save', '保存')}
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
