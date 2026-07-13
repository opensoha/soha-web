import { ManagementDetailHeader } from '@/components/management-list'
import './styles.css'

export function PluginPageShell({
  children,
  extra,
}: {
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="soha-page soha-plugin-page">
      <ManagementDetailHeader
        actions={extra}
        description="安装扩展资产和集成声明；真实访问能力仍由 RBAC、Gateway grants、policy、approval、audit 与 secrets 控制。"
        title="扩展"
      />
      {children}
    </div>
  )
}
