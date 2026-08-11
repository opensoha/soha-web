import { useEffect, useState } from 'react'
import { App, Descriptions, Form, Input, InputNumber } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import type { StepFormStep } from '@/components/step-form'
import { dockerApi } from '../docker-api'
import type { DockerHost, DockerHostInput } from '../docker-types'
import { compactRecord, refreshDocker } from '../shared/ui'

type RuntimeHostFormValues = Omit<
  DockerHostInput,
  'agentId' | 'architecture' | 'composeVersion' | 'dockerVersion' | 'ipAddress' | 'status'
> & {
  memoryGiB?: number
  diskGiB?: number
}

export function buildRuntimeHostPayload(values: RuntimeHostFormValues): DockerHostInput {
  const { memoryGiB, diskGiB, ...host } = values
  return compactRecord({
    ...host,
    memoryBytes: memoryGiB ? Math.round(memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: diskGiB ? Math.round(diskGiB * 1024 ** 3) : values.diskBytes,
  })
}

interface RuntimeHostStepModalProps {
  editing?: DockerHost | null
  onClose: () => void
  onSuccess?: () => void
  open: boolean
}

function runtimeHostFormValues(record: DockerHost): RuntimeHostFormValues {
  return {
    name: record.name,
    endpoint: record.endpoint,
    environment: record.environment,
    owner: record.owner,
    team: record.team,
    virtualizationConnectionId: record.virtualizationConnectionId,
    vmId: record.vmId,
    vmName: record.vmName,
    cpuCoreCount: record.cpuCoreCount,
    memoryGiB: record.memoryBytes ? record.memoryBytes / 1024 ** 3 : undefined,
    diskGiB: record.diskBytes ? record.diskBytes / 1024 ** 3 : undefined,
    availablePortStart: record.availablePortStart,
    availablePortEnd: record.availablePortEnd,
  }
}

export function RuntimeHostStepModal({
  editing,
  onClose,
  onSuccess,
  open,
}: RuntimeHostStepModalProps) {
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm<RuntimeHostFormValues>()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const saveMutation = useMutation({
    mutationFn: (values: RuntimeHostFormValues) =>
      editing
        ? dockerApi.updateHost(editing.id, buildRuntimeHostPayload(values))
        : dockerApi.createHost(buildRuntimeHostPayload(values)),
    onSuccess: () => {
      message.success(editing ? '运行时主机已更新' : '运行时主机已接入')
      refreshDocker(queryClient)
      onSuccess?.()
      onClose()
    },
    onError: (error) => void message.error(error.message),
  })

  useEffect(() => {
    if (open) setCurrent(0)
  }, [editing, open])

  const initialValues: RuntimeHostFormValues = editing
    ? runtimeHostFormValues(editing)
    : {
        name: '',
        availablePortStart: 20000,
        availablePortEnd: 39999,
      }

  const steps: StepFormStep[] = [
    {
      title: 'Agent 连接',
      fieldNames: ['name', 'endpoint'],
      children: (
        <>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Agent Endpoint"
            tooltip="Soha Server 可访问的 Soha Agent HTTP 地址。Agent ID、IP、架构以及 Docker/Compose 版本会在 Agent 上报后自动更新。"
            rules={[
              { required: true, message: '请输入 Agent Endpoint' },
              { type: 'url', message: '请输入有效的 HTTP 或 HTTPS 地址' },
            ]}
          >
            <Input placeholder="http://10.0.0.10:18080" />
          </Form.Item>
        </>
      ),
    },
    {
      title: '资源配置',
      children: (
        <>
          <Form.Item name="environment" label="环境">
            <Input />
          </Form.Item>
          <Form.Item name="owner" label="负责人">
            <Input />
          </Form.Item>
          <Form.Item name="team" label="团队">
            <Input />
          </Form.Item>
          <Form.Item name="cpuCoreCount" label="CPU 核数">
            <InputNumber min={1} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item name="memoryGiB" label="内存 GiB">
            <InputNumber min={1} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item name="diskGiB" label="磁盘 GiB">
            <InputNumber min={1} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item name="availablePortStart" label="端口池起始">
            <InputNumber min={1} max={65535} className="w-full" />
          </Form.Item>
          <Form.Item name="availablePortEnd" label="端口池结束">
            <InputNumber min={1} max={65535} className="w-full" />
          </Form.Item>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="接入方式">接入已有主机</Descriptions.Item>
            <Descriptions.Item label="Provider">Docker</Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
  ]

  return (
    <StepFormModal
      current={current}
      form={form}
      initialValues={initialValues}
      loading={saveMutation.isPending}
      onClose={onClose}
      onCurrentChange={setCurrent}
      onFinish={(values) => saveMutation.mutate(values)}
      open={open}
      steps={steps}
      submitText={editing ? '保存主机' : '接入主机'}
      title={editing ? '编辑运行时主机' : '接入运行时主机'}
      width={680}
    />
  )
}
