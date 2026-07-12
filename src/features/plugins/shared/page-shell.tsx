import { Tabs } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementDetailHeader } from '@/components/management-list'
import './styles.css'

const pluginTabs = [
  { key: 'marketplace', label: '市场', path: '/plugins/marketplace' },
  { key: 'installed', label: '已安装', path: '/plugins/installed' },
] as const

export function PluginPageShell({
  activeKey,
  children,
  extra,
}: {
  activeKey: 'installed' | 'marketplace'
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="soha-page soha-plugin-page">
      <ManagementDetailHeader
        actions={extra}
        description="安装扩展资产和集成声明；真实访问能力仍由 RBAC、Gateway grants、policy、approval、audit 与 secrets 控制。"
        title="Soha 插件"
      />
      <Tabs
        activeKey={activeKey}
        className="soha-plugin-tabs"
        items={pluginTabs.map((item) => ({ key: item.key, label: item.label }))}
        onChange={(key) => {
          const tab = pluginTabs.find((item) => item.key === key)
          if (tab) navigate(tab.path)
        }}
      />
      {children}
    </div>
  )
}
