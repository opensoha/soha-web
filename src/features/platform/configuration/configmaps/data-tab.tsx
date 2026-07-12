import { useState } from 'react'
import { Button, Card, Typography } from 'antd'
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
import type { ConfigMapDetail } from './types'

const { Text } = Typography

export function ConfigMapDataTab({
  applying,
  detail,
  onApply,
}: {
  applying?: boolean
  detail: ConfigMapDetail
  onApply: (data: Record<string, string>) => void
}) {
  const { localeCode } = useI18n()
  const data = configurationDataRows(detail.data)
  const binaryData = configurationDataRows(detail.binaryData)
  const [editorOpen, setEditorOpen] = useState(false)
  const columns: TableColumnsType<ConfigurationDataRow> = [
    { title: 'Key', dataIndex: 'key', width: 220, ellipsis: { showTitle: false } },
    {
      title: localeCode === 'zh_CN' ? '内容' : 'Value',
      dataIndex: 'value',
      ellipsis: { showTitle: false },
      render: (value: string) => <ConfigurationDataPreview value={value} />,
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
      width: 92,
      render: (_value, record) => (
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={() => copyConfigurationValue(record.value, localeCode)}
        >
          {localeCode === 'zh_CN' ? '复制' : 'Copy'}
        </Button>
      ),
    },
  ]

  return (
    <div className="soha-detail-stack">
      <Card className="soha-detail-card">
        <ConfigurationDataToolbar
          count={data.length}
          disabled={detail.immutable}
          loading={applying}
          onEdit={() => setEditorOpen(true)}
        />
        <ConfigurationDataTable
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
          <ConfigurationDataTable
            columns={columns}
            emptyDescription={localeCode === 'zh_CN' ? '暂无 binaryData 键' : 'No binaryData keys'}
            rows={binaryData}
          />
        </Card>
      ) : null}
      <EditConfigurationDataModal
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
