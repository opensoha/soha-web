import { Button, Form, Input, InputNumber, Spin, Switch, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { settingsMutations } from '../mutations'
import { settingsQueries } from '../queries'
import { DEFAULT_FORM_LAYOUT, fullWidthStyle, SettingsCard } from '../shared/components'
import type { PrometheusSettings } from '../types'

export function MonitoringSettingsPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewMonitoringSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.monitoring.view',
  )
  const canManageMonitoringSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.monitoring.manage',
  )

  const { data, isLoading } = useQuery(settingsQueries.monitoring())
  const saveMutation = useMutation(settingsMutations.monitoring.save(queryClient))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!canViewMonitoringSettings) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看监控设置的权限。" />
      </div>
    )
  }

  const settings = data

  return (
    <div className="soha-page">
      <SettingsCard>
        <Form
          {...DEFAULT_FORM_LAYOUT}
          onFinish={(values) => {
            if (!canManageMonitoringSettings) return
            saveMutation.mutate(values as PrometheusSettings, {
              onSuccess: () => void message.success('监控设置已保存'),
              onError: (err) => void message.error(err.message),
            })
          }}
          initialValues={settings ?? {}}
        >
          <Form.Item name="enabled" label="启用监控" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label="Prometheus URL"
            rules={[{ required: true, message: '请输入 Prometheus URL' }]}
          >
            <Input placeholder="http://prometheus:9090" />
          </Form.Item>
          <Form.Item name="bearerToken" label="Bearer Token">
            <Input.Password />
          </Form.Item>
          <Form.Item name="defaultRangeMinutes" label="默认范围(分钟)">
            <InputNumber style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="stepSeconds" label="默认步长(秒)">
            <InputNumber style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="clusterLabel" label="Cluster Label">
            <Input />
          </Form.Item>
          <Form.Item name="grafanaBaseUrl" label="Grafana URL">
            <Input />
          </Form.Item>
          <div className="soha-form-actions">
            {canManageMonitoringSettings ? (
              <Button htmlType="submit" type="primary" loading={saveMutation.isPending}>
                保存设置
              </Button>
            ) : null}
          </div>
        </Form>
      </SettingsCard>
    </div>
  )
}
