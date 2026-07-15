import { useEffect, useState } from 'react'
import { App, Descriptions, Form, Input, InputNumber, Radio, Select } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StepFormModal } from '@/components/step-form-modal'
import type { StepFormStep } from '@/components/step-form'
import { useWorkbenchModuleEnabled } from '@/features/modules'
import {
  virtualizationQueries,
  type VirtualizationCluster,
  type VirtualizationImage,
  type VirtualizationPage,
} from '@/features/virtualization'
import { dockerApi } from '../docker-api'
import type { DockerHost, DockerHostInput, DockerQuickCreateHostInput } from '../docker-types'
import {
  ARCHITECTURE_OPTIONS,
  compactRecord,
  formatBytes,
  refreshDocker,
  useDockerPermissions,
} from '../shared/ui'

type RuntimeHostCreateMode = 'existing' | 'provision'

type RuntimeHostCreateValues = Omit<DockerHostInput, 'config'> &
  Omit<DockerQuickCreateHostInput, 'config'> & {
    mode: RuntimeHostCreateMode
    memoryGiB?: number
    diskGiB?: number
  }

function virtualizationItems<T>(data: VirtualizationPage<T> | T[] | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.items ?? [])
}

function isProvisionConnection(item: VirtualizationCluster) {
  const provider = String(item.provider || '').toLowerCase()
  return item.enabled !== false && (provider === 'pve' || provider === 'kubevirt')
}

function isProvisionImage(item: VirtualizationImage) {
  const provider = String(item.provider || '').toLowerCase()
  const sourceKind = String(item.sourceKind || item.assetKind || '').toLowerCase()
  if (provider === 'pve') return ['', 'template', 'iso'].includes(sourceKind)
  if (provider === 'kubevirt') {
    return ['', 'datasource', 'pvc', 'containerdisk', 'container_disk'].includes(sourceKind)
  }
  return false
}

function buildExistingHostPayload(values: RuntimeHostCreateValues): DockerHostInput {
  const {
    mode: _mode,
    memoryGiB,
    diskGiB,
    cloudInit: _cloudInit,
    flavorId: _flavorId,
    imageId: _imageId,
    ttlSeconds: _ttlSeconds,
    vmTemplateId: _vmTemplateId,
    ...host
  } = values
  return compactRecord({
    ...host,
    memoryBytes: memoryGiB ? Math.round(memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: diskGiB ? Math.round(diskGiB * 1024 ** 3) : values.diskBytes,
  })
}

function buildProvisionHostPayload(values: RuntimeHostCreateValues): DockerQuickCreateHostInput {
  const {
    mode: _mode,
    memoryGiB,
    diskGiB,
    endpoint: _endpoint,
    agentId: _agentId,
    dockerVersion: _dockerVersion,
    composeVersion: _composeVersion,
    ipAddress: _ipAddress,
    status: _status,
    vmId: _vmId,
    vmName: _vmName,
    ...host
  } = values
  return compactRecord({
    ...host,
    memoryBytes: memoryGiB ? Math.round(memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: diskGiB ? Math.round(diskGiB * 1024 ** 3) : values.diskBytes,
  })
}

interface RuntimeHostStepModalProps {
  editing?: DockerHost | null
  initialMode?: RuntimeHostCreateMode
  onClose: () => void
  onSuccess?: () => void
  open: boolean
}

function existingHostFormValues(record: DockerHost): RuntimeHostCreateValues {
  return {
    mode: 'existing',
    name: record.name,
    status: record.status,
    endpoint: record.endpoint,
    architecture: record.architecture,
    agentId: record.agentId,
    ipAddress: record.ipAddress,
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
    dockerVersion: record.dockerVersion,
    composeVersion: record.composeVersion,
  }
}

export function RuntimeHostStepModal({
  editing,
  initialMode = 'existing',
  onClose,
  onSuccess,
  open,
}: RuntimeHostStepModalProps) {
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm<RuntimeHostCreateValues>()
  const mode = Form.useWatch('mode', form) ?? 'existing'
  const connectionID = Form.useWatch('virtualizationConnectionId', form)
  const selectedImageID = Form.useWatch('imageId', form)
  const { canManageHosts } = useDockerPermissions()
  const { moduleEnabled: virtualizationModuleEnabled } = useWorkbenchModuleEnabled('virtualization')
  const clustersQuery = useQuery(
    virtualizationQueries.clusters(canManageHosts && virtualizationModuleEnabled),
  )
  const imagesQuery = useQuery(
    virtualizationQueries.images(
      { page: 1, pageSize: 500 },
      canManageHosts && virtualizationModuleEnabled,
    ),
  )
  const flavorsQuery = useQuery(
    virtualizationQueries.flavors(canManageHosts && virtualizationModuleEnabled),
  )
  const connections = (clustersQuery.data ?? []).filter(isProvisionConnection)
  const images = virtualizationItems(imagesQuery.data).filter(isProvisionImage)
  const flavors = (flavorsQuery.data ?? []).filter((item) => item.enabled !== false)
  const selectedConnection = connections.find((item) => item.id === connectionID)
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const saveMutation = useMutation({
    mutationFn: async (values: RuntimeHostCreateValues): Promise<unknown> => {
      if (editing) return dockerApi.updateHost(editing.id, buildExistingHostPayload(values))
      if (values.mode === 'provision') {
        return dockerApi.quickCreateHost(buildProvisionHostPayload(values))
      }
      return dockerApi.createHost(buildExistingHostPayload(values))
    },
    onSuccess: (_result, values) => {
      message.success(
        editing
          ? '运行时主机已更新'
          : values.mode === 'provision'
            ? '主机构建任务已提交'
            : '运行时主机已接入',
      )
      refreshDocker(queryClient)
      onSuccess?.()
      onClose()
    },
  })

  useEffect(() => {
    if (!open) return
    setCurrent(0)
    form.setFieldsValue(
      editing
        ? existingHostFormValues(editing)
        : {
            mode: initialMode,
            architecture: 'amd64',
            status: 'pending',
            cpuCoreCount: 4,
            memoryGiB: 8,
            diskGiB: 80,
            availablePortStart: 20000,
            availablePortEnd: 39999,
          },
    )
  }, [editing, form, initialMode, open])

  useEffect(() => {
    if (!selectedImageID) return
    const image = images.find((item) => item.id === selectedImageID)
    const sourceKind = String(image?.sourceKind || image?.assetKind || '').toLowerCase()
    form.setFieldValue(
      'vmTemplateId',
      image?.provider === 'pve' && sourceKind === 'template' ? image.sourceRef : undefined,
    )
  }, [form, images, selectedImageID])
  const steps: StepFormStep[] = [
    {
      title: '接入方式',
      fieldNames: ['mode', 'name'],
      children: (
        <>
          <Form.Item
            name="mode"
            label="接入方式"
            rules={[{ required: true, message: '请选择接入方式' }]}
          >
            <Radio.Group
              disabled={Boolean(editing)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: '接入已有主机', value: 'existing' },
                { label: '从虚拟化资源构建', value: 'provision' },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="architecture" label="架构">
            <Select options={ARCHITECTURE_OPTIONS} />
          </Form.Item>
        </>
      ),
    },
    {
      title: mode === 'provision' ? '虚拟化资源' : '主机连接',
      fieldNames:
        mode === 'provision'
          ? ['virtualizationConnectionId', 'imageId']
          : ['endpoint', 'agentId', 'ipAddress'],
      children:
        mode === 'provision' ? (
          <>
            <Form.Item
              name="virtualizationConnectionId"
              label="虚拟化连接"
              rules={[{ required: true, message: '请选择虚拟化连接' }]}
            >
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                loading={clustersQuery.isLoading}
                options={connections.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.provider})`,
                }))}
                onChange={() => form.setFieldsValue({ imageId: undefined, flavorId: undefined })}
              />
            </Form.Item>
            <Form.Item
              name="imageId"
              label="镜像 / 模板"
              rules={[{ required: true, message: '请选择镜像或模板' }]}
            >
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                disabled={!connectionID}
                loading={imagesQuery.isLoading}
                options={images
                  .filter((item) => !connectionID || item.connectionId === connectionID)
                  .map((item) => ({
                    value: item.id,
                    label: [item.name || item.id, item.sourceKind || item.assetKind]
                      .filter(Boolean)
                      .join(' / '),
                  }))}
              />
            </Form.Item>
            <Form.Item name="vmTemplateId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="flavorId" label="规格">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                loading={flavorsQuery.isLoading}
                options={flavors.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.cpu}C / ${formatBytes(item.memoryMiB * 1024 ** 2)})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="network" label="网络">
              <Input placeholder={selectedConnection?.provider === 'pve' ? 'vmbr0' : 'pod'} />
            </Form.Item>
            <Form.Item name="cloudInit" label="Cloud-init 用户数据">
              <Input.TextArea rows={6} spellCheck={false} placeholder="#cloud-config" />
            </Form.Item>
            {selectedConnection?.provider === 'pve' ? (
              <>
                <Form.Item
                  name={['config', 'providerParams', 'snippetStorage']}
                  label="PVE Snippet Storage"
                >
                  <Input placeholder="local" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'controlPlaneBaseURL']}
                  label="控制面地址"
                >
                  <Input placeholder="http://10.0.3.x:8080" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'runtimeEndpoint']}
                  label="Agent Endpoint"
                >
                  <Input placeholder="http://__SOHA_VM_IP__:18080" />
                </Form.Item>
                <Form.Item
                  name={['config', 'providerParams', 'agentInstallScript']}
                  label="Agent 安装脚本"
                >
                  <Input.TextArea rows={3} spellCheck={false} />
                </Form.Item>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Form.Item name="endpoint" label="Endpoint">
              <Input placeholder="tcp://10.0.0.10:2376" />
            </Form.Item>
            <Form.Item name="agentId" label="Agent ID">
              <Input />
            </Form.Item>
            <Form.Item name="ipAddress" label="IP 地址">
              <Input />
            </Form.Item>
            <Form.Item name="dockerVersion" label="Docker 版本">
              <Input />
            </Form.Item>
            <Form.Item name="composeVersion" label="Compose 版本">
              <Input />
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
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="memoryGiB" label="内存 GiB">
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="diskGiB" label="磁盘 GiB">
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="availablePortStart" label="端口池起始">
            <InputNumber min={1} max={65535} className="w-full" />
          </Form.Item>
          <Form.Item name="availablePortEnd" label="端口池结束">
            <InputNumber min={1} max={65535} className="w-full" />
          </Form.Item>
          {mode === 'provision' ? (
            <Form.Item name="ttlSeconds" label="有效期秒数">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          ) : null}
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="接入方式">
              {mode === 'provision' ? '从虚拟化资源构建' : '接入已有主机'}
            </Descriptions.Item>
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
      loading={saveMutation.isPending}
      onClose={onClose}
      onCurrentChange={setCurrent}
      onFinish={(values) => saveMutation.mutate(values)}
      open={open}
      steps={steps}
      submitText={editing ? '保存主机' : mode === 'provision' ? '提交构建' : '接入主机'}
      title={editing ? '编辑运行时主机' : '新增运行时主机'}
      width={760}
    />
  )
}
