import { useEffect } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Form,
  Input,
  InputNumber,
  Segmented,
  Space,
  Switch,
} from 'antd'
import { LinkOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { SettingsCard } from '../shared/components'
import {
  createGitLabIntegration,
  gitLabFormValues,
  updateGitLabIntegration,
  type GitLabFormValues,
} from './model'
import { systemIntegrationMutations } from './mutations'
import { systemIntegrationQueries } from './queries'
import './styles.css'

export function SourceConnectionDetailPage() {
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ integrationId: string }>()
  const [searchParams] = useSearchParams()
  const integrationId = params.integrationId ?? ''
  const isNew = integrationId === 'new'
  const permissionQuery = usePermissionSnapshot()
  const canView = hasPermission(permissionQuery.data?.data, 'settings.system-integrations.view')
  const canManage = hasPermission(permissionQuery.data?.data, 'settings.system-integrations.manage')
  const detailQuery = useQuery(systemIntegrationQueries.detail(integrationId, canView && !isNew))
  const createMutation = useMutation(systemIntegrationMutations.create(queryClient))
  const updateMutation = useMutation(systemIntegrationMutations.update(queryClient))
  const testMutation = useMutation(systemIntegrationMutations.test(queryClient))
  const authorizeOAuthMutation = useMutation(systemIntegrationMutations.authorizeOAuth())
  const [form] = Form.useForm<GitLabFormValues>()
  const saving = createMutation.isPending || updateMutation.isPending
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
      form.setFieldsValue(gitLabFormValues())
    } else if (detailQuery.data) {
      form.setFieldsValue(gitLabFormValues(detailQuery.data))
    }
  }, [detailQuery.data, form, isNew])

  if (!permissionQuery.isLoading && !canView) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看代码源连接的权限。" />
      </div>
    )
  }

  if (isNew && !permissionQuery.isLoading && !canManage) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有新建代码源连接的权限。" />
      </div>
    )
  }

  const save = (values: GitLabFormValues) => {
    if (!canManage) return
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

  return (
    <ManagementDataPage
      className="soha-system-integrations-page"
      header={{
        title: isNew ? '新增 GitLab 连接' : detailQuery.data?.name || 'GitLab 连接',
        description: '全局代码源连接可被交付、虚拟化及其他工作台复用。凭据仅写入，不会回显。',
        actions: (
          <Space>
            <Button onClick={() => navigate('/settings/source-control')}>返回</Button>
            {!isNew && detailQuery.data ? (
              <Button
                disabled={!canManage || !detailQuery.data.enabled || !connectionReady}
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
            ) : null}
            {!isNew && detailQuery.data && oauthMode ? (
              <Button
                disabled={!canManage || !detailQuery.data.credentialKeys.includes('client_secret')}
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
            {canManage ? (
              <Button
                icon={<SaveOutlined />}
                loading={saving}
                type="primary"
                onClick={() => form.submit()}
              >
                保存
              </Button>
            ) : null}
          </Space>
        ),
      }}
      tableNode={
        <SettingsCard>
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
          <Form<GitLabFormValues>
            form={form}
            layout="vertical"
            disabled={!canManage || saving}
            initialValues={gitLabFormValues()}
            onFinish={save}
          >
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
          </Form>
        </SettingsCard>
      }
    />
  )
}
