import { useMemo } from 'react'
import { Button, Space, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePermissionSnapshot } from '@/features/auth'
import type { PermissionSnapshot } from '@/types'
import { SettingsCard } from '../shared/components'

export function getSettingsLandingMenus(snapshot?: PermissionSnapshot) {
  return (snapshot?.visibleMenus ?? [])
    .filter((menu) => menu.parentId === 'settings' && menu.path !== '/settings')
    .sort((left, right) => {
      const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : 0
      const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : 0
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.path.localeCompare(right.path)
    })
}

export function SettingsCenterPage() {
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const landingMenus = useMemo(() => getSettingsLandingMenus(snapshot), [snapshot])

  if (permissionSnapshotQuery.isLoading) {
    return (
      <div className="soha-page">
        <SettingsCard>
          <Spin size="large" />
        </SettingsCard>
      </div>
    )
  }

  return (
    <div className="soha-page">
      <SettingsCard>
        {landingMenus.length > 0 ? (
          <Space orientation="vertical" size={12}>
            {landingMenus.map((menu) => (
              <Button
                key={menu.id}
                type="link"
                style={{ paddingInline: 0 }}
                onClick={() => navigate(menu.path)}
              >
                {menu.labelZh || menu.labelEn || menu.id}
              </Button>
            ))}
          </Space>
        ) : (
          <span>暂无可用设置</span>
        )}
      </SettingsCard>
    </div>
  )
}
