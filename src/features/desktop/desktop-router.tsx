import { useEffect, useState } from 'react'
import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  HomeOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button } from 'antd'
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { logoutAuthSession, restoreAuthSession } from '@/features/auth'
import { useAuthStore } from '@/stores/auth-store'
import { AccountPage, ApplicationsPage, DesktopHomePage, SettingsPage } from './desktop-pages'
import { DesktopLoginPage } from './desktop-login-page'
import { SoftwareLibraryPage } from './software-library-page'
import './desktop.css'

const navigation = [
  { icon: <HomeOutlined />, label: '首页', path: '/home' },
  { icon: <AppstoreOutlined />, label: '企业应用', path: '/apps' },
  { icon: <CloudDownloadOutlined />, label: '软件库', path: '/software' },
  { icon: <UserOutlined />, label: '个人资料', path: '/account' },
  { icon: <SettingOutlined />, label: '设置', path: '/settings' },
]

function DesktopAuthGuard() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const location = useLocation()
  const [restoreStatus, setRestoreStatus] = useState<'checking' | 'ready' | 'offline'>(
    accessToken ? 'ready' : 'checking',
  )

  useEffect(() => {
    if (accessToken) {
      setRestoreStatus('ready')
      return
    }

    let cancelled = false
    void restoreAuthSession().then((status) => {
      if (cancelled) return
      setRestoreStatus(status === 'unavailable' ? 'offline' : 'ready')
    })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (!accessToken && restoreStatus === 'checking') {
    return (
      <div className="soha-desktop-auth-state" role="status">
        <span className="soha-desktop-spinner" />
        正在恢复登录状态
      </div>
    )
  }
  if (!accessToken && restoreStatus === 'offline') {
    return (
      <div className="soha-desktop-auth-state" role="alert">
        <strong>无法连接 Soha 服务</strong>
        <span>请确认网络和服务地址后重新打开应用。</span>
      </div>
    )
  }
  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

function DesktopLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const displayName = user?.displayName || user?.userName || user?.email || '用户'

  const signOut = () => {
    void logoutAuthSession().finally(() => navigate('/login', { replace: true }))
  }

  return (
    <div className="soha-desktop-shell">
      <aside className="soha-desktop-sidebar">
        <div className="soha-desktop-brand" aria-label="Soha">
          <span className="soha-desktop-brand-mark">S</span>
          <span>
            <strong>Soha</strong>
            <small>企业应用</small>
          </span>
        </div>

        <nav className="soha-desktop-nav" aria-label="桌面应用导航">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => `soha-desktop-nav-item${isActive ? ' is-active' : ''}`}
              key={item.path}
              to={item.path}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="soha-desktop-sidebar-footer">
          <button className="soha-desktop-user" onClick={() => navigate('/account')} type="button">
            <Avatar icon={<UserOutlined />} size={32} src={user?.avatarUrl || undefined} />
            <span>
              <strong>{displayName}</strong>
              <small>{user?.email || '已登录'}</small>
            </span>
          </button>
          <Button icon={<LogoutOutlined />} onClick={signOut} type="text">
            退出登录
          </Button>
        </div>
      </aside>

      <main className="soha-desktop-main">
        <header className="soha-desktop-titlebar">
          <span className="soha-desktop-connection">
            <i /> 已连接
          </span>
          <span>{displayName}</span>
        </header>
        <div className="soha-desktop-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function DesktopRouter() {
  return (
    <Routes>
      <Route path="/login" element={<DesktopLoginPage />} />
      <Route element={<DesktopAuthGuard />}>
        <Route element={<DesktopLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<DesktopHomePage />} />
          <Route path="/apps" element={<ApplicationsPage />} />
          <Route path="/software" element={<SoftwareLibraryPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
