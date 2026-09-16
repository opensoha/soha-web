import { lazy, Suspense, useState } from 'react'
import { Button } from 'antd'
import { BranchesOutlined } from '@ant-design/icons'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'

const Manager = lazy(() =>
  import('./manager').then((module) => ({ default: module.TemplateSourceManager })),
)

export function TemplateSourcesButton({ sourceId }: { sourceId?: string }) {
  const [open, setOpen] = useState(false)
  const permissions = usePermissionSnapshot()
  if (!hasPermission(permissions.data?.data, 'delivery.template-sources.view')) return null
  return (
    <>
      <Button icon={<BranchesOutlined />} onClick={() => setOpen(true)} disabled={false}>
        {sourceId ? '管理 Git 来源' : 'Git 来源'}
      </Button>
      {open ? (
        <Suspense fallback={<ManagementState compact kind="loading" />}>
          <Manager initialId={sourceId} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
