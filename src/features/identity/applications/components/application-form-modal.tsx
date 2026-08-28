import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  App,
  Avatar,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd'
import type { FormInstance } from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { accessQueries } from '@/features/access'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import type { IdentityProvider } from '../../providers'
import type { IdentityApplication, IdentityApplicationInput } from '../../shared/types'
import {
  buildIdentityApplicationInput,
  defaultIdentityApplicationFormValues,
  IDENTITY_APPLICATION_ICON_ACCEPT,
  identityApplicationAssignmentEffectOptions,
  identityApplicationAssignmentSubjectOptions,
  identityApplicationFormValuesFor,
  identityApplicationProviderTypeOptions,
  readIdentityApplicationIconFile,
  type IdentityApplicationTagOption,
  type IdentityApplicationFormValues,
} from '../application-form-model'

const { Text } = Typography

interface ApplicationIconInputProps {
  id?: string
  value?: string
  onChange?: (value: string) => void
}

function ApplicationIconInput({ id, value = '', onChange }: ApplicationIconInputProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const uploadedFileValue = value.startsWith('data:image/')

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setReading(true)
    try {
      onChange?.(await readIdentityApplicationIconFile(file))
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('common.failed', '操作失败'))
    } finally {
      setReading(false)
    }
  }

  const clearLabel = t('identity.applications.clearIcon', '清除图标')

  return (
    <div className="soha-identity-app-icon-field">
      <Avatar
        alt={t('identity.applications.iconPreview', '应用图标预览')}
        draggable={false}
        icon={<AppstoreOutlined />}
        shape="square"
        size={32}
        src={value || undefined}
      />
      <Input
        allowClear
        id={id}
        placeholder={
          uploadedFileValue
            ? t('identity.applications.iconUploaded', '已上传本地图片')
            : 'https://example.com/icon.png'
        }
        value={uploadedFileValue ? '' : value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Button
        icon={<UploadOutlined />}
        loading={reading}
        onClick={() => fileInputRef.current?.click()}
      >
        {t('identity.applications.uploadIcon', '上传')}
      </Button>
      {value ? (
        <Button
          aria-label={clearLabel}
          icon={<DeleteOutlined />}
          title={clearLabel}
          type="text"
          onClick={() => onChange?.('')}
        />
      ) : null}
      <input
        ref={fileInputRef}
        accept={IDENTITY_APPLICATION_ICON_ACCEPT}
        className="soha-identity-app-icon-file-input"
        hidden
        type="file"
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  )
}

interface AssignmentSubjectSelectProps {
  fieldName: number
  form: FormInstance<IdentityApplicationFormValues>
  onChange?: (value: string[]) => void
  options: Record<string, Array<{ label: string; value: string }>>
  value?: string[]
}

function AssignmentSubjectSelect({
  fieldName,
  form,
  onChange,
  options,
  value,
}: AssignmentSubjectSelectProps) {
  const { t } = useI18n()
  const subjectType = Form.useWatch(['assignments', fieldName, 'subjectType'], form) ?? 'role'
  const placeholder = {
    role: t('identity.applications.subjectPlaceholder.role', '选择角色（可多选）'),
    tag: t('identity.applications.subjectPlaceholder.tag', '输入标签（可多选）'),
    team: t('identity.applications.subjectPlaceholder.team', '选择团队（可多选）'),
    user: t('identity.applications.subjectPlaceholder.user', '选择用户（可多选）'),
  }[subjectType]
  return (
    <Select
      allowClear
      mode={subjectType === 'tag' ? 'tags' : 'multiple'}
      value={value}
      onChange={onChange}
      options={options[subjectType] ?? []}
      placeholder={placeholder}
      showSearch={{ optionFilterProp: ['label', 'value'] }}
      tokenSeparators={subjectType === 'tag' ? [',', '，'] : undefined}
    />
  )
}

interface ApplicationFormModalProps {
  application: IdentityApplication | null
  tagOptions: IdentityApplicationTagOption[]
  providerOptions: IdentityProvider[]
  providerOptionsLoading: boolean
  open: boolean
  saving: boolean
  stepUpAvailable: boolean
  stepUpReason?: string
  onCancel: () => void
  onSubmit: (input: IdentityApplicationInput) => void
}

export function ApplicationFormModal({
  application,
  tagOptions,
  providerOptions,
  providerOptionsLoading,
  open,
  saving,
  stepUpAvailable,
  stepUpReason,
  onCancel,
  onSubmit,
}: ApplicationFormModalProps) {
  const [form] = Form.useForm<IdentityApplicationFormValues>()
  const { message } = App.useApp()
  const { t } = useI18n()
  const assignmentHint = t(
    'identity.applications.assignmentHint',
    '每行只配置一种主体类型，中间可多选同类对象；如需其他类型，请添加新行。拒绝规则优先，留空表示所有已登录用户。',
  )
  const conditionHint = t(
    'identity.applications.conditionHint',
    '通过访问对象校验后，还必须同时满足已启用的 MFA、网络与 UTC 时段条件。',
  )
  const providerType = Form.useWatch('providerType', form) ?? 'link'
  const assignmentValues = Form.useWatch('assignments', form) ?? []
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canViewUsers = hasPermission(permissionSnapshot, 'access.users.view')
  const canViewRoles = hasPermission(permissionSnapshot, 'access.roles.view')
  const canViewTeams = hasPermission(permissionSnapshot, 'access.groups.view')
  const usersQuery = useQuery({ ...accessQueries.users(open && canViewUsers), retry: false })
  const rolesQuery = useQuery({ ...accessQueries.roles(open && canViewRoles), retry: false })
  const teamsQuery = useQuery({ ...accessQueries.teams(open && canViewTeams), retry: false })
  const providerSelectOptions = providerOptions
    .filter((provider) => provider.type === providerType)
    .map((provider) => ({
      disabled: !provider.enabled || provider.status !== 'enabled',
      label: `${provider.name} (${provider.id})`,
      value: provider.id,
    }))
  const providerSelectDisabled =
    !application ||
    providerType === 'link' ||
    (!providerOptionsLoading && providerSelectOptions.length === 0)
  const subjectOptions = {
    user: (canViewUsers ? (usersQuery.data ?? []) : []).map((user) => ({
      label: `${user.displayName || user.username} (${user.email || user.username})`,
      value: user.id,
    })),
    role: (canViewRoles ? (rolesQuery.data ?? []) : []).map((role) => ({
      label: role.name,
      value: role.id,
    })),
    team: (canViewTeams ? (teamsQuery.data ?? []) : []).map((team) => ({
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

  const submit = (values: IdentityApplicationFormValues) => {
    if (Boolean(values.startTimeUtc?.trim()) !== Boolean(values.endTimeUtc?.trim())) {
      void message.error(
        t('identity.applications.timeWindowRequired', 'UTC 开始与结束时间必须同时填写'),
      )
      return
    }
    if (values.requireMfa && !stepUpAvailable) {
      void message.error(
        stepUpReason || t('identity.applications.mfaUnavailable', '当前运行环境无法启用 MFA 条件'),
      )
      return
    }
    onSubmit(buildIdentityApplicationInput(values, application))
  }

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title={
        application
          ? t('identity.applications.edit', '编辑应用')
          : t('identity.applications.create', '新建应用')
      }
      width={900}
      onCancel={onCancel}
    >
      <Form
        form={form}
        className="soha-identity-app-form"
        initialValues={defaultIdentityApplicationFormValues()}
        layout="vertical"
        onFinish={submit}
      >
        <div className="soha-identity-form-grid">
          <Form.Item
            label={t('identity.applications.name', '名称')}
            name="name"
            rules={[
              {
                required: true,
                message: t('identity.applications.nameRequired', '请输入应用名称'),
              },
            ]}
          >
            <Input placeholder="Example App" />
          </Form.Item>
          <Form.Item label="Slug" name="slug">
            <Input placeholder="example-app" />
          </Form.Item>
          <Form.Item
            label={t('identity.applications.providerType', 'Provider 类型')}
            name="providerType"
          >
            <Select
              onChange={() => form.setFieldValue('providerId', '')}
              options={identityApplicationProviderTypeOptions}
            />
          </Form.Item>
          <Form.Item
            getValueProps={(value?: string) => ({ value: value || undefined })}
            label={t('identity.applications.providerId', 'Provider ID')}
            name="providerId"
            tooltip={t(
              'identity.applications.providerIdHint',
              'Provider 归属具体应用：新建 OIDC/Proxy 应用时请先保存，随后进入 Provider 配置；编辑时可选择同类型 Provider。',
            )}
          >
            <Select
              allowClear
              disabled={providerSelectDisabled}
              loading={providerOptionsLoading}
              options={providerSelectOptions}
              placeholder={
                providerType === 'link'
                  ? t('identity.applications.providerIdLinkPlaceholder', 'Link 应用无需 Provider')
                  : !application
                    ? t(
                        'identity.applications.providerIdCreatePlaceholder',
                        '保存应用后配置 Provider',
                      )
                    : providerOptionsLoading
                      ? t('identity.applications.providerIdLoading', '正在加载 Provider')
                      : providerSelectOptions.length
                        ? t('identity.applications.providerIdPlaceholder', '选择 Provider')
                        : t('identity.applications.providerIdEmpty', '当前应用暂无匹配的 Provider')
              }
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
          <div className="soha-identity-publish-controls">
            <div className="soha-identity-inline-switch">
              <Text>{t('identity.applications.column.enabled', '启用状态')}</Text>
              <Form.Item
                getValueFromEvent={(checked: boolean) => (checked ? 'enabled' : 'disabled')}
                getValueProps={(status: IdentityApplicationFormValues['status']) => ({
                  checked: status === 'enabled',
                })}
                name="status"
                noStyle
              >
                <Switch aria-label={t('identity.applications.column.enabled', '启用状态')} />
              </Form.Item>
            </div>
            <div className="soha-identity-inline-switch">
              <Text>{t('identity.applications.portalVisible', '门户可见')}</Text>
              <Form.Item name="portalVisible" noStyle valuePropName="checked">
                <Switch aria-label={t('identity.applications.portalVisible', '门户可见')} />
              </Form.Item>
            </div>
            <div className="soha-identity-inline-switch">
              <Text>{t('identity.applications.featured', '推荐应用')}</Text>
              <Form.Item name="featured" noStyle valuePropName="checked">
                <Switch aria-label={t('identity.applications.featured', '推荐应用')} />
              </Form.Item>
            </div>
          </div>
          <Form.Item label={t('identity.applications.sortOrder', '排序')} name="sortOrder">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item label={t('identity.applications.descriptionField', '描述')} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <Form.Item label={t('identity.applications.launchUrl', '访问地址')} name="launchUrl">
          <Input prefix={<LinkOutlined />} placeholder="https://app.example.com" />
        </Form.Item>

        <div className="soha-identity-form-grid">
          <Form.Item
            getValueFromEvent={(nextValue: string) => nextValue}
            label={t('identity.applications.icon', '图标')}
            name="iconUrl"
          >
            <ApplicationIconInput />
          </Form.Item>
          <Form.Item label={t('identity.applications.tags', '标签')} name="tags">
            <Select
              mode="tags"
              options={tagOptions}
              placeholder={t('identity.applications.tagsPlaceholder', '选择已有标签或输入新标签')}
              showSearch={{ optionFilterProp: 'label' }}
              tokenSeparators={[',', '，']}
            />
          </Form.Item>
        </div>

        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <div className="soha-identity-access-control-section">
              <div className="soha-identity-access-control-header">
                <Space size={4}>
                  <Text strong>{t('identity.applications.accessControl', '访问控制')}</Text>
                  <Tooltip title={assignmentHint} trigger={['hover', 'focus']}>
                    <QuestionCircleOutlined
                      aria-label={t('identity.applications.assignmentHintLabel', '访问控制说明')}
                      tabIndex={0}
                    />
                  </Tooltip>
                </Space>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => add({ effect: 'allow', subjectIds: [], subjectType: 'role' })}
                >
                  {t('common.add', '添加')}
                </Button>
              </div>
              <div className="soha-identity-assignment-editor">
                {fields.map((field) => (
                  <div className="soha-identity-assignment-row" key={field.key}>
                    <Form.Item name={[field.name, 'subjectType']} rules={[{ required: true }]}>
                      <Select
                        aria-label={t('identity.applications.subjectType', '主体类型')}
                        disabled={Boolean(
                          assignmentValues[field.name]?.subjectIds?.some((id) => id.trim()),
                        )}
                        options={identityApplicationAssignmentSubjectOptions}
                        onChange={() =>
                          form.setFieldValue(['assignments', field.name, 'subjectIds'], [])
                        }
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'subjectIds']}
                      rules={[
                        {
                          required: true,
                          message: t(
                            'identity.applications.subjectRequired',
                            '请选择或输入授权主体',
                          ),
                        },
                      ]}
                    >
                      <AssignmentSubjectSelect
                        fieldName={field.name}
                        form={form}
                        options={subjectOptions}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'effect']}>
                      <Select options={identityApplicationAssignmentEffectOptions} />
                    </Form.Item>
                    <Button
                      aria-label={t('identity.applications.removeAssignment', '删除访问授权')}
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
              </div>
              <div className="soha-identity-policy-conditions-section">
                <Space size={4}>
                  <Text strong>{t('identity.applications.accessConditions', '访问条件')}</Text>
                  <Tooltip title={conditionHint} trigger={['hover', 'focus']}>
                    <QuestionCircleOutlined
                      aria-label={t('identity.applications.conditionHintLabel', '访问条件说明')}
                      tabIndex={0}
                    />
                  </Tooltip>
                </Space>
                <div className="soha-identity-policy-conditions">
                  {!stepUpAvailable ? (
                    <Alert
                      showIcon
                      title={t('identity.applications.mfaUnavailableTitle', 'MFA 升级验证不可用')}
                      description={
                        stepUpReason ||
                        t('identity.applications.mfaUnavailable', '当前运行环境无法启用 MFA 条件。')
                      }
                      type="warning"
                    />
                  ) : null}
                  <Form.Item
                    label={t('identity.applications.requireMfa', '要求 MFA')}
                    name="requireMfa"
                    valuePropName="checked"
                  >
                    <Switch disabled={!stepUpAvailable} />
                  </Form.Item>
                  <Form.Item
                    label={t('identity.applications.allowedCidrs', '允许的 CIDR')}
                    name="allowedCidrs"
                  >
                    <Select mode="tags" placeholder="10.0.0.0/8" tokenSeparators={[',']} />
                  </Form.Item>
                  <div className="soha-identity-policy-time-window">
                    <Form.Item
                      getValueFromEvent={(_: unknown, value: string) => value}
                      getValueProps={(value?: string) => ({
                        value: value ? dayjs(`2000-01-01T${value}:00`) : null,
                      })}
                      label={t('identity.applications.startTimeUtc', 'UTC 开始时间')}
                      name="startTimeUtc"
                    >
                      <TimePicker
                        format="HH:mm"
                        placeholder={t('identity.applications.timePlaceholder', '选择时间')}
                        showNow={false}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      getValueFromEvent={(_: unknown, value: string) => value}
                      getValueProps={(value?: string) => ({
                        value: value ? dayjs(`2000-01-01T${value}:00`) : null,
                      })}
                      label={t('identity.applications.endTimeUtc', 'UTC 结束时间')}
                      name="endTimeUtc"
                    >
                      <TimePicker
                        format="HH:mm"
                        placeholder={t('identity.applications.timePlaceholder', '选择时间')}
                        showNow={false}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>
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
