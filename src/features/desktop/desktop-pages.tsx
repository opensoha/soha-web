import { useMemo, useState } from 'react'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, App, Avatar, Button, Empty, Input, Select, Skeleton, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IdentityApplication } from '@/features/identity'
import { authKeys, authProfileApi } from '@/features/auth'
import {
  PortalApplicationAvatar,
  portalApplicationSearchText,
  providerPortalMutations,
  providerPortalQueries,
} from '@/features/provider-portal'
import { useAuthStore } from '@/stores/auth-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { checkDesktopAppUpdate, getDesktopAppInfo } from './app-runtime'
import { desktopKeys } from './keys'

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description: string
}) {
  return (
    <header className="soha-desktop-page-heading">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function ApplicationCard({
  application,
  launch,
  pending,
}: {
  application: IdentityApplication
  launch: (application: IdentityApplication) => void
  pending: boolean
}) {
  return (
    <article className="soha-desktop-app-card">
      <PortalApplicationAvatar application={application} />
      <div className="soha-desktop-app-copy">
        <div className="soha-desktop-app-title">
          <h2>{application.name}</h2>
          {application.favorite ? <Tag color="blue">常用</Tag> : null}
        </div>
        <p>{application.description || '企业应用'}</p>
        <div className="soha-desktop-app-tags">
          {(application.tags || []).slice(0, 2).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>
      <Button
        aria-label={`打开 ${application.name}`}
        disabled={application.status !== 'enabled'}
        icon={<ArrowRightOutlined />}
        loading={pending}
        onClick={() => launch(application)}
        type="primary"
      >
        打开
      </Button>
    </article>
  )
}

function useApplicationLaunch() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const mutation = useMutation(providerPortalMutations.launch(queryClient))
  const launch = (application: IdentityApplication) => {
    mutation.mutate(application, {
      onSuccess: (decision) => {
        if (!decision.launchUrl) {
          message.warning('该应用尚未配置访问地址')
          return
        }
        window.location.assign(decision.launchUrl)
      },
      onError: () => message.error('应用启动失败，请稍后重试'),
    })
  }
  return { launch, pendingId: mutation.isPending ? mutation.variables?.id : undefined }
}

function ApplicationList({ applications }: { applications: IdentityApplication[] }) {
  const { launch, pendingId } = useApplicationLaunch()
  if (!applications.length) {
    return <Empty description="暂无可用应用" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  return (
    <div className="soha-desktop-app-grid">
      {applications.map((application) => (
        <ApplicationCard
          application={application}
          key={application.id}
          launch={launch}
          pending={pendingId === application.id}
        />
      ))}
    </div>
  )
}

export function DesktopHomePage() {
  const user = useAuthStore((state) => state.user)
  const portalQuery = useQuery(providerPortalQueries.bootstrap())
  const portal = portalQuery.data
  const applications = (portal?.favorites.length ? portal.favorites : portal?.applications) ?? []

  return (
    <div className="soha-desktop-page">
      <PageHeading
        eyebrow="SOHA DESKTOP"
        title={`你好，${user?.displayName || user?.userName || '欢迎回来'}`}
        description="从一个安静、可信的入口访问组织应用。"
      />

      <section className="soha-desktop-status-band" aria-label="连接状态">
        <div>
          <CheckCircleFilled />
          <span>
            <strong>服务已连接</strong>
            <small>会话与权限状态正常</small>
          </span>
        </div>
        <div>
          <AppstoreOutlined />
          <span>
            <strong>{portal?.applications.length ?? '-'}</strong>
            <small>可访问应用</small>
          </span>
        </div>
        <div>
          <LockOutlined />
          <span>
            <strong>{portal?.security.mfaEnabled ? '已启用' : '未启用'}</strong>
            <small>多因素认证</small>
          </span>
        </div>
      </section>

      <section className="soha-desktop-section">
        <div className="soha-desktop-section-heading">
          <div>
            <h2>{portal?.favorites.length ? '常用应用' : '推荐应用'}</h2>
            <p>选择应用后由 Soha 完成访问鉴权。</p>
          </div>
        </div>
        {portalQuery.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
        {portalQuery.isError ? <Alert title="暂时无法加载应用" type="error" showIcon /> : null}
        {portal ? <ApplicationList applications={applications.slice(0, 6)} /> : null}
      </section>
    </div>
  )
}

export function ApplicationsPage() {
  const [query, setQuery] = useState('')
  const applicationsQuery = useQuery(providerPortalQueries.applications())
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return (applicationsQuery.data ?? []).filter(
      (application) => !keyword || portalApplicationSearchText(application).includes(keyword),
    )
  }, [applicationsQuery.data, query])

  return (
    <div className="soha-desktop-page">
      <PageHeading title="全部应用" description="查找并打开你有权访问的企业应用。" />
      <div className="soha-desktop-toolbar">
        <Input
          allowClear
          aria-label="搜索应用"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称、标签或类型"
          prefix={<SearchOutlined />}
          value={query}
        />
        <span>{filtered.length} 个应用</span>
      </div>
      {applicationsQuery.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {applicationsQuery.isError ? <Alert title="暂时无法加载应用" type="error" showIcon /> : null}
      {applicationsQuery.data ? <ApplicationList applications={filtered} /> : null}
    </div>
  )
}

export function AccountPage() {
  const fallback = useAuthStore((state) => state.user)
  const profileQuery = useQuery({ queryKey: authKeys.profile(), queryFn: authProfileApi.get })
  const profile = profileQuery.data?.data
  const displayName = profile?.displayName || profile?.username || fallback?.userName || '用户'

  return (
    <div className="soha-desktop-page">
      <PageHeading title="个人资料" description="查看当前登录身份和组织归属。" />
      <section className="soha-desktop-profile">
        <Avatar
          icon={<UserOutlined />}
          size={72}
          src={profile?.avatarUrl || fallback?.avatarUrl || undefined}
        />
        <div>
          <h2>{displayName}</h2>
          <p>{profile?.email || fallback?.email}</p>
          <Tag color="green">{profile?.status || 'active'}</Tag>
        </div>
      </section>
      {profileQuery.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : null}
      {profileQuery.isError ? <Alert title="暂时无法读取完整资料" type="warning" showIcon /> : null}
      <dl className="soha-desktop-details">
        <div>
          <dt>用户名</dt>
          <dd>{profile?.username || fallback?.userName || '-'}</dd>
        </div>
        <div>
          <dt>邮箱</dt>
          <dd>{profile?.email || fallback?.email || '-'}</dd>
        </div>
        <div>
          <dt>手机号</dt>
          <dd>{profile?.phone || fallback?.phone || '未设置'}</dd>
        </div>
        <div>
          <dt>角色</dt>
          <dd>{(profile?.roles || fallback?.roles || []).join('、') || '普通用户'}</dd>
        </div>
        <div>
          <dt>团队</dt>
          <dd>{(profile?.teams || fallback?.teams || []).join('、') || '未加入团队'}</dd>
        </div>
      </dl>
    </div>
  )
}

export function SettingsPage() {
  const { message } = App.useApp()
  const themeMode = usePreferencesStore((state) => state.themeMode)
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode)
  const localeCode = usePreferencesStore((state) => state.localeCode)
  const setLocaleCode = usePreferencesStore((state) => state.setLocaleCode)
  const appInfoQuery = useQuery({ queryKey: desktopKeys.appInfo(), queryFn: getDesktopAppInfo })
  const updateMutation = useMutation({
    mutationFn: checkDesktopAppUpdate,
    onSuccess: (result) => message.success(result),
    onError: (error) => message.warning(error instanceof Error ? error.message : '检查更新失败'),
  })

  return (
    <div className="soha-desktop-page">
      <PageHeading title="设置" description="管理显示偏好、语言和桌面应用更新。" />
      <section className="soha-desktop-settings-section">
        <h2>外观与语言</h2>
        <div className="soha-desktop-setting-row">
          <span>
            <strong>主题</strong>
            <small>选择应用界面的明暗模式</small>
          </span>
          <Select
            aria-label="主题"
            onChange={setThemeMode}
            options={[
              { label: '跟随系统', value: 'system' },
              { label: '浅色', value: 'light' },
              { label: '深色', value: 'dark' },
            ]}
            value={themeMode}
          />
        </div>
        <div className="soha-desktop-setting-row">
          <span>
            <strong>语言</strong>
            <small>设置界面首选语言</small>
          </span>
          <Select
            aria-label="语言"
            onChange={setLocaleCode}
            options={[
              { label: '简体中文', value: 'zh_CN' },
              { label: 'English', value: 'en_US' },
            ]}
            value={localeCode}
          />
        </div>
      </section>
      <section className="soha-desktop-settings-section">
        <h2>关于 Soha</h2>
        <div className="soha-desktop-setting-row">
          <span>
            <strong>{appInfoQuery.data?.name || 'Soha Desktop'}</strong>
            <small>
              版本 {appInfoQuery.data?.version || '读取中'} · {appInfoQuery.data?.platform || '-'}{' '}
              {appInfoQuery.data?.arch || ''}
            </small>
          </span>
          <Button
            disabled={!appInfoQuery.data?.updateSupported}
            icon={<ReloadOutlined />}
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            检查更新
          </Button>
        </div>
        {!appInfoQuery.data?.updateSupported ? (
          <p className="soha-desktop-update-note">
            当前构建未配置更新源；正式发布包配置后可在此手动检查。
          </p>
        ) : null}
      </section>
    </div>
  )
}
