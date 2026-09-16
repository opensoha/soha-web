import type { WorkbenchAgentProvider, WorkbenchMode } from '../types'
import { agentUnavailableReason } from '../agent-selection'
import { useMemo, useState, type RefObject, type ReactNode } from 'react'
import { Button, Popover, Select, Tooltip, Tabs } from 'antd'
import type {
  WorkbenchModelPreferences,
  WorkbenchModelOption,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { Sender, Suggestion } from '@ant-design/x'
import type { SenderRef } from '@ant-design/x/es/sender'
import { CHAT_COMMANDS, matchingCommands, replaceSlashToken } from '../composer-commands'

export function WorkbenchComposer({
  agentProviders,
  agentProviderId,
  agentMode,
  onAgentChange,
  preferences,
  onPreferencesChange,
  modelOptions,
  defaultPublicModel,
  modelError,
  modelSelectionEnabled,
  contextSummary,
  usedContextSummary = [],
  contextControls,
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  loading,
  senderRef,
  resetVersion,
  onTools,
  onContext,
  onSettings,
  onSession,
}: {
  agentProviders: WorkbenchAgentProvider[]
  agentProviderId: string
  agentMode: WorkbenchMode
  onAgentChange: (id: string) => void
  preferences: WorkbenchModelPreferences
  onPreferencesChange: (value: WorkbenchModelPreferences) => void
  modelOptions: WorkbenchModelOption[]
  defaultPublicModel?: string
  modelError?: string
  modelSelectionEnabled: boolean
  contextSummary: { label: string; value: string }[]
  usedContextSummary?: { label: string; value: string }[]
  contextControls?: ReactNode
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel: () => void
  disabled: boolean
  loading: boolean
  senderRef: RefObject<SenderRef>
  resetVersion: number
  onTools: () => void
  onContext: () => void
  onSettings: () => void
  onSession: (id?: string) => void
}) {
  const effectiveModel = preferences.publicModel || defaultPublicModel
  const efforts =
    modelOptions.find((item) => item.publicModel === effectiveModel)?.reasoningEfforts ?? []
  const effortLabels = { auto: '自动', low: '轻度', medium: '标准', high: '深度' }
  const controlsDisabled = disabled || loading || !modelSelectionEnabled
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => matchingCommands(value), [value])
  const items = useMemo(
    () =>
      matches.map((item) => ({
        value: item.value,
        label: item.label,
        icon: item.icon,
        extra: `/${item.value}`,
      })),
    [matches],
  )
  const menuOpen = open && matches.length > 0 && !disabled && !loading

  return (
    <div className="soha-ai-workbench__composer">
      {contextControls}
      <Suggestion
        block
        open={menuOpen}
        onOpenChange={setOpen}
        items={items}
        onSelect={(key) => {
          const command = CHAT_COMMANDS.find((item) => item.value === key)
          if (!command) return
          onChange(replaceSlashToken(value, 'prompt' in command ? command.prompt : ''))
          setOpen(false)
          if ('action' in command) {
            if (command.action === 'session') onSession()
            else if (command.action === 'tools') onTools()
            else if (command.action === 'context') onContext()
            else onSettings()
          } else senderRef.current?.focus()
        }}
      >
        {({ onKeyDown }) => (
          <Sender
            key={resetVersion}
            ref={senderRef}
            autoSize={{ minRows: 4, maxRows: 12 }}
            placeholder="提问，或输入 / 选择功能"
            value={value}
            disabled={disabled}
            loading={loading}
            onChange={(next) => {
              onChange(next)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                event.stopPropagation()
                return false
              }
              onKeyDown(event)
              if (menuOpen && event.key === 'Enter') return false
            }}
            onSubmit={(text) => {
              if (menuOpen) return
              const reference = text.trim().match(/^\/session\s+(\S+)(?:\s+([\s\S]*))?$/)
              if (reference) {
                onChange(reference[2] || '')
                onSession(reference[1])
              } else onSubmit(text)
            }}
            onCancel={onCancel}
            suffix={false}
            footer={(_, { components: { SendButton, LoadingButton } }) => (
              <div className="soha-ai-workbench__composer-footer">
                <Select
                  aria-label="选择助手"
                  variant="borderless"
                  value={agentProviderId}
                  disabled={disabled || loading}
                  popupMatchSelectWidth={false}
                  options={agentProviders.map((provider) => {
                    const reason = agentUnavailableReason(provider, agentMode)
                    return {
                      value: provider.id,
                      label:
                        provider.id === 'internal'
                          ? '模型直连（兼容）'
                          : `${provider.name}${reason ? ` · ${reason}` : ''}`,
                      disabled: !!reason,
                    }
                  })}
                  onChange={onAgentChange}
                />
                {modelSelectionEnabled ? (
                  <>
                    <Tooltip
                      title={
                        modelError ||
                        (!modelSelectionEnabled
                          ? '当前 Agent 或分析模式自行管理模型'
                          : modelOptions.length
                            ? '选择本会话模型'
                            : '暂无可用模型，请先配置模型路由')
                      }
                    >
                      <Select
                        aria-label="选择模型"
                        variant="borderless"
                        value={preferences.publicModel || ''}
                        disabled={controlsDisabled || !!modelError || modelOptions.length === 0}
                        options={[
                          {
                            value: '',
                            label: defaultPublicModel ? `默认 · ${defaultPublicModel}` : '默认模型',
                          },
                          ...modelOptions.map((item) => ({
                            value: item.publicModel,
                            label: item.publicModel,
                          })),
                        ]}
                        onChange={(publicModel) =>
                          onPreferencesChange({ publicModel, reasoningEffort: 'auto' })
                        }
                        popupMatchSelectWidth={false}
                        className="soha-ai-workbench__model-select"
                      />
                    </Tooltip>
                    <Tooltip title={efforts.length ? '思考强度' : '当前模型未声明支持调整思考强度'}>
                      <Select
                        aria-label="思考强度"
                        variant="borderless"
                        value={preferences.reasoningEffort || 'auto'}
                        disabled={
                          controlsDisabled ||
                          (efforts.length === 0 &&
                            (!preferences.reasoningEffort ||
                              preferences.reasoningEffort === 'auto'))
                        }
                        options={['auto' as const, ...efforts].map((value) => ({
                          value,
                          label: effortLabels[value],
                        }))}
                        onChange={(reasoningEffort) =>
                          onPreferencesChange({ ...preferences, reasoningEffort })
                        }
                        popupMatchSelectWidth={false}
                      />
                    </Tooltip>
                  </>
                ) : (
                  <span className="soha-ai-workbench__managed-model">模型由助手管理</span>
                )}
                <Popover
                  trigger="click"
                  placement="topRight"
                  title="上下文背景"
                  content={
                    <div className="soha-ai-workbench__context-popover">
                      <Tabs
                        items={[
                          { key: 'next', label: '下次发送', children: contextRows(contextSummary) },
                          {
                            key: 'used',
                            label: '最近实际使用',
                            children: usedContextSummary.length ? (
                              contextRows(usedContextSummary)
                            ) : (
                              <p>尚无实际使用快照。</p>
                            ),
                          },
                        ]}
                      />
                      <p>模型完整输入用量未知。圆环仅作为入口；证据预算与模型窗口分开计量。</p>
                      <Button type="link" onClick={onContext}>
                        查看上下文详情
                      </Button>
                    </div>
                  }
                >
                  <Button
                    type="text"
                    icon={
                      <svg
                        className="soha-ai-workbench__context-ring"
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="10"
                          cy="10"
                          r="7.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          opacity="0.5"
                        />
                      </svg>
                    }
                    aria-label="上下文背景信息"
                  />
                </Popover>
                {loading ? <LoadingButton /> : <SendButton />}
              </div>
            )}
          />
        )}
      </Suggestion>
    </div>
  )
}

function contextRows(items: { label: string; value: string }[]) {
  return (
    <dl>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
