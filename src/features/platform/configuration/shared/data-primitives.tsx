import { useEffect, useState } from 'react'
import { Button, Input, Modal, Table, Typography, message } from 'antd'
import { ArrowsAltOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
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
  const [draft, setDraft] = useState<Array<{ key: string; value: string }>>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const expandedItem = expandedIndex === null ? undefined : draft[expandedIndex]

  useEffect(() => {
    if (open) setDraft(Object.entries(value).map(([key, item]) => ({ key, value: item })))
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
        const keys = draft.map((item) => item.key.trim())
        const duplicate = keys.find((key, index) => key && keys.indexOf(key) !== index)
        if (keys.some((key) => !key)) {
          void message.error(localeCode === 'zh_CN' ? '键不能为空' : 'Keys cannot be empty')
          return
        }
        if (duplicate) {
          void message.error(
            localeCode === 'zh_CN' ? `键重复：${duplicate}` : `Duplicate key: ${duplicate}`,
          )
          return
        }
        onSubmit(Object.fromEntries(draft.map((item, index) => [keys[index], item.value])))
      }}
    >
      <div className="soha-config-data-editor">
        {draft.map((item, index) => (
          <div className="soha-config-data-editor-row" key={`${item.key}-${index}`}>
            <Input
              aria-label={localeCode === 'zh_CN' ? '数据键' : 'Data key'}
              placeholder={localeCode === 'zh_CN' ? '键' : 'Key'}
              value={item.key}
              onChange={(event) =>
                setDraft((current) =>
                  current.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, key: event.target.value } : entry,
                  ),
                )
              }
            />
            <div className="soha-config-data-editor-value">
              <Input.TextArea
                aria-label={localeCode === 'zh_CN' ? '数据值' : 'Data value'}
                autoSize={{ minRows: 3, maxRows: 12 }}
                placeholder={
                  localeCode === 'zh_CN' ? '值（支持换行）' : 'Value (multiline supported)'
                }
                value={item.value}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, value: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Button
                aria-label={localeCode === 'zh_CN' ? '展开编辑数据值' : 'Expand data value editor'}
                className="soha-config-data-editor-expand"
                icon={<ArrowsAltOutlined />}
                size="small"
                title={localeCode === 'zh_CN' ? '展开编辑' : 'Expand editor'}
                type="text"
                onClick={() => setExpandedIndex(index)}
              />
            </div>
            <Button
              aria-label={localeCode === 'zh_CN' ? '删除数据键' : 'Delete data key'}
              danger
              icon={<DeleteOutlined />}
              type="text"
              onClick={() =>
                setDraft((current) => current.filter((_entry, entryIndex) => entryIndex !== index))
              }
            />
          </div>
        ))}
        <Button
          block
          icon={<PlusOutlined />}
          type="dashed"
          onClick={() => setDraft((current) => [...current, { key: '', value: '' }])}
        >
          {localeCode === 'zh_CN' ? '新增数据键' : 'Add data key'}
        </Button>
      </div>
      <Modal
        centered
        destroyOnHidden
        okText={localeCode === 'zh_CN' ? '完成' : 'Done'}
        cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
        open={expandedItem !== undefined}
        title={
          expandedItem
            ? `${localeCode === 'zh_CN' ? '展开编辑' : 'Expanded editor'}：${expandedItem.key || (localeCode === 'zh_CN' ? '未命名键' : 'Unnamed key')}`
            : ''
        }
        width={1080}
        onCancel={() => setExpandedIndex(null)}
        onOk={() => setExpandedIndex(null)}
      >
        {expandedItem ? (
          <Input.TextArea
            aria-label={localeCode === 'zh_CN' ? '展开数据值' : 'Expanded data value'}
            autoSize={{ minRows: 18, maxRows: 32 }}
            className="soha-config-data-expanded-editor"
            value={expandedItem.value}
            onChange={(event) => {
              const nextValue = event.target.value
              setDraft((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === expandedIndex ? { ...entry, value: nextValue } : entry,
                ),
              )
            }}
          />
        ) : null}
      </Modal>
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
