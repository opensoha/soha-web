import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import { pluginMutations } from '../mutations'
import type { InstalledPlugin } from '../plugin-model'

export function useInstalledPluginActions() {
  const { modal, message } = App.useApp()
  const queryClient = useQueryClient()
  const enableMutation = useMutation(pluginMutations.enable(queryClient))
  const disableMutation = useMutation(pluginMutations.disable(queryClient))
  const removeMutation = useMutation(pluginMutations.remove(queryClient))
  const upgradeMutation = useMutation(pluginMutations.upgrade(queryClient))

  return {
    loading:
      enableMutation.isPending ||
      disableMutation.isPending ||
      removeMutation.isPending ||
      upgradeMutation.isPending,
    async enable(pluginId: string) {
      const item = await enableMutation.mutateAsync({ pluginId })
      message.success(`已启用 ${item.name}`)
      return item
    },
    async disable(pluginId: string) {
      const item = await disableMutation.mutateAsync({ pluginId })
      message.success(`已停用 ${item.name}`)
      return item
    },
    async upgrade(pluginId: string) {
      const item = await upgradeMutation.mutateAsync({ pluginId })
      message.success(`已升级 ${item.name}`)
      return item
    },
    confirmRemove(plugin: InstalledPlugin) {
      modal.confirm({
        title: `移除 ${plugin.name}`,
        content:
          '移除后会删除安装记录、manifest 快照和配置的 secret refs，不会删除外部 secret 实体。',
        okText: '移除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          await removeMutation.mutateAsync({ pluginId: plugin.id })
          message.success('插件已移除')
        },
      })
    },
  }
}
