import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { isApiError } from '@/services/api-error'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { SettingsAdminTable } from '../shared/components'
import { RuntimeConfigurationHistoryDrawer } from './components/history-detail-drawer'
import { RuntimeResourceOverview } from './components/resource-overview'
import { buildRuntimeConfigChanges, visibleRuntimeConfigItems } from './runtime-config-model'
import {
  AI_WORKBENCH_CONFIG_KEY,
  aiWorkbenchDraft,
  aiWorkbenchEnabled,
  isAIWorkbenchChildConfig,
  isAIWorkbenchConfig,
} from './ai-module-model'
import {
  computeModuleDraft,
  computeModuleState,
  isComputeChildConfig,
} from './compute-module-model'
import { runtimeConfigurationMutations } from './mutations'
import { runtimeConfigurationQueries } from './queries'
import type {
  RuntimeConfigApplyMode,
  RuntimeConfigChange,
  RuntimeConfigItem,
  RuntimeConfigRevision,
  RuntimeConfigSource,
  RuntimeConfigValidationResult,
  RuntimeConfigValue,
} from './types'
import './styles.css'

const { Text } = Typography

type RuntimeConfigurationTab = 'configuration' | 'resources' | 'history'

const APPLY_MODE_LABELS: Record<RuntimeConfigApplyMode, string> = {
  hot: '即时生效',
  reconfigure: '重建连接',
  lifecycle: '启停模块',
  restart: '需要重启',
}

const SOURCE_LABELS: Record<RuntimeConfigSource, string> = {
  default: '默认值',
  config_file: '配置文件',
  runtime_override: '运行时覆盖',
  environment: '环境变量',
  secret: 'Secret',
}

const COMPUTE_STATE_LABELS = {
  disabled: '已关闭',
  partial: '部分启用',
  enabled: '全部启用',
} as const

function displayValue(item: RuntimeConfigItem) {
  if (item.sensitive) return '********'
  if (item.effectiveValue === undefined) return '-'
  if (Array.isArray(item.effectiveValue)) return item.effectiveValue.join(', ')
  return String(item.effectiveValue)
}

function isLocked(item: RuntimeConfigItem) {
  return !item.editable || item.source === 'environment' || item.source === 'secret'
}

function ConfigValueEditor({
  disabled,
  item,
  onChange,
  value,
}: {
  disabled: boolean
  item: RuntimeConfigItem
  onChange: (value: RuntimeConfigValue) => void
  value: RuntimeConfigValue | undefined
}) {
  if (item.valueType === 'boolean') {
    return (
      <Switch
        aria-label={item.label || item.key}
        checked={Boolean(value)}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }
  if (item.valueType === 'integer' || item.valueType === 'number') {
    return (
      <InputNumber
        aria-label={item.label || item.key}
        disabled={disabled}
        precision={item.valueType === 'integer' ? 0 : undefined}
        value={typeof value === 'number' ? value : undefined}
        onChange={(next) => next !== null && onChange(next)}
      />
    )
  }
  if (item.valueType === 'string_list') {
    return (
      <Select
        aria-label={item.label || item.key}
        disabled={disabled}
        mode="tags"
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    )
  }
  return (
    <Input
      aria-label={item.label || item.key}
      disabled={disabled}
      placeholder={item.sensitive ? '输入新值' : undefined}
      type={item.sensitive ? 'password' : item.valueType === 'url' ? 'url' : 'text'}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function RuntimeConfigurationPage() {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canView = hasPermission(snapshot, 'settings.runtime-config.view')
  const canManage = hasPermission(snapshot, 'settings.runtime-config.manage')
  const [activeTab, setActiveTab] = useState<RuntimeConfigurationTab>('configuration')
  const snapshotQuery = useQuery(runtimeConfigurationQueries.snapshot(canView))
  const resourceQuery = useQuery(
    runtimeConfigurationQueries.resources(canView && activeTab === 'resources'),
  )
  const historyQuery = useQuery(runtimeConfigurationQueries.history(canView))
  const validateMutation = useMutation(runtimeConfigurationMutations.validate())
  const applyMutation = useMutation(runtimeConfigurationMutations.apply(queryClient))
  const rollbackMutation = useMutation(runtimeConfigurationMutations.rollback(queryClient))
  const [draft, setDraft] = useState<Record<string, RuntimeConfigValue>>({})
  const [resetKeys, setResetKeys] = useState<Set<string>>(() => new Set())
  const [validation, setValidation] = useState<RuntimeConfigValidationResult | null>(null)
  const [keyword, setKeyword] = useState('')
  const [applyMode, setApplyMode] = useState('')
  const [source, setSource] = useState('')
  const [reason, setReason] = useState('')
  const [activeRevision, setActiveRevision] = useState<RuntimeConfigRevision | null>(null)

  const runtimeSnapshot = snapshotQuery.data
  useEffect(() => {
    setDraft({})
    setResetKeys(new Set())
    setValidation(null)
  }, [runtimeSnapshot?.version])

  const changes = useMemo<RuntimeConfigChange[]>(() => {
    return buildRuntimeConfigChanges(draft, resetKeys, runtimeSnapshot?.items ?? [])
  }, [draft, resetKeys, runtimeSnapshot?.items])

  const updateDraft = (key: string, value: RuntimeConfigValue) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setResetKeys((current) => {
      if (!current.has(key)) return current
      const next = new Set(current)
      next.delete(key)
      return next
    })
    setValidation(null)
  }

  const updateDraftValues = (values: Record<string, RuntimeConfigValue>) => {
    const keys = Object.keys(values)
    setDraft((current) => ({ ...current, ...values }))
    setResetKeys((current) => {
      if (!keys.some((key) => current.has(key))) return current
      const next = new Set(current)
      keys.forEach((key) => next.delete(key))
      return next
    })
    setValidation(null)
  }

  const resetOverride = (key: string) => {
    setDraft((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setResetKeys((current) => new Set(current).add(key))
    setValidation(null)
  }

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return visibleRuntimeConfigItems(runtimeSnapshot?.items ?? []).filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [
          item.key,
          item.label,
          item.description,
          item.category,
          isComputeChildConfig(item.key) ? '计算资源工作台' : '',
          isAIWorkbenchConfig(item.key) ? 'AI 工作台' : '',
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
      return (
        matchesKeyword &&
        (!applyMode || item.applyMode === applyMode) &&
        (!source || item.source === source)
      )
    })
  }, [applyMode, keyword, runtimeSnapshot?.items, source])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, RuntimeConfigItem[]>()
    filteredItems.forEach((item) => {
      const category =
        isComputeChildConfig(item.key) || isAIWorkbenchConfig(item.key)
          ? '模块'
          : item.category || '其他配置'
      const group = groups.get(category) ?? []
      group.push(item)
      groups.set(category, group)
    })
    return Array.from(groups, ([category, items]) => ({ category, items }))
  }, [filteredItems])

  const computeItems = useMemo(
    () => (runtimeSnapshot?.items ?? []).filter((item) => isComputeChildConfig(item.key)),
    [runtimeSnapshot?.items],
  )
  const computeCurrentState = computeModuleState(computeItems, {})
  const computeDraftState = computeModuleState(computeItems, draft)
  const computeParentLocked =
    computeItems.length !== 2 || computeItems.some((item) => isLocked(item))
  const aiItems = useMemo(
    () => (runtimeSnapshot?.items ?? []).filter((item) => isAIWorkbenchConfig(item.key)),
    [runtimeSnapshot?.items],
  )
  const aiWorkbenchItem = aiItems.find((item) => item.key === AI_WORKBENCH_CONFIG_KEY)
  const aiWorkbenchDraftEnabled = aiWorkbenchEnabled(aiItems, draft)
  const aiWorkbenchLocked = !aiWorkbenchItem || isLocked(aiWorkbenchItem)

  const request = () => ({
    expectedVersion: runtimeSnapshot?.version ?? 0,
    changes,
    reason: reason.trim() || undefined,
  })

  const reportError = (error: unknown, fallback: string) => {
    if (isApiError(error) && error.status === 409) {
      void message.error('配置版本已变化，请刷新后重新提交。')
      void snapshotQuery.refetch()
      return
    }
    void message.error(error instanceof Error ? error.message : fallback)
  }

  const handleValidate = async () => {
    if (changes.length === 0) return
    try {
      const result = await validateMutation.mutateAsync(request())
      setValidation(result)
      if (result.valid) void message.success('配置校验通过')
    } catch (error) {
      reportError(error, '配置校验失败')
    }
  }

  const handleApply = () => {
    if (changes.length === 0) return
    modal.confirm({
      title: `应用 ${changes.length} 项配置变更？`,
      content: '系统会再次校验版本与配置。即时和模块配置将直接生效，需要重启的配置会标记为待重启。',
      okText: '应用配置',
      cancelText: '取消',
      onOk: async () => {
        try {
          const checked = await validateMutation.mutateAsync(request())
          setValidation(checked)
          if (!checked.valid) throw new Error('配置校验未通过，请先处理校验问题。')
          await applyMutation.mutateAsync(request())
          setReason('')
          void message.success('配置变更已提交')
        } catch (error) {
          reportError(error, '应用配置失败')
          throw error
        }
      },
    })
  }

  const handleRollback = (revision: RuntimeConfigRevision) => {
    modal.confirm({
      title: `回滚到版本 v${revision.version}？`,
      content: '回滚会创建新的配置版本，并按当前运行时规则应用。',
      okText: '确认回滚',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await rollbackMutation.mutateAsync({
            expectedVersion: runtimeSnapshot?.version ?? 0,
            targetVersion: revision.version,
            reason: `回滚到版本 v${revision.version}`,
          })
          setActiveRevision(null)
          void message.success(`已提交回滚到版本 v${revision.version}`)
        } catch (error) {
          reportError(error, '配置回滚失败')
          throw error
        }
      },
    })
  }

  if (!permissionQuery.isLoading && !canView) {
    return (
      <div className="soha-page">
        <Alert showIcon title="无权查看运行时配置" type="warning" />
      </div>
    )
  }

  const historyColumns: TableColumnsType<RuntimeConfigRevision> = [
    { title: '版本', dataIndex: 'version', width: 90, render: (value: number) => `v${value}` },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '变更数',
      dataIndex: 'changes',
      width: 100,
      render: (value: unknown[]) => value.length,
    },
    { title: '操作者', dataIndex: 'actor', width: 160 },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    {
      ...tableColumnPresets.datetime,
      title: '创建时间',
      dataIndex: 'createdAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.action,
      key: 'actions',
      render: (_, revision) => (
        <ManagementIconButton
          aria-label={`查看版本 v${revision.version}`}
          icon={<EyeOutlined />}
          tooltip="查看变更"
          onClick={() => setActiveRevision(revision)}
        />
      ),
    },
  ]

  const configurationView = (
    <>
      {runtimeSnapshot?.pendingRestart ? (
        <Alert
          className="soha-runtime-config-alert"
          showIcon
          title="存在等待重启生效的配置"
          description="运行中的进程仍使用旧值，请按部署方式完成滚动重启。"
          type="warning"
        />
      ) : null}
      {validation ? (
        <Alert
          className="soha-runtime-config-alert"
          showIcon
          title={validation.valid ? '校验通过' : '校验未通过'}
          description={
            validation.issues.length
              ? validation.issues
                  .map((issue) => `${issue.key ? `${issue.key}: ` : ''}${issue.message}`)
                  .join('；')
              : validation.requiresRestart
                ? '部分变更需要重启后生效。'
                : '所有变更均可提交。'
          }
          type={validation.valid ? (validation.requiresRestart ? 'warning' : 'success') : 'error'}
        />
      ) : null}
      <ManagementQueryPanel
        actions={
          <Button
            disabled={!keyword && !applyMode && !source}
            icon={<UndoOutlined />}
            onClick={() => {
              setKeyword('')
              setApplyMode('')
              setSource('')
            }}
          >
            重置筛选
          </Button>
        }
        onFinish={() => undefined}
      >
        <ManagementQueryField grow label="关键词" minWidth={260} width={320}>
          <Input allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </ManagementQueryField>
        <ManagementQueryField label="生效方式" width={180}>
          <Select
            allowClear
            options={Object.entries(APPLY_MODE_LABELS).map(([value, label]) => ({ value, label }))}
            value={applyMode || undefined}
            onChange={(value) => setApplyMode(value ?? '')}
          />
        </ManagementQueryField>
        <ManagementQueryField label="配置来源" width={180}>
          <Select
            allowClear
            options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
            value={source || undefined}
            onChange={(value) => setSource(value ?? '')}
          />
        </ManagementQueryField>
      </ManagementQueryPanel>
      <div className="soha-runtime-config-actionbar">
        <Input
          className="soha-runtime-config-reason"
          maxLength={1000}
          placeholder="变更原因（可选）"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <Space className="soha-runtime-config-actionbar__actions" size={8} wrap={false}>
          {canManage ? (
            <>
              <Button
                disabled={changes.length === 0}
                icon={<UndoOutlined />}
                onClick={() => {
                  setDraft({})
                  setResetKeys(new Set())
                  setValidation(null)
                }}
              >
                放弃草稿
              </Button>
              <Button
                disabled={changes.length === 0}
                icon={<CheckCircleOutlined />}
                loading={validateMutation.isPending}
                onClick={() => void handleValidate()}
              >
                校验
              </Button>
              <Button
                disabled={changes.length === 0}
                icon={<SaveOutlined />}
                loading={applyMutation.isPending}
                type="primary"
                onClick={handleApply}
              >
                应用 {changes.length} 项
              </Button>
            </>
          ) : null}
          <Button icon={<ReloadOutlined />} onClick={() => void snapshotQuery.refetch()}>
            刷新
          </Button>
        </Space>
      </div>
      <div className="soha-runtime-config-list">
        {snapshotQuery.isLoading ? (
          <div className="soha-runtime-config-list__state">正在读取最新配置...</div>
        ) : groupedItems.length === 0 ? (
          <Empty description="当前筛选条件下没有匹配的配置项" />
        ) : (
          groupedItems.map((group) => {
            const regularItems = group.items.filter(
              (item) => !isComputeChildConfig(item.key) && !isAIWorkbenchConfig(item.key),
            )
            const visibleComputeItems = group.items.filter((item) => isComputeChildConfig(item.key))
            const visibleAIItems = group.items.filter((item) => isAIWorkbenchConfig(item.key))
            const visibleAIParent = visibleAIItems.some(
              (item) => item.key === AI_WORKBENCH_CONFIG_KEY,
            )
            const visibleAIChildren = (visibleAIParent ? aiItems : visibleAIItems).filter((item) =>
              isAIWorkbenchChildConfig(item.key),
            )
            return (
              <section className="soha-runtime-config-group" key={group.category}>
                <div className="soha-runtime-config-group__header">
                  <Text strong>{group.category}</Text>
                  <Text type="secondary">{group.items.length} 项配置</Text>
                </div>
                <div className="soha-runtime-config-group__items">
                  {aiWorkbenchItem && visibleAIItems.length > 0 ? (
                    <Collapse
                      bordered={false}
                      className="soha-runtime-config-branch"
                      defaultActiveKey={['ai-workbench']}
                      items={[
                        {
                          key: 'ai-workbench',
                          label: (
                            <div className="soha-runtime-config-branch__header">
                              <div className="soha-runtime-config-item__info">
                                <Text strong>{aiWorkbenchItem.label || 'AI 工作台'}</Text>
                                <Text type="secondary">1 个功能</Text>
                              </div>
                              <div className="soha-runtime-config-item__effective">
                                <Text type="secondary">当前值</Text>
                                <Text code>{displayValue(aiWorkbenchItem)}</Text>
                              </div>
                              <div
                                className="soha-runtime-config-item__editor"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Text type="secondary">新值</Text>
                                <Switch
                                  aria-label="AI 工作台"
                                  checked={aiWorkbenchDraftEnabled}
                                  disabled={
                                    !canManage || aiWorkbenchLocked || applyMutation.isPending
                                  }
                                  onChange={(enabled) => {
                                    updateDraftValues(aiWorkbenchDraft(enabled))
                                  }}
                                />
                              </div>
                              <div className="soha-runtime-config-item__meta">
                                {aiWorkbenchItem.source === 'runtime_override' ? (
                                  <Button
                                    disabled={!canManage || applyMutation.isPending}
                                    icon={<UndoOutlined />}
                                    size="small"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      resetOverride(aiWorkbenchItem.key)
                                    }}
                                  >
                                    移除覆盖
                                  </Button>
                                ) : null}
                                <MetadataTag label={SOURCE_LABELS[aiWorkbenchItem.source]} />
                                <MetadataTag
                                  label={APPLY_MODE_LABELS[aiWorkbenchItem.applyMode]}
                                  tone="blue"
                                />
                                <StatusTag
                                  value={isLocked(aiWorkbenchItem) ? 'locked' : 'active'}
                                />
                              </div>
                            </div>
                          ),
                          children: (
                            <div className="soha-runtime-config-branch__children">
                              {visibleAIChildren.map((item) => (
                                <article className="soha-runtime-config-item" key={item.key}>
                                  <div className="soha-runtime-config-item__info">
                                    <Text strong>{item.label || item.key}</Text>
                                    <Text code>{item.key}</Text>
                                    {item.description ? (
                                      <Text type="secondary">{item.description}</Text>
                                    ) : null}
                                  </div>
                                  <div className="soha-runtime-config-item__effective">
                                    <Text type="secondary">当前值</Text>
                                    <Text code>{displayValue(item)}</Text>
                                  </div>
                                  <div className="soha-runtime-config-item__editor">
                                    <Text type="secondary">新值</Text>
                                    <ConfigValueEditor
                                      disabled={
                                        !canManage ||
                                        !aiWorkbenchDraftEnabled ||
                                        isLocked(item) ||
                                        applyMutation.isPending
                                      }
                                      item={item}
                                      value={draft[item.key] ?? item.effectiveValue}
                                      onChange={(value) => {
                                        updateDraft(item.key, value)
                                      }}
                                    />
                                  </div>
                                  <div className="soha-runtime-config-item__meta">
                                    {item.source === 'runtime_override' ? (
                                      <Button
                                        disabled={!canManage || applyMutation.isPending}
                                        icon={<UndoOutlined />}
                                        size="small"
                                        onClick={() => resetOverride(item.key)}
                                      >
                                        移除覆盖
                                      </Button>
                                    ) : null}
                                    <MetadataTag label="依赖 AI 工作台" tone="cyan" />
                                    <MetadataTag label={SOURCE_LABELS[item.source]} />
                                    <MetadataTag
                                      label={APPLY_MODE_LABELS[item.applyMode]}
                                      tone="blue"
                                    />
                                    <StatusTag value={isLocked(item) ? 'locked' : 'active'} />
                                  </div>
                                </article>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  ) : null}
                  {regularItems.map((item) => (
                    <article className="soha-runtime-config-item" key={item.key}>
                      <div className="soha-runtime-config-item__info">
                        <Text strong>{item.label || item.key}</Text>
                        <Text code>{item.key}</Text>
                        {item.description ? <Text type="secondary">{item.description}</Text> : null}
                      </div>
                      <div className="soha-runtime-config-item__effective">
                        <Text type="secondary">当前值</Text>
                        <Text code>{displayValue(item)}</Text>
                      </div>
                      <div className="soha-runtime-config-item__editor">
                        <Text type="secondary">新值</Text>
                        <ConfigValueEditor
                          disabled={!canManage || isLocked(item) || applyMutation.isPending}
                          item={item}
                          value={
                            draft[item.key] ?? (item.sensitive ? undefined : item.effectiveValue)
                          }
                          onChange={(value) => {
                            updateDraft(item.key, value)
                          }}
                        />
                      </div>
                      <div className="soha-runtime-config-item__meta">
                        {item.source === 'runtime_override' ? (
                          <Button
                            disabled={!canManage || applyMutation.isPending}
                            icon={<UndoOutlined />}
                            size="small"
                            onClick={() => resetOverride(item.key)}
                          >
                            移除覆盖
                          </Button>
                        ) : null}
                        <MetadataTag label={SOURCE_LABELS[item.source]} />
                        <MetadataTag
                          label={APPLY_MODE_LABELS[item.applyMode]}
                          tone={item.applyMode === 'restart' ? 'orange' : 'blue'}
                        />
                        <StatusTag
                          value={
                            item.pendingRestart
                              ? 'restart_required'
                              : isLocked(item)
                                ? 'locked'
                                : 'active'
                          }
                        />
                      </div>
                    </article>
                  ))}
                  {visibleComputeItems.length > 0 ? (
                    <Collapse
                      bordered={false}
                      className="soha-runtime-config-branch"
                      defaultActiveKey={['compute']}
                      items={[
                        {
                          key: 'compute',
                          label: (
                            <div className="soha-runtime-config-branch__header">
                              <div className="soha-runtime-config-item__info">
                                <Text strong>计算资源工作台</Text>
                                <Text type="secondary">2 个子模块</Text>
                              </div>
                              <div className="soha-runtime-config-item__effective">
                                <Text type="secondary">当前值</Text>
                                <Text>{COMPUTE_STATE_LABELS[computeCurrentState]}</Text>
                              </div>
                              <div
                                className="soha-runtime-config-item__editor"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Text type="secondary">批量设置</Text>
                                <Checkbox
                                  aria-label="计算资源工作台"
                                  checked={computeDraftState === 'enabled'}
                                  disabled={
                                    !canManage || computeParentLocked || applyMutation.isPending
                                  }
                                  indeterminate={computeDraftState === 'partial'}
                                  onChange={(event) => {
                                    updateDraftValues(computeModuleDraft(event.target.checked))
                                  }}
                                >
                                  {COMPUTE_STATE_LABELS[computeDraftState]}
                                </Checkbox>
                              </div>
                              <div className="soha-runtime-config-item__meta">
                                <MetadataTag label="派生状态" />
                                <MetadataTag label="批量联动" tone="cyan" />
                              </div>
                            </div>
                          ),
                          children: (
                            <div className="soha-runtime-config-branch__children">
                              {visibleComputeItems.map((item) => (
                                <article className="soha-runtime-config-item" key={item.key}>
                                  <div className="soha-runtime-config-item__info">
                                    <Text strong>{item.label || item.key}</Text>
                                    <Text code>{item.key}</Text>
                                    {item.description ? (
                                      <Text type="secondary">{item.description}</Text>
                                    ) : null}
                                  </div>
                                  <div className="soha-runtime-config-item__effective">
                                    <Text type="secondary">当前值</Text>
                                    <Text code>{displayValue(item)}</Text>
                                  </div>
                                  <div className="soha-runtime-config-item__editor">
                                    <Text type="secondary">新值</Text>
                                    <ConfigValueEditor
                                      disabled={
                                        !canManage || isLocked(item) || applyMutation.isPending
                                      }
                                      item={item}
                                      value={draft[item.key] ?? item.effectiveValue}
                                      onChange={(value) => {
                                        updateDraft(item.key, value)
                                      }}
                                    />
                                  </div>
                                  <div className="soha-runtime-config-item__meta">
                                    {item.source === 'runtime_override' ? (
                                      <Button
                                        disabled={!canManage || applyMutation.isPending}
                                        icon={<UndoOutlined />}
                                        size="small"
                                        onClick={() => resetOverride(item.key)}
                                      >
                                        移除覆盖
                                      </Button>
                                    ) : null}
                                    <MetadataTag label={SOURCE_LABELS[item.source]} />
                                    <MetadataTag
                                      label={APPLY_MODE_LABELS[item.applyMode]}
                                      tone={item.applyMode === 'restart' ? 'orange' : 'blue'}
                                    />
                                    <StatusTag value={isLocked(item) ? 'locked' : 'active'} />
                                  </div>
                                </article>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  ) : null}
                </div>
              </section>
            )
          })
        )}
      </div>
    </>
  )

  const historyView = (
    <SettingsAdminTable
      columns={historyColumns}
      dataSource={historyQuery.data ?? []}
      loading={historyQuery.isLoading}
      pageSize={20}
      rowKey="id"
    />
  )

  const resourceView = <RuntimeResourceOverview query={resourceQuery} />

  return (
    <div className="soha-page soha-runtime-config-page">
      <Tabs
        activeKey={activeTab}
        className="soha-resource-tabs"
        items={[
          { key: 'configuration', label: '运行时配置', children: configurationView },
          { key: 'resources', label: '服务资源', children: resourceView },
          { key: 'history', label: '变更历史', children: historyView },
        ]}
        onChange={(key) => setActiveTab(key as RuntimeConfigurationTab)}
      />
      <RuntimeConfigurationHistoryDrawer
        canRollback={canManage && activeRevision?.version !== runtimeSnapshot?.version}
        items={runtimeSnapshot?.items ?? []}
        open={Boolean(activeRevision)}
        revision={activeRevision}
        rollingBack={rollbackMutation.isPending}
        onClose={() => setActiveRevision(null)}
        onRollback={handleRollback}
      />
    </div>
  )
}
