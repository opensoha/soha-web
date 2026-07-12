import { useState } from 'react'
import { Button, Card, Space } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useI18n } from '@/i18n'
import type { TableColumnsType } from 'antd'
import {
  ConfigurationDataPreview,
  ConfigurationDataTable,
  ConfigurationDataToolbar,
  EditConfigurationDataModal,
  configurationDataRows,
  configurationDataSize,
  copyConfigurationValue,
  type ConfigurationDataRow,
} from '../shared/data-primitives'
import type { SecretDetail } from './types'

export function SecretDataTab({
  applying,
  detail,
  onApply,
}: {
  applying?: boolean
  detail: SecretDetail
  onApply: (decodedData: Record<string, string>) => void
}) {
  const { localeCode } = useI18n()
  const rows = configurationDataRows(detail.data, true)
  const [editorOpen, setEditorOpen] = useState(false)
  const decodedData = Object.fromEntries(rows.map((row) => [row.key, row.decoded ?? '']))
  const columns: TableColumnsType<ConfigurationDataRow> = [
    { title: 'Key', dataIndex: 'key', width: 220, ellipsis: { showTitle: false } },
    {
      title: 'Base64',
      dataIndex: 'value',
      ellipsis: { showTitle: false },
      render: (value: string) => <ConfigurationDataPreview value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '解码后内容' : 'Decoded',
      dataIndex: 'decoded',
      ellipsis: { showTitle: false },
      render: (value?: string) => <ConfigurationDataPreview value={value ?? ''} />,
    },
    {
      title: localeCode === 'zh_CN' ? '大小' : 'Size',
      dataIndex: 'value',
      width: 96,
      render: configurationDataSize,
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
            onClick={() => copyConfigurationValue(record.value, localeCode)}
          >
            Base64
          </Button>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyConfigurationValue(record.decoded ?? '', localeCode)}
          >
            {localeCode === 'zh_CN' ? '解码' : 'Decoded'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card className="soha-detail-card">
      <ConfigurationDataToolbar
        count={rows.length}
        disabled={detail.immutable}
        loading={applying}
        onEdit={() => setEditorOpen(true)}
      />
      <ConfigurationDataTable
        columns={columns}
        emptyDescription={localeCode === 'zh_CN' ? '暂无 data 键' : 'No data keys'}
        rows={rows}
      />
      <EditConfigurationDataModal
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
