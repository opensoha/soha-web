import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from 'antd'
import {
  ExpandAltOutlined,
  HeartOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { DraggableFloatShell } from '@/features/copilot'
import type { AIGlobalAssistantAction, AIGlobalAssistantMessage } from '@/features/copilot'
import { pluginQueries } from '@/features/plugins'
import type { InstalledPlugin } from '@/features/plugins'
import { usePreferencesStore } from '@/stores/preferences-store'
import { companionApi, companionKeys } from './api'
import { builtinCompanionPack, BUILTIN_COMPANION_PLUGIN_ID } from './builtin-pack'
import { CompanionRenderer } from './companion-renderer'
import { companionSpeech, resolveCompanionVisualState } from './state-machine'
import type { CompanionPackSelection } from './types'

interface AssistantCompanionOverlayProps {
  disabled?: boolean
  messages: AIGlobalAssistantMessage[]
  panelOpen?: boolean
  running?: boolean
  onAction: (action: AIGlobalAssistantAction) => void
  onOpenAssistant: () => void
  onOpenWorkbench: () => void
  nativeWindow?: boolean
}

function activePack(
  selectedPluginId: string,
  installed: InstalledPlugin[],
): CompanionPackSelection {
  if (selectedPluginId === BUILTIN_COMPANION_PLUGIN_ID) return builtinCompanionPack
  const plugin = installed?.find(
    (item) =>
      item.id === selectedPluginId &&
      item.status === 'enabled' &&
      item.type === 'companion-pack' &&
      item.manifest.companionPack,
  )
  if (!plugin?.manifest.companionPack) return builtinCompanionPack
  return {
    pluginId: plugin.id,
    version: plugin.activeVersion || plugin.version,
    manifest: plugin.manifest.companionPack,
    installed: plugin,
  }
}

export function AssistantCompanionOverlay({
  disabled = false,
  messages,
  panelOpen = false,
  running = false,
  onAction,
  onOpenAssistant,
  onOpenWorkbench,
  nativeWindow = false,
}: AssistantCompanionOverlayProps) {
  const queryClient = useQueryClient()
  const selectedPluginId = usePreferencesStore((state) => state.selectedCompanionPluginId)
  const bubbleEnabled = usePreferencesStore((state) => state.companionBubbleEnabled)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const installedQuery = useQuery(pluginQueries.installed())
  const profileQuery = useQuery({
    queryKey: companionKeys.profile(),
    queryFn: companionApi.profile,
    enabled: !disabled,
  })
  const pack = useMemo(
    () =>
      activePack(selectedPluginId, Array.isArray(installedQuery.data) ? installedQuery.data : []),
    [installedQuery.data, selectedPluginId],
  )
  const interactionMutation = useMutation({
    mutationFn: (interactionId: string) =>
      companionApi.interact({
        pluginId: pack.pluginId,
        interactionId,
        clientRevision: profileQuery.data?.revision,
      }),
    onSuccess: (receipt) => {
      queryClient.setQueryData(companionKeys.profile(), receipt.profile)
      try {
        const channel = new BroadcastChannel('soha-companion')
        channel.postMessage({ type: 'profile-updated' })
        channel.close()
      } catch {
        // BroadcastChannel is optional; React Query remains authoritative in this view.
      }
    },
  })

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel('soha-companion')
    channel.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: companionKeys.profile() })
    }
    return () => channel.close()
  }, [queryClient])

  const visualState = resolveCompanionVisualState({
    disabled,
    dragging,
    hovered,
    panelOpen,
    running,
    messages,
  })
  const speech = companionSpeech(messages, running)
  const profile = profileQuery.data

  const companion = (
    <div
      className="soha-companion"
      data-state={visualState}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {bubbleEnabled && speech ? (
        <button className="soha-companion__bubble" type="button" onClick={onOpenAssistant}>
          {speech}
        </button>
      ) : null}
      <button
        aria-label={disabled ? '没有 AI 助手权限' : '打开 AI 宠物助手'}
        className="soha-companion__model"
        disabled={disabled}
        type="button"
        onClick={() => {
          void interactionMutation.mutateAsync('tap').catch(() => undefined)
          onOpenAssistant()
        }}
      >
        <CompanionRenderer pack={pack} state={visualState} />
      </button>
      <div aria-label="宠物操作" className="soha-companion__actions" role="toolbar">
        <Button
          aria-label="摸摸宠物"
          disabled={disabled}
          icon={<HeartOutlined />}
          loading={interactionMutation.isPending}
          shape="circle"
          size="small"
          onClick={() => void interactionMutation.mutateAsync('pet').catch(() => undefined)}
        />
        <Button
          aria-label="打开助手"
          disabled={disabled}
          icon={<MessageOutlined />}
          shape="circle"
          size="small"
          onClick={onOpenAssistant}
        />
        <Button
          aria-label="分析当前页面"
          disabled={disabled}
          icon={<SearchOutlined />}
          shape="circle"
          size="small"
          onClick={() => onAction('analyze-page')}
        />
        <Button
          aria-label="打开完整 AI Workbench"
          icon={<ExpandAltOutlined />}
          shape="circle"
          size="small"
          onClick={onOpenWorkbench}
        />
      </div>
      {profile ? (
        <div
          aria-label={`等级 ${profile.level}，亲密度 ${profile.affinity}`}
          className="soha-companion__growth"
        >
          <span>Lv.{profile.level}</span>
          <span className="soha-companion__growth-track">
            <span style={{ width: `${Math.min(profile.xp % 100, 100)}%` }} />
          </span>
          <span>{profile.affinity}</span>
        </div>
      ) : null}
    </div>
  )

  if (nativeWindow) {
    return <div className="soha-companion-native-shell">{companion}</div>
  }

  return (
    <DraggableFloatShell
      className="soha-companion-shell"
      disabled={disabled}
      onDraggingChange={setDragging}
      shellSize={{ width: 176, height: 210 }}
      storageKey="soha.companion.float.position"
    >
      {companion}
    </DraggableFloatShell>
  )
}
