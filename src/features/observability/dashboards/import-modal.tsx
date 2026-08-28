import type {
  ObservabilityDashboardImportResult,
  ObservabilityGrafanaDashboardImportInput,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Modal, Segmented, Select, Space, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { observabilityDashboardMutations } from './mutations'
import { observabilityDashboardQueries } from './queries'
import { dashboardTemplateJSON, dashboardTemplates } from './templates'

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
  const [sourceMode, setSourceMode] = useState<'template' | 'json'>('template')
  const [templateKey, setTemplateKey] = useState('kubernetes-workloads')
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
    setSourceMode('template')
    setTemplateKey('kubernetes-workloads')
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
    if (!dataSourceId) return
    let json = dashboardTemplateJSON(templateKey)
    if (sourceMode === 'json') {
      const file = fileList[0]?.originFileObj
      if (!file) return
      if (file.size > maxDashboardBytes) {
        message.error('JSON 文件不能超过 2 MiB')
        return
      }
      json = await file.text()
    }
    if (!json) return
    const input: ObservabilityGrafanaDashboardImportInput = {
      json,
      dataSourceId,
    }
    importMutation.mutate(input)
  }

  return (
    <Modal
      destroyOnHidden
      open={open}
      title="添加仪表盘"
      okText="添加"
      cancelText="取消"
      confirmLoading={importMutation.isPending}
      okButtonProps={{
        disabled:
          !dataSourceId ||
          (sourceMode === 'template' ? !dashboardTemplateJSON(templateKey) : fileList.length === 0),
      }}
      onCancel={() => {
        reset()
        onOpenChange(false)
      }}
      onOk={submit}
    >
      <Space className="soha-dashboard-import-fields" orientation="vertical" size={16}>
        <Segmented
          block
          options={[
            { label: 'Soha 模板', value: 'template' },
            { label: 'Grafana JSON', value: 'json' },
          ]}
          value={sourceMode}
          onChange={setSourceMode}
        />
        {dataSourcesQuery.isSuccess && dataSources.length === 0 ? (
          <Alert
            showIcon
            type="warning"
            title="没有可用的 Prometheus 数据源"
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
        <Space className="soha-dashboard-import-field" orientation="vertical" size={6}>
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
        {sourceMode === 'template' ? (
          <Space className="soha-dashboard-import-field" orientation="vertical" size={6}>
            <Typography.Text strong>模板</Typography.Text>
            <Select
              className="soha-dashboard-import-control"
              options={dashboardTemplates.map((item) => ({
                disabled: !item.available,
                label: item.available ? item.name : `${item.name}（未就绪）`,
                title: item.reason ?? item.description,
                value: item.key,
              }))}
              value={templateKey}
              onChange={setTemplateKey}
            />
            <Typography.Text type="secondary">
              {dashboardTemplates.find((item) => item.key === templateKey)?.description}
            </Typography.Text>
          </Space>
        ) : (
          <Space className="soha-dashboard-import-field" orientation="vertical" size={6}>
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
        )}
      </Space>
    </Modal>
  )
}
