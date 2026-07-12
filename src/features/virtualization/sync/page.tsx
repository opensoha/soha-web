import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button } from 'antd'
import { CloudSyncOutlined } from '@ant-design/icons'
import { virtualizationMutations, withVirtualizationMutationSuccess } from '../mutations'
import { OperationsTable } from '../operations/operations-table'
import { useVirtualizationPermissions } from '../shared/use-virtualization-permissions'

export function VirtualizationSyncPage() {
  const { canSync } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const syncMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.syncAll(queryClient), () =>
      message.success('同步任务已提交'),
    ),
  )
  const headerActions = useMemo(
    () =>
      canSync ? (
        <Button
          type="primary"
          icon={<CloudSyncOutlined />}
          loading={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          新建同步任务
        </Button>
      ) : null,
    [canSync, syncMutation],
  )

  return (
    <div className="soha-page soha-virtualization-page">
      <OperationsTable assetType="asset_sync" toolbarExtra={headerActions} />
    </div>
  )
}
