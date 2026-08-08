import type {
  ObservabilityDashboardImportResult,
  ObservabilityGrafanaDashboardImportInput,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Modal, Select, Space, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { observabilityDashboardMutations } from './mutations'
import { observabilityDashboardQueries } from './queries'

const maxDashboardBytes = 2 * 1024 * 1024

export function ImportDashboardModal({
  onImported,
  onOpenChange,
  open,
}: {
  onImported: (result: ObservabilityDashboardImportResult) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { message, notification } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [dataSourceId, setDataSourceId] = useState('')
  const dataSourcesQuery = useQuery({
    ...observabilityDashboardQueries.metricDataSources(),
    enabled: open,
  })
  const dataSources = dataSourcesQuery.data ?? []

  useEffect(() => {
    if (open && !dataSourceId && dataSources.length === 1) {
      setDataSourceId(dataSources[0].id)
    }
  }, [dataSourceId, dataSources, open])

  function reset() {
    setFileList([])
    setDataSourceId('')
  }
  const importMutation = useMutation({
    ...observabilityDashboardMutations.import(queryClient),
    onError: (error) => message.error(error.message),
    onSuccess: (result) => {
      message.success(`已导入 ${result.importedPanelCount} 个面板`)
      if (result.warnings.length > 0) {
        notification.warning({
          title: '部分内容未导入',
          description: result.warnings
            .slice(0, 4)
            .map((warning) => warning.message)
            .join('；'),
        })
      }
      reset()
      onOpenChange(false)
      onImported(result)
    },
  })

  async function submit() {
    const file = fileList[0]?.originFileObj
    if (!file || !dataSourceId) return
    if (file.size > maxDashboardBytes) {
      message.error('JSON 文件不能超过 2 MiB')
      return
    }
    const input: ObservabilityGrafanaDashboardImportInput = {
      json: await file.text(),
      dataSourceId,
    }
    importMutation.mutate(input)
  }

  return (
    <Modal
      destroyOnHidden
      open={open}
      title="导入 Grafana 仪表盘"
      okText="导入"
      cancelText="取消"
      confirmLoading={importMutation.isPending}
      okButtonProps={{ disabled: fileList.length === 0 || !dataSourceId }}
      onCancel={() => {
        reset()
        onOpenChange(false)
      }}
      onOk={submit}
    >
      <Space className="soha-dashboard-import-fields" direction="vertical" size={16}>
        {dataSourcesQuery.isSuccess && dataSources.length === 0 ? (
          <Alert
            showIcon
            type="warning"
            message="没有可用的 Prometheus 数据源"
            action={
              <Button
                size="small"
                type="link"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                  navigate('/ai-workbench/model-settings')
                }}
              >
                去配置
              </Button>
            }
          />
        ) : null}
        <Space className="soha-dashboard-import-field" direction="vertical" size={6}>
          <Typography.Text strong>Prometheus 数据源</Typography.Text>
          <Select
            allowClear
            className="soha-dashboard-import-control"
            loading={dataSourcesQuery.isLoading}
            options={dataSources.map((item) => ({ label: item.name, value: item.id }))}
            placeholder="选择数据源"
            value={dataSourceId || undefined}
            onChange={(value) => setDataSourceId(value ?? '')}
          />
        </Space>
        <Space className="soha-dashboard-import-field" direction="vertical" size={6}>
          <Typography.Text strong>Grafana JSON</Typography.Text>
          <Upload
            accept="application/json,.json"
            beforeUpload={() => false}
            fileList={fileList}
            maxCount={1}
            onChange={({ fileList: nextFiles }) => setFileList(nextFiles.slice(-1))}
          >
            <Button icon={<UploadOutlined />}>选择 JSON</Button>
          </Upload>
        </Space>
      </Space>
    </Modal>
  )
}
