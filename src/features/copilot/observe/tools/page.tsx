import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { getAIModelSettingsPath, getAIWorkbenchPathForMode } from '../../workbench/navigation'
import { displayWorkbenchSessionTitle } from '../../workbench/model'
import {
  TOOLSET_BUDGET_FIELDS,
  buildDisabledToolOptions,
  canonicalDisabledToolNames,
  cleanToolsetPayload,
  countObjectKeys,
  numberRecord,
  recommendedAdapterIds,
  scopeOverrideState,
} from '../../workbench/toolset'
import type { WorkbenchSessionScope } from '../../workbench/types'
import { observeKeys } from '../keys'
import { observeMutations } from '../mutations'
import { observeQueries } from '../queries'
import '../../copilot-pages.css'

const { Paragraph, Text } = Typography

function buildScopeSummary(scope?: WorkbenchSessionScope) {
  if (!scope) return '未固定上下文'
  return (
    [scope.clusterId, scope.namespace, scope.workload || scope.service, scope.alertId]
      .filter(Boolean)
      .join(' / ') || '未固定上下文'
  )
}

export function AIToolsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedSessionId = searchParams.get('session') || undefined
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const [selectedAdapterIds, setSelectedAdapterIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [disabledToolNames, setDisabledToolNames] = useState<string[]>([])
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, number>>({})
  const [scopeOverrides, setScopeOverrides] = useState<Partial<WorkbenchSessionScope>>({})
  const catalogQuery = useQuery(observeQueries.tools.catalog())
  const sessionDetailQuery = useQuery(observeQueries.tools.session(requestedSessionId))

  const adapters = useMemo(() => catalogQuery.data?.adapters ?? [], [catalogQuery.data?.adapters])
  const dataSources = useMemo(
    () => catalogQuery.data?.dataSources ?? [],
    [catalogQuery.data?.dataSources],
  )
  const skills = useMemo(
    () => catalogQuery.data?.skillsRegistry ?? [],
    [catalogQuery.data?.skillsRegistry],
  )
  const currentSession = sessionDetailQuery.data
  const disabledToolOptions = useMemo(() => buildDisabledToolOptions(adapters), [adapters])
  const cleanedBudgetOverrides = useMemo(() => numberRecord(budgetOverrides), [budgetOverrides])
  const cleanedScopeOverrides = useMemo(() => scopeOverrideState(scopeOverrides), [scopeOverrides])
  const activeDataSourceAdapters = [
    ...new Set(
      dataSources
        .filter((item) => item.enabled)
        .map((item) => item.mcpAdapter)
        .filter(Boolean),
    ),
  ]
  const unavailableSelectedAdapterIds = selectedAdapterIds.filter(
    (adapterId) =>
      adapterId !== 'platform-native.v1' && !activeDataSourceAdapters.includes(adapterId),
  )

  useEffect(() => {
    setSelectedAdapterIds(currentSession?.metadata?.toolset?.enabledAdapterIds ?? [])
    setSelectedSkillIds(currentSession?.metadata?.toolset?.enabledSkillIds ?? [])
    setDisabledToolNames(
      canonicalDisabledToolNames(
        currentSession?.metadata?.toolset?.disabledToolNames ?? [],
        adapters,
      ),
    )
    setBudgetOverrides(numberRecord(currentSession?.metadata?.toolset?.budgetOverrides))
    setScopeOverrides(scopeOverrideState(currentSession?.metadata?.toolset?.scopeOverrides))
  }, [
    adapters,
    currentSession?.id,
    currentSession?.metadata?.toolset?.budgetOverrides,
    currentSession?.metadata?.toolset?.disabledToolNames,
    currentSession?.metadata?.toolset?.enabledAdapterIds,
    currentSession?.metadata?.toolset?.enabledSkillIds,
    currentSession?.metadata?.toolset?.scopeOverrides,
  ])

  const patchSessionMutation = useMutation({
    ...observeMutations.tools.patchSession(),
    onSuccess: async (_response, payload) => {
      await queryClient.invalidateQueries({ queryKey: observeKeys.tools.sessions() })
      await queryClient.invalidateQueries({
        queryKey: observeKeys.tools.session(payload.sessionId),
      })
      void message.success('会话级工具装配已更新')
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const setBudgetOverrideValue = (key: string, value: number | string | null) => {
    setBudgetOverrides((current) => {
      const next = { ...current }
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        next[key] = numberValue
      } else {
        delete next[key]
      }
      return next
    })
  }

  const setScopeOverrideValue = (key: keyof WorkbenchSessionScope, value: string) => {
    setScopeOverrides((current) => {
      const next = { ...current }
      const trimmed = value.trim()
      if (trimmed) {
        next[key] = trimmed as never
      } else {
        delete next[key]
      }
      return next
    })
  }

  const setScopeOverrideNumberValue = (
    key: keyof WorkbenchSessionScope,
    value: number | string | null,
  ) => {
    setScopeOverrides((current) => {
      const next = { ...current }
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        next[key] = numberValue as never
      } else {
        delete next[key]
      }
      return next
    })
  }

  const applyRecommendedToolset = () => {
    setSelectedAdapterIds(recommendedAdapterIds(adapters, dataSources))
    setSelectedSkillIds(skills.filter((item) => item.enabled).map((item) => item.id))
    setDisabledToolNames([])
    setBudgetOverrides({ timeoutSeconds: 60, maxEvidenceItems: 20 })
    setScopeOverrides({})
  }

  const clearToolset = () => {
    setSelectedAdapterIds([])
    setSelectedSkillIds([])
    setDisabledToolNames([])
    setBudgetOverrides({})
    setScopeOverrides({})
  }

  const saveToolset = () => {
    if (!requestedSessionId || !currentSession) return
    patchSessionMutation.mutate({
      sessionId: requestedSessionId,
      body: {
        toolset: cleanToolsetPayload({
          enabledAdapterIds: selectedAdapterIds,
          enabledSkillIds: selectedSkillIds,
          disabledToolNames: canonicalDisabledToolNames(disabledToolNames, adapters),
          budgetOverrides: cleanedBudgetOverrides,
          scopeOverrides: cleanedScopeOverrides,
        }),
      },
    })
  }

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="工具与技能"
        description="全局配置镜像与会话级装配入口，统一查看 MCP adapters、数据源和技能能力。"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="MCP Adapters">
            <List
              dataSource={adapters}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag>{item.sourceKind}</Tag>
                      </Space>
                    }
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Data Sources">
            <List
              dataSource={dataSources}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag>{item.backendType}</Tag>
                      </Space>
                    }
                    description={`${item.sourceKind} / ${item.mcpAdapter}`}
                  />
                  <StatusTag
                    value={item.validationStatus || (item.enabled ? 'enabled' : 'disabled')}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="会话级装配">
            {!requestedSessionId || !currentSession ? (
              <ManagementState
                bordered={false}
                compact
                kind="select-scope"
                title="未选择会话"
                description="先从左侧菜单进入一个会话，再配置工具装配。"
              />
            ) : (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Flex justify="space-between" align="start" gap={12} wrap="wrap">
                  <Space size={[8, 8]} wrap>
                    <Tag color="blue">{displayWorkbenchSessionTitle(currentSession.title)}</Tag>
                    <Tag>{currentSession.metadata?.mode || 'general'}</Tag>
                    <Tag>{buildScopeSummary(currentSession.metadata?.scope)}</Tag>
                    <Tag>
                      {selectedAdapterIds.length > 0
                        ? `${selectedAdapterIds.length} adapters`
                        : 'auto adapters'}
                    </Tag>
                    <Tag>{disabledToolNames.length} disabled tools</Tag>
                    <Tag>{countObjectKeys(cleanedBudgetOverrides)} budgets</Tag>
                  </Space>
                  <Space wrap>
                    <Button onClick={clearToolset}>恢复自动选择</Button>
                    <Button onClick={applyRecommendedToolset}>应用推荐预设</Button>
                    <Button
                      type="primary"
                      loading={patchSessionMutation.isPending}
                      onClick={saveToolset}
                    >
                      保存会话级装配
                    </Button>
                  </Space>
                </Flex>

                {unavailableSelectedAdapterIds.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="部分已选 adapter 当前没有启用数据源"
                    description={`${unavailableSelectedAdapterIds.join(', ')} 会保留在会话策略中，但运行时相关工具可能被跳过。`}
                  />
                ) : null}

                <Card size="small" title="Adapters 与工具">
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Select
                      mode="multiple"
                      allowClear
                      maxTagCount="responsive"
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="留空表示自动允许所有已注册 adapter"
                      value={selectedAdapterIds}
                      onChange={(value: string[]) => setSelectedAdapterIds(value)}
                      options={adapters.map((item) => ({
                        value: item.id,
                        label: `${item.name} (${item.sourceKind})`,
                      }))}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      maxTagCount="responsive"
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="选择要屏蔽的工具，保存为 adapter.tool"
                      value={disabledToolNames}
                      onChange={(value: string[]) =>
                        setDisabledToolNames(canonicalDisabledToolNames(value, adapters))
                      }
                      options={disabledToolOptions}
                    />
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      禁用工具会以 `adapter.tool` 形式保存，避免同名工具跨 adapter 被误屏蔽。
                    </Paragraph>
                  </Space>
                </Card>

                <Card size="small" title="Skills">
                  <Select
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    showSearch={{ optionFilterProp: 'label' }}
                    placeholder="选择会话级技能；留空表示沿用全局启用项"
                    value={selectedSkillIds}
                    onChange={(value: string[]) => setSelectedSkillIds(value)}
                    options={skills
                      .filter((item) => item.enabled)
                      .map((item) => ({ value: item.id, label: item.name }))}
                  />
                </Card>

                <Card size="small" title="Budget Overrides">
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {TOOLSET_BUDGET_FIELDS.map((field) => (
                      <Flex key={field.key} justify="space-between" align="center" gap={12}>
                        <span>
                          <Text strong>{field.label}</Text>
                          <Text type="secondary" style={{ display: 'block' }}>
                            {field.description}
                          </Text>
                        </span>
                        <InputNumber
                          min={0}
                          suffix={field.suffix}
                          value={budgetOverrides[field.key]}
                          onChange={(value) => setBudgetOverrideValue(field.key, value)}
                        />
                      </Flex>
                    ))}
                  </Space>
                </Card>

                <Card size="small" title="Scope Overrides">
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      title="Scope override 会叠加到当前会话范围"
                      description={`当前会话范围：${buildScopeSummary(currentSession.metadata?.scope)}`}
                    />
                    <Input
                      placeholder="Override cluster"
                      value={scopeOverrides.clusterId || ''}
                      onChange={(event) => setScopeOverrideValue('clusterId', event.target.value)}
                    />
                    <Input
                      placeholder="Override namespace"
                      value={scopeOverrides.namespace || ''}
                      onChange={(event) => setScopeOverrideValue('namespace', event.target.value)}
                    />
                    <Input
                      placeholder="Override workload"
                      value={scopeOverrides.workload || ''}
                      onChange={(event) => setScopeOverrideValue('workload', event.target.value)}
                    />
                    <Input
                      placeholder="Override service"
                      value={scopeOverrides.service || ''}
                      onChange={(event) => setScopeOverrideValue('service', event.target.value)}
                    />
                    <Input
                      placeholder="Override alert ID"
                      value={scopeOverrides.alertId || ''}
                      onChange={(event) => setScopeOverrideValue('alertId', event.target.value)}
                    />
                    <InputNumber
                      min={0}
                      suffix="minutes"
                      placeholder="Override time range"
                      value={scopeOverrides.timeRangeMinutes}
                      onChange={(value) => setScopeOverrideNumberValue('timeRangeMinutes', value)}
                    />
                  </Space>
                </Card>
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="Skills Registry">
            <List
              dataSource={skills}
              locale={{ emptyText: '暂无全局 skills 配置' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag>{item.id}</Tag>
                      </Space>
                    }
                    description={item.description || (item.scopes ?? []).join(', ')}
                  />
                  <StatusTag value={item.enabled ? 'enabled' : 'disabled'} />
                </List.Item>
              )}
            />
            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => navigate(getAIModelSettingsPath(searchParams))}>
                前往 AI 设置
              </Button>
              <Button
                type="primary"
                onClick={() =>
                  navigate(getAIWorkbenchPathForMode(currentSession?.metadata?.mode, searchParams))
                }
              >
                回到 AI 工作台
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
