import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  LockOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Form, Input, Slider } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  authKeys,
  commitAuthResult,
  fetchAuthProviders,
  fetchLoginOptions,
  loginWithPassword,
} from '@/features/auth'
import { useAuthStore } from '@/stores/auth-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { resolveThemeMode } from '@/theme/app-theme'

interface LoginValues {
  username: string
  password: string
}

function providerLoginPath(provider: { id?: string; loginUrl?: string }) {
  if (provider.id) return `/api/v1/auth/providers/${encodeURIComponent(provider.id)}/login`
  if (provider.loginUrl) return `/api/v1${provider.loginUrl}`
  return null
}

export function DesktopLoginPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const accessToken = useAuthStore((state) => state.accessToken)
  const themeMode = usePreferencesStore((state) => state.themeMode)
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode)
  const [loading, setLoading] = useState(false)
  const [sliderValue, setSliderValue] = useState(0)
  const [sliderVerified, setSliderVerified] = useState(false)
  const providersQuery = useQuery({
    queryKey: authKeys.providers(),
    queryFn: fetchAuthProviders,
    staleTime: 60_000,
  })
  const optionsQuery = useQuery({
    queryKey: authKeys.loginOptions(),
    queryFn: fetchLoginOptions,
    retry: false,
    staleTime: 60_000,
  })
  const passwordEnabled = optionsQuery.data?.localPasswordLoginEnabled !== false
  const sliderEnabled = optionsQuery.data?.verification.sliderEnabled === true
  const providers = (providersQuery.data ?? []).filter(
    (provider) => provider.enabled !== false && provider.type !== 'password',
  )
  const resolvedTheme = resolveThemeMode(themeMode)

  useEffect(() => {
    if (accessToken) navigate('/home', { replace: true })
  }, [accessToken, navigate])

  const submit = async (values: LoginValues) => {
    if (sliderEnabled && !sliderVerified) {
      message.warning('请先完成滑块验证')
      return
    }
    setLoading(true)
    try {
      const result = await loginWithPassword(values.username, values.password)
      commitAuthResult(result)
      message.success('登录成功')
      navigate('/home', { replace: true })
    } catch (error) {
      setSliderValue(0)
      setSliderVerified(false)
      message.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const openProvider = (provider: (typeof providers)[number]) => {
    const path = providerLoginPath(provider)
    if (!path || provider.type === 'saml') {
      message.warning('当前登录方式尚未启用')
      return
    }
    const target = new URL(path, window.location.origin)
    target.searchParams.set('return_to', '/home')
    window.location.assign(`${target.pathname}${target.search}`)
  }

  return (
    <div className="soha-desktop-login">
      <header className="soha-desktop-login-titlebar">
        <div className="soha-desktop-login-brand">
          <span className="soha-desktop-brand-mark">S</span>
          <strong>Soha</strong>
        </div>
        <Button
          aria-label={resolvedTheme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          icon={resolvedTheme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')}
          title={resolvedTheme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          type="text"
        />
      </header>

      <main className="soha-desktop-login-main">
        <section className="soha-desktop-login-panel">
          <div className="soha-desktop-login-heading">
            <span>SOHA DESKTOP</span>
            <h1>登录 Soha</h1>
            <p>使用组织账号安全访问你的企业应用。</p>
          </div>

          {optionsQuery.isError ? (
            <Alert showIcon title="无法读取登录配置，将尝试本地账号登录" type="warning" />
          ) : null}

          {passwordEnabled ? (
            <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false}>
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input allowClear autoComplete="username" prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password autoComplete="current-password" prefix={<LockOutlined />} />
              </Form.Item>

              {sliderEnabled ? (
                <div className={`soha-desktop-login-slider${sliderVerified ? ' is-verified' : ''}`}>
                  <span>
                    {sliderVerified ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
                    {sliderVerified ? '验证通过' : '拖动滑块完成验证'}
                  </span>
                  <Slider
                    disabled={sliderVerified || loading}
                    onChange={(value) => {
                      setSliderValue(value)
                      if (value < 98) setSliderVerified(false)
                    }}
                    onChangeComplete={(value) => {
                      setSliderValue(value >= 98 ? 100 : 0)
                      setSliderVerified(value >= 98)
                    }}
                    tooltip={{ formatter: null }}
                    value={sliderValue}
                  />
                </div>
              ) : null}

              <Button
                block
                disabled={sliderEnabled && !sliderVerified}
                htmlType="submit"
                loading={loading}
                type="primary"
              >
                登录
              </Button>
            </Form>
          ) : null}

          {providers.length ? (
            <div className="soha-desktop-login-providers">
              <span>或使用组织登录</span>
              {providers.map((provider) => (
                <Button
                  block
                  key={`${provider.type}-${provider.id || provider.name}`}
                  onClick={() => openProvider(provider)}
                >
                  {provider.name}
                </Button>
              ))}
            </div>
          ) : null}

          <footer>
            <i /> 连接到组织服务
          </footer>
        </section>
      </main>
    </div>
  )
}
