import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { CopyOutlined, EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { api } from '@/services/api-client'
import { buildClusterScopedPath } from '@/features/platform/platform-scope-query'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import type { ApiResponse, ResourceYAMLView } from '@/types'
import type { TableColumnsType, TabsProps } from 'antd'
import './platform-pages.css'

const { Text } = Typography

const K8sYamlEditor = lazy(async () => {
  const mod = await import('@/components/k8s-yaml-editor')
  return { default: mod.K8sYamlEditor }
})

function ResourceMetadataSection({
  items,
  title,
}: {
  items?: Record<string, string>
  title: React.ReactNode
}) {
  const entries = Object.entries(items ?? {}).filter(([key]) => key.trim())
  if (entries.length === 0) return null

  return (
    <div className="soha-workload-metadata-section">
      <Text strong className="soha-workload-metadata-title">
        {title}
      </Text>
      <div className="soha-workload-kv-grid">
        {entries.map(([key, value]) => {
          const displayValue = value || '-'
          return (
            <Tooltip
              key={key}
              title={
                <div className="soha-workload-kv-tooltip">
                  <div>{key}</div>
                  <div>{displayValue}</div>
                </div>
              }
            >
              <div className="soha-workload-kv-item" title={`${key}: ${displayValue}`}>
                <span className="soha-workload-kv-key">{`${key}:`}</span>
                <span className="soha-workload-kv-value">{displayValue}</span>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

interface ConfigMapDetail {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  data?: Record<string, string>
  binaryData?: Record<string, string>
  immutable: boolean
  createdAt?: string
  ageSeconds: number
}

interface SecretDetail {
  name: string
  namespace: string
  type: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  data?: Record<string, string>
  immutable: boolean
  createdAt?: string
  ageSeconds: number
}

interface ConfigReference {
  kind: string
  name: string
  namespace: string
  path: string
}

const DEFAULT_CONFIGMAP_TEMPLATE = `apiVersion: v1
kind: ConfigMap
metadata:
  name: example-config
data:
  key: value
`

const DEFAULT_SECRET_TEMPLATE = `apiVersion: v1
kind: Secret
metadata:
  name: example-secret
type: Opaque
stringData:
  key: value
`

export function CreateResourceModal({
  visible,
  onClose,
  kind,
  resourcePath,
  defaultTemplate,
  invalidationKeys,
  namespaceScope = 'required',
}: {
  visible: boolean
  onClose: () => void
  kind: string
  resourcePath: string
  defaultTemplate: string
  invalidationKeys: unknown[][]
  namespaceScope?: 'cluster' | 'required'
}) {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(defaultTemplate)
  const effectiveNamespace = namespaceScope === 'cluster' ? null : namespace || 'default'

  useEffect(() => {
    if (visible) setDraft(defaultTemplate)
  }, [visible, defaultTemplate])

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<ResourceYAMLView>>(
        buildClusterScopedPath(clusterId!, resourcePath, effectiveNamespace),
        { content: draft, ...(effectiveNamespace ? { namespace: effectiveNamespace } : {}) },
      ),
    onSuccess: () => {
      void message.success(localeCode === 'zh_CN' ? `${kind} 已创建` : `${kind} created`)
      invalidationKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
      onClose()
    },
    onError: (err: Error) => void message.error(err.message),
  })

  return (
    <Modal
      title={localeCode === 'zh_CN' ? `新建 ${kind}` : `Create ${kind}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={960}
      mask={{ closable: false }}
    >
      {!clusterId ? (
        <ManagementState
          compact
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请先选择集群' : 'Select a cluster first'}
        />
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                height: 520,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spin size="large" />
            </div>
          }
        >
          <Alert
            banner
            showIcon
            type="info"
            description={
              localeCode === 'zh_CN'
                ? namespaceScope === 'cluster'
                  ? '当前资源为 cluster scope，metadata.namespace 必须留空。'
                  : `命名空间：${effectiveNamespace || 'default'}。可在 YAML 内指定 metadata.namespace 覆盖。`
                : namespaceScope === 'cluster'
                  ? 'This resource is cluster-scoped. Keep metadata.namespace empty.'
                  : `Namespace: ${effectiveNamespace || 'default'}. You can override via metadata.namespace in YAML.`
            }
          />
          <div style={{ marginTop: 12 }}>
            <K8sYamlEditor
              value={draft}
              onChange={setDraft}
              onReset={() => setDraft(defaultTemplate)}
              onSave={() =>
                void message.info(
                  localeCode === 'zh_CN'
                    ? '新建模式不支持本地草稿'
                    : 'Draft saving disabled in create mode',
                )
              }
              onApply={() => createMutation.mutate()}
              saveDisabled
              applyDisabled={!draft.trim() || createMutation.isPending}
              applying={createMutation.isPending}
              editorHeight="min(46vh, 440px)"
            />
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button onClick={onClose} style={{ marginRight: 8 }}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </Suspense>
      )}
    </Modal>
  )
}

function useResolvedNamespace() {
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  return namespace && namespace !== '' ? namespace : searchParams.get('namespace') || ''
}

function copyToClipboard(value: string, localeCode: string) {
  if (!navigator.clipboard) return
  navigator.clipboard.writeText(value).then(
    () => void message.success(localeCode === 'zh_CN' ? '已复制' : 'Copied'),
    () => void message.error(localeCode === 'zh_CN' ? '复制失败' : 'Copy failed'),
  )
}

function decodeBase64Safe(value: string) {
  try {
    if (typeof atob === 'function') {
      const binary = atob(value)
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    }
    return value
  } catch {
    return value
  }
}

type ConfigDataRow = {
  key: string
  value: string
  decoded?: string
}

function dataRows(entries?: Record<string, string>, withDecoded = false): ConfigDataRow[] {
  return Object.entries(entries ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      value,
      decoded: withDecoded ? decodeBase64Safe(value) : undefined,
    }))
}

function dataSize(value: string) {
  return `${new Blob([value]).size} B`
}

function DataPreview({ value }: { value: string }) {
  return (
    <Text className="soha-config-data-preview" title={value}>
      {value || '-'}
    </Text>
  )
}

function EditDataModal({
  confirmLoading,
  onCancel,
  onSubmit,
  open,
  title,
  value,
}: {
  confirmLoading?: boolean
  onCancel: () => void
  onSubmit: (value: Record<string, string>) => void
  open: boolean
  title: string
  value: Record<string, string>
}) {
  const { localeCode } = useI18n()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(JSON.stringify(value, null, 2))
    }
  }, [open, value])

  return (
    <Modal
      centered
      destroyOnHidden
      confirmLoading={confirmLoading}
      okText={localeCode === 'zh_CN' ? '应用' : 'Apply'}
      cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
      open={open}
      title={title}
      width={760}
      onCancel={onCancel}
      onOk={() => {
        try {
          const parsed = JSON.parse(draft) as unknown
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            throw new Error('data must be an object')
          }
          const next = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
              key,
              item == null ? '' : String(item),
            ]),
          )
          onSubmit(next)
        } catch (err) {
          void message.error(
            localeCode === 'zh_CN'
              ? `JSON 格式无效：${(err as Error).message}`
              : `Invalid JSON: ${(err as Error).message}`,
          )
        }
      }}
    >
      <Input.TextArea
        autoSize={{ minRows: 12, maxRows: 20 }}
        className="soha-config-data-editor"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </Modal>
  )
}

function ConfigDataTable({
  columns,
  emptyDescription,
  rows,
}: {
  columns: TableColumnsType<ConfigDataRow>
  emptyDescription: string
  rows: ConfigDataRow[]
}) {
  return (
    <Table<ConfigDataRow>
      className="soha-platform-table soha-config-data-table"
      columns={columns}
      dataSource={rows}
      expandable={{
        expandedRowRender: (record) => (
          <div className="soha-config-data-expanded">
            <pre className="soha-json-block">{record.value || '-'}</pre>
            {record.decoded !== undefined ? (
              <pre className="soha-json-block">{record.decoded || '-'}</pre>
            ) : null}
          </div>
        ),
        rowExpandable: (record) => Boolean(record.value || record.decoded),
      }}
      locale={{
        emptyText: <ManagementState bordered={false} compact description={emptyDescription} />,
      }}
      pagination={false}
      rowKey="key"
      size="small"
      tableLayout="fixed"
    />
  )
}

function ConfigDataToolbar({
  count,
  disabled,
  loading,
  onEdit,
}: {
  count: number
  disabled?: boolean
  loading?: boolean
  onEdit: () => void
}) {
  const { localeCode } = useI18n()
  return (
    <div className="soha-config-data-toolbar">
      <Text type="secondary">{localeCode === 'zh_CN' ? `共 ${count} 个键` : `${count} keys`}</Text>
      <Button
        autoInsertSpace={false}
        disabled={disabled}
        icon={<EditOutlined />}
        loading={loading}
        size="small"
        type="primary"
        onClick={onEdit}
      >
        {localeCode === 'zh_CN' ? '编辑数据' : 'Edit Data'}
      </Button>
    </div>
  )
}

function ConfigMapDataTab({
  applying,
  detail,
  onApply,
}: {
  applying?: boolean
  detail: ConfigMapDetail
  onApply: (data: Record<string, string>) => void
}) {
  const { localeCode } = useI18n()
  const data = dataRows(detail.data)
  const binaryData = dataRows(detail.binaryData)
  const [editorOpen, setEditorOpen] = useState(false)
  const columns: TableColumnsType<ConfigDataRow> = [
    { title: 'Key', dataIndex: 'key', width: 220, ellipsis: { showTitle: false } },
    {
      title: localeCode === 'zh_CN' ? '内容' : 'Value',
      dataIndex: 'value',
      ellipsis: { showTitle: false },
      render: (value: string) => <DataPreview value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '大小' : 'Size',
      dataIndex: 'value',
      width: 96,
      render: dataSize,
    },
    {
      title: localeCode === 'zh_CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 92,
      render: (_value, record) => (
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(record.value, localeCode)}
        >
          {localeCode === 'zh_CN' ? '复制' : 'Copy'}
        </Button>
      ),
    },
  ]
  return (
    <div className="soha-detail-stack">
      <Card className="soha-detail-card">
        <ConfigDataToolbar
          count={data.length}
          disabled={detail.immutable}
          loading={applying}
          onEdit={() => setEditorOpen(true)}
        />
        <ConfigDataTable
          columns={columns}
          emptyDescription={localeCode === 'zh_CN' ? '暂无 data 键' : 'No data keys'}
          rows={data}
        />
      </Card>
      {binaryData.length > 0 ? (
        <Card className="soha-detail-card">
          <div className="soha-config-data-toolbar">
            <Text type="secondary">
              {localeCode === 'zh_CN'
                ? `二进制数据 ${binaryData.length} 个键`
                : `${binaryData.length} binary keys`}
            </Text>
          </div>
          <ConfigDataTable
            columns={columns}
            emptyDescription={localeCode === 'zh_CN' ? '暂无 binaryData 键' : 'No binaryData keys'}
            rows={binaryData}
          />
        </Card>
      ) : null}
      <EditDataModal
        confirmLoading={applying}
        onCancel={() => setEditorOpen(false)}
        onSubmit={(next) => {
          onApply(next)
          setEditorOpen(false)
        }}
        open={editorOpen}
        title={localeCode === 'zh_CN' ? '编辑 ConfigMap 数据' : 'Edit ConfigMap Data'}
        value={detail.data ?? {}}
      />
    </div>
  )
}

function SecretDataTab({
  applying,
  detail,
  onApply,
}: {
  applying?: boolean
  detail: SecretDetail
  onApply: (decodedData: Record<string, string>) => void
}) {
  const { localeCode } = useI18n()
  const rows = dataRows(detail.data, true)
  const [editorOpen, setEditorOpen] = useState(false)
  const decodedData = Object.fromEntries(rows.map((row) => [row.key, row.decoded ?? '']))
  const columns: TableColumnsType<ConfigDataRow> = [
    { title: 'Key', dataIndex: 'key', width: 220, ellipsis: { showTitle: false } },
    {
      title: 'Base64',
      dataIndex: 'value',
      ellipsis: { showTitle: false },
      render: (value: string) => <DataPreview value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '解码后内容' : 'Decoded',
      dataIndex: 'decoded',
      ellipsis: { showTitle: false },
      render: (value?: string) => <DataPreview value={value ?? ''} />,
    },
    {
      title: localeCode === 'zh_CN' ? '大小' : 'Size',
      dataIndex: 'value',
      width: 96,
      render: dataSize,
    },
    {
      title: localeCode === 'zh_CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 156,
      render: (_value, record) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(record.value, localeCode)}
          >
            Base64
          </Button>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(record.decoded ?? '', localeCode)}
          >
            {localeCode === 'zh_CN' ? '解码' : 'Decoded'}
          </Button>
        </Space>
      ),
    },
  ]
  return (
    <Card className="soha-detail-card">
      <ConfigDataToolbar
        count={rows.length}
        disabled={detail.immutable}
        loading={applying}
        onEdit={() => setEditorOpen(true)}
      />
      <ConfigDataTable
        columns={columns}
        emptyDescription={localeCode === 'zh_CN' ? '暂无 data 键' : 'No data keys'}
        rows={rows}
      />
      <EditDataModal
        confirmLoading={applying}
        onCancel={() => setEditorOpen(false)}
        onSubmit={(next) => {
          onApply(next)
          setEditorOpen(false)
        }}
        open={editorOpen}
        title={localeCode === 'zh_CN' ? '编辑 Secret 解码后数据' : 'Edit Secret Decoded Data'}
        value={decodedData}
      />
    </Card>
  )
}

function ConfigReferencesTab({ path }: { path: string | null }) {
  const { localeCode } = useI18n()
  const referencesQuery = useQuery({
    queryKey: ['configuration-references', path],
    queryFn: () => api.get<ApiResponse<ConfigReference[]>>(path!),
    enabled: !!path,
  })
  const columns: TableColumnsType<ConfigReference> = [
    {
      title: localeCode === 'zh_CN' ? '资源类型' : 'Kind',
      dataIndex: 'kind',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      render: (value: string) => (
        <Text className="soha-config-reference-name" title={value}>
          {value}
        </Text>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 180,
    },
    {
      title: localeCode === 'zh_CN' ? '引用位置' : 'Reference',
      dataIndex: 'path',
      ellipsis: { showTitle: false },
      render: (value: string) => (
        <Text className="soha-config-reference-path" title={value}>
          {value}
        </Text>
      ),
    },
  ]
  return (
    <Card className="soha-detail-card">
      <Table<ConfigReference>
        className="soha-platform-table soha-config-reference-table"
        columns={columns}
        dataSource={referencesQuery.data?.data ?? []}
        loading={referencesQuery.isLoading}
        locale={{
          emptyText: (
            <ManagementState
              bordered={false}
              compact
              description={localeCode === 'zh_CN' ? '暂无关联资源' : 'No referencing resources'}
            />
          ),
        }}
        pagination={false}
        rowKey={(record) => `${record.kind}/${record.namespace}/${record.name}/${record.path}`}
        size="small"
        tableLayout="fixed"
      />
    </Card>
  )
}

export function ResourceMetaOverview({
  name,
  namespace,
  createdAt,
  ageSeconds,
  labels,
  annotations,
  extra,
}: {
  name: string
  namespace: string
  createdAt?: string
  ageSeconds?: number
  labels?: Record<string, string>
  annotations?: Record<string, string>
  extra?: Array<{ key: string; value: React.ReactNode }>
}) {
  const { t, localeCode } = useI18n()
  const hasLabels = !!labels && Object.keys(labels).length > 0
  const hasAnnotations = !!annotations && Object.keys(annotations).length > 0
  return (
    <Card className="soha-detail-card">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        size="small"
        items={[
          { key: t('common.name', 'Name'), label: t('common.name', 'Name'), children: name },
          {
            key: t('common.namespace', 'Namespace'),
            label: t('common.namespace', 'Namespace'),
            children: namespace,
          },
          {
            key: t('common.createdAt', 'Created At'),
            label: t('common.createdAt', 'Created At'),
            children: createdAt
              ? formatRelativeTime(createdAt)
              : typeof ageSeconds === 'number'
                ? formatAgeSeconds(ageSeconds)
                : '-',
          },
          ...(extra ?? []).map((item) => ({
            key: item.key,
            label: item.key,
            children: item.value,
          })),
        ]}
      />
      {hasLabels || hasAnnotations ? (
        <div className="soha-workload-metadata-stack">
          <ResourceMetadataSection items={labels} title={t('common.labels', 'Labels')} />
          <ResourceMetadataSection
            items={annotations}
            title={localeCode === 'zh_CN' ? '注解' : 'Annotations'}
          />
        </div>
      ) : null}
    </Card>
  )
}

export function useResourceYAMLState(
  yamlPath: string | null,
  resource: string,
  name: string,
  namespace: string,
) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery({
    queryKey: ['resource-yaml', resource, name, namespace],
    queryFn: () => api.get<ApiResponse<ResourceYAMLView>>(yamlPath!),
    enabled: !!yamlPath,
  })
  const [draft, setDraft] = useState('')
  const serverValue = yamlQuery.data?.data?.content ?? ''

  useEffect(() => {
    if (!yamlPath) return
    setDraft(serverValue)
  }, [yamlPath, serverValue])

  const applyMutation = useMutation({
    mutationFn: () => api.put<ApiResponse<ResourceYAMLView>>(yamlPath!, { content: draft }),
    onSuccess: (response) => {
      setDraft(response.data?.content ?? draft)
      void message.success(t('yamlEditor.applySuccess', 'YAML applied'))
      yamlQuery.refetch()
      queryClient.invalidateQueries({ queryKey: [resource, 'detail', name, namespace] })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  return { draft, setDraft, serverValue, applyMutation, yamlQuery }
}

export function ConfigurationDetailShell({
  children,
  kind,
  name,
}: {
  children: React.ReactNode
  kind: string
  name: string
}) {
  return (
    <div className="soha-page soha-workload-detail-page">
      <div className="soha-workload-detail-heading">
        <div className="soha-workload-detail-heading-main">
          <Text type="secondary" className="soha-workload-detail-kind">
            {kind}
          </Text>
          <Text strong className="soha-workload-detail-name">
            {name}
          </Text>
        </div>
      </div>
      {children}
    </div>
  )
}

export function ConfigurationDetailTabs({ items }: { items: TabsProps['items'] }) {
  return (
    <Tabs
      className="soha-workload-detail-tabs"
      defaultActiveKey="overview"
      indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
      items={items}
      size="small"
      tabBarGutter={18}
    />
  )
}

export function ConfigurationYamlTab({
  state,
  yamlPath,
}: {
  state: ReturnType<typeof useResourceYAMLState>
  yamlPath: string | null
}) {
  const { localeCode } = useI18n()
  return (
    <Suspense
      fallback={
        <Card className="soha-detail-card">
          <Spin size="large" />
        </Card>
      }
    >
      <div style={{ height: 620 }}>
        <K8sYamlEditor
          value={state.draft}
          onChange={state.setDraft}
          onReset={() => state.setDraft(state.serverValue)}
          onSave={() =>
            void message.info(
              localeCode === 'zh_CN' ? '暂不支持本地草稿' : 'Local draft save disabled here',
            )
          }
          onApply={() => state.applyMutation.mutate()}
          saveDisabled
          applyDisabled={!yamlPath || !state.draft.trim()}
          applying={state.applyMutation.isPending}
        />
      </div>
    </Suspense>
  )
}

export function ConfigMapDetailPage() {
  const { t, localeCode } = useI18n()
  const queryClient = useQueryClient()
  const params = useParams()
  const name = params.configMapName as string
  const detailNamespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()

  const detailPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/configmaps/${name}/detail?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const updateDataPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/configmaps/${name}/data?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const referencesPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/configmaps/${name}/references?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const yamlPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/configmaps/${name}/yaml?namespace=${encodeURIComponent(detailNamespace)}`
      : null

  const detailQuery = useQuery({
    queryKey: ['configmaps', 'detail', name, detailNamespace],
    queryFn: () => api.get<ApiResponse<ConfigMapDetail>>(detailPath!),
    enabled: !!detailPath,
  })

  const yamlState = useResourceYAMLState(yamlPath, 'configmaps', name, detailNamespace)
  const updateDataMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.put<ApiResponse<ConfigMapDetail>>(updateDataPath!, {
        data,
        binaryData: detail?.binaryData ?? {},
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(['configmaps', 'detail', name, detailNamespace], response)
      void message.success(localeCode === 'zh_CN' ? '数据已更新' : 'Data updated')
      void queryClient.invalidateQueries({
        queryKey: ['configmaps', 'detail', name, detailNamespace],
      })
      void yamlState.yamlQuery.refetch()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'ConfigMap 未找到' : 'ConfigMap not found'}
        />
      </div>
    )
  }

  return (
    <ConfigurationDetailShell kind="ConfigMap" name={name}>
      <ConfigurationDetailTabs
        items={[
          {
            key: 'overview',
            label: t('common.overview', 'Overview'),
            children: (
              <>
                <ResourceMetaOverview
                  name={detail.name}
                  namespace={detail.namespace}
                  createdAt={detail.createdAt}
                  labels={detail.labels}
                  annotations={detail.annotations}
                  extra={[{ key: 'Immutable', value: detail.immutable ? 'Yes' : 'No' }]}
                />
              </>
            ),
          },
          {
            key: 'data',
            label: localeCode === 'zh_CN' ? '数据' : 'Data',
            children: (
              <ConfigMapDataTab
                applying={updateDataMutation.isPending}
                detail={detail}
                onApply={(next) => updateDataMutation.mutate(next)}
              />
            ),
          },
          {
            key: 'relationships',
            label: localeCode === 'zh_CN' ? '关联关系' : 'Relationships',
            children: <ConfigReferencesTab path={referencesPath} />,
          },
          {
            key: 'yaml',
            label: t('common.yaml', 'YAML'),
            children: <ConfigurationYamlTab state={yamlState} yamlPath={yamlPath} />,
          },
        ]}
      />
    </ConfigurationDetailShell>
  )
}

export function SecretDetailPage() {
  const { t, localeCode } = useI18n()
  const queryClient = useQueryClient()
  const params = useParams()
  const name = params.secretName as string
  const detailNamespace = useResolvedNamespace()
  const { clusterId } = usePlatformScopeStore()

  const detailPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/secrets/${name}/detail?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const updateDataPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/secrets/${name}/data?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const referencesPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/secrets/${name}/references?namespace=${encodeURIComponent(detailNamespace)}`
      : null
  const yamlPath =
    clusterId && detailNamespace
      ? `/clusters/${clusterId}/configuration/secrets/${name}/yaml?namespace=${encodeURIComponent(detailNamespace)}`
      : null

  const detailQuery = useQuery({
    queryKey: ['secrets', 'detail', name, detailNamespace],
    queryFn: () => api.get<ApiResponse<SecretDetail>>(detailPath!),
    enabled: !!detailPath,
  })

  const yamlState = useResourceYAMLState(yamlPath, 'secrets', name, detailNamespace)
  const updateDataMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.put<ApiResponse<SecretDetail>>(updateDataPath!, { data }),
    onSuccess: (response) => {
      queryClient.setQueryData(['secrets', 'detail', name, detailNamespace], response)
      void message.success(localeCode === 'zh_CN' ? '数据已更新' : 'Data updated')
      void queryClient.invalidateQueries({ queryKey: ['secrets', 'detail', name, detailNamespace] })
      void yamlState.yamlQuery.refetch()
    },
    onError: (err: Error) => void message.error(err.message),
  })
  const detail = detailQuery.data?.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'Secret 未找到' : 'Secret not found'}
        />
      </div>
    )
  }

  return (
    <ConfigurationDetailShell kind="Secret" name={name}>
      <ConfigurationDetailTabs
        items={[
          {
            key: 'overview',
            label: t('common.overview', 'Overview'),
            children: (
              <>
                <ResourceMetaOverview
                  name={detail.name}
                  namespace={detail.namespace}
                  createdAt={detail.createdAt}
                  labels={detail.labels}
                  annotations={detail.annotations}
                  extra={[
                    { key: 'Type', value: detail.type || '-' },
                    { key: 'Immutable', value: detail.immutable ? 'Yes' : 'No' },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'data',
            label: localeCode === 'zh_CN' ? '数据' : 'Data',
            children: (
              <SecretDataTab
                applying={updateDataMutation.isPending}
                detail={detail}
                onApply={(next) => updateDataMutation.mutate(next)}
              />
            ),
          },
          {
            key: 'relationships',
            label: localeCode === 'zh_CN' ? '关联关系' : 'Relationships',
            children: <ConfigReferencesTab path={referencesPath} />,
          },
          {
            key: 'yaml',
            label: t('common.yaml', 'YAML'),
            children: <ConfigurationYamlTab state={yamlState} yamlPath={yamlPath} />,
          },
        ]}
      />
    </ConfigurationDetailShell>
  )
}

export const CONFIGMAP_DEFAULT_TEMPLATE = DEFAULT_CONFIGMAP_TEMPLATE
export const SECRET_DEFAULT_TEMPLATE = DEFAULT_SECRET_TEMPLATE
