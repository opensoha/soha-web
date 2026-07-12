import { ManagementDetailHeader } from '@/components/management-list'
import { AISettingsPage } from '@/features/settings'
import '../../copilot-pages.css'

export function AIModelSettingsPage() {
  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="AI 设置"
        description="在 AI 工作台内查看和调整 Provider、数据源、技能与自动化策略。"
      />
      <AISettingsPage embedded />
    </div>
  )
}
