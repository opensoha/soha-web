import { useState } from 'react'
import {
  ArrowRightOutlined,
  CodeOutlined,
  FileTextOutlined,
  RocketOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { DeliveryGatewayReadinessPanel } from '../delivery-gateway-readiness'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import { DeliveryTable } from '../delivery-table'
import type {
  DeliveryApplication,
  DeliveryBlueprint,
  DeliveryDraft,
  DeliveryDraftConfirmResult,
  DeliveryDraftInput,
  ReleaseBoardEntry,
  RenderedDeliverySpec,
} from '../types'
import { ActionCards, ManualModeAlert, sortByLatest, StatCards, WorkbenchHeader } from './shared'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

interface OnboardingRow {
  app: DeliveryApplication
  bindings: ReleaseBoardEntry[]
  buildSourceCount: number
  nextStep: {
    color: string
    label: string
  }
  serviceClues: number
  targetCount: number
}

interface OnboardingDraftFormValues {
  appGroup?: string
  appKey?: string
  appName?: string
  blueprintId?: string
  clusterId?: string
  defaultBranch?: string
  environmentKey?: string
  language?: string
  namespace?: string
  repositoryPath?: string
  serviceKey?: string
  serviceName?: string
  workloadName?: string
}

function OnboardingBoundaryCards() {
  const items = [
    {
      label: '应用档案',
      value: '项目 / 产品边界',
      description: '承载权限、业务线、仓库默认信息和一组服务组件。',
    },
    {
      label: '服务组件',
      value: '构建 / 部署 / 验证单元',
      description: '每个组件可以有独立构建源、容器、目标工作负载和验证规则。',
    },
    {
      label: '环境绑定',
      value: '交付目标',
      description: '把服务组件绑定到环境、发布目标和发布流程模板。审批由流程模板节点配置。',
    },
    {
      label: 'DeliveryDraft',
      value: '统一接入草稿',
      description: '手工配置与 AI 生成都先进入草稿预览，确认后再创建平台对象。',
    },
  ]

  return (
    <div className="soha-delivery-onboarding-boundary">
      <div className="soha-delivery-onboarding-boundary__title">
        <Text strong>接入对象边界</Text>
        <Text type="secondary">
          应用中心不是流程向导，应用接入负责把项目下的服务组件补齐为交付对象。
        </Text>
      </div>
      {items.map((item) => (
        <Card key={item.label} className="soha-delivery-onboarding-boundary__item" size="small">
          <Text type="secondary">{item.label}</Text>
          <Text strong>{item.value}</Text>
          <Text type="secondary">{item.description}</Text>
        </Card>
      ))}
    </div>
  )
}

function summarizeApplicationRepository(app: DeliveryApplication) {
  return app.repositoryPath || app.repositoryProjectId || app.repositoryProvider || '-'
}

function summarizeBuildSources(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  const sourceNames = [
    ...(app.buildSources ?? []).map((item) => item.name || item.type),
    ...bindings.map((item) => item.buildSource?.name || item.buildSourceId).filter(Boolean),
  ]
  const uniqueSources = Array.from(new Set(sourceNames.filter(Boolean)))
  return uniqueSources.length > 0 ? uniqueSources.join(' / ') : '-'
}

function summarizeEnvironmentBindings(bindings: ReleaseBoardEntry[]) {
  const environments = Array.from(
    new Set(bindings.map((item) => item.environmentName || item.environmentKey).filter(Boolean)),
  )
  return environments.length > 0 ? environments.join(' / ') : '待绑定'
}

function countReleaseTargets(bindings: ReleaseBoardEntry[]) {
  return bindings.reduce((sum, item) => sum + (item.targets?.length ?? 0), 0)
}

function summarizeOnboardingNextStep(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  if ((app.buildSources?.length ?? 0) === 0) return { color: 'warning', label: '补构建源' }
  if (bindings.length === 0) return { color: 'warning', label: '绑定环境' }
  if (countReleaseTargets(bindings) === 0) {
    return { color: 'processing', label: '补发布目标' }
  }
  return { color: 'success', label: '可进入交付' }
}

function slugFrom(value: unknown, fallback: string) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function buildManualDeliveryDraftPayload(
  values: OnboardingDraftFormValues,
  blueprint?: DeliveryBlueprint,
): DeliveryDraftInput {
  const appKey = slugFrom(
    values.appKey || values.appName || blueprint?.applicationDraft?.key,
    'sample-app',
  )
  const appName = String(values.appName || blueprint?.applicationDraft?.name || appKey).trim()
  const serviceKey = slugFrom(values.serviceKey || appKey, appKey)
  const serviceName = String(values.serviceName || appName).trim()
  const defaultBranch = String(
    values.defaultBranch || blueprint?.applicationDraft?.defaultBranch || 'main',
  ).trim()
  const repositoryPath = String(
    values.repositoryPath || blueprint?.applicationDraft?.repositoryPath || '',
  ).trim()
  const buildSourceId = blueprint?.buildSources?.[0]?.id || 'source-1'
  const environmentKey = String(
    values.environmentKey || blueprint?.environmentBindings?.[0]?.environmentKey || 'dev',
  ).trim()
  const clusterId = String(values.clusterId || '').trim()
  const namespace = String(values.namespace || '').trim()
  const workloadName = String(values.workloadName || serviceKey).trim()

  return {
    source: blueprint ? 'blueprint' : 'manual',
    applicationDraft: {
      ...(blueprint?.applicationDraft ?? {}),
      name: appName,
      key: appKey,
      group: String(values.appGroup || blueprint?.applicationDraft?.group || 'default').trim(),
      language: String(values.language || blueprint?.applicationDraft?.language || 'go').trim(),
      repositoryPath: repositoryPath || undefined,
      defaultBranch,
      enabled: true,
      metadata: blueprint?.applicationDraft?.metadata ?? {},
    },
    services: [
      {
        key: serviceKey,
        name: serviceName,
        serviceKind: 'kubernetes_workload',
        repositoryPath: repositoryPath || undefined,
        defaultBranch,
        buildSourceId,
        enabled: true,
        metadata: {},
        containers: [
          {
            name: serviceKey,
            imageRepository: '',
            dockerfilePath: blueprint?.applicationDraft?.dockerfilePath || 'Dockerfile',
            buildContextDir: blueprint?.applicationDraft?.buildContextDir || '.',
            metadata: {},
          },
        ],
      },
    ],
    buildSources: blueprint?.buildSources?.length
      ? blueprint.buildSources
      : [
          {
            id: buildSourceId,
            name: 'Repo Dockerfile',
            type: 'repo_dockerfile',
            enabled: true,
            isDefault: true,
            config: {
              contextDir: blueprint?.applicationDraft?.buildContextDir || '.',
              dockerfilePath: blueprint?.applicationDraft?.dockerfilePath || 'Dockerfile',
            },
          },
        ],
    environmentBindings: [
      {
        ...(blueprint?.environmentBindings?.[0] ?? {}),
        environmentKey,
        buildPolicy: {
          ...(blueprint?.environmentBindings?.[0]?.buildPolicy ?? {}),
          sourceId: buildSourceId,
          refType: 'branch',
          refValue: defaultBranch,
        },
        releasePolicy: {
          ...(blueprint?.environmentBindings?.[0]?.releasePolicy ?? {}),
          actionKind: 'deploy',
          requiresApproval:
            blueprint?.environmentBindings?.[0]?.releasePolicy?.requiresApproval ?? false,
          verificationMode: 'workflow',
        },
        targets:
          clusterId && namespace && workloadName
            ? [
                {
                  id: 'target-1',
                  clusterId,
                  namespace,
                  workloadKind: 'Deployment',
                  workloadName,
                  containerName: serviceKey,
                  enabled: true,
                },
              ]
            : (blueprint?.environmentBindings?.[0]?.targets ?? []),
      },
    ],
    files: blueprint?.files ?? [],
    executionHints: {
      ...(blueprint?.executionHints ?? {}),
      onboardingMode: 'manual',
    },
    postCreateActions: blueprint?.postCreateActions ?? ['render_spec'],
  }
}

function specFromDraft(draft: DeliveryDraft): RenderedDeliverySpec {
  return {
    applicationDraft: draft.applicationDraft,
    services: draft.services,
    buildSources: draft.buildSources,
    environmentBindings: draft.environmentBindings,
    files: draft.files,
    executionHints: draft.executionHints,
    postCreateActions: draft.postCreateActions,
  }
}

function DeliveryDraftPreview({ spec }: { spec: RenderedDeliverySpec | null }) {
  if (!spec) {
    return (
      <ManagementState
        bordered={false}
        compact
        title="暂无草稿"
        description="生成 DeliveryDraft 后可在这里确认将创建或更新的对象。"
      />
    )
  }

  return (
    <div className="soha-delivery-draft-preview">
      <Card size="small" title="应用档案">
        <Space orientation="vertical" size={2}>
          <Text strong>{spec.applicationDraft?.name || '-'}</Text>
          <Text type="secondary">
            {spec.applicationDraft?.key || '-'} / {spec.applicationDraft?.group || '-'}
          </Text>
          <Text type="secondary">
            {spec.applicationDraft?.repositoryPath ||
              spec.applicationDraft?.repositoryProjectId ||
              '未填写仓库'}
          </Text>
        </Space>
      </Card>
      <Card size="small" title="服务组件">
        <Space size={6} wrap>
          {(spec.services ?? []).map((service) => (
            <Tag key={service.key}>{service.name || service.key}</Tag>
          ))}
          {(spec.services?.length ?? 0) === 0 ? <Text type="secondary">未配置服务组件</Text> : null}
        </Space>
      </Card>
      <Card size="small" title="构建源">
        <Space size={6} wrap>
          {(spec.buildSources ?? []).map((source) => (
            <Tag key={source.id}>{source.name || source.type}</Tag>
          ))}
          {(spec.buildSources?.length ?? 0) === 0 ? (
            <Text type="secondary">未配置构建源</Text>
          ) : null}
        </Space>
      </Card>
      <Card size="small" title="环境绑定">
        <Space size={6} wrap>
          {(spec.environmentBindings ?? []).map((binding, index) => (
            <Tag key={`${binding.environmentId || binding.environmentKey || index}`}>
              {binding.environmentKey || binding.environmentId || '未映射环境'}
            </Tag>
          ))}
          {(spec.environmentBindings?.length ?? 0) === 0 ? (
            <Text type="secondary">未配置环境绑定</Text>
          ) : null}
        </Space>
      </Card>
      <Card size="small" title="规范文件">
        <Space size={6} wrap>
          {(spec.files ?? []).map((file) => (
            <Tag key={file.path}>
              {file.kind}: {file.path}
            </Tag>
          ))}
          {(spec.files?.length ?? 0) === 0 ? (
            <Text type="secondary">未附带规范文件草稿</Text>
          ) : null}
        </Space>
      </Card>
      <Card size="small" title="流程提示">
        <pre className="soha-json-block">{JSON.stringify(spec.executionHints ?? {}, null, 2)}</pre>
      </Card>
    </div>
  )
}

export function DeliveryOnboardingPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<OnboardingDraftFormValues>()
  const [draftModalVisible, setDraftModalVisible] = useState(false)
  const [createdDraft, setCreatedDraft] = useState<DeliveryDraft | null>(null)
  const [confirmedResult, setConfirmedResult] = useState<DeliveryDraftConfirmResult | null>(null)
  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const blueprintsQuery = useQuery(deliveryQueries.blueprints.list())
  const releaseBoardQuery = useQuery(deliveryQueries.releaseBoard.list())
  const createDraftMutation = useMutation(deliveryMutations.drafts.create(queryClient))
  const confirmDraftMutation = useMutation(deliveryMutations.drafts.confirm(queryClient))

  const applications = applicationsQuery.data ?? []
  const blueprints = blueprintsQuery.data ?? []
  const board = releaseBoardQuery.data ?? []
  const enabledBlueprints = blueprints.filter((item) => item.enabled)
  const boardByApplication = board.reduce<Record<string, ReleaseBoardEntry[]>>((acc, entry) => {
    acc[entry.applicationId] = [...(acc[entry.applicationId] ?? []), entry]
    return acc
  }, {})
  const onboardingRows: OnboardingRow[] = sortByLatest(applications, (item) => item.updatedAt)
    .map((app) => {
      const bindings = boardByApplication[app.id] ?? []
      const buildSourceCount = app.buildSources?.length ?? 0
      const targetCount = countReleaseTargets(bindings)
      return {
        app,
        bindings,
        buildSourceCount,
        serviceClues: Math.max(
          buildSourceCount,
          bindings.length,
          targetCount,
          app.environmentCount ?? 0,
        ),
        targetCount,
        nextStep: summarizeOnboardingNextStep(app, bindings),
      }
    })
    .slice(0, 8)
  const needsCompletion = onboardingRows.filter((item) => item.nextStep.color !== 'success').length
  const onboardingStats = [
    { label: '应用档案', value: applications.length, hint: '作为项目 / 产品边界' },
    {
      label: '服务线索',
      value: onboardingRows.reduce((sum, item) => sum + item.serviceClues, 0),
      hint: '来自构建源、环境和目标',
    },
    {
      label: '接入模板',
      value: enabledBlueprints.length,
      hint: `${blueprints.length - enabledBlueprints.length} 个未启用模板`,
    },
    { label: '待补齐', value: needsCompletion, hint: '缺构建源、环境或发布目标' },
  ]

  const loading =
    applicationsQuery.isLoading || blueprintsQuery.isLoading || releaseBoardQuery.isLoading
  const selectedBlueprintId = Form.useWatch('blueprintId', form)
  const selectedBlueprint = selectedBlueprintId
    ? blueprints.find((item) => item.id === selectedBlueprintId)
    : undefined

  const onboardingColumns: ColumnProps<OnboardingRow>[] = [
    {
      title: '项目 / 应用',
      dataIndex: ['app', 'name'],
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.app.name}</Text>
          <Text type="secondary">{record.app.key}</Text>
        </Space>
      ),
    },
    {
      title: '仓库',
      dataIndex: ['app', 'repositoryPath'],
      render: (_value, record) => summarizeApplicationRepository(record.app),
    },
    {
      title: '服务线索',
      dataIndex: 'serviceClues',
      render: (value, record) => (
        <Space size={6} wrap>
          <Tag>{value} 个</Tag>
          <Tag>{record.buildSourceCount} 构建源</Tag>
          <Tag>{record.targetCount} 目标</Tag>
        </Space>
      ),
    },
    {
      title: '构建源',
      dataIndex: 'buildSourceCount',
      render: (_value, record) => summarizeBuildSources(record.app, record.bindings),
    },
    {
      title: '环境绑定',
      dataIndex: 'bindings',
      render: (_value, record) => summarizeEnvironmentBindings(record.bindings),
    },
    {
      title: '下一步',
      dataIndex: 'nextStep',
      render: (_value, record) => <Tag color={record.nextStep.color}>{record.nextStep.label}</Tag>,
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新',
      dataIndex: ['app', 'updatedAt'],
      render: (_value, record) => formatDateTime(record.app.updatedAt),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: ['app', 'id'],
      render: (_value, record) => (
        <Button
          size="small"
          type="link"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(`/applications/${record.app.id}`)}
        >
          配置服务
        </Button>
      ),
    },
  ]

  const handleCreateDraft = async () => {
    try {
      const values = await form.validateFields()
      const draft = await createDraftMutation.mutateAsync(
        buildManualDeliveryDraftPayload(values, selectedBlueprint),
      )
      setCreatedDraft(draft)
      setConfirmedResult(null)
      setDraftModalVisible(true)
      void message.success('DeliveryDraft 已生成')
    } catch (error) {
      if (error instanceof Error) void message.error(error.message)
    }
  }

  const handleConfirmDraft = async () => {
    if (!createdDraft) return
    try {
      const result = await confirmDraftMutation.mutateAsync(createdDraft.id)
      setConfirmedResult(result)
      setCreatedDraft(result.draft)
      void message.success('DeliveryDraft 已确认并创建交付对象')
    } catch (error) {
      if (error instanceof Error) void message.error(error.message)
    }
  }

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <WorkbenchHeader
        title="应用 / 服务接入"
        description="把项目档案下的仓库和服务组件接入为可构建、可发布、可验证的交付对象；不是重复创建应用。"
      />
      <ManualModeAlert description="手工选择应用档案、服务组件、构建源、环境绑定和模板即可完成接入；AI Gateway 只负责辅助识别和生成草稿。" />
      <StatCards items={onboardingStats} />
      <OnboardingBoundaryCards />
      <Card
        className="soha-management-panel-card"
        title="手工生成 DeliveryDraft"
        extra={
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={createDraftMutation.isPending}
            onClick={() => void handleCreateDraft()}
          >
            生成草稿
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            appGroup: 'default',
            language: 'go',
            defaultBranch: 'main',
            environmentKey: 'dev',
          }}
        >
          <div className="soha-delivery-onboarding-form-grid">
            <Form.Item label="接入模板" name="blueprintId">
              <Select
                allowClear
                placeholder="可选，未选择时使用手工默认规范"
                options={enabledBlueprints.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.key})`,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="应用名称"
              name="appName"
              rules={[{ required: true, message: '请输入应用名称' }]}
            >
              <Input placeholder={selectedBlueprint?.applicationDraft?.name || 'Demo API'} />
            </Form.Item>
            <Form.Item
              label="应用 Key"
              name="appKey"
              rules={[{ required: true, message: '请输入应用 Key' }]}
            >
              <Input placeholder={selectedBlueprint?.applicationDraft?.key || 'demo-api'} />
            </Form.Item>
            <Form.Item label="应用分组" name="appGroup">
              <Input />
            </Form.Item>
            <Form.Item label="语言" name="language">
              <Select
                options={[
                  { value: 'go', label: 'Go' },
                  { value: 'node', label: 'Node.js' },
                  { value: 'java', label: 'Java' },
                  { value: 'python', label: 'Python' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </Form.Item>
            <Form.Item label="仓库路径" name="repositoryPath">
              <Input placeholder="group/project" />
            </Form.Item>
            <Form.Item label="默认分支" name="defaultBranch">
              <Input />
            </Form.Item>
            <Form.Item
              label="服务名称"
              name="serviceName"
              rules={[{ required: true, message: '请输入服务名称' }]}
            >
              <Input placeholder="API" />
            </Form.Item>
            <Form.Item
              label="服务 Key"
              name="serviceKey"
              rules={[{ required: true, message: '请输入服务 Key' }]}
            >
              <Input placeholder="api" />
            </Form.Item>
            <Form.Item
              label="环境 Key"
              name="environmentKey"
              rules={[{ required: true, message: '请输入环境 Key' }]}
            >
              <Input placeholder="dev" />
            </Form.Item>
            <Form.Item label="集群 ID" name="clusterId">
              <Input placeholder="可选，填写后生成发布目标" />
            </Form.Item>
            <Form.Item label="命名空间" name="namespace">
              <Input placeholder="可选" />
            </Form.Item>
            <Form.Item label="工作负载" name="workloadName">
              <Input placeholder="可选，默认使用服务 Key" />
            </Form.Item>
          </div>
        </Form>
      </Card>
      <div className="soha-delivery-workbench-grid">
        <Card className="soha-management-panel-card" title="接入路径" size="small">
          <Steps
            current={1}
            orientation="vertical"
            items={[
              {
                title: '选择应用档案',
                content: '新项目先建应用档案，已有项目直接选择应用后补服务组件。',
              },
              {
                title: '形成 DeliveryDraft',
                content: '手工填写或 AI 分析仓库后生成同一份服务、构建源和环境绑定草稿。',
              },
              {
                title: '预览并确认',
                content: '确认 Dockerfile、Helm / Deployment、审批和发布流程后再落库。',
              },
            ]}
          />
        </Card>
        <DeliveryGatewayReadinessPanel
          title="AI Gateway 接入辅助"
          description="适合分析仓库语言、入口、服务拆分和构建方式，并生成 Dockerfile 与 Helm / Deployment 草稿；平台对象创建仍走确认后的常规 API。"
          skillId="delivery-developer"
          manualPath="/applications"
          manualTitle="手工接入"
          capabilities={[
            'delivery.onboarding.analyze_repo',
            'delivery.standards.dockerfile.generate',
            'delivery.standards.dockerfile.validate',
            'delivery.standards.helm.generate',
            'delivery.standards.k8s.validate',
            'delivery.spec.render',
            'delivery.application.bootstrap',
          ]}
        />
      </div>
      <ActionCards
        items={[
          {
            label: '接入新服务',
            description: '进入应用中心选择项目档案，再维护服务组件、容器和构建源。',
            icon: <CodeOutlined />,
            path: '/applications',
            type: 'primary',
          },
          {
            label: '维护接入模板',
            description: '维护平台应用接入模板和规范文件草稿。',
            icon: <FileTextOutlined />,
            path: '/delivery/blueprints',
          },
          {
            label: '配置环境绑定',
            description: '绑定服务交付环境、发布目标、构建源和流程模板。',
            icon: <RocketOutlined />,
            path: '/application-environments',
          },
        ]}
      />
      {loading ? (
        <ManagementState kind="loading" />
      ) : onboardingRows.length > 0 ? (
        <DeliveryTable
          title="待接入服务线索"
          rowKey={(record: OnboardingRow) => record.app.id}
          dataSource={onboardingRows}
          pagination={false}
          loading={loading}
          showRefresh={false}
          columns={onboardingColumns}
        />
      ) : (
        <Card className="soha-management-panel-card">
          <ManagementState
            bordered={false}
            compact
            title="暂无服务线索"
            description="可以先创建应用档案，或从接入模板生成 DeliveryDraft。"
          />
        </Card>
      )}
      <Modal
        width={980}
        title="DeliveryDraft 预览确认"
        open={draftModalVisible}
        onCancel={() => setDraftModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDraftModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="confirm"
            type="primary"
            disabled={!createdDraft || createdDraft.status !== 'draft'}
            loading={confirmDraftMutation.isPending}
            onClick={() => void handleConfirmDraft()}
          >
            确认创建交付对象
          </Button>,
        ]}
      >
        {confirmedResult ? (
          <Alert
            showIcon
            type="success"
            title="草稿已确认"
            description={`应用 ${confirmedResult.application.name} 已创建或更新，服务 ${confirmedResult.services?.length ?? 0} 个，环境绑定 ${confirmedResult.environmentBindings?.length ?? 0} 个。`}
          />
        ) : (
          <Alert
            showIcon
            type="warning"
            title="确认前不会创建或修改平台对象"
            description="请核对应用、服务、构建源、环境绑定、规范文件和流程提示，确认后才会写入控制面。"
          />
        )}
        <DeliveryDraftPreview spec={createdDraft ? specFromDraft(createdDraft) : null} />
      </Modal>
    </div>
  )
}
