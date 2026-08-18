import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import type { StepFormStep } from '@/components/step-form'
import { virtualizationQueries } from '@/features/virtualization'
import { formatDateTime } from '@/utils/time'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerHost, DockerHostAgentInstallation, DockerHostInput } from '../docker-types'
import { compactRecord, refreshDocker } from '../shared/ui'

type RuntimeHostFormValues = Omit<
  DockerHostInput,
  'agentId' | 'architecture' | 'composeVersion' | 'dockerVersion' | 'ipAddress' | 'status'
> & {
  connectionMode?: 'quick' | 'manual'
  memoryGiB?: number
  diskGiB?: number
}

export function buildRuntimeHostPayload(values: RuntimeHostFormValues): DockerHostInput {
  const { connectionMode: _connectionMode, memoryGiB, diskGiB, ...host } = values
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
    connectionMode: 'manual',
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
  const [installation, setInstallation] = useState<DockerHostAgentInstallation | null>(null)
  const [form] = Form.useForm<RuntimeHostFormValues>()
  const connectionMode = Form.useWatch('connectionMode', form) ?? (editing ? 'manual' : 'quick')
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const virtualMachinesQuery = useQuery(virtualizationQueries.vms({ page: 1, pageSize: 500 }, open))
  const virtualMachines = Array.isArray(virtualMachinesQuery.data)
    ? virtualMachinesQuery.data
    : (virtualMachinesQuery.data?.items ?? [])
  const hostQuery = useQuery({
    ...dockerQueries.host(installation?.hostId ?? '', Boolean(installation)),
    refetchInterval: (query) => (hasAgentReport(query.state.data) ? false : 2_000),
  })
  const agentReported = hasAgentReport(hostQuery.data)
  const saveMutation = useMutation({
    mutationFn: async (values: RuntimeHostFormValues) => {
      const host = editing
        ? await dockerApi.updateHost(editing.id, buildRuntimeHostPayload(values))
        : await dockerApi.createHost(buildRuntimeHostPayload(values))
      if (!editing && values.connectionMode !== 'manual') {
        try {
          return { host, installation: await dockerApi.createHostAgentInstallation(host.id) }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          try {
            await dockerApi.deleteHost(host.id)
          } catch (cleanupError) {
            const cleanupDetail =
              cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            throw Object.assign(
              new Error(
                `${reason}；临时主机记录自动清理失败，请在主机列表中删除 ${host.name || host.id}。清理失败原因：${cleanupDetail}`,
              ),
              { cause: cleanupError },
            )
          }
          throw Object.assign(new Error(`${reason}；临时主机记录已自动清理。`), {
            cause: error,
          })
        }
      }
      return {
        host,
        installation: undefined,
      }
    },
    onSuccess: (result) => {
      refreshDocker(queryClient)
      onSuccess?.()
      if (result.installation) {
        setInstallation(result.installation)
        message.success('安装命令已生成')
      } else {
        message.success(editing ? '运行时主机已更新' : '运行时主机已接入')
      }
      form.resetFields()
      setCurrent(0)
      onClose()
    },
    onError: (error) =>
      void message.error(
        error.message.includes('临时主机记录')
          ? error.message
          : `运行时主机接入失败：${error.message}`,
      ),
  })

  const closeForm = () => {
    form.resetFields()
    saveMutation.reset()
    setCurrent(0)
    onClose()
  }

  useEffect(() => {
    if (open) setCurrent(0)
  }, [editing, open])

  useEffect(() => {
    if (agentReported) refreshDocker(queryClient)
  }, [agentReported, queryClient])

  const initialValues: RuntimeHostFormValues = editing
    ? runtimeHostFormValues(editing)
    : {
        connectionMode: 'quick',
        name: '',
        availablePortStart: 20000,
        availablePortEnd: 39999,
      }

  const steps: StepFormStep[] = [
    {
      title: 'Agent 连接',
      fieldNames:
        connectionMode === 'manual'
          ? ['connectionMode', 'name', 'endpoint']
          : ['connectionMode', 'name'],
      children: (
        <>
          {!editing ? (
            <Form.Item name="connectionMode" label="接入方式" rules={[{ required: true }]}>
              <Segmented
                block
                options={[
                  { label: '快速安装 Agent', value: 'quick' },
                  { label: '已有 Agent', value: 'manual' },
                ]}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          {connectionMode === 'manual' ? (
            <Form.Item
              name="endpoint"
              label="Agent Endpoint"
              tooltip="Soha Server 可访问的 Soha Agent HTTP 地址。其余运行时信息会在 Agent 上报后自动更新。"
              rules={[
                { required: true, message: '请输入 Agent Endpoint' },
                { type: 'url', message: '请输入有效的 HTTP 或 HTTPS 地址' },
              ]}
            >
              <Input placeholder="http://10.0.0.10:18080" />
            </Form.Item>
          ) : (
            <Alert
              showIcon
              type="info"
              title="保存后生成限时安装命令"
              description="Agent 上报后会自动填写 Endpoint、Agent ID、IP、架构以及 Docker/Compose 版本。"
            />
          )}
        </>
      ),
    },
    {
      title: '资源配置',
      children: (
        <>
          <div className="soha-runtime-host-ownership-grid">
            <Form.Item name="environment" label="环境">
              <Input />
            </Form.Item>
            <Form.Item name="owner" label="负责人">
              <Input />
            </Form.Item>
            <Form.Item name="team" label="团队">
              <Input />
            </Form.Item>
          </div>
          <Form.Item
            className="soha-runtime-host-vm-field"
            name="vmId"
            label="关联虚拟机"
            tooltip="关联到 Soha 已管理的虚拟机，用于从运行时主机返回虚拟机资源。裸机可不选择。"
          >
            <Select
              allowClear
              loading={virtualMachinesQuery.isLoading}
              options={virtualMachines
                .filter((vm) => vm.status?.toLowerCase() !== 'deleted')
                .map((vm) => ({
                  label: [vm.name, vm.connectionName ?? vm.provider].filter(Boolean).join(' · '),
                  value: vm.id,
                }))}
              placeholder="选择 Soha 已管理的虚拟机"
              showSearch={{ optionFilterProp: 'label' }}
              onChange={(vmId) => {
                const vm = virtualMachines.find((item) => item.id === vmId)
                form.setFieldsValue({
                  virtualizationConnectionId: vm?.connectionId,
                  vmName: vm?.name,
                })
              }}
            />
          </Form.Item>
          <Form.Item name="virtualizationConnectionId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="vmName" hidden>
            <Input />
          </Form.Item>
          <div className="soha-runtime-host-capacity-grid">
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
          </div>
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
          >
            <Descriptions.Item label="接入方式">
              {connectionMode === 'manual' ? '已有 Agent' : '快速安装 Agent'}
            </Descriptions.Item>
            <Descriptions.Item label="Provider">Docker</Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
  ]

  return (
    <>
      <StepFormModal
        current={current}
        form={form}
        initialValues={initialValues}
        loading={saveMutation.isPending}
        onClose={closeForm}
        onCurrentChange={setCurrent}
        onFinish={(values) => saveMutation.mutate(values)}
        open={open}
        steps={steps}
        submitText={
          editing ? '保存主机' : connectionMode === 'manual' ? '接入主机' : '生成安装命令'
        }
        title={editing ? '编辑运行时主机' : '接入运行时主机'}
        width={680}
      />
      <Modal
        destroyOnHidden
        footer={<Button onClick={() => setInstallation(null)}>关闭</Button>}
        mask={{ closable: false }}
        open={Boolean(installation)}
        title="快速安装 Agent"
        width={680}
        onCancel={() => setInstallation(null)}
      >
        <div className="space-y-4">
          <Alert
            showIcon
            type={agentReported ? 'success' : 'info'}
            title={agentReported ? 'Agent 已上报' : '等待 Agent 上报'}
            description={
              agentReported
                ? '运行时主机信息已自动更新。'
                : '安装票据有效期内，在目标 Linux 主机执行下列命令。'
            }
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Typography.Text strong>安装命令</Typography.Text>
              <Typography.Text
                copyable={{ text: installation?.command ?? '', tooltips: ['复制命令', '已复制'] }}
              >
                复制
              </Typography.Text>
            </div>
            <Input.TextArea
              aria-label="Agent 安装命令"
              autoSize={{ minRows: 3, maxRows: 6 }}
              readOnly
              value={installation?.command ?? ''}
            />
            <Typography.Text type="secondary">
              有效期至 {formatDateTime(installation?.expiresAt)}
            </Typography.Text>
          </div>
          {agentReported ? (
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
              items={[
                { key: 'agentId', label: 'Agent ID', children: hostQuery.data?.agentId || '-' },
                { key: 'endpoint', label: 'Endpoint', children: hostQuery.data?.endpoint || '-' },
                { key: 'ipAddress', label: 'IP 地址', children: hostQuery.data?.ipAddress || '-' },
                {
                  key: 'architecture',
                  label: '架构',
                  children: hostQuery.data?.architecture || '-',
                },
                {
                  key: 'dockerVersion',
                  label: 'Docker 版本',
                  children: hostQuery.data?.dockerVersion || '-',
                },
                {
                  key: 'composeVersion',
                  label: 'Compose 版本',
                  children: hostQuery.data?.composeVersion || '-',
                },
              ]}
            />
          ) : null}
        </div>
      </Modal>
    </>
  )
}

function hasAgentReport(host: DockerHost | undefined): boolean {
  return Boolean(host?.agentId && host.endpoint && host.dockerVersion)
}
