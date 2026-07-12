import { Space, Tag } from 'antd'
import { SettingsCard } from '../shared/components'

export function AboutSettingsPage() {
  return (
    <div className="soha-page">
      <SettingsCard title="关于 OpenSoha">
        <Space orientation="vertical" size={8}>
          <strong>OpenSoha</strong>
          <span>Soha AI Gateway 与云原生运维控制台。</span>
          <Space size={8} wrap>
            <Tag>Console</Tag>
            <Tag>Apache-2.0</Tag>
          </Space>
        </Space>
      </SettingsCard>
    </div>
  )
}
