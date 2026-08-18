import { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Switch,
} from 'antd'
import { LinkOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StepFormModal } from '@/components/step-form-modal'
import type { StepFormStep } from '@/components/step-form'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  createGitLabIntegration,
  gitLabFormValues,
  updateGitLabIntegration,
  type GitLabFormValues,
} from './model'
import { systemIntegrationMutations } from './mutations'
import { systemIntegrationQueries } from './queries'
import { SourceConnectionsPage } from './source-list-page'
import './styles.css'

type SourceConnectionFormValues = GitLabFormValues & {
  providerType: 'gitlab'
}

export function SourceConnectionDetailPage() {
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ integrationId: string }>()
  const [searchParams] = useSearchParams()
  const integrationId = params.integrationId ?? ''
  const isNew = !params.integrationId || integrationId === 'new'
  const permissionQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionQuery.data?.data
  const canView = hasPermission(permissionSnapshot, 'settings.system-integrations.view')
  const canCreate = hasPermission(permissionSnapshot, 'settings.system-integrations.create')
  const canUpdate = hasPermission(permissionSnapshot, 'settings.system-integrations.update')
  const canTest = hasPermission(permissionSnapshot, 'settings.system-integrations.test')
  const canSave = isNew ? canCreate : canUpdate
  const detailQuery = useQuery(systemIntegrationQueries.detail(integrationId, canView && !isNew))
  const createMutation = useMutation(systemIntegrationMutations.create(queryClient))
  const updateMutation = useMutation(systemIntegrationMutations.update(queryClient))
  const testMutation = useMutation(systemIntegrationMutations.test(queryClient))
  const authorizeOAuthMutation = useMutation(systemIntegrationMutations.authorizeOAuth())
  const [form] = Form.useForm<SourceConnectionFormValues>()
  const [currentStep, setCurrentStep] = useState(() => (isNew ? 0 : 1))
  const saving = createMutation.isPending || updateMutation.isPending
  const providerType = Form.useWatch('providerType', form) ?? 'gitlab'
  const authMode = Form.useWatch('authMode', form) ?? 'access_token'
  const configuredAuthMode = detailQuery.data?.configuration.find(
    (field) => field.key === 'auth_mode',
  )?.value
  const oauthMode = configuredAuthMode === 'oauth'
  const connectionReady = detailQuery.data?.credentialKeys.includes(
    oauthMode ? 'access_token' : 'token',
  )

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue({ providerType: 'gitlab', ...gitLabFormValues() })
    } else if (detailQuery.data) {
      form.setFieldsValue({ providerType: 'gitlab', ...gitLabFormValues(detailQuery.data) })
    }
  }, [detailQuery.data, form, isNew])

  if (!permissionQuery.isLoading && !canView) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看代码源连接的权限。" />
      </div>
    )
  }

  if (isNew && !permissionQuery.isLoading && !canCreate) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有新建代码源连接的权限。" />
      </div>
    )
  }

  const save = (values: SourceConnectionFormValues) => {
    if (!canSave) return
    if (isNew) {
      createMutation.mutate(createGitLabIntegration(values), {
        onSuccess: () => {
          void message.success('GitLab 连接已创建')
          navigate('/settings/source-control')
        },
        onError: (error) => void message.error(error.message),
      })
      return
    }
    if (!detailQuery.data) return
    updateMutation.mutate(
      { id: detailQuery.data.id, values: updateGitLabIntegration(detailQuery.data, values) },
      {
        onSuccess: () => {
          void message.success('GitLab 连接已保存')
          navigate('/settings/source-control')
        },
        onError: (error) => void message.error(error.message),
      },
    )
  }

  const steps: StepFormStep[] = [
    {
      title: '选择 Provider',
      fieldNames: ['providerType'],
      children: (
        <div className="soha-system-integration-provider-step">
          <Form.Item
            name="providerType"
            label="Git Provider"
            rules={[{ required: true, message: '请选择 Git Provider' }]}
          >
            <Select
              disabled={!isNew}
              options={[{ label: 'GitLab', value: 'gitlab' }]}
              placeholder="选择 Git Provider"
            />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '连接配置',
      children: (
        <>
          {searchParams.get('oauth') === 'success' ? (
            <Alert
              className="soha-system-integration-oauth-alert"
              showIcon
              type="success"
              title="GitLab OAuth 授权成功"
            />
          ) : null}
          {searchParams.get('oauth') === 'error' ? (
            <Alert
              className="soha-system-integration-oauth-alert"
              showIcon
              type="error"
              title="GitLab OAuth 授权失败，请重新授权"
            />
          ) : null}
          {!isNew && detailQuery.data ? (
            <div className="soha-system-integration-tools">
              <Space wrap>
                <Button
                  disabled={!canTest || !detailQuery.data.enabled || !connectionReady}
                  icon={<ThunderboltOutlined />}
                  loading={testMutation.isPending}
                  onClick={() =>
                    testMutation.mutate(detailQuery.data!.id, {
                      onSuccess: (result) =>
                        void message[result.status === 'succeeded' ? 'success' : 'error'](
                          result.message ||
                            (result.status === 'succeeded' ? '连接测试成功' : '连接测试失败'),
                        ),
                      onError: (error) => void message.error(error.message),
                    })
                  }
                >
                  测试连接
                </Button>
                {oauthMode ? (
                  <Button
                    disabled={
                      !canUpdate || !detailQuery.data.credentialKeys.includes('client_secret')
                    }
                    icon={<LinkOutlined />}
                    loading={authorizeOAuthMutation.isPending}
                    onClick={() =>
                      authorizeOAuthMutation.mutate(detailQuery.data!.id, {
                        onSuccess: (result) => window.location.assign(result.authorizationUrl),
                        onError: (error) => void message.error(error.message),
                      })
                    }
                  >
                    {connectionReady ? '重新授权' : '授权 GitLab'}
                  </Button>
                ) : null}
              </Space>
            </div>
          ) : null}
          {providerType === 'gitlab' ? (
            <div className="soha-system-integration-form-grid">
              <Form.Item
                name="name"
                label="连接名称"
                rules={[{ required: true, message: '请输入连接名称' }]}
              >
                <Input maxLength={200} placeholder="公司 GitLab" />
              </Form.Item>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                name="authMode"
                label="认证方式"
                rules={[{ required: true, message: '请选择认证方式' }]}
              >
                <Segmented
                  block
                  options={[
                    { label: 'Access Token', value: 'access_token' },
                    { label: 'OAuth Application', value: 'oauth' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="baseUrl"
                label="API 地址"
                rules={[
                  { required: true, message: '请输入 GitLab API 地址' },
                  { type: 'url', message: '请输入有效的 URL' },
                ]}
              >
                <Input placeholder="https://gitlab.example.com/api/v4" />
              </Form.Item>
              <Form.Item name="groupId" label="默认 Group ID">
                <Input placeholder="可选，不限制时留空" />
              </Form.Item>
              <Form.Item
                name="perPage"
                label="每页数量"
                rules={[{ required: true, message: '请输入每页数量' }]}
              >
                <InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="timeout"
                label="请求超时"
                rules={[{ required: true, message: '请输入请求超时' }]}
              >
                <Input placeholder="15s" />
              </Form.Item>
              {authMode === 'access_token' ? (
                <Form.Item
                  name="token"
                  label={
                    detailQuery.data?.credentialKeys.includes('token')
                      ? '访问令牌（已配置，留空保持不变）'
                      : '访问令牌'
                  }
                  rules={isNew ? [{ required: true, message: '请输入访问令牌' }] : undefined}
                >
                  <Input.Password autoComplete="new-password" placeholder="GitLab access token" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    name="clientId"
                    label="Application ID"
                    rules={[{ required: true, message: '请输入 GitLab Application ID' }]}
                  >
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item
                    name="clientSecret"
                    label={
                      detailQuery.data?.credentialKeys.includes('client_secret')
                        ? 'Application Secret（已配置，留空保持不变）'
                        : 'Application Secret'
                    }
                    rules={
                      isNew || !detailQuery.data?.credentialKeys.includes('client_secret')
                        ? [{ required: true, message: '请输入 GitLab Application Secret' }]
                        : undefined
                    }
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    name="oauthRedirectUri"
                    label="GitLab Application Redirect URI"
                    rules={[
                      { required: true, message: '请输入 OAuth 回调地址' },
                      { type: 'url', message: '请输入有效的 URL' },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Alert
                    className="soha-system-integration-oauth-alert"
                    showIcon
                    type={connectionReady ? 'success' : 'info'}
                    title={
                      connectionReady ? 'OAuth 已授权' : '保存连接后，点击“授权 GitLab”完成授权'
                    }
                  />
                </>
              )}
              <Form.Item name="description" label="说明">
                <Input.TextArea maxLength={1000} rows={3} />
              </Form.Item>
            </div>
          ) : null}
        </>
      ),
    },
  ]

  return (
    <>
      <SourceConnectionsPage />
      <StepFormModal
        contentMaxWidth={820}
        current={currentStep}
        disabled={!canSave || saving}
        form={form}
        initialValues={{ providerType: 'gitlab', ...gitLabFormValues() }}
        loading={saving}
        open
        steps={steps}
        submitText="保存"
        title={isNew ? '新增 Git' : '编辑 Git 连接'}
        width={900}
        onClose={() => navigate('/settings/source-control')}
        onCurrentChange={setCurrentStep}
        onFinish={save}
      />
    </>
  )
}
