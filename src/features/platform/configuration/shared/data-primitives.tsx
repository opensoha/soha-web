import { useEffect, useState } from 'react'
import { Button, Input, Modal, Table, Typography, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import type { TableColumnsType } from 'antd'

const { Text } = Typography

export interface ConfigurationDataRow {
  key: string
  value: string
  decoded?: string
}

export function copyConfigurationValue(value: string, localeCode: string) {
  if (!navigator.clipboard) return
  navigator.clipboard.writeText(value).then(
    () => void message.success(localeCode === 'zh_CN' ? '已复制' : 'Copied'),
    () => void message.error(localeCode === 'zh_CN' ? '复制失败' : 'Copy failed'),
  )
}

export function decodeBase64Safe(value: string) {
  try {
    if (typeof atob !== 'function') return value
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return value
  }
}

export function configurationDataRows(
  entries?: Record<string, string>,
  withDecoded = false,
): ConfigurationDataRow[] {
  return Object.entries(entries ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      value,
      decoded: withDecoded ? decodeBase64Safe(value) : undefined,
    }))
}

export function configurationDataSize(value: string) {
  return `${new Blob([value]).size} B`
}

export function ConfigurationDataPreview({ value }: { value: string }) {
  return (
    <Text className="soha-config-data-preview" title={value}>
      {value || '-'}
    </Text>
  )
}

export function EditConfigurationDataModal({
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
    if (open) setDraft(JSON.stringify(value, null, 2))
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
          onSubmit(
            Object.fromEntries(
              Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
                key,
                item == null ? '' : String(item),
              ]),
            ),
          )
        } catch (error) {
          void message.error(
            localeCode === 'zh_CN'
              ? `JSON 格式无效：${(error as Error).message}`
              : `Invalid JSON: ${(error as Error).message}`,
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

export function ConfigurationDataTable({
  columns,
  emptyDescription,
  rows,
}: {
  columns: TableColumnsType<ConfigurationDataRow>
  emptyDescription: string
  rows: ConfigurationDataRow[]
}) {
  return (
    <Table<ConfigurationDataRow>
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

export function ConfigurationDataToolbar({
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
